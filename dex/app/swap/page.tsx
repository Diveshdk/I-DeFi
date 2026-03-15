"use client";

import { useState, useCallback, useEffect, useMemo, Suspense } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { useSearchParams } from "next/navigation";
import { ethers } from "ethers";
import {
  TOKEN_LIST, SWAP_ROUTER, SWAP_ROUTER_ABI, QUOTER_V2, QUOTER_V2_ABI,
  ERC20_ABI, FEE_TIERS, FeeTier, basePublicClient,
  Token, formatAmount, parseAmount, getTokenByAddress,
} from "../lib/contracts";
import { getInjectedSigner, isUserRejection } from "../lib/injectedSigner";
import { usePrices, formatUsd } from "../lib/priceService";

const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
const HISTORY_KEY = "crossdex_swap_history";
const SLIPPAGE_BPS = 50n; // 0.5% default slippage tolerance

interface QuoteResult {
  amountOut: bigint;
  fee: FeeTier;
  feePct: string;
}

// ── V3 Quote helper (uses dedicated Base mainnet client — chain-independent) ──
async function getV3Quote(
  tokenIn: string,
  tokenOut: string,
  amountIn: bigint,
): Promise<QuoteResult | null> {
  if (amountIn === 0n || tokenIn.toLowerCase() === tokenOut.toLowerCase()) return null;

  const attempts = await Promise.allSettled(
    FEE_TIERS.map(async (fee) => {
      const res = await basePublicClient.simulateContract({
        address: QUOTER_V2 as `0x${string}`,
        abi: QUOTER_V2_ABI,
        functionName: "quoteExactInputSingle",
        args: [{
          tokenIn:           tokenIn as `0x${string}`,
          tokenOut:          tokenOut as `0x${string}`,
          amountIn,
          fee,
          sqrtPriceLimitX96: 0n,
        }],
      });
      const amountOut = ((res.result as unknown) as bigint[])[0];
      return { amountOut, fee };
    }),
  );

  const valid = attempts
    .filter((r): r is PromiseFulfilledResult<{ amountOut: bigint; fee: FeeTier }> =>
      r.status === "fulfilled" && r.value.amountOut > 0n)
    .map(r => r.value);

  if (valid.length === 0) return null;
  const best = valid.reduce((a, b) => b.amountOut > a.amountOut ? b : a);
  return {
    ...best,
    feePct: best.fee === 100 ? "0.01%" : best.fee === 500 ? "0.05%" : best.fee === 3000 ? "0.30%" : "1.00%",
  };
}

// ── Token Selector Dropdown ───────────────────────────────────────────────────
function TokenSelector({
  token, exclude, onChange, label,
}: {
  token: Token; exclude: string; onChange: (t: Token) => void; label: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <div className="token-input-label">{label}</div>
      <button className="token-select-btn" onClick={() => setOpen(!open)}>
        <span style={{ fontSize: 16 }}>{token.emoji}</span>
        {token.symbol}
        <span style={{ fontSize: 10 }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0,
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)", zIndex: 100, minWidth: 180,
          boxShadow: "0 12px 40px rgba(0,0,0,0.6)", overflow: "hidden",
        }}>
          {TOKEN_LIST.filter(t => t.address !== exclude).map(t => (
            <button
              key={t.address}
              onClick={() => { onChange(t); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%", padding: "10px 14px",
                background: token.address === t.address ? "var(--bg-hover)" : "transparent",
                border: "none", color: "var(--text-primary)",
                cursor: "pointer", fontFamily: "inherit",
                fontSize: 13, fontWeight: 600, textAlign: "left",
                transition: "background 0.12s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
              onMouseLeave={e => (e.currentTarget.style.background = token.address === t.address ? "var(--bg-hover)" : "transparent")}
            >
              <span style={{ fontSize: 18 }}>{t.emoji}</span>
              <span>{t.symbol}</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-muted)" }}>{t.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Swap inner (needs Suspense for useSearchParams) ───────────────────────────
function SwapInner() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const searchParams = useSearchParams();

  const initialTokenIn = useMemo(() => {
    const addr = searchParams.get("tokenIn");
    return addr ? (getTokenByAddress(addr) ?? TOKEN_LIST[0]) : TOKEN_LIST[0];
  }, [searchParams]);

  const initialTokenOut = useMemo(() => {
    const addr = searchParams.get("tokenOut");
    if (addr) {
      const found = getTokenByAddress(addr);
      if (found && found.address !== initialTokenIn.address) return found;
    }
    return TOKEN_LIST.find(t => t.address !== initialTokenIn.address) ?? TOKEN_LIST[1];
  }, [searchParams, initialTokenIn]);

  const [tokenIn, setTokenIn] = useState<Token>(initialTokenIn);
  const [tokenOut, setTokenOut] = useState<Token>(initialTokenOut);
  const [amountIn, setAmountIn] = useState("");
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [noLiquidity, setNoLiquidity] = useState(false);
  const [balanceIn, setBalanceIn] = useState(0n);
  const [balanceOut, setBalanceOut] = useState(0n);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const allIds = useMemo(() => TOKEN_LIST.map(t => t.coingeckoId), []);
  const { prices } = usePrices(allIds);

  // ── Fetch balances ──────────────────────────────────────────────────────────
  const fetchBalances = useCallback(async () => {
    if (!publicClient || !address) return;
    try {
      const [bIn, bOut] = await Promise.all([
        publicClient.readContract({ address: tokenIn.address as `0x${string}`, abi: ERC20_ABI, functionName: "balanceOf", args: [address] }).catch(() => 0n) as Promise<bigint>,
        publicClient.readContract({ address: tokenOut.address as `0x${string}`, abi: ERC20_ABI, functionName: "balanceOf", args: [address] }).catch(() => 0n) as Promise<bigint>,
      ]);
      setBalanceIn(bIn);
      setBalanceOut(bOut);
    } catch { /* ignore */ }
  }, [publicClient, address, tokenIn, tokenOut]);

  useEffect(() => { fetchBalances(); }, [fetchBalances]);

  // ── V3 Quote ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const run = async () => {
      const amtIn = parseAmount(amountIn, tokenIn.decimals);
      if (amtIn === 0n) { setQuote(null); setNoLiquidity(false); return; }

      setQuoting(true);
      setNoLiquidity(false);
      try {
        const result = await getV3Quote(tokenIn.address, tokenOut.address, amtIn);
        if (result) { setQuote(result); setNoLiquidity(false); }
        else { setQuote(null); setNoLiquidity(true); }
      } catch { setQuote(null); setNoLiquidity(true); }
      finally { setQuoting(false); }
    };

    const timer = setTimeout(run, 500);
    return () => clearTimeout(timer);
  }, [amountIn, tokenIn, tokenOut, publicClient]);

  // ── Swap handler (uses injected provider so MetaMask opens; rejection keeps UI usable) ──
  const handleSwap = async () => {
    if (!address || !amountIn || !quote) return;
    setLoading(true);
    setStatus(null);
    setTxHash(null);

    try {
      const signer = await getInjectedSigner();
      if (!signer) {
        setStatus({ type: "error", msg: "Wallet not available. Unlock MetaMask or install an injected wallet." });
        return;
      }
      const amtIn = parseAmount(amountIn, tokenIn.decimals);

      // Apply slippage tolerance
      const amtOutMin = quote.amountOut - (quote.amountOut * SLIPPAGE_BPS / 10000n);

      const isNativeETH = tokenIn.symbol === "WETH"; // treat WETH as native ETH in

      // Approve if paying with ERC-20
      if (!isNativeETH && publicClient) {
        const allowance = await publicClient.readContract({
          address: tokenIn.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [address, SWAP_ROUTER as `0x${string}`],
        }).catch(() => 0n) as bigint;

        if (allowance < amtIn) {
          setStatus({ type: "success", msg: "Requesting token approval…" });
          const erc20 = new ethers.Contract(tokenIn.address, ERC20_ABI, signer);
          const appTx = await erc20.approve(SWAP_ROUTER, MAX_UINT256);
          await appTx.wait();
          setStatus({ type: "success", msg: "Approved — submitting swap…" });
        }
      }

      const router = new ethers.Contract(SWAP_ROUTER, SWAP_ROUTER_ABI, signer);
      const params = {
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        fee: quote.fee,
        recipient: address,
        amountIn: amtIn,
        amountOutMinimum: amtOutMin,
        sqrtPriceLimitX96: 0n,
      };

      const tx = await router.exactInputSingle(
        params,
        isNativeETH ? { value: amtIn } : {},
      );

      setStatus({ type: "success", msg: "Swap submitted — waiting for confirmation…" });
      const receipt = await tx.wait();
      const hash = (receipt?.hash ?? tx.hash) as string;
      setTxHash(hash);

      // Save to swap history
      try {
        const prev = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as object[];
        prev.push({ hash, tokenIn: tokenIn.symbol, tokenOut: tokenOut.symbol, amountIn, timestamp: Date.now() });
        localStorage.setItem(HISTORY_KEY, JSON.stringify(prev.slice(-50)));
      } catch { /* ignore */ }

      setStatus({ type: "success", msg: `✓ Swapped ${amountIn} ${tokenIn.symbol} → ${formatAmount(quote.amountOut, tokenOut.decimals, 4)} ${tokenOut.symbol}` });
      setAmountIn("");
      setQuote(null);
      setTimeout(fetchBalances, 2000);
    } catch (err: unknown) {
      if (isUserRejection(err)) {
        setStatus({ type: "error", msg: "Transaction rejected in wallet. You can try again." });
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus({ type: "error", msg: msg.slice(0, 160) || "Transaction failed." });
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Flip tokens ─────────────────────────────────────────────────────────────
  const flip = () => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setAmountIn("");
    setQuote(null);
    setNoLiquidity(false);
  };

  const setMax = () => {
    setAmountIn(formatAmount(balanceIn, tokenIn.decimals, 6));
  };

  const amtInNum = Number(amountIn) || 0;
  const usdIn = amtInNum * (prices[tokenIn.coingeckoId] ?? 0);
  const amtOut = quote ? Number(formatAmount(quote.amountOut, tokenOut.decimals, 6)) : 0;
  const usdOut = amtOut * (prices[tokenOut.coingeckoId] ?? 0);

  const btnLabel = () => {
    if (!isConnected) return "Connect Wallet";
    if (quoting) return "Getting quote…";
    if (noLiquidity) return "No liquidity for this pair";
    if (!amountIn || amtInNum <= 0) return "Enter an amount";
    if (amtInNum > Number(formatAmount(balanceIn, tokenIn.decimals, 6))) return "Insufficient balance";
    if (!quote) return "Enter an amount";
    if (loading) return "Swapping…";
    return `Swap ${tokenIn.symbol} → ${tokenOut.symbol}`;
  };

  const canSwap = isConnected && quote && amountIn && amtInNum > 0 && !loading && !quoting;

  return (
    <div className="main-content">
      <div style={{ width: "100%", maxWidth: 460 }}>
        {/* Page title */}
        <div className="page-header">
          <h1>Swap</h1>
          <p>Trade tokens instantly via Uniswap V3 on Base · 0.5% slippage</p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: "20px" }}>
          {/* Header */}
          <div className="card-title">
            <span>Exchange</span>
            <span className="badge badge-blue" style={{ fontSize: 11 }}>
              {quote ? `V3 · ${quote.feePct}` : "V3 · Uniswap"}
            </span>
          </div>

          {/* Token In */}
          <div className="token-input-wrap">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div className="token-input-label">You Pay</div>
              <TokenSelector
                token={tokenIn}
                exclude={tokenOut.address}
                onChange={t => { setTokenIn(t); setAmountIn(""); setQuote(null); }}
                label=""
              />
            </div>
            <div className="token-input-row" style={{ marginTop: 6 }}>
              <input
                className="token-amount-input"
                type="number"
                placeholder="0.0"
                value={amountIn}
                onChange={e => setAmountIn(e.target.value)}
                min="0"
              />
            </div>
            <div className="token-balance-row">
              <span style={{ color: usdIn > 0 ? "var(--text-muted)" : "transparent" }}>
                ≈ {formatUsd(usdIn)}
              </span>
              <span>
                Balance: {formatAmount(balanceIn, tokenIn.decimals, 4)}
                {" "}
                {balanceIn > 0n && (
                  <span onClick={setMax} style={{ cursor: "pointer", color: "var(--accent)", fontWeight: 700 }}>MAX</span>
                )}
              </span>
            </div>
          </div>

          {/* Flip arrow */}
          <div style={{ display: "flex", justifyContent: "center", margin: "4px 0" }}>
            <button className="swap-arrow-btn" onClick={flip} title="Flip tokens">⇅</button>
          </div>

          {/* Token Out */}
          <div className="token-input-wrap" style={{ background: "var(--bg-base)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div className="token-input-label">You Receive</div>
              <TokenSelector
                token={tokenOut}
                exclude={tokenIn.address}
                onChange={t => { setTokenOut(t); setQuote(null); }}
                label=""
              />
            </div>
            <div className="token-input-row" style={{ marginTop: 6 }}>
              <div style={{
                flex: 1, fontSize: 22, fontWeight: 700,
                color: quoting ? "var(--text-muted)"
                  : noLiquidity ? "var(--red)"
                  : quote ? "var(--green)"
                  : "var(--text-muted)",
              }}>
                {quoting ? "…"
                  : noLiquidity ? "No liquidity"
                  : quote ? formatAmount(quote.amountOut, tokenOut.decimals, 6)
                  : "0.0"}
              </div>
            </div>
            <div className="token-balance-row">
              <span style={{ color: usdOut > 0 ? "var(--text-muted)" : "transparent" }}>
                ≈ {formatUsd(usdOut)}
              </span>
              <span>Balance: {formatAmount(balanceOut, tokenOut.decimals, 4)}</span>
            </div>
          </div>

          {/* Info panel */}
          {quote && (
            <div className="info-panel">
              <div className="info-row">
                <span>Pool Fee</span>
                <span>{quote.feePct}</span>
              </div>
              <div className="info-row">
                <span>Rate</span>
                <span>
                  1 {tokenIn.symbol} = {(amtOut / amtInNum).toFixed(4)} {tokenOut.symbol}
                </span>
              </div>
              <div className="info-row">
                <span>Min Received (0.5% slippage)</span>
                <span>{formatAmount(quote.amountOut - (quote.amountOut * SLIPPAGE_BPS / 10000n), tokenOut.decimals, 4)} {tokenOut.symbol}</span>
              </div>
              <div className="info-row">
                <span>Protocol</span>
                <span>Uniswap V3 on Base</span>
              </div>
            </div>
          )}

          {/* Status */}
          {status && (
            <div className={`alert alert-${status.type}`} style={{ marginTop: 12 }}>
              {status.msg}
              {txHash && (
                <>  &nbsp;
                  <a
                    href={`https://basescan.org/tx/${txHash}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ color: "inherit", fontWeight: 700 }}
                  >View on Basescan ↗</a>
                </>
              )}
            </div>
          )}

          {/* Swap button */}
          <button
            className="btn-primary"
            style={{ marginTop: 14 }}
            onClick={handleSwap}
            disabled={!canSwap}
          >
            {loading ? <><span className="spinner" /> {btnLabel()}</> : btnLabel()}
          </button>
        </div>

        <div style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: "var(--text-muted)" }}>
          ⚡ Powered by Uniswap V3 on Base · Real on-chain swaps
        </div>
      </div>
    </div>
  );
}

export default function SwapPage() {
  return (
    <Suspense fallback={
      <div className="main-content" style={{ textAlign: "center", paddingTop: 60 }}>
        <div className="spinner" />
      </div>
    }>
      <SwapInner />
    </Suspense>
  );
}

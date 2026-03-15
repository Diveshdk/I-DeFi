"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useAccount } from "wagmi";
import { ethers } from "ethers";
import {
  TOKEN_LIST, SWAP_ROUTER, SWAP_ROUTER_ABI, QUOTER_V2, QUOTER_V2_ABI,
  ERC20_ABI, FEE_TIERS, FeeTier, basePublicClient,
  Token, parseAmount, formatAmount,
} from "./lib/contracts";
import { getInjectedSigner, isUserRejection } from "./lib/injectedSigner";
import { usePrices, formatUsd } from "./lib/priceService";
import { useTestMode } from "./contexts/TestModeContext";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MarketToken {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
  emoji: string;
  color: string;
  address?: string;
  rank?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3)  return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function PriceChange({ v }: { v: number }) {
  const up = v >= 0;
  return (
    <span className={up ? "change-up" : "change-down"}>
      {up ? "▲" : "▼"} {Math.abs(v).toFixed(2)}%
    </span>
  );
}

// ── BUY MODAL ─────────────────────────────────────────────────────────────────

const TEST_TXS_KEY = "I-DeFI_test_txs";
const TEST_MODE_PAY_ETH = "0.001";

function BuyModal({ token, onClose }: { token: MarketToken; onClose: () => void }) {
  const { address, isConnected } = useAccount();
  const { isTestMode } = useTestMode();
  // We use getInjectedSigner() so MetaMask (or the active wallet) opens when the user confirms. Rejection is handled and UI stays usable.

  const ids = useMemo(() => TOKEN_LIST.map(t => t.coingeckoId), []);
  const { prices } = usePrices(ids);

  const [payToken, setPayToken] = useState<"ETH" | Token>("ETH");
  const [amountIn, setAmountIn] = useState("");
  const [quoteOut, setQuoteOut] = useState<string>("");
  const [bestFee, setBestFee] = useState<FeeTier>(3000);
  const [quoting, setQuoting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // The local token entry for buyToken (so we can get address + decimals)
  const localToken: Token | undefined = TOKEN_LIST.find(
    t => t.symbol.toUpperCase() === token.symbol.toUpperCase()
  );
  const WETH = TOKEN_LIST.find(t => t.symbol === "WETH")!;

  // Quote using Uniswap V3 QuoterV2 (tries all fee tiers, picks best)
  useEffect(() => {
    const run = async () => {
      if (!amountIn || Number(amountIn) <= 0 || !localToken) {
        setQuoteOut("");
        return;
      }
      setQuoting(true);
      try {
        const tokenInAddr = payToken === "ETH" ? WETH.address : (payToken as Token).address;
        const decimalsIn  = payToken === "ETH" ? 18 : (payToken as Token).decimals;
        const amtIn = parseAmount(amountIn, decimalsIn);
        if (amtIn === 0n || tokenInAddr === localToken.address) { setQuoteOut(""); setQuoting(false); return; }

        const results: { amountOut: bigint; fee: FeeTier }[] = [];
        await Promise.allSettled(
          FEE_TIERS.map(async (fee) => {
            const res = await basePublicClient.simulateContract({
              address: QUOTER_V2 as `0x${string}`,
              abi: QUOTER_V2_ABI,
              functionName: "quoteExactInputSingle",
              args: [{ tokenIn: tokenInAddr as `0x${string}`, tokenOut: localToken.address as `0x${string}`, amountIn: amtIn, fee, sqrtPriceLimitX96: 0n }],
            });
            const out = ((res.result as unknown) as bigint[])[0];
            if (out > 0n) results.push({ amountOut: out, fee });
          }),
        );

        if (results.length === 0) { setQuoteOut("No liquidity"); return; }
        const best = results.reduce((a, b) => b.amountOut > a.amountOut ? b : a);
        setBestFee(best.fee);
        setQuoteOut(formatAmount(best.amountOut, localToken.decimals, 4));
      } catch { setQuoteOut("No liquidity"); }
      finally { setQuoting(false); }
    };
    const t = setTimeout(run, 400);
    return () => clearTimeout(t);
  }, [amountIn, payToken, localToken, WETH.address]);

  const handleBuy = async () => {
    if (!address || !localToken || !amountIn || quoteOut === "No liquidity" || !quoteOut) return;
    setLoading(true);
    setStatus(null);
    setTxHash(null);

    try {
      if (isTestMode) {
        const numIn = Number(amountIn) || 1;
        const numOut = Number(quoteOut) || 0;
        const testOut = numIn > 0 ? ((numOut * 0.001) / numIn).toFixed(4) : "0";
        try {
          const prev = JSON.parse(localStorage.getItem(TEST_TXS_KEY) ?? "[]") as { tokenIn: string; tokenOut: string; amountIn: string; amountOut: string; timestamp: number }[];
          prev.push({
            tokenIn: payToken === "ETH" ? "ETH" : (payToken as Token).symbol,
            tokenOut: localToken.symbol,
            amountIn: TEST_MODE_PAY_ETH,
            amountOut: testOut,
            timestamp: Date.now(),
          });
          localStorage.setItem(TEST_TXS_KEY, JSON.stringify(prev.slice(-100)));
        } catch { /* ignore */ }
        setStatus({ type: "success", msg: `✓ Test: ${TEST_MODE_PAY_ETH} ETH → ${testOut} ${localToken.symbol} (see Profile)` });
        setLoading(false);
        return;
      }

      const signer = await getInjectedSigner();
      if (!signer) {
        setStatus({ type: "error", msg: "Wallet not available. Unlock MetaMask or install an injected wallet." });
        setLoading(false);
        return;
      }
      const MAX_UINT = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

      const isNativeETH = payToken === "ETH";
      const tokenInAddr = isNativeETH ? WETH.address : (payToken as Token).address;
      const decimalsIn  = isNativeETH ? 18 : (payToken as Token).decimals;
      const amtIn = parseAmount(amountIn, decimalsIn);
      const tokenInSym = isNativeETH ? "ETH" : (payToken as Token).symbol;

      if (!isNativeETH) {
        const allowance = await basePublicClient.readContract({
          address: tokenInAddr as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [address, SWAP_ROUTER as `0x${string}`],
        }).catch(() => 0n) as bigint;
        if (allowance < amtIn) {
          setStatus({ type: "success", msg: "Requesting token approval…" });
          const erc20 = new ethers.Contract(tokenInAddr, ERC20_ABI, signer);
          await (await erc20.approve(SWAP_ROUTER, MAX_UINT)).wait();
        }
      }

      const router = new ethers.Contract(SWAP_ROUTER, SWAP_ROUTER_ABI, signer);
      const params = {
        tokenIn: tokenInAddr,
        tokenOut: localToken.address,
        fee: bestFee,
        recipient: address,
        amountIn: amtIn,
        amountOutMinimum: 0n,
        sqrtPriceLimitX96: 0n,
      };
      const tx = await router.exactInputSingle(params, isNativeETH ? { value: amtIn } : {});
      setStatus({ type: "success", msg: "Transaction submitted…" });
      const receipt = await tx.wait();
      const hash = (receipt?.hash ?? tx.hash) as string;
      setTxHash(hash);

      try {
        const prev = JSON.parse(localStorage.getItem("I-DeFI_swap_history") ?? "[]") as object[];
        prev.push({ hash, tokenIn: tokenInSym, tokenOut: localToken.symbol, amountIn, timestamp: Date.now() });
        localStorage.setItem("I-DeFI_swap_history", JSON.stringify(prev.slice(-50)));
      } catch { /* ignore */ }

      setStatus({ type: "success", msg: `✓ Bought ${quoteOut} ${localToken.symbol}!` });
    } catch (err: unknown) {
      if (isUserRejection(err)) {
        setStatus({ type: "error", msg: "Transaction rejected in wallet. You can try again." });
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus({ type: "error", msg: msg.slice(0, 120) || "Transaction failed." });
      }
    } finally {
      setLoading(false);
    }
  };

  const paySymbol = payToken === "ETH" ? "ETH" : (payToken as Token).symbol;
  const usdPay = amountIn && Number(amountIn) > 0
    ? formatUsd(Number(amountIn) * (payToken === "ETH" ? prices["ethereum"] ?? 0 : prices[(payToken as Token).coingeckoId] ?? 0))
    : "";

  // Click outside to close
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box">
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%",
              background: token.color + "30",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22,
            }}>{token.emoji}</div>
            <div>
              <div className="modal-title">Buy {token.symbol}</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                {formatUsd(token.price)} &nbsp;
                <PriceChange v={token.change24h} />
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Pay with selector */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, fontWeight: 600 }}>
            Pay with
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["ETH", ...TOKEN_LIST.filter(t => t.symbol !== token.symbol)] as (string | Token)[]).map((opt) => {
              const sym = opt === "ETH" ? "ETH" : (opt as Token).symbol;
              const active = payToken === opt ||
                (typeof opt === "object" && typeof payToken === "object" && opt.address === payToken.address) ||
                (opt === "ETH" && payToken === "ETH");
              return (
                <button
                  key={sym}
                  onClick={() => { setPayToken(opt as "ETH" | Token); setQuoteOut(""); setAmountIn(""); }}
                  style={{
                    padding: "5px 12px", borderRadius: 999,
                    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                    background: active ? "rgba(88,166,255,0.12)" : "transparent",
                    color: active ? "var(--accent)" : "var(--text-secondary)",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                    fontFamily: "inherit", transition: "all 0.15s",
                  }}
                >
                  {sym}
                </button>
              );
            })}
          </div>
        </div>

        {/* Amount input */}
        <div className="token-input-wrap" style={{ marginBottom: 12 }}>
          <div className="token-input-label">Amount ({paySymbol})</div>
          <div className="token-input-row">
            <input
              className="token-amount-input"
              type="number"
              placeholder="0.0"
              value={amountIn}
              onChange={e => setAmountIn(e.target.value)}
              min="0"
              style={{ fontSize: 20 }}
            />
            <div style={{
              background: "var(--bg-hover)", border: "1px solid var(--border)",
              borderRadius: 999, padding: "6px 12px",
              fontSize: 13, fontWeight: 600, color: "var(--text-primary)",
              whiteSpace: "nowrap",
            }}>
              {paySymbol}
            </div>
          </div>
          {usdPay && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>≈ {usdPay}</div>}
        </div>

        {/* You receive */}
        <div style={{
          background: "var(--bg-input)", border: "1px solid var(--border-light)",
          borderRadius: "var(--radius-md)", padding: "12px 14px", marginBottom: 16,
          display: "flex", justifyContent: "space-between", alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 4 }}>
              You receive ≈
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: quoteOut && quoteOut !== "No liquidity" ? "var(--green)" : "var(--text-muted)" }}>
              {quoting ? "…" : (quoteOut || "0.0")}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{
              fontSize: 16, fontWeight: 700,
              background: token.color + "30",
              borderRadius: 999, padding: "6px 12px",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span>{token.emoji}</span>
              <span>{token.symbol}</span>
            </div>
          </div>
        </div>

        {/* Status */}
        {status && (
          <div className={`alert alert-${status.type}`}>
            {status.msg}
            {txHash && (
              <> &nbsp;
                <a href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                  style={{ color: "inherit", fontWeight: 700 }}>View ↗</a>
              </>
            )}
          </div>
        )}

        {!localToken && (
          <div className="alert alert-warning">This token isn&apos;t in our Base token list — direct buy unavailable. Use the Swap page.</div>
        )}

        {/* Action */}
        <div style={{ marginTop: 14 }}>
          {!isConnected ? (
            <div className="alert alert-warning" style={{ textAlign: "center" }}>Connect your wallet to buy</div>
          ) : !localToken ? (
            <button className="btn-primary" disabled>Token not on Base</button>
          ) : (
            <button
              className="btn-primary"
              onClick={handleBuy}
              disabled={loading || !amountIn || Number(amountIn) <= 0 || quoteOut === "No liquidity"}
              style={{ background: loading ? undefined : "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff" }}
            >
              {loading
                ? <><span className="spinner" /> Processing…</>
                : `Buy ${token.symbol} with ${paySymbol}`}
            </button>
          )}
        </div>

        <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
          ⚡ Swaps execute on Uniswap V3 via Base • Pool fee (to LPs, not I-DeFI)
        </div>
      </div>
    </div>
  );
}

// ── TOKEN ROW (CMC table style) ───────────────────────────────────────────────

function TokenRow({
  rank, token, onBuy
}: {
  rank: number;
  token: MarketToken;
  onBuy: (t: MarketToken) => void;
}) {
  return (
    <tr>
      <td style={{ color: "var(--text-muted)", textAlign: "center", width: 36 }}>{rank}</td>
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: token.color + "30",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, flexShrink: 0,
          }}>{token.emoji}</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>{token.symbol}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{token.name}</div>
          </div>
        </div>
      </td>
      <td style={{ fontWeight: 600, fontSize: 13 }}>{formatUsd(token.price)}</td>
      <td><PriceChange v={token.change24h} /></td>
      <td style={{ color: "var(--text-secondary)", fontSize: 12 }}>{fmt(token.marketCap)}</td>
      <td style={{ color: "var(--text-secondary)", fontSize: 12, display: "none" }} className="hide-sm">{fmt(token.volume24h)}</td>
      <td>
        <button className="btn-buy" onClick={() => onBuy(token)}>Buy</button>
      </td>
    </tr>
  );
}

// ── LAUNCHPAD HOME SECTION ───────────────────────────────────────────────────

function LaunchpadHomeSection() {
  const [projects, setProjects] = useState<{ id: string; name: string; symbol: string; image: string | null; banner: string | null; status: string; launchDate: string | null; raisedAmount: string | null; tokenomics: { hardCap: string | null } | null }[]>([]);
  useEffect(() => {
    fetch("/api/launchpad/projects")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setProjects(Array.isArray(data) ? data : []))
      .catch(() => setProjects([]));
  }, []);
  const live = projects.filter((p) => p.status === "live").slice(0, 3);
  const upcoming = projects.filter((p) => p.status === "upcoming").slice(0, 3);
  const list = [...live, ...upcoming].slice(0, 6);
  if (list.length === 0) return null;
  return (
    <section style={{ marginBottom: 32 }}>
      <div className="section-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <span className="section-title">🚀 Launchpad</span>
        <a href="/launchpad" style={{ fontSize: 13, color: "var(--accent)", fontWeight: 600 }}>View all →</a>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
        {list.map((p) => {
          const hardCap = p.tokenomics?.hardCap ? parseFloat(p.tokenomics.hardCap) : 0;
          const raised = p.raisedAmount ? parseFloat(p.raisedAmount) : 0;
          const progress = hardCap > 0 ? Math.min(100, (raised / hardCap) * 100) : 0;
          return (
            <a
              key={p.id}
              href={`/launchpad/${p.id}`}
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                overflow: "hidden",
                textDecoration: "none",
                color: "inherit",
                display: "block",
              }}
            >
              <div style={{ height: 90, background: "var(--bg-input)" }}>
                {p.banner || p.image ? (
                  <img src={p.banner || p.image || ""} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, color: "var(--text-muted)" }}>🚀</div>
                )}
              </div>
              <div style={{ padding: 10 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{p.name} ({p.symbol})</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{p.status} · {p.launchDate ? new Date(p.launchDate).toLocaleDateString() : "—"}</div>
                {hardCap > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ height: 4, borderRadius: 2, background: "var(--bg-input)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${progress}%`, background: "var(--accent)", borderRadius: 2 }} />
                    </div>
                  </div>
                )}
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

// ── SECTION ───────────────────────────────────────────────────────────────────

function Section({
  title, badge, tokens, onBuy
}: {
  title: string;
  badge: string;
  tokens: MarketToken[];
  onBuy: (t: MarketToken) => void;
}) {
  const sliced = tokens.slice(0, 10);
  return (
    <section style={{ marginBottom: 32 }}>
      <div className="section-header">
        <span className="section-title">{title}</span>
        <span className="section-badge">{badge}</span>
      </div>
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)", overflow: "hidden",
      }}>
        <table className="data-table" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th style={{ width: 36, textAlign: "center" }}>#</th>
              <th>Token</th>
              <th>Price</th>
              <th>24h %</th>
              <th>Market Cap</th>
              <th className="hide-sm">Volume 24h</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sliced.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
                  Loading…
                </td>
              </tr>
            ) : sliced.map((t, i) => (
              <TokenRow key={t.id} rank={i + 1} token={t} onBuy={onBuy} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── PAGE ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const allIds = useMemo(() => TOKEN_LIST.map(t => t.coingeckoId), []);
  const { prices, changes } = usePrices(allIds);

  const [cgList, setCgList] = useState<MarketToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyToken, setBuyToken] = useState<MarketToken | null>(null);
  const [activeTab, setActiveTab] = useState<"trending" | "gainers" | "losers" | "liquidity">("trending");

  const localFallback = useMemo<MarketToken[]>(() =>
    TOKEN_LIST.map(t => ({
      id: t.coingeckoId,
      symbol: t.symbol,
      name: t.name,
      price: prices[t.coingeckoId] ?? 0,
      change24h: changes[t.coingeckoId] ?? 0,
      marketCap: 0, volume24h: 0,
      emoji: t.emoji, color: t.color, address: t.address,
    })), [prices, changes]);

  const fetchMarket = useCallback(async () => {
    try {
      const url = "/api/markets";
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error("CoinGecko error");
      const data = await res.json();
      const list: MarketToken[] = data.map((c: {
        id: string; symbol: string; name: string;
        current_price?: number; price_change_percentage_24h?: number;
        market_cap?: number; total_volume?: number;
        market_cap_rank?: number;
      }, i: number) => {
        const local = TOKEN_LIST.find(t => t.coingeckoId === c.id);
        return {
          id: c.id,
          symbol: (c.symbol as string).toUpperCase(),
          name: c.name,
          price: c.current_price ?? 0,
          change24h: c.price_change_percentage_24h ?? 0,
          marketCap: c.market_cap ?? 0,
          volume24h: c.total_volume ?? 0,
          emoji: local?.emoji ?? "🪙",
          color: local?.color ?? "#8b949e",
          address: local?.address,
          rank: i + 1,
        };
      });
      setCgList(list);
    } catch {
      setCgList(localFallback);
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchMarket(); }, [fetchMarket]);

  const all = cgList.length > 0 ? cgList : localFallback;
  const trending   = [...all].sort((a, b) => b.volume24h - a.volume24h);
  const gainers    = [...all].sort((a, b) => b.change24h - a.change24h);
  const losers     = [...all].sort((a, b) => a.change24h - b.change24h);
  const liquidity  = [...all].sort((a, b) => b.marketCap - a.marketCap);

  const tabData: Record<string, MarketToken[]> = { trending, gainers, losers, liquidity };
  const tabLabels: Record<string, { title: string; badge: string }> = {
    trending:  { title: "🔥 Trending Tokens",     badge: "By Volume" },
    gainers:   { title: "📈 Top Gainers",          badge: "24h" },
    losers:    { title: "📉 Top Losers",            badge: "24h" },
    liquidity: { title: "💧 High Liquidity Tokens", badge: "By Market Cap" },
  };

  return (
    <div style={{ width: "100%", maxWidth: 1100, margin: "0 auto" }}>
      {/* Hero strip */}
      <div style={{
        background: "linear-gradient(135deg, rgba(88,166,255,0.06), rgba(124,58,237,0.06))",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-xl)", padding: "20px 24px",
        marginBottom: 24, display: "flex", justifyContent: "space-between",
        alignItems: "center", flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700, marginBottom: 4 }}>
            ⚡ Base Network · Uniswap V3
          </div>
          <h1 style={{ fontSize: "clamp(18px, 3vw, 28px)", fontWeight: 800, color: "var(--text-primary)", margin: 0, lineHeight: 1.2 }}>
            I-DeFI
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4, margin: 0 }}>
            DEX & DeFi marketplace on Base · Swap, buy, launchpad, send to ENS
          </p>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          {[
            { label: "Network", value: "Base" },
            { label: "Protocol", value: "Uniswap V3" },
            { label: "Tokens", value: String(TOKEN_LIST.length) },
            { label: "Fee", value: "Pool (LPs)" },
          ].map(s => (
            <div key={s.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{s.value}</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        display: "flex", gap: 4, marginBottom: 20, flexWrap: "wrap",
        borderBottom: "1px solid var(--border)", paddingBottom: 12,
      }}>
        {Object.entries(tabLabels).map(([key, { title }]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as typeof activeTab)}
            style={{
              padding: "7px 16px", borderRadius: 999,
              border: `1px solid ${activeTab === key ? "rgba(88,166,255,0.4)" : "transparent"}`,
              background: activeTab === key ? "rgba(88,166,255,0.1)" : "transparent",
              color: activeTab === key ? "var(--accent)" : "var(--text-secondary)",
              fontSize: 13, fontWeight: activeTab === key ? 700 : 500,
              cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
            }}
          >
            {title}
          </button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center" }}>
          <button
            onClick={fetchMarket}
            style={{
              padding: "6px 12px", borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)", background: "transparent",
              color: "var(--text-muted)", fontSize: 12, cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ⟳ Refresh
          </button>
        </div>
      </div>

      {/* Active table */}
      {loading ? (
        <div style={{
          textAlign: "center", padding: "60px 0",
          color: "var(--text-muted)", fontSize: 14,
        }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>📊</div>
          Loading market data…
        </div>
      ) : (
        <Section
          title={tabLabels[activeTab].title}
          badge={tabLabels[activeTab].badge}
          tokens={tabData[activeTab]}
          onBuy={setBuyToken}
        />
      )}

      {/* Compact grid of ALL our supported tokens */}
      <div style={{ marginBottom: 32 }}>
        <div className="section-header">
          <span className="section-title">⚡ Tokens on Base</span>
          <span className="section-badge">Instantly swappable</span>
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: 10,
        }}>
          {TOKEN_LIST.map(token => {
            const price = prices[token.coingeckoId] ?? 0;
            const change = changes[token.coingeckoId] ?? 0;
            return (
              <div
                key={token.address}
                className="token-card-grid"
                onClick={() => setBuyToken({
                  id: token.coingeckoId, symbol: token.symbol, name: token.name,
                  price, change24h: change, marketCap: 0, volume24h: 0,
                  emoji: token.emoji, color: token.color, address: token.address,
                })}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%",
                    background: token.color + "25",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, flexShrink: 0,
                  }}>{token.emoji}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{token.symbol}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{token.name}</div>
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{formatUsd(price)}</div>
                  <PriceChange v={change} />
                </div>
                <button
                  className="btn-buy"
                  style={{ width: "100%", marginTop: 10, padding: "8px" }}
                  onClick={e => {
                    e.stopPropagation();
                    setBuyToken({
                      id: token.coingeckoId, symbol: token.symbol, name: token.name,
                      price, change24h: change, marketCap: 0, volume24h: 0,
                      emoji: token.emoji, color: token.color, address: token.address,
                    });
                  }}
                >
                  Buy {token.symbol}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Launchpad section */}
      <LaunchpadHomeSection />

      {/* BUY MODAL */}
      {buyToken && <BuyModal token={buyToken} onClose={() => setBuyToken(null)} />}

      {/* Hide-sm CSS */}
      <style>{`
        @media (max-width: 640px) {
          .hide-sm { display: none !important; }
          .data-table th, .data-table td { padding: 9px 8px; }
        }
      `}</style>
    </div>
  );
}

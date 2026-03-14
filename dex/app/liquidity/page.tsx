"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { ethers } from "ethers";
import {
  TOKEN_LIST, ROUTER_ADDRESS, FACTORY_ADDRESS, ROUTER_ABI, ERC20_ABI, PAIR_ABI, FACTORY_ABI,
  Token, formatAmount, parseAmount, deadline
} from "../lib/contracts";
import { usePrices, tokenAmountToUsd } from "../lib/priceService";

const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

interface PoolInfo {
  reserveA: bigint;
  reserveB: bigint;
  totalSupply: bigint;
  lpBalance: bigint;
}

type TabMode = "add" | "remove";

export default function LiquidityPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [tab, setTab] = useState<TabMode>("add");
  const [tokenA, setTokenA] = useState<Token>(TOKEN_LIST[0]);
  const [tokenB, setTokenB] = useState<Token>(TOKEN_LIST[1]);
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [lpAmount, setLpAmount] = useState("");
  const [balA, setBalA] = useState(0n);
  const [balB, setBalB] = useState(0n);
  const [poolInfo, setPoolInfo] = useState<PoolInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Live prices
  const allIds = useMemo(() => TOKEN_LIST.map((t) => t.coingeckoId), []);
  const { prices } = usePrices(allIds);

  const priceA = prices[tokenA.coingeckoId] ?? 0;
  const priceB = prices[tokenB.coingeckoId] ?? 0;

  // ── Fetch balances & pool info ────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!address || !publicClient) return;
    try {
      const [bA, bB] = await Promise.all([
        publicClient.readContract({ address: tokenA.address as `0x${string}`, abi: ERC20_ABI, functionName: "balanceOf", args: [address] }),
        publicClient.readContract({ address: tokenB.address as `0x${string}`, abi: ERC20_ABI, functionName: "balanceOf", args: [address] }),
      ]);
      setBalA(bA as bigint);
      setBalB(bB as bigint);

      const pairAddr = await publicClient.readContract({
        address: FACTORY_ADDRESS as `0x${string}`,
        abi: FACTORY_ABI,
        functionName: "getPair",
        args: [tokenA.address as `0x${string}`, tokenB.address as `0x${string}`],
      }) as string;

      if (pairAddr && pairAddr !== "0x0000000000000000000000000000000000000000") {
        const [reserves, ts, lpBal] = await Promise.all([
          publicClient.readContract({ address: pairAddr as `0x${string}`, abi: PAIR_ABI, functionName: "getReserves" }),
          publicClient.readContract({ address: pairAddr as `0x${string}`, abi: PAIR_ABI, functionName: "totalSupply" }),
          publicClient.readContract({ address: pairAddr as `0x${string}`, abi: PAIR_ABI, functionName: "balanceOf", args: [address] }),
        ]);

        const [r0, r1] = reserves as [bigint, bigint, bigint];
        const token0 = await publicClient.readContract({
          address: pairAddr as `0x${string}`, abi: PAIR_ABI, functionName: "token0"
        }) as string;

        const [reserveA, reserveB] = token0.toLowerCase() === tokenA.address.toLowerCase()
          ? [r0, r1] : [r1, r0];

        setPoolInfo({ reserveA, reserveB, totalSupply: ts as bigint, lpBalance: lpBal as bigint });
      } else {
        setPoolInfo(null);
      }
    } catch { /* ignore */ }
  }, [address, publicClient, tokenA, tokenB]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-quote amountB from amountA using pool ratio
  useEffect(() => {
    if (!amountA || !poolInfo || tab !== "add") return;
    if (poolInfo.reserveA === 0n) return;
    const a = parseAmount(amountA, tokenA.decimals);
    const b = (a * poolInfo.reserveB) / poolInfo.reserveA;
    setAmountB(formatAmount(b, tokenB.decimals, 8));
  }, [amountA, poolInfo, tab, tokenA.decimals, tokenB.decimals]);

  // ── Add Liquidity ─────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!walletClient || !address || !amountA || !amountB) return;
    setLoading(true);
    setStatus(null);
    try {
      const amtA = parseAmount(amountA, tokenA.decimals);
      const amtB = parseAmount(amountB, tokenB.decimals);
      const provider = new ethers.BrowserProvider(walletClient.transport);
      const signer = await provider.getSigner();

      for (const [tokenAddr, amt] of [[tokenA.address, amtA], [tokenB.address, amtB]] as [string, bigint][]) {
        const allowance = await publicClient!.readContract({
          address: tokenAddr as `0x${string}`, abi: ERC20_ABI, functionName: "allowance",
          args: [address, ROUTER_ADDRESS as `0x${string}`],
        }) as bigint;
        if (allowance < amt) {
          const erc20 = new ethers.Contract(tokenAddr, ERC20_ABI, signer);
          const tx = await erc20.approve(ROUTER_ADDRESS, MAX_UINT256);
          await tx.wait();
        }
      }

      const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, signer);
      const tx = await router.addLiquidity(
        tokenA.address, tokenB.address,
        amtA, amtB,
        (amtA * 95n) / 100n, (amtB * 95n) / 100n,
        address, deadline()
      );
      await tx.wait();

      setStatus({ type: "success", msg: `Liquidity added successfully! 🎉 LP tokens sent to your wallet.` });
      setAmountA(""); setAmountB("");
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      setStatus({ type: "error", msg: msg.slice(0, 120) });
    } finally {
      setLoading(false);
    }
  };

  // ── Remove Liquidity ──────────────────────────────────────────────────────
  const handleRemove = async () => {
    if (!walletClient || !address || !lpAmount || !poolInfo) return;
    setLoading(true);
    setStatus(null);
    try {
      const lp = parseAmount(lpAmount);
      const provider = new ethers.BrowserProvider(walletClient.transport);
      const signer = await provider.getSigner();

      const pairAddr = await publicClient!.readContract({
        address: FACTORY_ADDRESS as `0x${string}`, abi: FACTORY_ABI,
        functionName: "getPair",
        args: [tokenA.address as `0x${string}`, tokenB.address as `0x${string}`],
      }) as string;

      const pairApprove = new ethers.Contract(pairAddr, ["function approve(address,uint256) returns (bool)"], signer);
      const approveTx = await pairApprove.approve(ROUTER_ADDRESS, MAX_UINT256);
      await approveTx.wait();

      const router = new ethers.Contract(ROUTER_ADDRESS, ROUTER_ABI, signer);
      const tx = await router.removeLiquidity(
        tokenA.address, tokenB.address, lp, 0, 0, address, deadline()
      );
      await tx.wait();

      setStatus({ type: "success", msg: "Liquidity removed successfully! Tokens returned to your wallet." });
      setLpAmount("");
      fetchData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      setStatus({ type: "error", msg: msg.slice(0, 120) });
    } finally {
      setLoading(false);
    }
  };

  const lpShare = poolInfo && poolInfo.totalSupply > 0n
    ? (Number(poolInfo.lpBalance) * 100) / Number(poolInfo.totalSupply)
    : 0;

  const usdA = amountA && priceA ? `≈ ${(Number(amountA) * priceA).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 })}` : "";
  const usdB = amountB && priceB ? `≈ ${(Number(amountB) * priceB).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 })}` : "";

  return (
    <div style={{ width: "100%", maxWidth: 480 }}>
      <div className="page-header">
        <h1>Liquidity</h1>
        <p>Add liquidity to earn 0.3% of all swaps in this pool, proportional to your share.</p>
      </div>

      {/* Token pair selector */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center", justifyContent: "center" }}>
        {TOKEN_LIST.map((t) => {
          const isA = t.address === tokenA.address;
          const isB = t.address === tokenB.address;
          return (
            <button
              key={t.address}
              onClick={() => {
                if (!isA && !isB) {
                  setTokenA(t);
                  setAmountA(""); setAmountB("");
                }
              }}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 12px", borderRadius: 999,
                background: isA ? t.color + "33" : isB ? t.color + "22" : "var(--bg-input)",
                border: `1px solid ${isA || isB ? t.color + "66" : "var(--border)"}`,
                color: isA || isB ? "var(--text-primary)" : "var(--text-secondary)",
                fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                transition: "all 0.15s",
              }}
            >
              <span>{t.emoji}</span> {t.symbol}
              {isA && <span style={{ fontSize: 10, color: t.color }}>A</span>}
              {isB && <span style={{ fontSize: 10, color: t.color }}>B</span>}
            </button>
          );
        })}
      </div>

      {/* Tab selector */}
      <div className="tab-bar">
        <button className={`tab-item ${tab === "add" ? "active" : ""}`} onClick={() => setTab("add")}>
          ➕ Add Liquidity
        </button>
        <button className={`tab-item ${tab === "remove" ? "active" : ""}`} onClick={() => setTab("remove")}>
          ➖ Remove Liquidity
        </button>
      </div>

      {/* Pool stats */}
      {poolInfo && (
        <div style={{ marginBottom: 24 }}>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{formatAmount(poolInfo.reserveA, tokenA.decimals, 2)}</div>
              <div className="stat-label">{tokenA.symbol} Reserve</div>
              {priceA > 0 && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                {tokenAmountToUsd(poolInfo.reserveA, tokenA.decimals, priceA)}
              </div>}
            </div>
            <div className="stat-card">
              <div className="stat-value">{formatAmount(poolInfo.reserveB, tokenB.decimals, 2)}</div>
              <div className="stat-label">{tokenB.symbol} Reserve</div>
              {priceB > 0 && <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                {tokenAmountToUsd(poolInfo.reserveB, tokenB.decimals, priceB)}
              </div>}
            </div>
            <div className="stat-card">
              <div className="stat-value">{lpShare.toFixed(2)}%</div>
              <div className="stat-label">Your Share</div>
            </div>
          </div>
          {poolInfo.lpBalance > 0n && (
            <div style={{ textAlign: "center", marginTop: 12, color: "var(--text-muted)", fontSize: 13 }}>
              Your LP tokens: <span style={{ color: "var(--accent-light)", fontWeight: 600 }}>
                {formatAmount(poolInfo.lpBalance, 18, 4)}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-title">
          <span>{tab === "add" ? "Add Liquidity" : "Remove Liquidity"}</span>
          <span className="badge badge-green">🌊 AMM Pool</span>
        </div>

        {tab === "add" ? (
          <>
            <div className="token-input-wrap" style={{ marginBottom: 12 }}>
              <div className="token-input-label">{tokenA.symbol} Amount</div>
              <div className="token-input-row">
                <input
                  className="token-amount-input"
                  type="number"
                  placeholder="0.0"
                  value={amountA}
                  onChange={e => setAmountA(e.target.value)}
                  min="0"
                />
                <span style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", color: "var(--text-secondary)", fontWeight: 600 }}>
                  <span style={{ fontSize: 20 }}>{tokenA.emoji}</span> {tokenA.symbol}
                </span>
              </div>
              <div className="token-balance-row">
                <span className="usd-value">{usdA}</span>
                <span>Balance: {formatAmount(balA, tokenA.decimals)}</span>
              </div>
            </div>

            <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 18, margin: "4px 0" }}>+</div>

            <div className="token-input-wrap">
              <div className="token-input-label">{tokenB.symbol} Amount</div>
              <div className="token-input-row">
                <input
                  className="token-amount-input"
                  type="number"
                  placeholder="0.0"
                  value={amountB}
                  onChange={e => setAmountB(e.target.value)}
                  min="0"
                />
                <span style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", color: "var(--text-secondary)", fontWeight: 600 }}>
                  <span style={{ fontSize: 20 }}>{tokenB.emoji}</span> {tokenB.symbol}
                </span>
              </div>
              <div className="token-balance-row">
                <span className="usd-value">{usdB}</span>
                <span>Balance: {formatAmount(balB, tokenB.decimals)}</span>
              </div>
            </div>

            {poolInfo && amountA && amountB && (
              <div className="info-panel" style={{ marginTop: 12 }}>
                <div className="info-row">
                  <span>Pool rate</span>
                  <span>1 {tokenA.symbol} = {poolInfo.reserveA > 0n ? formatAmount(poolInfo.reserveB * parseAmount("1", tokenA.decimals) / poolInfo.reserveA, tokenB.decimals, 6) : "?"} {tokenB.symbol}</span>
                </div>
                <div className="info-row">
                  <span>Slippage tolerance</span>
                  <span>5%</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="token-input-wrap">
              <div className="token-input-label">LP Tokens to burn</div>
              <div className="token-input-row">
                <input
                  className="token-amount-input"
                  type="number"
                  placeholder="0.0"
                  value={lpAmount}
                  onChange={e => setLpAmount(e.target.value)}
                  min="0"
                />
                <span style={{ color: "var(--text-secondary)", fontWeight: 600, whiteSpace: "nowrap" }}>DEX-LP</span>
              </div>
              {poolInfo && (
                <div className="token-balance">
                  Your LP: <span onClick={() => setLpAmount(formatAmount(poolInfo.lpBalance, 18, 8))} style={{ cursor: "pointer", color: "var(--accent-light)" }}>
                    {formatAmount(poolInfo.lpBalance)} MAX
                  </span>
                </div>
              )}
            </div>

            {poolInfo && lpAmount && poolInfo.totalSupply > 0n && (() => {
              const lp = parseAmount(lpAmount);
              const a = lp * poolInfo.reserveA / poolInfo.totalSupply;
              const b = lp * poolInfo.reserveB / poolInfo.totalSupply;
              return (
                <div className="info-panel" style={{ marginTop: 12 }}>
                  <div className="info-row"><span>You receive {tokenA.symbol}</span><span>≈ {formatAmount(a, tokenA.decimals, 6)}</span></div>
                  <div className="info-row"><span>You receive {tokenB.symbol}</span><span>≈ {formatAmount(b, tokenB.decimals, 6)}</span></div>
                </div>
              );
            })()}
          </>
        )}

        {status && <div className={`alert alert-${status.type}`} style={{ marginTop: 12 }}>{status.msg}</div>}

        <div style={{ marginTop: 20 }}>
          {!isConnected ? (
            <button className="btn-primary" disabled>Connect Wallet</button>
          ) : tab === "add" ? (
            <button className="btn-primary" onClick={handleAdd} disabled={loading || !amountA || !amountB}>
              {loading ? <><span className="spinner" /> Adding…</> : "Add Liquidity"}
            </button>
          ) : (
            <button className="btn-primary" onClick={handleRemove} disabled={loading || !lpAmount}>
              {loading ? <><span className="spinner" /> Removing…</> : "Remove Liquidity"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

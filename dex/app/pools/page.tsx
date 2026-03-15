"use client";

import { useEffect, useState, useMemo } from "react";
import { usePublicClient } from "wagmi";
import {
  TOKEN_LIST, FACTORY_ADDRESS, FACTORY_ABI, PAIR_ABI,
  formatAmount
} from "../lib/contracts";
import { usePrices, tokenAmountToUsd } from "../lib/priceService";

interface PairInfo {
  address: string;
  symbol0: string;
  symbol1: string;
  emoji0: string;
  emoji1: string;
  color0: string;
  color1: string;
  decimals0: number;
  decimals1: number;
  coingeckoId0: string;
  coingeckoId1: string;
  reserve0: bigint;
  reserve1: bigint;
  totalSupply: bigint;
}

export default function PoolsPage() {
  const publicClient = usePublicClient();
  const [pairs, setPairs] = useState<PairInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Live prices for TVL
  const allIds = useMemo(() => TOKEN_LIST.map((t) => t.coingeckoId), []);
  const { prices } = usePrices(allIds);

  useEffect(() => {
    const load = async () => {
      if (!publicClient) return;
      try {
        const len = await publicClient.readContract({
          address: FACTORY_ADDRESS as `0x${string}`,
          abi: FACTORY_ABI,
          functionName: "allPairsLength",
        }) as bigint;

        const results: PairInfo[] = [];

        for (let i = 0n; i < len && i < 10n; i++) {
          try {
            const pairAddr = await publicClient.readContract({
              address: FACTORY_ADDRESS as `0x${string}`,
              abi: [...FACTORY_ABI, "function allPairs(uint256) view returns (address)"] as const,
              functionName: "allPairs",
              args: [i],
            }) as string;

            const [token0, token1, reserves, ts] = await Promise.all([
              publicClient.readContract({ address: pairAddr as `0x${string}`, abi: PAIR_ABI, functionName: "token0" }),
              publicClient.readContract({ address: pairAddr as `0x${string}`, abi: PAIR_ABI, functionName: "token1" }),
              publicClient.readContract({ address: pairAddr as `0x${string}`, abi: PAIR_ABI, functionName: "getReserves" }),
              publicClient.readContract({ address: pairAddr as `0x${string}`, abi: PAIR_ABI, functionName: "totalSupply" }),
            ]);

            const [r0, r1] = reserves as [bigint, bigint, bigint];
            const t0 = TOKEN_LIST.find(t => t.address.toLowerCase() === (token0 as string).toLowerCase());
            const t1 = TOKEN_LIST.find(t => t.address.toLowerCase() === (token1 as string).toLowerCase());

            results.push({
              address: pairAddr,
              symbol0: t0?.symbol ?? "???",
              symbol1: t1?.symbol ?? "???",
              emoji0: t0?.emoji ?? "🪙",
              emoji1: t1?.emoji ?? "🪙",
              color0: t0?.color ?? "#888",
              color1: t1?.color ?? "#888",
              decimals0: t0?.decimals ?? 18,
              decimals1: t1?.decimals ?? 18,
              coingeckoId0: t0?.coingeckoId ?? "",
              coingeckoId1: t1?.coingeckoId ?? "",
              reserve0: r0,
              reserve1: r1,
              totalSupply: ts as bigint,
            });
          } catch { /* skip */ }
        }

        setPairs(results);
      } catch { /* ignore */ } finally {
        setLoading(false);
      }
    };
    load();
  }, [publicClient]);

  return (
    <div style={{ width: "100%", maxWidth: 760 }}>
      <div className="page-header">
        <h1>Pools</h1>
        <p>All active liquidity pools on I-DeFI. Provide liquidity to earn fees.</p>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>
          <div className="spinner" style={{ margin: "0 auto 12px" }} />
          <div>Loading pools…</div>
        </div>
      ) : pairs.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🌊</div>
          <div style={{ color: "var(--text-secondary)", fontSize: 16, marginBottom: 8 }}>No pools found</div>
          <div style={{ color: "var(--text-muted)", fontSize: 14 }}>
            Deploy contracts and add liquidity to see pools here.
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {pairs.map(pair => {
            const tvl0 = tokenAmountToUsd(pair.reserve0, pair.decimals0, prices[pair.coingeckoId0] ?? 0);
            const tvl1 = tokenAmountToUsd(pair.reserve1, pair.decimals1, prices[pair.coingeckoId1] ?? 0);
            const tvlNum =
              (Number(pair.reserve0) / Math.pow(10, pair.decimals0)) * (prices[pair.coingeckoId0] ?? 0) +
              (Number(pair.reserve1) / Math.pow(10, pair.decimals1)) * (prices[pair.coingeckoId1] ?? 0);
            const tvlStr = tvlNum > 0
              ? tvlNum.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
              : "—";

            return (
              <div key={pair.address} className="card" style={{ padding: "20px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    {/* Token icons */}
                    <div style={{ position: "relative", width: 54, height: 36 }}>
                      <span style={{
                        position: "absolute", left: 0, top: 0, width: 36, height: 36,
                        background: pair.color0 + "33", borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20
                      }}>{pair.emoji0}</span>
                      <span style={{
                        position: "absolute", right: 0, bottom: 0, width: 28, height: 28,
                        background: pair.color1 + "33", borderRadius: "50%",
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
                        border: "2px solid var(--bg-card)"
                      }}>{pair.emoji1}</span>
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 18, color: "var(--text-primary)" }}>
                        {pair.symbol0} / {pair.symbol1}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                        0.3% fee tier
                      </div>
                    </div>
                  </div>

                  {/* TVL */}
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}>{tvlStr}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Total Value Locked</div>
                  </div>
                </div>

                {/* Reserves */}
                <div style={{ marginTop: 16, display: "flex", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, background: "var(--bg-input)", borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{formatAmount(pair.reserve0, pair.decimals0, 4)} {pair.symbol0}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{tvl0 ? `≈ ${tvl0}` : ""}</div>
                  </div>
                  <div style={{ flex: 1, background: "var(--bg-input)", borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{formatAmount(pair.reserve1, pair.decimals1, 4)} {pair.symbol1}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{tvl1 ? `≈ ${tvl1}` : ""}</div>
                  </div>
                </div>

                <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span className="badge badge-purple">Total LP: {formatAmount(pair.totalSupply, 18, 2)}</span>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>
                    {pair.address.slice(0, 10)}...{pair.address.slice(-6)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

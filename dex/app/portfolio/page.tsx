"use client";

import { useEffect, useState, useCallback } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { TOKEN_LIST, ERC20_ABI, formatAmount } from "../lib/contracts";
import { usePrices, formatUsd } from "../lib/priceService";
import Link from "next/link";

interface TokenBalance {
  token: typeof TOKEN_LIST[0];
  raw: bigint;
  formatted: string;
  usdValue: number;
}

export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const ids = TOKEN_LIST.map(t => t.coingeckoId);
  const { prices } = usePrices(ids);

  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchBalances = useCallback(async () => {
    if (!address || !publicClient) return;
    setLoading(true);
    try {
      const results = await Promise.all(
        TOKEN_LIST.map(token =>
          publicClient.readContract({
            address: token.address as `0x${string}`,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [address],
          }).catch(() => 0n)
        )
      );

      const bals: TokenBalance[] = TOKEN_LIST.map((token, i) => {
        const raw = results[i] as bigint;
        const formatted = formatAmount(raw, token.decimals, 6);
        const price = prices[token.coingeckoId] ?? 0;
        const usdValue = (Number(raw) / Math.pow(10, token.decimals)) * price;
        return { token, raw, formatted, usdValue };
      });

      setBalances(bals);
      setLastRefresh(new Date());
    } finally {
      setLoading(false);
    }
  }, [address, publicClient, prices]);

  useEffect(() => {
    if (isConnected) fetchBalances();
  }, [isConnected, fetchBalances]);

  const totalValue = balances.reduce((acc, b) => acc + b.usdValue, 0);
  const nonZero = balances.filter(b => b.raw > 0n);

  // ── Not connected UI ──────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "80px 16px", textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>👛</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>Your Portfolio</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 16, marginBottom: 32 }}>
          Connect your MetaMask wallet to view your Base network token balances.
        </p>
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
          Use the Connect Wallet button in the navigation bar above.
        </p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 16px" }}>
      <div className="page-header">
        <h1>Portfolio</h1>
        <p>Your token balances on Base network</p>
      </div>

      {/* Wallet info */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Wallet Address</div>
            <div style={{ fontFamily: "monospace", fontSize: 14, wordBreak: "break-all" }}>{address}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Total Value</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--purple)" }}>
              {formatUsd(totalValue)}
            </div>
          </div>
        </div>
        {lastRefresh && (
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 12 }}>
            Last refreshed: {lastRefresh.toLocaleTimeString()}
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        <button
          className="btn-primary"
          style={{ flex: "0 0 auto", padding: "10px 20px", fontSize: 14 }}
          onClick={fetchBalances}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "⟳ Refresh Balances"}
        </button>
        <Link href="/swap">
          <button className="btn-primary" style={{ flex: "0 0 auto", padding: "10px 20px", fontSize: 14, background: "transparent", border: "1px solid var(--border)" }}>
            ⇄ Go to Swap
          </button>
        </Link>
      </div>

      {/* Balance table */}
      {loading && balances.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
          Loading balances…
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Token", "Balance", "Price", "Value", "Action"].map(h => (
                  <th key={h} style={{
                    padding: "14px 16px", textAlign: "left",
                    fontSize: 11, color: "var(--text-muted)",
                    textTransform: "uppercase", letterSpacing: "0.08em",
                    fontWeight: 600,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {balances.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                    No token data. Make sure you&apos;re connected to Base network.
                  </td>
                </tr>
              ) : (
                balances.map(b => (
                  <tr key={b.token.address} style={{
                    borderBottom: "1px solid var(--border)",
                    opacity: b.raw === 0n ? 0.45 : 1,
                    transition: "background 0.15s",
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}
                  >
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{
                          width: 32, height: 32, borderRadius: "50%",
                          background: b.token.color + "33",
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          fontSize: 16,
                        }}>{b.token.emoji}</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{b.token.symbol}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{b.token.name}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px", fontFamily: "monospace", fontSize: 13 }}>
                      {b.raw === 0n ? "0" : b.formatted}
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 13 }}>
                      {formatUsd(prices[b.token.coingeckoId] ?? 0)}
                    </td>
                    <td style={{ padding: "14px 16px", fontSize: 13, fontWeight: 600 }}>
                      {b.usdValue > 0 ? formatUsd(b.usdValue) : "—"}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <Link href={`/swap?tokenIn=${encodeURIComponent(b.token.address)}`}>
                        <button style={{
                          padding: "6px 14px", borderRadius: 8,
                          background: "linear-gradient(135deg,#7c3aed,#2563eb)",
                          border: "none", color: "#fff", fontSize: 12,
                          fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                        }}>
                          Swap
                        </button>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {nonZero.length === 0 && !loading && balances.length > 0 && (
        <div style={{ textAlign: "center", marginTop: 24, color: "var(--text-muted)", fontSize: 14 }}>
          No token balances found on Base mainnet. <Link href="/swap" style={{ color: "var(--purple)" }}>Buy some tokens →</Link>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { TOKEN_LIST } from "../lib/contracts";
import { usePrices, formatUsd } from "../lib/priceService";
import Link from "next/link";

interface SwapRecord {
  hash: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  timestamp: number;
}

const HISTORY_KEY = "crossdex_swap_history";
const FAVORITES_KEY = "crossdex_favorites";

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const ids = TOKEN_LIST.map(t => t.coingeckoId);
  const { prices } = usePrices(ids);

  const [history, setHistory] = useState<SwapRecord[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]); // token addresses
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) setHistory(JSON.parse(raw));
      const fav = localStorage.getItem(FAVORITES_KEY);
      if (fav) setFavorites(JSON.parse(fav));
    } catch { /* ignore */ }
  }, []);

  const copyAddress = useCallback(() => {
    if (!address) return;
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [address]);

  const toggleFavorite = useCallback((tokenAddress: string) => {
    setFavorites(prev => {
      const next = prev.includes(tokenAddress)
        ? prev.filter(a => a !== tokenAddress)
        : [...prev, tokenAddress];
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
  }, []);

  if (!isConnected) {
    return (
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "80px 16px", textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>🧑‍💻</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>Your Profile</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 16, marginBottom: 16 }}>
          Connect your wallet to view your swap history and favorite tokens.
        </p>
      </div>
    );
  }

  const favTokens = TOKEN_LIST.filter(t => favorites.includes(t.address));

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 16px" }}>
      <div className="page-header">
        <h1>Profile</h1>
        <p>Your swap history and favorites on CrossDEX</p>
      </div>

      {/* Wallet card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">Wallet</div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "linear-gradient(135deg, #7c3aed, #2563eb)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, fontWeight: 800, color: "#fff",
          }}>
            {address?.slice(2, 4).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "monospace", fontSize: 14, wordBreak: "break-all", marginBottom: 4 }}>
              {address}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Base Mainnet</div>
          </div>
          <button
            onClick={copyAddress}
            style={{
              padding: "8px 16px", borderRadius: 8,
              border: "1px solid var(--border)",
              background: "transparent", color: "var(--text-primary)",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              fontFamily: "inherit", transition: "border-color 0.2s",
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--purple)")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
          >
            {copied ? "✓ Copied!" : "Copy Address"}
          </button>
        </div>
      </div>

      {/* Swap history */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Swap History</span>
          {history.length > 0 && (
            <button
              onClick={clearHistory}
              style={{
                background: "transparent", border: "none",
                color: "var(--red)", fontSize: 12, cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Clear all
            </button>
          )}
        </div>
        {history.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
            No swaps yet. <Link href="/swap" style={{ color: "var(--purple)" }}>Make your first swap →</Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {history.slice().reverse().map(record => (
              <div key={record.hash} style={{
                background: "var(--bg-secondary)", borderRadius: 10,
                padding: "12px 14px",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                flexWrap: "wrap", gap: 8,
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {record.amountIn} {record.tokenIn} → {record.tokenOut}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3 }}>
                    {new Date(record.timestamp).toLocaleString()}
                  </div>
                </div>
                <a
                  href={`https://basescan.org/tx/${record.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 12, color: "var(--purple)",
                    textDecoration: "none", fontWeight: 600,
                  }}
                >
                  View on Basescan ↗
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Favorite tokens */}
      <div className="card">
        <div className="card-title">Favorite Tokens</div>
        {favTokens.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 20 }}>
            No favorites yet. ❤️ a token below to add it.
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            {favTokens.map(t => (
              <div key={t.address} style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "var(--bg-secondary)", borderRadius: 10, padding: "10px 14px",
              }}>
                <span style={{ fontSize: 18 }}>{t.emoji}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{t.symbol}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {formatUsd(prices[t.coingeckoId] ?? 0)}
                  </div>
                </div>
                <Link href={`/swap?tokenOut=${encodeURIComponent(t.address)}`}>
                  <button style={{
                    marginLeft: 4, padding: "4px 10px", borderRadius: 6,
                    background: "linear-gradient(135deg,#7c3aed,#2563eb)",
                    border: "none", color: "#fff", fontSize: 11,
                    fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                  }}>Buy</button>
                </Link>
                <button
                  onClick={() => toggleFavorite(t.address)}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: 0 }}
                  title="Remove from favorites"
                >
                  ❤️
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>All supported tokens — click ❤️ to favorite:</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {TOKEN_LIST.map(t => {
            const isFav = favorites.includes(t.address);
            return (
              <button
                key={t.address}
                onClick={() => toggleFavorite(t.address)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 12px", borderRadius: 8,
                  border: `1px solid ${isFav ? "var(--purple)" : "var(--border)"}`,
                  background: isFav ? "var(--purple)20" : "transparent",
                  color: "var(--text-primary)", cursor: "pointer",
                  fontSize: 13, fontFamily: "inherit", transition: "all 0.2s",
                }}
              >
                <span>{t.emoji}</span>
                <span style={{ fontWeight: 600 }}>{t.symbol}</span>
                <span style={{ fontSize: 14 }}>{isFav ? "❤️" : "🤍"}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useEnsIdentity } from "../hooks/useEnsIdentity";
import { usePrices, formatUsd } from "../lib/priceService";
import { TOKEN_LIST } from "../lib/contracts";

interface FeedItem {
  id: string;
  type: "insight" | "narrative" | "whale" | "signal" | "token";
  title: string;
  body: string;
  cta?: string;
  ctaUrl?: string;
  tokens?: string[];
  narrative?: string;
  createdAt: string;
}

export default function FeedPage() {
  const { address, ensName, profile, loading, needsOnboarding, needsEnsInput, updateWatchlist } = useEnsIdentity();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [addingSymbol, setAddingSymbol] = useState<string | null>(null);
  const ids = TOKEN_LIST.map((t) => t.coingeckoId);
  const { prices } = usePrices(ids);

  const loadFeed = useCallback(async () => {
    if (!profile) {
      setFeed([]);
      setFeedLoading(false);
      return;
    }
    setFeedLoading(true);
    try {
      const q = ensName ? `ens=${encodeURIComponent(ensName)}` : `address=${encodeURIComponent(address!)}`;
      const res = await fetch(`/api/feed?${q}`);
      if (res.ok) {
        const data = await res.json();
        setFeed(data.feed ?? []);
      } else {
        setFeed([]);
      }
    } catch {
      setFeed([]);
    } finally {
      setFeedLoading(false);
    }
  }, [profile, ensName, address]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const watchlist = profile?.watchlist ?? [];
  const watchlistTokens = watchlist
    .map((sym) => TOKEN_LIST.find((t) => t.symbol.toUpperCase() === sym.toUpperCase()))
    .filter(Boolean) as typeof TOKEN_LIST;

  const addToWatchlist = async (symbol: string) => {
    const sym = symbol.toUpperCase();
    if (watchlist.map((s) => s.toUpperCase()).includes(sym)) return;
    setAddingSymbol(sym);
    const ok = await updateWatchlist([...watchlist, sym]);
    setAddingSymbol(null);
  };

  const removeFromWatchlist = async (symbol: string) => {
    const sym = symbol.toUpperCase();
    const next = watchlist.filter((s) => s.toUpperCase() !== sym);
    await updateWatchlist(next);
  };

  if (!address) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "80px 16px", textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>📡</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>Personalized Feed</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 16, marginBottom: 24 }}>
          Connect your wallet and link an ENS name to get an AI-personalized market feed.
        </p>
        <Link href="/" className="btn-primary" style={{ display: "inline-block" }}>
          Connect wallet
        </Link>
      </div>
    );
  }

  if (needsEnsInput || needsOnboarding) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "80px 16px", textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>🪪</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>Set up your ENS identity</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 16, marginBottom: 24 }}>
          {needsEnsInput
            ? "Enter your ENS name or register one to get a personalized feed."
            : "Complete the short preference questionnaire to personalize your feed."}
        </p>
        <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          You should see a modal to enter your ENS or complete onboarding. If not, refresh the page.
        </p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "80px 16px", textAlign: "center" }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>Personalized Feed</h1>
        <p style={{ color: "var(--text-muted)", fontSize: 16 }}>Complete your preferences (onboarding) to see your feed.</p>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", maxWidth: 720, margin: "0 auto", padding: "0 16px" }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <h1>{ensName || "Your"} dashboard</h1>
        <p>AI-personalized market feed and watchlist</p>
      </div>

      <div style={{ display: "grid", gap: 24 }}>
        {/* Watchlist */}
        <section className="card" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>⭐ Watchlist</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
            {watchlistTokens.map((t) => {
              const price = prices[t.coingeckoId] ?? 0;
              return (
                <div
                  key={t.address}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    background: "var(--bg-hover)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <span style={{ fontSize: 18 }}>{t.emoji}</span>
                  <Link href={`/swap?from=${t.symbol}`} style={{ fontWeight: 700, color: "inherit", textDecoration: "none" }}>
                    {t.symbol}
                  </Link>
                  <span style={{ color: "var(--text-muted)", fontSize: 13 }}>{formatUsd(price)}</span>
                  <button
                    type="button"
                    onClick={() => removeFromWatchlist(t.symbol)}
                    style={{
                      marginLeft: 4,
                      padding: "2px 6px",
                      fontSize: 11,
                      border: "none",
                      background: "transparent",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                    }}
                    title="Remove from watchlist"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Add:</span>
            {TOKEN_LIST.filter((t) => !watchlist.map((s) => s.toUpperCase()).includes(t.symbol.toUpperCase())).map((t) => (
              <button
                key={t.address}
                type="button"
                disabled={addingSymbol === t.symbol}
                onClick={() => addToWatchlist(t.symbol)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: addingSymbol === t.symbol ? "wait" : "pointer",
                }}
              >
                {t.emoji} {t.symbol}
              </button>
            ))}
          </div>
        </section>

        {/* Feed */}
        <section>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>📡 Personalized Feed</h2>
          {feedLoading ? (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
              <div className="spinner" style={{ margin: "0 auto 12px" }} />
              Loading feed…
            </div>
          ) : feed.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>
              No feed items yet. Complete onboarding to get personalized insights.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {feed.map((item) => (
                <article
                  key={item.id}
                  className="card"
                  style={{
                    padding: 18,
                    borderLeft: `4px solid ${
                      item.type === "narrative"
                        ? "var(--purple)"
                        : item.type === "whale"
                          ? "var(--green)"
                          : "var(--accent)"
                    }`,
                  }}
                >
                  <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                    {item.type}
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{item.title}</h3>
                  <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: item.tokens?.length ? 12 : 0 }}>
                    {item.body}
                  </p>
                  {item.tokens && item.tokens.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                      {item.tokens.map((sym) => (
                        <span
                          key={sym}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 999,
                            background: "var(--bg-hover)",
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {sym}
                        </span>
                      ))}
                    </div>
                  )}
                  {item.cta && (
                    <Link
                      href={item.ctaUrl ?? "#"}
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--accent)",
                        textDecoration: "none",
                      }}
                    >
                      {item.cta} →
                    </Link>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/" className="btn-secondary">
            ← Markets
          </Link>
          <Link href="/swap" className="btn-primary">
            Swap
          </Link>
        </div>
      </div>
    </div>
  );
}

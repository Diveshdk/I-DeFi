"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { useEnsIdentity, verifyEnsOwnership } from "../hooks/useEnsIdentity";
import { TOKEN_LIST } from "../lib/contracts";
import { usePrices, formatUsd } from "../lib/priceService";
import {
  TRADING_STYLE_LABELS,
  RISK_LEVEL_LABELS,
  SECTOR_LABELS,
  ECOSYSTEM_LABELS,
  SIGNAL_LABELS,
  NOTIFICATION_LABELS,
} from "../lib/ens-preferences";
import EditPreferencesModal from "../components/EditPreferencesModal";
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

type AlertRule = { id: string; type: "portfolio" | "token"; threshold_usd: number; token_address?: string };

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const { profile, refetchProfile, ensName, setEnsNameManually } = useEnsIdentity();
  const ids = TOKEN_LIST.map(t => t.coingeckoId);
  const { prices } = usePrices(ids);

  const [history, setHistory] = useState<SwapRecord[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]); // token addresses
  const [copied, setCopied] = useState(false);
  const [editingPrefs, setEditingPrefs] = useState(false);
  const [ensInput, setEnsInput] = useState("");
  const [ensLinking, setEnsLinking] = useState(false);
  const [ensError, setEnsError] = useState<string | null>(null);
  const [ensContact, setEnsContact] = useState<{ email: string | null; phone: string | null } | null>(null);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [alertType, setAlertType] = useState<"portfolio" | "token">("portfolio");
  const [alertThreshold, setAlertThreshold] = useState("");
  const [alertToken, setAlertToken] = useState(TOKEN_LIST[0]?.address ?? "");
  const [alertSaving, setAlertSaving] = useState(false);

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

  const handleLinkEns = useCallback(async () => {
    const name = ensInput.trim().toLowerCase();
    const withEth = name.endsWith(".eth") ? name : `${name}.eth`;
    if (!address) return;
    setEnsError(null);
    setEnsLinking(true);
    try {
      const ok = await verifyEnsOwnership(address, withEth);
      if (ok) {
        setEnsNameManually(withEth);
        setEnsInput("");
        refetchProfile();
      } else {
        setEnsError("This ENS does not resolve to your wallet. Enter an ENS you own.");
      }
    } catch {
      setEnsError("Could not verify. Try again.");
    } finally {
      setEnsLinking(false);
    }
  }, [address, ensInput, setEnsNameManually, refetchProfile]);

  useEffect(() => {
    if (!ensName) {
      setEnsContact(null);
      setAlertRules([]);
      return;
    }
    (async () => {
      try {
        const [contactRes, rulesRes] = await Promise.all([
          fetch(`/api/ens/contact?name=${encodeURIComponent(ensName)}`),
          fetch(`/api/alerts?ens=${encodeURIComponent(ensName)}`),
        ]);
        if (contactRes.ok) {
          const c = await contactRes.json();
          setEnsContact({ email: c.email ?? null, phone: c.phone ?? null });
        } else setEnsContact(null);
        if (rulesRes.ok) {
          const r = await rulesRes.json();
          setAlertRules(r.rules ?? []);
        } else setAlertRules([]);
      } catch {
        setEnsContact(null);
        setAlertRules([]);
      }
    })();
  }, [ensName]);

  const addAlertRule = useCallback(async () => {
    if (!ensName || !alertThreshold.trim()) return;
    const th = Number(alertThreshold);
    if (!Number.isFinite(th) || th <= 0) return;
    setAlertSaving(true);
    try {
      const newRule: AlertRule = {
        id: `rule-${Date.now()}`,
        type: alertType,
        threshold_usd: th,
        token_address: alertType === "token" ? alertToken : undefined,
      };
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ens_name: ensName, rules: [...alertRules, newRule] }),
      });
      if (res.ok) {
        const data = await res.json();
        setAlertRules(data.rules ?? []);
        setAlertThreshold("");
      }
    } finally {
      setAlertSaving(false);
    }
  }, [ensName, alertRules, alertType, alertThreshold, alertToken]);

  const removeAlertRule = useCallback(async (id: string) => {
    if (!ensName) return;
    const next = alertRules.filter((r) => r.id !== id);
    setAlertSaving(true);
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ens_name: ensName, rules: next }),
      });
      if (res.ok) {
        const data = await res.json();
        setAlertRules(data.rules ?? []);
      }
    } finally {
      setAlertSaving(false);
    }
  }, [ensName, alertRules]);

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
        <p>Your swap history, preferences, and favorites on CrossDEX</p>
      </div>

      {/* ENS identity — show linked ENS or prompt to link */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">ENS identity</div>
        {ensName ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{
              padding: "10px 16px",
              borderRadius: "var(--radius-md)",
              background: "rgba(88,166,255,0.12)",
              border: "1px solid rgba(88,166,255,0.3)",
              fontSize: 16,
              fontWeight: 700,
              color: "var(--accent)",
              fontFamily: "inherit",
            }}>
              {ensName}
            </div>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Linked to your wallet · Preferences and feed are tied to this name
            </span>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 14 }}>
              Link an ENS name you own so your preferences and feed stay tied to your identity across wallets.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
              <input
                type="text"
                placeholder="yourname.eth"
                value={ensInput}
                onChange={(e) => { setEnsInput(e.target.value); setEnsError(null); }}
                onKeyDown={(e) => e.key === "Enter" && handleLinkEns()}
                className="token-amount-input"
                style={{ flex: "1 1 200px", minWidth: 160, padding: "10px 14px" }}
              />
              <button
                type="button"
                className="btn-primary"
                onClick={handleLinkEns}
                disabled={ensLinking || !ensInput.trim()}
                style={{ whiteSpace: "nowrap" }}
              >
                {ensLinking ? "Verifying…" : "Link ENS"}
              </button>
            </div>
            {ensError && (
              <div style={{ marginTop: 10, fontSize: 13, color: "var(--red)" }}>{ensError}</div>
            )}
            <p style={{ marginTop: 12, fontSize: 12, color: "var(--text-muted)" }}>
              Your ENS must resolve to your connected wallet address. Don’t have one?{" "}
              <a href="https://app.ens.domains" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>Register at app.ens.domains ↗</a>
            </p>
          </div>
        )}
      </div>

      {/* Market preferences */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <span>Market preferences</span>
          {profile ? (
            <button
              className="btn-secondary"
              onClick={() => setEditingPrefs(true)}
              style={{ fontSize: 13 }}
            >
              Edit preferences
            </button>
          ) : (
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Complete onboarding to set preferences</span>
          )}
        </div>
        {profile ? (
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            <p><strong style={{ color: "var(--text-primary)" }}>Trading:</strong> {TRADING_STYLE_LABELS[profile.preferences.trading_style]}</p>
            <p><strong style={{ color: "var(--text-primary)" }}>Risk:</strong> {RISK_LEVEL_LABELS[profile.preferences.risk_level]}</p>
            <p><strong style={{ color: "var(--text-primary)" }}>Sectors:</strong> {profile.preferences.sectors.map(s => SECTOR_LABELS[s]).join(", ") || "—"}</p>
            <p><strong style={{ color: "var(--text-primary)" }}>Ecosystems:</strong> {profile.preferences.ecosystems.map(e => ECOSYSTEM_LABELS[e]).join(", ") || "—"}</p>
            <p><strong style={{ color: "var(--text-primary)" }}>Signals:</strong> {profile.preferences.signals.map(s => SIGNAL_LABELS[s]).join(", ") || "—"}</p>
            <p><strong style={{ color: "var(--text-primary)" }}>Notifications:</strong> {profile.preferences.notifications.map(n => NOTIFICATION_LABELS[n]).join(", ") || "—"}</p>
          </div>
        ) : (
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Preferences personalize your feed and recommendations. You’ll set these when you first connect or in onboarding.</p>
        )}
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
            {ensName && <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginBottom: 4 }}>{ensName}</div>}
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

      {/* Alerts — only when ENS is linked; contact (email/phone) comes from ENS */}
      {ensName && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-title">Price & portfolio alerts</div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 14 }}>
            Get email (and SMS when configured) when your portfolio or a token value goes below a threshold. Contact is read from your ENS profile.
          </p>
          {ensContact && (ensContact.email || ensContact.phone) ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
              <strong style={{ color: "var(--text-primary)" }}>Contact from ENS:</strong>{" "}
              {ensContact.email && <span>{ensContact.email}</span>}
              {ensContact.email && ensContact.phone && " · "}
              {ensContact.phone && <span>{ensContact.phone}</span>}
              {" "}(set at{" "}
              <a href="https://app.ens.domains" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>app.ens.domains</a>)
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "var(--yellow)", marginBottom: 12 }}>
              Set an <strong>email</strong> (and optionally <strong>com.phone</strong>) on your ENS at{" "}
              <a href="https://app.ens.domains" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>app.ens.domains</a> to receive alerts.
            </div>
          )}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
            <select
              value={alertType}
              onChange={(e) => setAlertType(e.target.value as "portfolio" | "token")}
              style={{
                padding: "8px 12px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                fontSize: 13,
              }}
            >
              <option value="portfolio">Portfolio total</option>
              <option value="token">Single token</option>
            </select>
            {alertType === "token" && (
              <select
                value={alertToken}
                onChange={(e) => setAlertToken(e.target.value)}
                style={{
                  padding: "8px 12px",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border)",
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                  fontSize: 13,
                  minWidth: 100,
                }}
              >
                {TOKEN_LIST.map((t) => (
                  <option key={t.address} value={t.address}>{t.symbol}</option>
                ))}
              </select>
            )}
            <input
              type="number"
              placeholder="Threshold (USD)"
              value={alertThreshold}
              onChange={(e) => setAlertThreshold(e.target.value)}
              min={0}
              step={1}
              style={{
                width: 120,
                padding: "8px 12px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
                background: "var(--bg-input)",
                color: "var(--text-primary)",
                fontSize: 13,
              }}
            />
            <button
              type="button"
              className="btn-primary"
              onClick={addAlertRule}
              disabled={alertSaving || !alertThreshold.trim()}
              style={{ padding: "8px 16px", fontSize: 13 }}
            >
              {alertSaving ? "Saving…" : "Add alert"}
            </button>
          </div>
          {alertRules.length > 0 && (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {alertRules.map((r) => (
                <li
                  key={r.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 0",
                    borderBottom: "1px solid var(--border-light)",
                    fontSize: 13,
                  }}
                >
                  <span>
                    {r.type === "portfolio" ? "Portfolio" : TOKEN_LIST.find((t) => t.address === r.token_address)?.symbol ?? "Token"} below ${r.threshold_usd}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAlertRule(r.id)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--red)",
                      cursor: "pointer",
                      fontSize: 12,
                      padding: "2px 8px",
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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

      {editingPrefs && profile && (
        <EditPreferencesModal
          profile={profile}
          onClose={() => setEditingPrefs(false)}
          onSaved={() => refetchProfile()}
        />
      )}
    </div>
  );
}

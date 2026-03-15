"use client";

import { useState, useEffect } from "react";
import {
  EnsPreferences,
  TRADING_STYLES,
  RISK_LEVELS,
  MARKET_SECTORS,
  ECOSYSTEMS,
  PORTFOLIO_SIZE_RANGES,
  SIGNAL_TYPES,
  NOTIFICATION_PREFS,
  TRADING_STYLE_LABELS,
  RISK_LEVEL_LABELS,
  SECTOR_LABELS,
  ECOSYSTEM_LABELS,
  PORTFOLIO_SIZE_LABELS,
  SIGNAL_LABELS,
  NOTIFICATION_LABELS,
} from "../lib/ens-preferences";
import type { EnsProfile } from "../lib/ens-preferences";

const STEPS = [
  { id: "trading", title: "Trading style" },
  { id: "risk", title: "Risk appetite" },
  { id: "sectors", title: "Market segments" },
  { id: "ecosystems", title: "Favorite ecosystems" },
  { id: "portfolio", title: "Portfolio size (optional)" },
  { id: "signals", title: "Market signals" },
  { id: "notifications", title: "Notifications" },
];

export default function EditPreferencesModal({
  profile,
  onClose,
  onSaved,
}: {
  profile: EnsProfile;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [step, setStep] = useState(0);
  const [prefs, setPrefs] = useState<EnsPreferences>(profile.preferences);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPrefs(profile.preferences);
  }, [profile]);

  const toggleArray = <T,>(arr: T[], item: T): T[] =>
    arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = profile.ens_name
        ? { ens_name: profile.ens_name, preferences: prefs }
        : { address: profile.wallet_address, preferences: prefs };
      const res = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Update failed");
      onSaved();
      onClose();
    } catch {
      setSaving(false);
    }
  };

  const stepId = STEPS[step]?.id ?? "trading";
  const isLast = step === STEPS.length - 1;
  const btnStyle = (active: boolean) => ({
    padding: "8px 14px",
    borderRadius: 999,
    border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
    background: active ? "rgba(88,166,255,0.12)" : "transparent",
    color: "var(--text-primary)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer" as const,
  });

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Edit market preferences</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
              Step {step + 1} of {STEPS.length}
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: i <= step ? "var(--accent)" : "var(--border)",
              }}
            />
          ))}
        </div>

        {stepId === "trading" && (
          <div>
            <p style={{ marginBottom: 12, color: "var(--text-secondary)", fontSize: 13 }}>How do you approach the market?</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {TRADING_STYLES.map((v) => (
                <button key={v} onClick={() => setPrefs((p) => ({ ...p, trading_style: v }))} style={btnStyle(prefs.trading_style === v)}>
                  {TRADING_STYLE_LABELS[v]}
                </button>
              ))}
            </div>
          </div>
        )}
        {stepId === "risk" && (
          <div>
            <p style={{ marginBottom: 12, color: "var(--text-secondary)", fontSize: 13 }}>Risk appetite</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {RISK_LEVELS.map((v) => (
                <button key={v} onClick={() => setPrefs((p) => ({ ...p, risk_level: v }))} style={btnStyle(prefs.risk_level === v)}>
                  {RISK_LEVEL_LABELS[v]}
                </button>
              ))}
            </div>
          </div>
        )}
        {stepId === "sectors" && (
          <div>
            <p style={{ marginBottom: 12, color: "var(--text-secondary)", fontSize: 13 }}>Market segments (multiple)</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {MARKET_SECTORS.map((v) => (
                <button key={v} onClick={() => setPrefs((p) => ({ ...p, sectors: toggleArray(p.sectors, v) }))} style={btnStyle(prefs.sectors.includes(v))}>
                  {SECTOR_LABELS[v]}
                </button>
              ))}
            </div>
          </div>
        )}
        {stepId === "ecosystems" && (
          <div>
            <p style={{ marginBottom: 12, color: "var(--text-secondary)", fontSize: 13 }}>Favorite ecosystems (multiple)</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {ECOSYSTEMS.map((v) => (
                <button key={v} onClick={() => setPrefs((p) => ({ ...p, ecosystems: toggleArray(p.ecosystems, v) }))} style={btnStyle(prefs.ecosystems.includes(v))}>
                  {ECOSYSTEM_LABELS[v]}
                </button>
              ))}
            </div>
          </div>
        )}
        {stepId === "portfolio" && (
          <div>
            <p style={{ marginBottom: 12, color: "var(--text-secondary)", fontSize: 13 }}>Portfolio size (optional)</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {PORTFOLIO_SIZE_RANGES.map((v) => (
                <button key={v} onClick={() => setPrefs((p) => ({ ...p, portfolio_size: p.portfolio_size === v ? undefined : v }))} style={btnStyle(prefs.portfolio_size === v)}>
                  {PORTFOLIO_SIZE_LABELS[v]}
                </button>
              ))}
            </div>
          </div>
        )}
        {stepId === "signals" && (
          <div>
            <p style={{ marginBottom: 12, color: "var(--text-secondary)", fontSize: 13 }}>Insights you want (multiple)</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SIGNAL_TYPES.map((v) => (
                <button key={v} onClick={() => setPrefs((p) => ({ ...p, signals: toggleArray(p.signals, v) }))} style={btnStyle(prefs.signals.includes(v))}>
                  {SIGNAL_LABELS[v]}
                </button>
              ))}
            </div>
          </div>
        )}
        {stepId === "notifications" && (
          <div>
            <p style={{ marginBottom: 12, color: "var(--text-secondary)", fontSize: 13 }}>Notifications</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {NOTIFICATION_PREFS.map((v) => (
                <button key={v} onClick={() => setPrefs((p) => ({ ...p, notifications: toggleArray(p.notifications, v) }))} style={btnStyle(prefs.notifications.includes(v))}>
                  {NOTIFICATION_LABELS[v]}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
          <button className="btn-secondary" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            Back
          </button>
          {isLast ? (
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          ) : (
            <button className="btn-primary" onClick={() => setStep((s) => s + 1)}>Next</button>
          )}
        </div>
      </div>
    </div>
  );
}

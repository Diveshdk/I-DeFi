"use client";

import { useState } from "react";
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
  DEFAULT_PREFERENCES,
} from "../lib/ens-preferences";

const STEPS = [
  { id: "trading", title: "Trading style" },
  { id: "risk", title: "Risk appetite" },
  { id: "sectors", title: "Market segments" },
  { id: "ecosystems", title: "Favorite ecosystems" },
  { id: "portfolio", title: "Portfolio size (optional)" },
  { id: "signals", title: "Market signals" },
  { id: "notifications", title: "Notifications" },
];

export default function OnboardingQuestionnaire({
  ensName,
  walletAddress,
  onComplete,
}: {
  ensName: string | null;
  walletAddress: string;
  onComplete: () => void;
}) {
  const [step, setStep] = useState(0);
  const [prefs, setPrefs] = useState<EnsPreferences>({ ...DEFAULT_PREFERENCES });
  const [saving, setSaving] = useState(false);

  const toggleArray = <T,>(arr: T[], item: T): T[] =>
    arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/user/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(ensName ? { ens_name: ensName } : {}),
          wallet_address: walletAddress,
          preferences: prefs,
        }),
      });
      if (!res.ok) throw new Error("Save failed");
      onComplete();
    } catch {
      setSaving(false);
    }
  };

  const stepId = STEPS[step]?.id ?? "trading";
  const isLast = step === STEPS.length - 1;

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Set your preferences</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
              {ensName || "Set preferences"} · Step {step + 1} of {STEPS.length}
            </div>
          </div>
        </div>

        {/* Progress */}
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

        {/* Step content */}
        {stepId === "trading" && (
          <div>
            <p style={{ marginBottom: 12, color: "var(--text-secondary)", fontSize: 13 }}>How do you approach the market?</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {TRADING_STYLES.map((v) => (
                <button
                  key={v}
                  onClick={() => setPrefs((p) => ({ ...p, trading_style: v }))}
                  style={{
                    padding: "12px 14px",
                    borderRadius: "var(--radius-md)",
                    border: `2px solid ${prefs.trading_style === v ? "var(--accent)" : "var(--border)"}`,
                    background: prefs.trading_style === v ? "rgba(88,166,255,0.1)" : "transparent",
                    color: "var(--text-primary)",
                    fontSize: 14,
                    fontWeight: 600,
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
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
                <button
                  key={v}
                  onClick={() => setPrefs((p) => ({ ...p, risk_level: v }))}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 999,
                    border: `2px solid ${prefs.risk_level === v ? "var(--accent)" : "var(--border)"}`,
                    background: prefs.risk_level === v ? "rgba(88,166,255,0.1)" : "transparent",
                    color: "var(--text-primary)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {RISK_LEVEL_LABELS[v]}
                </button>
              ))}
            </div>
          </div>
        )}

        {stepId === "sectors" && (
          <div>
            <p style={{ marginBottom: 12, color: "var(--text-secondary)", fontSize: 13 }}>Select sectors you care about (multiple)</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {MARKET_SECTORS.map((v) => (
                <button
                  key={v}
                  onClick={() => setPrefs((p) => ({ ...p, sectors: toggleArray(p.sectors, v) }))}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: `1px solid ${prefs.sectors.includes(v) ? "var(--accent)" : "var(--border)"}`,
                    background: prefs.sectors.includes(v) ? "rgba(88,166,255,0.12)" : "transparent",
                    color: "var(--text-primary)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
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
                <button
                  key={v}
                  onClick={() => setPrefs((p) => ({ ...p, ecosystems: toggleArray(p.ecosystems, v) }))}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: `1px solid ${prefs.ecosystems.includes(v) ? "var(--accent)" : "var(--border)"}`,
                    background: prefs.ecosystems.includes(v) ? "rgba(88,166,255,0.12)" : "transparent",
                    color: "var(--text-primary)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {ECOSYSTEM_LABELS[v]}
                </button>
              ))}
            </div>
          </div>
        )}

        {stepId === "portfolio" && (
          <div>
            <p style={{ marginBottom: 12, color: "var(--text-secondary)", fontSize: 13 }}>Rough portfolio size (optional, for better recommendations)</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {PORTFOLIO_SIZE_RANGES.map((v) => (
                <button
                  key={v}
                  onClick={() => setPrefs((p) => ({ ...p, portfolio_size: p.portfolio_size === v ? undefined : v }))}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 999,
                    border: `1px solid ${prefs.portfolio_size === v ? "var(--accent)" : "var(--border)"}`,
                    background: prefs.portfolio_size === v ? "rgba(88,166,255,0.12)" : "transparent",
                    color: "var(--text-primary)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {PORTFOLIO_SIZE_LABELS[v]}
                </button>
              ))}
            </div>
          </div>
        )}

        {stepId === "signals" && (
          <div>
            <p style={{ marginBottom: 12, color: "var(--text-secondary)", fontSize: 13 }}>What insights do you want? (multiple)</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {SIGNAL_TYPES.map((v) => (
                <button
                  key={v}
                  onClick={() => setPrefs((p) => ({ ...p, signals: toggleArray(p.signals, v) }))}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: `1px solid ${prefs.signals.includes(v) ? "var(--accent)" : "var(--border)"}`,
                    background: prefs.signals.includes(v) ? "rgba(88,166,255,0.12)" : "transparent",
                    color: "var(--text-primary)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {SIGNAL_LABELS[v]}
                </button>
              ))}
            </div>
          </div>
        )}

        {stepId === "notifications" && (
          <div>
            <p style={{ marginBottom: 12, color: "var(--text-secondary)", fontSize: 13 }}>How do you want to be updated?</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {NOTIFICATION_PREFS.map((v) => (
                <button
                  key={v}
                  onClick={() => setPrefs((p) => ({ ...p, notifications: toggleArray(p.notifications, v) }))}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 999,
                    border: `1px solid ${prefs.notifications.includes(v) ? "var(--accent)" : "var(--border)"}`,
                    background: prefs.notifications.includes(v) ? "rgba(88,166,255,0.12)" : "transparent",
                    color: "var(--text-primary)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {NOTIFICATION_LABELS[v]}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24 }}>
          <button
            className="btn-secondary"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            Back
          </button>
          {isLast ? (
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save & open dashboard"}
            </button>
          ) : (
            <button className="btn-primary" onClick={() => setStep((s) => s + 1)}>
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

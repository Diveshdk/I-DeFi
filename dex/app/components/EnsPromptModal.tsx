"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { verifyEnsOwnership } from "../hooks/useEnsIdentity";

const REGISTER_ENS_URL = "https://app.ens.domains";

export default function EnsPromptModal({
  onVerified,
  onSkip,
}: {
  onVerified: (ensName: string) => void;
  onSkip?: () => void;
}) {
  const { address } = useAccount();
  const [input, setInput] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const name = input.trim().toLowerCase();
    if (!name) return;
    if (!name.endsWith(".eth")) {
      setInput(name + ".eth");
      return;
    }
    setError(null);
    setVerifying(true);
    try {
      const ok = await verifyEnsOwnership(address!, name);
      if (ok) onVerified(name);
      else setError("This ENS name does not resolve to your connected wallet. Please enter an ENS you own.");
    } catch {
      setError("Could not verify ENS. Try again.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onSkip?.()}>
      <div className="modal-box" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">Link your ENS identity</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
              Your preferences will be saved to this ENS name and persist across wallets.
            </div>
          </div>
          {onSkip && (
            <button className="modal-close" onClick={onSkip} aria-label="Close">✕</button>
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 8 }}>
            ENS name you own
          </label>
          <input
            type="text"
            placeholder="yourname.eth"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className="token-amount-input"
            style={{ width: "100%", padding: "12px 14px" }}
            autoFocus
          />
          {error && (
            <div className="alert alert-error" style={{ marginTop: 10 }}>{error}</div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            className="btn-primary"
            onClick={handleSubmit}
            disabled={verifying || !input.trim()}
          >
            {verifying ? "Verifying…" : "Continue"}
          </button>
          <a
            href={REGISTER_ENS_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: "10px 16px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
              color: "var(--accent)",
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Register new ENS ↗
          </a>
          {onSkip && (
            <button
              className="btn-secondary"
              onClick={onSkip}
              style={{ marginLeft: "auto" }}
            >
              Skip for now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

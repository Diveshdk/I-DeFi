"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ConnectWallet from "./ConnectWallet";
import { useEnsIdentity } from "../hooks/useEnsIdentity";
import { useTestMode } from "../contexts/TestModeContext";

export default function Navbar() {
  const [mounted, setMounted] = useState(false);
  const { ensName, loading: ensLoading } = useEnsIdentity();
  const { isTestMode, setTestMode } = useTestMode();

  useEffect(() => { setMounted(true); }, []);

  return (
    <header className="navbar" style={{ justifyContent: "space-between" }}>
      <Link href="/" className="navbar-brand">
        <div className="navbar-logo">⚡</div>
        <span className="navbar-name">Cross<span>DEX</span></span>
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {mounted && (
          <button
            type="button"
            onClick={() => setTestMode(!isTestMode)}
            title={isTestMode ? "Turn off test mode" : "Turn on test / demo mode for judges"}
            style={{
              padding: "6px 10px",
              borderRadius: "var(--radius-sm)",
              border: `1px solid ${isTestMode ? "rgba(234,179,8,0.6)" : "var(--border)"}`,
              background: isTestMode ? "rgba(234,179,8,0.15)" : "transparent",
              color: isTestMode ? "#eab308" : "var(--text-muted)",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {isTestMode ? "Test ON" : "Test"}
          </button>
        )}
        {mounted && ensLoading && (
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
            Resolving ENS…
          </span>
        )}
        {mounted && !ensLoading && ensName && (
          <Link
            href="/feed"
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--accent)",
              textDecoration: "none",
              padding: "6px 12px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
              background: "rgba(88,166,255,0.08)",
            }}
          >
            {ensName}
          </Link>
        )}
        <ConnectWallet />
      </div>
    </header>
  );
}

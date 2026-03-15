"use client";

import Link from "next/link";
import ConnectWallet from "./ConnectWallet";
import { useEnsIdentity } from "../hooks/useEnsIdentity";

export default function Navbar() {
  const { ensName, loading: ensLoading } = useEnsIdentity();

  return (
    <header className="navbar" style={{ justifyContent: "space-between" }}>
      <Link href="/" className="navbar-brand">
        <div className="navbar-logo">⚡</div>
        <span className="navbar-name">Cross<span>DEX</span></span>
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {ensLoading && (
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
            Resolving ENS…
          </span>
        )}
        {!ensLoading && ensName && (
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

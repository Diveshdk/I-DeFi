"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ConnectWallet from "./ConnectWallet";
import { useState } from "react";

const NAV_LINKS = [
  { href: "/",          label: "Markets",   icon: "📊" },
  { href: "/swap",      label: "Swap",      icon: "⇄" },
  { href: "/liquidity", label: "Liquidity", icon: "💧" },
  { href: "/pools",     label: "Pools",     icon: "🏊" },
  { href: "/portfolio", label: "Portfolio", icon: "💼" },
  { href: "/profile",   label: "Profile",   icon: "👤" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <nav className="navbar">
        {/* Brand */}
        <Link href="/" className="navbar-brand">
          <div className="navbar-logo">⚡</div>
          <span className="navbar-name">Cross<span>DEX</span></span>
        </Link>

        {/* Desktop nav */}
        <div className="navbar-nav">
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link ${pathname === link.href ? "active" : ""}`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right: connect wallet */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ConnectWallet />
          {/* Mobile hamburger — just shows a menu icon, navigation done via bottom nav */}
          <button
            className="mobile-menu-btn"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            ☰
          </button>
        </div>

        {/* Mobile slide-down menu */}
        {mobileOpen && (
          <div style={{
            position: "absolute", top: "100%", left: 0, right: 0,
            background: "var(--bg-sidebar)", borderBottom: "1px solid var(--border)",
            zIndex: 250, padding: "8px 14px 12px",
            display: "flex", flexDirection: "column", gap: 2,
          }}>
            {NAV_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-link ${pathname === link.href ? "active" : ""}`}
                style={{ display: "flex", alignItems: "center", gap: 8 }}
                onClick={() => setMobileOpen(false)}
              >
                <span>{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* Mobile bottom navigation */}
      <nav className="mobile-nav">
        {NAV_LINKS.slice(0, 5).map(link => (
          <Link
            key={link.href}
            href={link.href}
            className={`mobile-nav-link ${pathname === link.href ? "active" : ""}`}
          >
            <span className="mobile-nav-icon">{link.icon}</span>
            {link.label}
          </Link>
        ))}
      </nav>
    </>
  );
}

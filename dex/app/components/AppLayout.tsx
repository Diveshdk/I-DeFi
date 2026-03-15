"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const OVERVIEW_ITEMS = [
  { href: "/", label: "Markets", desc: "Token prices & buy" },
  { href: "/swap", label: "Swap", desc: "Trade on Base" },
  { href: "/send", label: "Send to ENS", desc: "Send by ENS or address" },
  { href: "/feed", label: "Feed", desc: "Personalized feed" },
  { href: "/portfolio", label: "Portfolio", desc: "Holdings" },
  { href: "/profile", label: "Profile", desc: "Preferences & ENS" },
  { href: "/broadcast", label: "Emergency broadcast", desc: "Alert all ENS users" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [leftOpen, setLeftOpen] = useState(false);

  return (
    <div className="app-layout">
      {/* Left sidebar — CMC-style overview (hidden on small screens, toggled by button) */}
      <aside className="app-sidebar app-sidebar-left">
        <div className="app-sidebar-inner">
          <div className="app-sidebar-title">Overview</div>
          <nav className="app-sidebar-nav">
            {OVERVIEW_ITEMS.map(({ href, label, desc }) => (
              <Link
                key={href}
                href={href}
                className={`app-sidebar-link ${pathname === href ? "active" : ""}`}
                onClick={() => setLeftOpen(false)}
              >
                <span className="app-sidebar-link-label">{label}</span>
                <span className="app-sidebar-link-desc">{desc}</span>
              </Link>
            ))}
          </nav>
        </div>
      </aside>

      {/* Mobile sidebar toggles */}
      <button
        type="button"
        className="app-sidebar-toggle app-sidebar-toggle-left"
        onClick={() => setLeftOpen((o) => !o)}
        aria-label="Open menu"
      >
        ☰
      </button>
      {leftOpen && (
        <div className="app-sidebar-overlay" onClick={() => setLeftOpen(false)} aria-hidden />
      )}
      {leftOpen && (
        <aside className="app-sidebar app-sidebar-left app-sidebar-mobile-open">
          <div className="app-sidebar-inner">
            <div className="app-sidebar-title">Overview</div>
            <nav className="app-sidebar-nav">
              {OVERVIEW_ITEMS.map(({ href, label, desc }) => (
                <Link
                  key={href}
                  href={href}
                  className={`app-sidebar-link ${pathname === href ? "active" : ""}`}
                  onClick={() => setLeftOpen(false)}
                >
                  <span className="app-sidebar-link-label">{label}</span>
                  <span className="app-sidebar-link-desc">{desc}</span>
                </Link>
              ))}
            </nav>
          </div>
        </aside>
      )}

      {/* Center content */}
      <main className="app-main">
        {children}
      </main>

      {/* Right sidebar (hidden on small screens) */}
      <aside className="app-sidebar app-sidebar-right">
        <div className="app-sidebar-inner">
          <div className="app-sidebar-title">Send</div>
          <div className="app-sidebar-card">
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10 }}>
              Send tokens to an ENS name or a 0x address on the same chain.
            </p>
            <Link href="/send" className="btn-primary" style={{ padding: 10, fontSize: 13, textAlign: "center" }}>
              Send to ENS →
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}

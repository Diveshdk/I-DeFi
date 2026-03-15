"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_ICONS: Record<string, React.ReactNode> = {
  markets: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" /></svg>
  ),
  swap: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 16V4M7 4L3 8M7 4l4 4" /><path d="M17 8v12M17 20l4-4M17 20l-4-4" /></svg>
  ),
  send: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
  ),
  feed: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /></svg>
  ),
  portfolio: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h4v16h-4" /><path d="M4 4h4v16H4" /><path d="M10 4h4v8h-4z" /></svg>
  ),
  profile: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
  ),
  launchpad: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22 12 2l8 20" /><path d="M12 12v10" /><path d="M8 18l4-6 4 6" /></svg>
  ),
  create: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
  ),
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></svg>
  ),
  broadcast: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.5 20.5a2.5 2.5 0 0 1-5 0" /><path d="M18.5 20.5a2.5 2.5 0 0 1-5 0" /><path d="M12 2v16" /><path d="M4 8a8 8 0 0 1 16 0" /></svg>
  ),
};

const OVERVIEW_ITEMS = [
  { href: "/", label: "Markets", desc: "Token prices & buy", icon: "markets" },
  { href: "/swap", label: "Swap", desc: "Trade on Base", icon: "swap" },
  { href: "/send", label: "Send to ENS", desc: "Send by ENS or address", icon: "send" },
  { href: "/feed", label: "Feed", desc: "Personalized feed", icon: "feed" },
  { href: "/portfolio", label: "Portfolio", desc: "Holdings", icon: "portfolio" },
  { href: "/profile", label: "Profile", desc: "Preferences & ENS", icon: "profile" },
  { href: "/launchpad", label: "Launchpad", desc: "Discover & join launches", icon: "launchpad" },
  { href: "/launchpad/create", label: "Create Project", desc: "Launch a token", icon: "create" },
  { href: "/launchpad/dashboard", label: "Creator Dashboard", desc: "Manage your projects", icon: "dashboard" },
  { href: "/broadcast", label: "Emergency broadcast", desc: "Alert all ENS users", icon: "broadcast" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [leftOpen, setLeftOpen] = useState(false);

  return (
    <div className="app-layout">
      <aside className="app-sidebar app-sidebar-left">
        <div className="app-sidebar-inner">
          <div className="app-sidebar-title">Overview</div>
          <nav className="app-sidebar-nav">
            {OVERVIEW_ITEMS.map(({ href, label, desc, icon }) => (
              <Link
                key={href}
                href={href}
                className={`app-sidebar-link ${pathname === href ? "active" : ""}`}
                onClick={() => setLeftOpen(false)}
              >
                <span className="app-sidebar-link-icon" aria-hidden>{NAV_ICONS[icon] ?? null}</span>
                <span className="app-sidebar-link-text">
                  <span className="app-sidebar-link-label">{label}</span>
                  <span className="app-sidebar-link-desc">{desc}</span>
                </span>
              </Link>
            ))}
          </nav>
        </div>
      </aside>

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
              {OVERVIEW_ITEMS.map(({ href, label, desc, icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`app-sidebar-link ${pathname === href ? "active" : ""}`}
                  onClick={() => setLeftOpen(false)}
                >
                  <span className="app-sidebar-link-icon" aria-hidden>{NAV_ICONS[icon] ?? null}</span>
                  <span className="app-sidebar-link-text">
                    <span className="app-sidebar-link-label">{label}</span>
                    <span className="app-sidebar-link-desc">{desc}</span>
                  </span>
                </Link>
              ))}
            </nav>
          </div>
        </aside>
      )}

      <main className="app-main">
        {children}
      </main>
    </div>
  );
}

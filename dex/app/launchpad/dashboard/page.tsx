"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";

type Project = {
  id: string;
  name: string;
  symbol: string;
  image: string | null;
  banner: string | null;
  chain: string;
  standard: string;
  status: string;
  creatorAddress: string;
  launchDate: string | null;
  raisedAmount: string | null;
  tokenomics: { hardCap: string | null } | null;
  _count?: { updates: number };
};

export default function LaunchpadDashboardPage() {
  const { address, isConnected } = useAccount();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/launchpad/projects")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!cancelled) {
          const list = Array.isArray(data) ? data : [];
          setProjects(list.filter((p: Project) => p.creatorAddress === address));
        }
      })
      .catch(() => {
        if (!cancelled) setProjects([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [address]);

  if (!isConnected) {
    return (
      <div className="main-content" style={{ maxWidth: 640, margin: "0 auto", padding: "0 16px" }}>
        <div className="page-header">
          <h1>Creator Dashboard</h1>
          <p>Connect your wallet to see your projects.</p>
        </div>
        <div className="card" style={{ padding: 24 }}>
          <p style={{ color: "var(--text-muted)" }}>Connect wallet to continue.</p>
          <Link href="/launchpad" className="btn-secondary" style={{ marginTop: 16, display: "inline-block" }}>Back to Launchpad</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content" style={{ maxWidth: 900, margin: "0 auto", padding: "0 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <Link href="/launchpad" style={{ fontSize: 14, color: "var(--accent)", marginBottom: 8, display: "inline-block" }}>← Launchpad</Link>
          <h1>Creator Dashboard</h1>
          <p>Manage your launchpad projects, post updates, and track funding.</p>
        </div>
        <Link href="/launchpad/create" className="btn-primary" style={{ padding: "12px 20px" }}>Create Project</Link>
      </div>

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : projects.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>You haven’t created any projects yet.</p>
          <Link href="/launchpad/create" className="btn-primary" style={{ padding: "12px 24px" }}>Create Project</Link>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
          {projects.map((p) => {
            const hardCap = p.tokenomics?.hardCap ? parseFloat(p.tokenomics.hardCap) : 0;
            const raised = p.raisedAmount ? parseFloat(p.raisedAmount) : 0;
            const progress = hardCap > 0 ? Math.min(100, (raised / hardCap) * 100) : 0;
            return (
              <div key={p.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ height: 100, background: "var(--bg-input)" }}>
                  {p.banner || p.image ? (
                    <img src={p.banner || p.image || ""} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, color: "var(--text-muted)" }}>🚀</div>
                  )}
                </div>
                <div style={{ padding: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{p.name} ({p.symbol})</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>{p.chain} · {p.standard} · {p.status}</div>
                  {hardCap > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                        <span>Raised</span>
                        <span>{raised} / {hardCap} ETH</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: "var(--bg-input)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${progress}%`, background: "var(--accent)", borderRadius: 2 }} />
                      </div>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Link href={`/launchpad/${p.id}`} className="btn-primary" style={{ padding: "8px 14px", fontSize: 13 }}>View</Link>
                    <Link href={`/launchpad/${p.id}/updates`} className="btn-secondary" style={{ padding: "8px 14px", fontSize: 13 }}>Updates ({p._count?.updates ?? 0})</Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

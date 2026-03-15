"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Project = {
  id: string;
  name: string;
  symbol: string;
  status: string;
  approved: boolean;
  featured: boolean;
  creatorAddress: string;
  createdAt: string;
};

export default function AdminLaunchpadPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/launchpad/projects")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setProjects(Array.isArray(data) ? data : []))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  const handlePatch = async (id: string, body: { approved?: boolean; featured?: boolean }) => {
    try {
      const res = await fetch(`/api/launchpad/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const updated = await res.json();
        setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, approved: updated.approved, featured: updated.featured } : p)));
      }
    } catch { /* ignore */ }
  };

  return (
    <div className="main-content" style={{ maxWidth: 900, margin: "0 auto", padding: "0 16px" }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <Link href="/launchpad" style={{ fontSize: 14, color: "var(--accent)", marginBottom: 8, display: "inline-block" }}>← Launchpad</Link>
        <h1>Admin · Launchpad</h1>
        <p>Approve projects, feature on homepage, or ban. (Optional: add auth so only admins can access.)</p>
      </div>

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase" }}>Project</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase" }}>Status</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase" }}>Approved</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase" }}>Featured</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <Link href={`/launchpad/${p.id}`} style={{ fontWeight: 600, color: "var(--accent)" }}>{p.name} ({p.symbol})</Link>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{p.creatorAddress.slice(0, 8)}…</div>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13 }}>{p.status}</td>
                  <td style={{ padding: "12px 16px" }}>{p.approved ? "Yes" : "No"}</td>
                  <td style={{ padding: "12px 16px" }}>{p.featured ? "Yes" : "No"}</td>
                  <td style={{ padding: "12px 16px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" className="btn-secondary" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => handlePatch(p.id, { approved: !p.approved })}>
                      {p.approved ? "Unapprove" : "Approve"}
                    </button>
                    <button type="button" className="btn-secondary" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => handlePatch(p.id, { featured: !p.featured })}>
                      {p.featured ? "Unfeature" : "Feature"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {projects.length === 0 && <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>No projects.</div>}
        </div>
      )}
    </div>
  );
}

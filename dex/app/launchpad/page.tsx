"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export type LaunchpadProject = {
  id: string;
  name: string;
  symbol: string;
  description: string | null;
  category: string | null;
  image: string | null;
  banner: string | null;
  chain: string;
  standard: string;
  creatorAddress: string;
  launchDate: string | null;
  endDate: string | null;
  status: string;
  raisedAmount: string | null;
  tokenomics?: { hardCap: string | null; softCap: string | null } | null;
  social?: Record<string, string | null> | null;
};

function formatDate(d: string | null): string {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; color: string }> = {
    live: { bg: "var(--green)", color: "white" },
    upcoming: { bg: "var(--accent)", color: "white" },
    ended: { bg: "var(--text-muted)", color: "var(--text-primary)" },
    draft: { bg: "var(--bg-hover)", color: "var(--text-secondary)" },
  };
  const s = styles[status] ?? styles.draft;
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: "var(--radius-sm)",
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        backgroundColor: s.bg,
        color: s.color,
      }}
    >
      {status}
    </span>
  );
}

function ProjectCard({ project }: { project: LaunchpadProject }) {
  const hardCap = project.tokenomics?.hardCap ? parseFloat(project.tokenomics.hardCap) : 0;
  const raised = project.raisedAmount ? parseFloat(project.raisedAmount) : 0;
  const progress = hardCap > 0 ? Math.min(100, (raised / hardCap) * 100) : 0;

  return (
    <div className="launchpad-card">
      <div className="launchpad-card-banner">
        {project.banner || project.image ? (
          <img src={project.banner || project.image || ""} alt="" />
        ) : (
          <div className="launchpad-card-placeholder">🚀</div>
        )}
        <div className="launchpad-card-status">
          <StatusBadge status={project.status} />
        </div>
      </div>
      <div className="launchpad-card-body">
        <h3 className="launchpad-card-title">
          {project.name} <span className="launchpad-card-symbol">({project.symbol})</span>
        </h3>
        <div className="launchpad-card-meta">
          Chain: {project.chain} · Standard: {project.standard}
        </div>
        <div className="launchpad-card-meta launchpad-card-date">
          Launch: {formatDate(project.launchDate)}
        </div>
        <div className="launchpad-card-creator">
          Creator: {project.creatorAddress.slice(0, 6)}…{project.creatorAddress.slice(-4)}
        </div>
        {(project.status === "live" || project.status === "ended") && hardCap > 0 && (
          <div className="launchpad-card-progress-wrap">
            <div className="launchpad-card-progress-labels">
              <span>Raised</span>
              <span>{raised} / {hardCap} ETH</span>
            </div>
            <div className="launchpad-card-progress-bar">
              <div className="launchpad-card-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
        <Link href={`/launchpad/${project.id}`} className="launchpad-card-cta">
          View Details
        </Link>
      </div>
    </div>
  );
}

export default function LaunchpadPage() {
  const [projects, setProjects] = useState<LaunchpadProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/launchpad/projects")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load"))))
      .then((data) => {
        if (!cancelled) setProjects(Array.isArray(data) ? data : []);
      })
      .catch((e) => {
        if (!cancelled) {
          setError((e as Error).message);
          setProjects([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const live = projects.filter((p) => p.status === "live");
  const upcoming = projects.filter((p) => p.status === "upcoming");
  const past = projects.filter((p) => p.status === "ended");
  const draft = projects.filter((p) => p.status === "draft");

  return (
    <div className="launchpad-page">
      <header className="launchpad-header">
        <div className="launchpad-header-content">
          <h1 className="launchpad-title">Launchpad</h1>
          <p className="launchpad-subtitle">Discover upcoming and active token launches. Participate in sales and track progress.</p>
        </div>
        <Link href="/launchpad/create" className="launchpad-header-cta btn-primary">
          Create Project
        </Link>
      </header>

      {error && (
        <div className="launchpad-error card">
          <p>Could not load projects. You can still create one.</p>
        </div>
      )}

      {loading ? (
        <div className="launchpad-loading">Loading projects…</div>
      ) : (
        <>
          {live.length > 0 && (
            <section className="launchpad-section">
              <h2 className="launchpad-section-title">Live Launches</h2>
              <div className="launchpad-grid">
                {live.map((p) => (
                  <ProjectCard key={p.id} project={p} />
                ))}
              </div>
            </section>
          )}
          {upcoming.length > 0 && (
            <section className="launchpad-section">
              <h2 className="launchpad-section-title">Upcoming Launches</h2>
              <div className="launchpad-grid">
                {upcoming.map((p) => (
                  <ProjectCard key={p.id} project={p} />
                ))}
              </div>
            </section>
          )}
          {past.length > 0 && (
            <section className="launchpad-section">
              <h2 className="launchpad-section-title">Past Launches</h2>
              <div className="launchpad-grid">
                {past.map((p) => (
                  <ProjectCard key={p.id} project={p} />
                ))}
              </div>
            </section>
          )}
          {live.length === 0 && upcoming.length === 0 && past.length === 0 && draft.length === 0 && !loading && (
            <div className="launchpad-empty card">
              <p>No projects yet. Create the first one.</p>
              <Link href="/launchpad/create" className="btn-primary">Create Project</Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

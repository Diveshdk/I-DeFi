"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAccount } from "wagmi";

type Project = {
  id: string;
  name: string;
  symbol: string;
  description: string | null;
  category: string | null;
  image: string | null;
  banner: string | null;
  gallery: string | null;
  chain: string;
  standard: string;
  creatorAddress: string;
  launchDate: string | null;
  launchTime: string | null;
  endDate: string | null;
  status: string;
  raisedAmount: string | null;
  tokenomics: {
    totalSupply: string | null;
    tokenPrice: string | null;
    softCap: string | null;
    hardCap: string | null;
    minBuy: string | null;
    maxBuy: string | null;
    publicSale: string | null;
    team: string | null;
    marketing: string | null;
    liquidity: string | null;
    treasury: string | null;
  } | null;
  social: {
    website: string | null;
    twitter: string | null;
    discord: string | null;
    telegram: string | null;
    github: string | null;
    medium: string | null;
  } | null;
  updates: { id: string; title: string; description: string | null; image: string | null; createdAt: string }[];
  roadmap: { quarter: string | null; title: string; body: string | null; sortOrder: number }[];
  documents: { type: string; url: string; name: string | null }[];
};

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function DistributionPieChart({ data }: { data: { label: string; value: string | null }[] }) {
  const total = data.reduce((s, d) => s + (Number(d.value) || 0), 0);
  if (total === 0) return <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-input)", borderRadius: "var(--radius-md)", fontSize: 12, color: "var(--text-muted)" }}>No distribution %</div>;
  const colors = ["var(--accent)", "var(--green)", "#a78bfa", "#f59e0b", "#ec4899"];
  let acc = 0;
  const segments = data.map((d, i) => {
    const pct = (Number(d.value) || 0) / total;
    const start = acc;
    acc += pct;
    return { label: d.label, value: d.value, pct: pct * 100, start: start * 360, end: acc * 360, color: colors[i % colors.length] };
  });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
      <div style={{ width: 120, height: 120, borderRadius: "50%", background: `conic-gradient(${segments.map((s) => `${s.color} ${s.start}deg ${s.end}deg`).join(", ")})` }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {segments.map((s) => (
          <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color }} />
            <span>{s.label}: {s.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const TAB_IDS = ["overview", "tokenomics", "roadmap", "whitepaper", "updates", "community"] as const;

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { address, isConnected } = useAccount();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<(typeof TAB_IDS)[number]>("overview");
  const [buyAmount, setBuyAmount] = useState("");
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/launchpad/projects/${projectId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (!cancelled) setProject(data);
      })
      .catch(() => {
        if (!cancelled) setProject(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [projectId]);

  const handleBuy = async () => {
    if (!project || project.status !== "live" || !buyAmount || !isConnected) return;
    setBuying(true);
    try {
      // Placeholder: in production call contract buyTokens() via wagmi/viem
      await new Promise((r) => setTimeout(r, 1000));
      setBuyAmount("");
    } finally {
      setBuying(false);
    }
  };

  if (loading) {
    return (
      <div className="main-content" style={{ maxWidth: 900, margin: "0 auto", padding: "0 16px" }}>
        <p style={{ color: "var(--text-muted)" }}>Loading project…</p>
      </div>
    );
  }
  if (!project) {
    return (
      <div className="main-content" style={{ maxWidth: 900, margin: "0 auto", padding: "0 16px" }}>
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>Project not found.</p>
          <Link href="/launchpad" className="btn-primary">Back to Launchpad</Link>
        </div>
      </div>
    );
  }

  const hardCap = project.tokenomics?.hardCap ? parseFloat(project.tokenomics.hardCap) : 0;
  const raised = project.raisedAmount ? parseFloat(project.raisedAmount) : 0;
  const progress = hardCap > 0 ? Math.min(100, (raised / hardCap) * 100) : 0;
  const tokenPrice = project.tokenomics?.tokenPrice ? parseFloat(project.tokenomics.tokenPrice) : 0;
  const estimatedTokens = tokenPrice > 0 && buyAmount ? parseFloat(buyAmount) / tokenPrice : 0;

  const distribution = project.tokenomics
    ? [
        { label: "Public Sale", value: project.tokenomics.publicSale },
        { label: "Team", value: project.tokenomics.team },
        { label: "Marketing", value: project.tokenomics.marketing },
        { label: "Liquidity", value: project.tokenomics.liquidity },
        { label: "Treasury", value: project.tokenomics.treasury },
      ].filter((d) => d.value)
    : [];

  return (
    <div className="main-content" style={{ maxWidth: 960, margin: "0 auto", padding: "0 16px" }}>
      <Link href="/launchpad" style={{ fontSize: 14, color: "var(--accent)", marginBottom: 12, display: "inline-block" }}>← Launchpad</Link>

      {/* Hero */}
      <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 24 }}>
        <div style={{ height: 200, background: "var(--bg-input)", position: "relative" }}>
          {project.banner || project.image ? (
            <img src={project.banner || project.image || ""} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 64, color: "var(--text-muted)" }}>🚀</div>
          )}
          <div style={{ position: "absolute", bottom: 16, left: 16, right: 16, display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
            <div style={{ width: 72, height: 72, borderRadius: "var(--radius-lg)", overflow: "hidden", border: "3px solid var(--bg-primary)", background: "var(--bg-input)" }}>
              {project.image ? <img src={project.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🪙</div>}
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 4px" }}>{project.name} <span style={{ color: "var(--accent)", fontWeight: 600 }}>({project.symbol})</span></h1>
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{project.chain} · {project.standard}</div>
              <span style={{ display: "inline-block", marginTop: 6, padding: "4px 10px", borderRadius: "var(--radius-sm)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", background: project.status === "live" ? "var(--green)" : project.status === "upcoming" ? "var(--accent)" : "var(--text-muted)", color: "white" }}>{project.status}</span>
            </div>
          </div>
        </div>
        <div style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Launch: {formatDate(project.launchDate)} {project.launchTime && `· ${project.launchTime}`}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Creator: {project.creatorAddress.slice(0, 8)}…{project.creatorAddress.slice(-6)}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "start" }}>
        <div>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 16, flexWrap: "wrap" }}>
            {TAB_IDS.map((t) => (
              <button
                key={t}
                type="button"
                className={tab === t ? "btn-primary" : "btn-secondary"}
                style={{ padding: "8px 14px", fontSize: 13, textTransform: "capitalize" }}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="card" style={{ padding: 24 }}>
            {tab === "overview" && (
              <>
                <div className="card-title" style={{ marginBottom: 12 }}>Overview</div>
                <p style={{ fontSize: 14, color: "var(--text-secondary)", whiteSpace: "pre-wrap", marginBottom: 16 }}>{project.description || "No description."}</p>
                {project.category && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Category: {project.category}</p>}
                {hardCap > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                      <span style={{ color: "var(--text-muted)" }}>Raised</span>
                      <span style={{ fontWeight: 600 }}>{raised} / {hardCap} ETH</span>
                    </div>
                    <div style={{ height: 8, borderRadius: 4, background: "var(--bg-input)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${progress}%`, background: "var(--accent)", borderRadius: 4 }} />
                    </div>
                  </div>
                )}
              </>
            )}
            {tab === "tokenomics" && (
              <>
                <div className="card-title" style={{ marginBottom: 16 }}>Tokenomics</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 20 }}>
                  {project.tokenomics?.totalSupply && <div><span style={{ fontSize: 12, color: "var(--text-muted)" }}>Total Supply</span><div style={{ fontWeight: 600 }}>{project.tokenomics.totalSupply}</div></div>}
                  {project.tokenomics?.tokenPrice && <div><span style={{ fontSize: 12, color: "var(--text-muted)" }}>Token Price</span><div style={{ fontWeight: 600 }}>{project.tokenomics.tokenPrice} ETH</div></div>}
                  {project.tokenomics?.softCap && <div><span style={{ fontSize: 12, color: "var(--text-muted)" }}>Soft Cap</span><div style={{ fontWeight: 600 }}>{project.tokenomics.softCap} ETH</div></div>}
                  {project.tokenomics?.hardCap && <div><span style={{ fontSize: 12, color: "var(--text-muted)" }}>Hard Cap</span><div style={{ fontWeight: 600 }}>{project.tokenomics.hardCap} ETH</div></div>}
                </div>
                {distribution.length > 0 && (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Distribution</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {distribution.map((d) => (
                        <span key={d.label} style={{ padding: "6px 12px", background: "var(--bg-secondary)", borderRadius: "var(--radius-sm)", fontSize: 13 }}>{d.label}: {d.value}%</span>
                      ))}
                    </div>
                    <div style={{ marginTop: 16 }}>
                      <DistributionPieChart data={distribution} />
                    </div>
                  </>
                )}
              </>
            )}
            {tab === "roadmap" && (
              <>
                <div className="card-title" style={{ marginBottom: 16 }}>Roadmap</div>
                {project.roadmap.length === 0 ? <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No roadmap.</p> : (
                  <div style={{ position: "relative", paddingLeft: 20, borderLeft: "2px solid var(--border)" }}>
                    {project.roadmap.map((r, i) => (
                      <div key={i} style={{ marginBottom: 16, position: "relative" }}>
                        <div style={{ position: "absolute", left: -26, width: 10, height: 10, borderRadius: "50%", background: "var(--accent)" }} />
                        <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>{r.quarter}</div>
                        <div style={{ fontWeight: 600, marginTop: 2 }}>{r.title}</div>
                        {r.body && <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{r.body}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            {tab === "whitepaper" && (
              <>
                <div className="card-title" style={{ marginBottom: 16 }}>Whitepaper & Documents</div>
                {project.documents.length === 0 ? <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No documents.</p> : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {project.documents.map((d) => (
                      <a key={d.url} href={d.url} target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ padding: "12px 16px", textAlign: "left" }}>
                        {d.name || d.type} →
                      </a>
                    ))}
                  </div>
                )}
              </>
            )}
            {tab === "updates" && (
              <>
                <div className="card-title" style={{ marginBottom: 16 }}>Updates</div>
                <Link href={`/launchpad/${projectId}/updates`} style={{ fontSize: 13, color: "var(--accent)", marginBottom: 12, display: "inline-block" }}>Post update (creator) →</Link>
                {project.updates.length === 0 ? <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No updates yet.</p> : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {project.updates.map((u) => (
                      <div key={u.id} style={{ padding: 12, background: "var(--bg-secondary)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                        <div style={{ fontWeight: 600, marginBottom: 4 }}>{u.title}</div>
                        {u.description && <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>{u.description}</p>}
                        {u.image && <img src={u.image} alt="" style={{ maxWidth: "100%", borderRadius: "var(--radius-sm)", marginBottom: 8 }} />}
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{formatDate(u.createdAt)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            {tab === "community" && (
              <>
                <div className="card-title" style={{ marginBottom: 16 }}>Community</div>
                {!project.social || !Object.values(project.social).some(Boolean) ? <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No links.</p> : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {project.social.website && <a href={project.social.website} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>Website</a>}
                    {project.social.twitter && <a href={project.social.twitter} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>Twitter</a>}
                    {project.social.discord && <a href={project.social.discord} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>Discord</a>}
                    {project.social.telegram && <a href={project.social.telegram} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>Telegram</a>}
                    {project.social.github && <a href={project.social.github} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>GitHub</a>}
                    {project.social.medium && <a href={project.social.medium} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>Medium</a>}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Sidebar: Participate */}
        <div className="card" style={{ padding: 24, position: "sticky", top: 16 }}>
          {project.status === "live" ? (
            <>
              <div className="card-title" style={{ marginBottom: 16 }}>Participate</div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>Buy tokens. Connect wallet to continue.</p>
              {!isConnected ? (
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Connect wallet to buy.</p>
              ) : (
                <>
                  <label className="token-input-label" style={{ display: "block", marginBottom: 6 }}>Amount (ETH)</label>
                  <input
                    type="number"
                    value={buyAmount}
                    onChange={(e) => setBuyAmount(e.target.value)}
                    placeholder="0.1"
                    style={{ width: "100%", padding: "12px 14px", marginBottom: 8, borderRadius: "var(--radius-md)", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14 }}
                  />
                  {tokenPrice > 0 && buyAmount && (
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Estimated tokens: {estimatedTokens.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                  )}
                  <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12 }}>Gas estimate: —</p>
                  <button type="button" className="btn-primary" style={{ width: "100%", padding: "12px" }} onClick={handleBuy} disabled={buying || !buyAmount}>
                    {buying ? "Processing…" : "Buy Tokens"}
                  </button>
                </>
              )}
              {hardCap > 0 && (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                    <span style={{ color: "var(--text-muted)" }}>Raised</span>
                    <span style={{ fontWeight: 600 }}>{raised} / {hardCap} ETH</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "var(--bg-input)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${progress}%`, background: "var(--accent)", borderRadius: 3 }} />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="card-title" style={{ marginBottom: 8 }}>Status: {project.status}</div>
          )}
        </div>
      </div>
    </div>
  );
}

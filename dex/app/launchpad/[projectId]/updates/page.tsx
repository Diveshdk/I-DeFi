"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAccount } from "wagmi";

type Update = { id: string; title: string; description: string | null; image: string | null; createdAt: string };

export default function ProjectUpdatesPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { address } = useAccount();
  const [updates, setUpdates] = useState<Update[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/launchpad/projects/${projectId}/updates`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!cancelled) setUpdates(Array.isArray(data) ? data : []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [projectId]);

  const handlePost = async () => {
    if (!title.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/launchpad/projects/${projectId}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim() || null, image: image.trim() || null }),
      });
      const data = await res.json();
      if (res.ok) {
        setUpdates((prev) => [data, ...prev]);
        setTitle("");
        setDescription("");
        setImage("");
      }
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="main-content" style={{ maxWidth: 640, margin: "0 auto", padding: "0 16px" }}>
      <Link href={`/launchpad/${projectId}`} style={{ fontSize: 14, color: "var(--accent)", marginBottom: 12, display: "inline-block" }}>← Project</Link>
      <h1 style={{ marginBottom: 8 }}>Project Updates</h1>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24 }}>Post announcements for your backers.</p>

      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <div className="card-title" style={{ marginBottom: 12 }}>Post update</div>
        <label className="token-input-label" style={{ display: "block", marginBottom: 6 }}>Title</label>
        <input
          style={{ width: "100%", padding: "12px 14px", marginBottom: 12, borderRadius: "var(--radius-md)", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14 }}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Smart contract audit completed"
        />
        <label className="token-input-label" style={{ display: "block", marginBottom: 6 }}>Description</label>
        <textarea
          style={{ width: "100%", padding: "12px 14px", marginBottom: 12, minHeight: 80, borderRadius: "var(--radius-md)", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14 }}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Details..."
        />
        <label className="token-input-label" style={{ display: "block", marginBottom: 6 }}>Image URL</label>
        <input
          style={{ width: "100%", padding: "12px 14px", marginBottom: 16, borderRadius: "var(--radius-md)", border: "1px solid var(--border)", background: "var(--bg-input)", color: "var(--text-primary)", fontSize: 14 }}
          value={image}
          onChange={(e) => setImage(e.target.value)}
          placeholder="https://..."
        />
        <button type="button" className="btn-primary" onClick={handlePost} disabled={posting || !title.trim()} style={{ padding: "12px 20px" }}>
          {posting ? "Posting…" : "Post Update"}
        </button>
      </div>

      {loading ? <p style={{ color: "var(--text-muted)" }}>Loading…</p> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {updates.map((u) => (
            <div key={u.id} className="card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{u.title}</div>
              {u.description && <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>{u.description}</p>}
              {u.image && <img src={u.image} alt="" style={{ maxWidth: "100%", borderRadius: "var(--radius-sm)", marginBottom: 8 }} />}
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{new Date(u.createdAt).toLocaleString()}</div>
            </div>
          ))}
          {updates.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No updates yet.</p>}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";

export default function BroadcastPage() {
  const [message, setMessage] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; total: number; sent: number; error?: string } | null>(null);

  const handleBroadcast = async () => {
    const text = message.trim() || "Emergency: Please check your assets and verified links. Stay safe.";
    setLoading(true);
    setResult(null);
    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (adminKey.trim()) headers["Authorization"] = `Bearer ${adminKey.trim()}`;
      const res = await fetch("/api/alerts/broadcast", {
        method: "POST",
        headers,
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, total: 0, sent: 0, error: data.error || "Broadcast failed" });
        return;
      }
      setResult({ ok: true, total: data.total ?? 0, sent: data.sent ?? 0 });
    } catch (e) {
      setResult({ ok: false, total: 0, sent: 0, error: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-content" style={{ maxWidth: 560, margin: "0 auto", padding: "0 16px" }}>
      <div className="page-header">
        <h1>Emergency broadcast</h1>
        <p>Send an alert to all ENS users who have registered for alerts (e.g. attack on a wallet or exchange). They will receive it at the email set on their ENS.</p>
      </div>
      <div className="card" style={{ padding: 24 }}>
        <label className="token-input-label" style={{ display: "block", marginBottom: 8 }}>
          Message
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. Reports of phishing on X. Verify links. Never share your seed phrase."
          rows={4}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border)",
            background: "var(--bg-input)",
            color: "var(--text-primary)",
            fontSize: 14,
            fontFamily: "inherit",
            resize: "vertical",
          }}
        />
        <label className="token-input-label" style={{ display: "block", marginTop: 16, marginBottom: 8 }}>
          Admin key (optional)
        </label>
        <input
          type="password"
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          placeholder="Set BROADCAST_SECRET in .env to require"
          style={{
            width: "100%",
            padding: "10px 14px",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border)",
            background: "var(--bg-input)",
            color: "var(--text-primary)",
            fontSize: 13,
          }}
        />
        <button
          type="button"
          className="btn-primary"
          onClick={handleBroadcast}
          disabled={loading}
          style={{ marginTop: 20, padding: 14 }}
        >
          {loading ? "Sending…" : "Broadcast to all ENS users"}
        </button>
        {result && (
          <div
            style={{
              marginTop: 20,
              padding: 14,
              borderRadius: "var(--radius-md)",
              background: result.ok ? "rgba(34,197,94,0.1)" : "rgba(248,81,73,0.1)",
              border: `1px solid ${result.ok ? "var(--green)" : "var(--red)"}`,
              fontSize: 14,
              color: "var(--text-primary)",
            }}
          >
            {result.ok ? (
              <>Sent to <strong>{result.sent}</strong> of <strong>{result.total}</strong> registered ENS users.</>
            ) : (
              <>Error: {result.error}</>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

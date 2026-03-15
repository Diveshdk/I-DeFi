"use client";

import { useState, useCallback } from "react";
import { useAccount } from "wagmi";
import { ethers } from "ethers";
import { TOKEN_LIST, ERC20_ABI, Token, formatAmount, parseAmount } from "../lib/contracts";
import { getInjectedSigner, isUserRejection } from "../lib/injectedSigner";
import { usePrices, formatUsd } from "../lib/priceService";

const WETH = TOKEN_LIST.find((t) => t.symbol === "WETH")!;
const SEND_ENS_CACHE_KEY = "crossdex_send_ens_cache";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function isAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

function looksLikeEns(value: string): boolean {
  return value.trim().toLowerCase().endsWith(".eth");
}

function getCachedResolved(name: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SEND_ENS_CACHE_KEY);
    if (!raw) return null;
    const cache: Record<string, { address: string; ts: number }> = JSON.parse(raw);
    const key = name.trim().toLowerCase();
    const entry = cache[key];
    if (!entry || Date.now() - entry.ts > CACHE_TTL_MS) return null;
    return entry.address;
  } catch {
    return null;
  }
}

function setCachedResolved(name: string, address: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(SEND_ENS_CACHE_KEY);
    const cache: Record<string, { address: string; ts: number }> = raw ? JSON.parse(raw) : {};
    cache[name.trim().toLowerCase()] = { address, ts: Date.now() };
    localStorage.setItem(SEND_ENS_CACHE_KEY, JSON.stringify(cache));
  } catch { /* ignore */ }
}

export default function SendPage() {
  const { address, isConnected } = useAccount();
  const [recipientInput, setRecipientInput] = useState("");
  const [resolvedAddress, setResolvedAddress] = useState<`0x${string}` | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [token, setToken] = useState<Token>(WETH);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const ids = TOKEN_LIST.map((t) => t.coingeckoId);
  const { prices } = usePrices(ids);
  const price = prices[token.coingeckoId] ?? 0;
  const amountNum = Number(amount) || 0;
  const usd = amountNum * price;

  const RESOLVE_TIMEOUT_MS = 10_000;
  const resolveEns = useCallback(async () => {
    const name = recipientInput.trim().toLowerCase();
    if (!name.endsWith(".eth")) {
      setResolveError("Enter an ENS name (name.eth) or a 0x address.");
      return;
    }
    const cached = getCachedResolved(name);
    if (cached) {
      setResolvedAddress(cached as `0x${string}`);
      setResolveError(null);
      return;
    }
    setResolving(true);
    setResolveError(null);
    setResolvedAddress(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), RESOLVE_TIMEOUT_MS);
    const slowId = setTimeout(() => {
      setResolveError("Taking longer than usual…");
    }, 3000);
    try {
      const res = await fetch(`/api/ens/resolve?name=${encodeURIComponent(name)}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      clearTimeout(slowId);
      setResolveError(null);
      const data = await res.json();
      if (!res.ok) {
        setResolveError(data.error || "Could not resolve ENS.");
        return;
      }
      const addr = data.address as string;
      setResolvedAddress(addr as `0x${string}`);
      setCachedResolved(name, addr);
    } catch (err) {
      clearTimeout(slowId);
      if ((err as Error).name === "AbortError") {
        setResolveError("Resolution timed out. Try again or paste a 0x address.");
      } else {
        setResolveError("Resolution failed.");
      }
    } finally {
      setResolving(false);
    }
  }, [recipientInput]);

  const handleRecipientBlur = () => {
    const v = recipientInput.trim();
    if (looksLikeEns(v)) resolveEns();
    else if (isAddress(v)) {
      setResolvedAddress(v as `0x${string}`);
      setResolveError(null);
    } else if (v.length > 0) setResolveError("Enter an ENS name (name.eth) or a 0x address.");
    else {
      setResolvedAddress(null);
      setResolveError(null);
    }
  };

  const handleSend = async () => {
    const to = resolvedAddress ?? (isAddress(recipientInput) ? (recipientInput.trim() as `0x${string}`) : null);
    if (!address || !to || !amount || amountNum <= 0) return;
    setLoading(true);
    setStatus(null);
    setTxHash(null);
    try {
      const signer = await getInjectedSigner();
      if (!signer) {
        setStatus({ type: "error", msg: "Wallet not available. Unlock MetaMask or install an injected wallet." });
        return;
      }
      const amountWei = parseAmount(amount, token.decimals);
      const isNative = token.symbol === "WETH";
      if (isNative) {
        const tx = await signer.sendTransaction({ to, value: amountWei });
        setStatus({ type: "success", msg: "Transaction sent. Waiting for confirmation…" });
        const receipt = await tx.wait();
        setTxHash(receipt?.hash ?? tx.hash);
        setStatus({ type: "success", msg: `Sent ${amount} ${token.symbol} to ${recipientInput.trim()}.` });
      } else {
        const contract = new ethers.Contract(token.address, ERC20_ABI, signer);
        const tx = await contract.transfer(to, amountWei);
        setStatus({ type: "success", msg: "Transaction sent. Waiting for confirmation…" });
        const receipt = await tx.wait();
        setTxHash(receipt?.hash ?? tx.hash);
        setStatus({ type: "success", msg: `Sent ${amount} ${token.symbol} to ${recipientInput.trim()}.` });
      }
      setAmount("");
    } catch (err: unknown) {
      if (isUserRejection(err)) {
        setStatus({ type: "error", msg: "Transaction rejected in wallet. You can try again." });
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        setStatus({ type: "error", msg: msg.slice(0, 120) || "Send failed." });
      }
    } finally {
      setLoading(false);
    }
  };

  const canSend = isConnected && (resolvedAddress || isAddress(recipientInput)) && amount && amountNum > 0 && !loading;

  return (
    <div className="main-content">
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="page-header">
          <h1>Send to ENS</h1>
          <p>Send tokens to an ENS name or to a 0x address on the same chain.</p>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div style={{ marginBottom: 16 }}>
            <label className="token-input-label">Recipient (ENS or address)</label>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <input
                type="text"
                className="token-amount-input"
                placeholder="name.eth or 0x..."
                value={recipientInput}
                onChange={(e) => {
                  setRecipientInput(e.target.value);
                  if (!e.target.value.trim()) setResolvedAddress(null);
                  setResolveError(null);
                }}
                onBlur={handleRecipientBlur}
                style={{ flex: 1 }}
              />
              {looksLikeEns(recipientInput) && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={resolveEns}
                  disabled={resolving}
                  style={{ whiteSpace: "nowrap" }}
                >
                  {resolving ? "Resolving…" : "Resolve"}
                </button>
              )}
            </div>
            {resolvedAddress && (
              <div style={{ marginTop: 10, padding: 10, background: "var(--bg-input)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>Resolved address (verify before sending)</div>
                <div style={{ fontFamily: "monospace", fontSize: 12, color: "var(--green)", wordBreak: "break-all" }}>{resolvedAddress}</div>
              </div>
            )}
            {resolveError && (
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--red)" }}>{resolveError}</div>
            )}
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="token-input-label">Token</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
              {TOKEN_LIST.map((t) => (
                <button
                  key={t.address}
                  type="button"
                  onClick={() => setToken(t)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "var(--radius-md)",
                    border: token.address === t.address ? "2px solid var(--accent)" : "1px solid var(--border)",
                    background: token.address === t.address ? "var(--bg-hover)" : "var(--bg-input)",
                    color: "var(--text-primary)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {t.emoji} {t.symbol}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label className="token-input-label">Amount</label>
            <input
              type="number"
              className="token-amount-input"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              style={{ marginTop: 6, width: "100%" }}
            />
            {usd > 0 && (
              <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-muted)" }}>≈ {formatUsd(usd)}</div>
            )}
          </div>
          {status && (
            <div className={`alert alert-${status.type}`} style={{ marginBottom: 16 }}>
              {status.msg}
              {txHash && (
                <span style={{ marginLeft: 8 }}>
                  <a
                    href={`https://basescan.org/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "inherit", fontWeight: 700 }}
                  >
                    View on Basescan ↗
                  </a>
                </span>
              )}
            </div>
          )}
          <button
            className="btn-primary"
            onClick={handleSend}
            disabled={!canSend}
            style={{ width: "100%", padding: 14 }}
          >
            {loading ? "Sending…" : `Send ${token.symbol}`}
          </button>
        </div>
      </div>
    </div>
  );
}

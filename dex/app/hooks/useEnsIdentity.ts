"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { normalizeEnsName } from "../lib/ens";
import type { EnsProfile } from "../lib/ens-preferences";

const ENS_CACHE_KEY = "crossdex_ens_reverse_cache";
const ENS_RESOLVE_TIMEOUT_MS = 12_000; // 12s then give up and inform user

function getCachedEnsName(address: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(ENS_CACHE_KEY);
    if (!raw) return null;
    const cache: Record<string, { name: string; ts: number }> = JSON.parse(raw);
    const entry = cache[address.toLowerCase()];
    if (!entry || Date.now() - entry.ts > 24 * 60 * 60 * 1000) return null; // 24h TTL
    return entry.name;
  } catch {
    return null;
  }
}

function setCachedEnsName(address: string, name: string | null): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(ENS_CACHE_KEY);
    const cache: Record<string, { name: string; ts: number }> = raw ? JSON.parse(raw) : {};
    const key = address.toLowerCase();
    if (name) cache[key] = { name, ts: Date.now() };
    else delete cache[key];
    localStorage.setItem(ENS_CACHE_KEY, JSON.stringify(cache));
  } catch { /* ignore */ }
}

export interface EnsIdentityState {
  address: string | undefined;
  ensName: string | null;
  profile: EnsProfile | null;
  loading: boolean;
  needsOnboarding: boolean;
  needsEnsInput: boolean;
  error: string | null;
}

/**
 * Resolve ENS from connected wallet (reverse lookup). Uses cache for instant show; refetches with timeout.
 */
export function useEnsNameFromAddress(address: string | undefined): {
  ensName: string | null;
  loading: boolean;
  refetch: () => Promise<void>;
} {
  const cached = address ? getCachedEnsName(address) : null;
  const [ensName, setEnsName] = useState<string | null>(cached);
  const [loading, setLoading] = useState(!cached && !!address);

  const refetch = useCallback(async () => {
    if (!address) {
      setEnsName(null);
      setLoading(false);
      return;
    }
    const fromCache = getCachedEnsName(address);
    if (fromCache) {
      setEnsName(fromCache);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), ENS_RESOLVE_TIMEOUT_MS);
      const res = await fetch(`/api/ens/reverse?address=${encodeURIComponent(address)}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      const name = data.name ?? null;
      setEnsName(name);
      setCachedEnsName(address, name);
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setEnsName(null);
        setCachedEnsName(address, null);
      } else {
        setEnsName(getCachedEnsName(address));
      }
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ensName, loading, refetch };
}

/**
 * Fetch user profile (preferences) from API by ENS or by wallet address.
 */
export async function fetchUserProfile(ensName: string | null, address: string | undefined): Promise<EnsProfile | null> {
  if (ensName) {
    const res = await fetch(`/api/user/preferences?ens=${encodeURIComponent(ensName)}`);
    if (res.ok) return res.json();
  }
  if (address) {
    const res = await fetch(`/api/user/preferences?address=${encodeURIComponent(address)}`);
    if (res.ok) return res.json();
  }
  return null;
}

/**
 * Full ENS identity: wallet → ENS name → profile.
 * Tells you if user needs to enter ENS or complete onboarding.
 */
export function useEnsIdentity(): EnsIdentityState & {
  setEnsNameManually: (name: string) => void;
  refetchProfile: () => Promise<void>;
  refetchEns: () => Promise<void>;
  updateWatchlist: (watchlist: string[]) => Promise<boolean>;
} {
  const { address, isConnected } = useAccount();
  const { ensName: resolvedEns, loading: ensLoading, refetch: refetchEns } = useEnsNameFromAddress(address);

  const [manualEns, setManualEns] = useState<string | null>(null);
  const ensName = manualEns || resolvedEns;

  const [profile, setProfile] = useState<EnsProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const refetchProfile = useCallback(async () => {
    if (!address) {
      setProfile(null);
      return;
    }
    setProfileLoading(true);
    try {
      const p = await fetchUserProfile(ensName || null, address);
      setProfile(p ?? null);
    } catch {
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, [address, ensName]);

  useEffect(() => {
    if (!address) {
      setProfile(null);
      return;
    }
    refetchProfile();
  }, [address, refetchProfile]);

  const setEnsNameManually = useCallback((name: string) => {
    const n = name.trim();
    setManualEns(n ? normalizeEnsName(n) : null);
  }, []);

  const updateWatchlist = useCallback(
    async (watchlist: string[]) => {
      if (!address) return false;
      try {
        const res = await fetch("/api/user/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ensName ? { ens_name: ensName, watchlist } : { address, watchlist }),
        });
        if (!res.ok) return false;
        const updated = await res.json();
        setProfile(updated);
        return true;
      } catch {
        return false;
      }
    },
    [address, ensName]
  );

  const loading = ensLoading || (!!address && profileLoading && profile === null);
  const needsEnsInput = isConnected && !!address && !ensLoading && !resolvedEns && !manualEns;
  const needsOnboarding = isConnected && !!address && !profile && !profileLoading;

  return {
    address,
    ensName: ensName || null,
    profile,
    loading,
    needsOnboarding,
    needsEnsInput,
    error: null,
    setEnsNameManually,
    refetchProfile,
    refetchEns,
    updateWatchlist,
  };
}

/**
 * Verify that the connected address owns the given ENS (for "enter your ENS" flow).
 * Uses same-origin API to avoid CORS (no direct Ethereum RPC from browser).
 */
export async function verifyEnsOwnership(address: string, ensName: string): Promise<boolean> {
  try {
    const name = normalizeEnsName(ensName);
    const res = await fetch(`/api/ens/resolve?name=${encodeURIComponent(name)}`);
    const data = await res.json();
    const resolved = data.address;
    if (!resolved) return false;
    return resolved.toLowerCase() === address.toLowerCase();
  } catch {
    return false;
  }
}

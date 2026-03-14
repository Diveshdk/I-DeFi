"use client";

import { useState, useEffect, useCallback } from "react";

// Hardcoded fallback prices (USD) — used when CoinGecko is unavailable
export const FALLBACK_PRICES: Record<string, number> = {
  ethereum: 3500,
  tether: 1.0,
  "usd-coin": 1.0,
  "wrapped-bitcoin": 95000,
  dai: 1.0,
  "coinbase-wrapped-staked-eth": 3500,
};

// 24h mock % changes (for the ticker display)
export const MOCK_CHANGES: Record<string, number> = {
  ethereum: 1.24,
  tether: 0.01,
  "usd-coin": 0.0,
  "wrapped-bitcoin": -0.87,
  dai: 0.0,
  "coinbase-wrapped-staked-eth": 1.24,
};

export type PriceMap = Record<string, number>; // coingeckoId → USD price
export type ChangeMap = Record<string, number>; // coingeckoId → 24h % change

let cachedPrices: PriceMap = { ...FALLBACK_PRICES };
let cachedChanges: ChangeMap = { ...MOCK_CHANGES };
let lastFetch = 0;
const CACHE_TTL = 60_000; // 60 seconds

export async function fetchPrices(ids: string[]): Promise<{ prices: PriceMap; changes: ChangeMap }> {
  const now = Date.now();
  if (now - lastFetch < CACHE_TTL) {
    return { prices: cachedPrices, changes: cachedChanges };
  }

  try {
    const idsStr = ids.join(",");
    // Use server-side proxy to avoid CORS/429 issues with CoinGecko
    const url = `/api/prices?ids=${idsStr}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error("Price API error");
    const data = await res.json();

    const prices: PriceMap = {};
    const changes: ChangeMap = {};
    for (const id of ids) {
      if (data[id]) {
        prices[id] = data[id].usd ?? FALLBACK_PRICES[id] ?? 0;
        changes[id] = data[id].usd_24h_change ?? MOCK_CHANGES[id] ?? 0;
      } else {
        prices[id] = FALLBACK_PRICES[id] ?? 0;
        changes[id] = MOCK_CHANGES[id] ?? 0;
      }
    }

    cachedPrices = prices;
    cachedChanges = changes;
    lastFetch = now;
    return { prices, changes };
  } catch {
    // Return fallback on any error
    lastFetch = now - CACHE_TTL + 10_000; // retry in 10 seconds
    return { prices: { ...FALLBACK_PRICES }, changes: { ...MOCK_CHANGES } };
  }
}

// ── React hook ────────────────────────────────────────────────────────────────
export function usePrices(ids: string[]) {
  const [prices, setPrices] = useState<PriceMap>({ ...FALLBACK_PRICES });
  const [changes, setChanges] = useState<ChangeMap>({ ...MOCK_CHANGES });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const result = await fetchPrices(ids);
    setPrices(result.prices);
    setChanges(result.changes);
    setLoading(false);
  }, [ids.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
    const interval = setInterval(load, CACHE_TTL);
    return () => clearInterval(interval);
  }, [load]);

  return { prices, changes, loading };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Format a USD dollar amount nicely */
export function formatUsd(amount: number): string {
  if (amount >= 1000) {
    return amount.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
  }
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 });
}

/** Given a raw bigint token amount and its price, return USD string */
export function tokenAmountToUsd(
  amount: bigint,
  decimals: number,
  priceUsd: number
): string {
  if (amount === 0n || priceUsd === 0) return "";
  const amountFloat = Number(amount) / Math.pow(10, decimals);
  const usd = amountFloat * priceUsd;
  return formatUsd(usd);
}

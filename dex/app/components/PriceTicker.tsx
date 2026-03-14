"use client";

import { useMemo } from "react";
import { TOKEN_LIST } from "../lib/contracts";
import { usePrices, formatUsd } from "../lib/priceService";

export default function PriceTicker() {
  const ids = useMemo(() => TOKEN_LIST.map(t => t.coingeckoId), []);
  const { prices, changes } = usePrices(ids);

  const items = TOKEN_LIST.map(token => ({
    symbol: token.symbol,
    emoji: token.emoji,
    price: prices[token.coingeckoId] ?? 0,
    change: changes[token.coingeckoId] ?? 0,
    color: token.color,
  }));

  // Quadruple for smooth seamless scroll
  const repeated = [...items, ...items, ...items, ...items];

  return (
    <div className="price-ticker">
      <div className="price-ticker-track">
        {repeated.map((item, i) => (
          <span key={i} className="price-ticker-item">
            <span className="ticker-emoji">{item.emoji}</span>
            <span className="ticker-symbol">{item.symbol}</span>
            <span className="ticker-price">{formatUsd(item.price)}</span>
            <span
              className="ticker-change"
              style={{ color: item.change >= 0 ? "var(--green)" : "var(--red)" }}
            >
              {item.change >= 0 ? "▲" : "▼"}{Math.abs(item.change).toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

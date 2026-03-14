import { NextResponse } from "next/server";

// Server-side proxy for CoinGecko coins/markets
// Avoids CORS issues and browser-side 429 rate limits

export async function GET() {
  try {
    const url =
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h";
    const res = await fetch(url, {
      next: { revalidate: 60 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (err) {
    console.error("[/api/markets]", err);
    return NextResponse.json([], { status: 502 });
  }
}

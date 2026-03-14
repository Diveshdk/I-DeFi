import { NextRequest, NextResponse } from "next/server";

// Server-side proxy for CoinGecko simple/price
// Avoids CORS issues and browser-side 429 rate limits

export async function GET(req: NextRequest) {
  const ids = req.nextUrl.searchParams.get("ids") ?? "";
  if (!ids) return NextResponse.json({}, { status: 400 });

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
    const res = await fetch(url, {
      next: { revalidate: 60 }, // cache for 60 seconds
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (err) {
    console.error("[/api/prices]", err);
    return NextResponse.json({}, { status: 502 });
  }
}

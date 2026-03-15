import { NextRequest, NextResponse } from "next/server";
import { resolveEnsName } from "../../../lib/ens";

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get("address")?.trim();
  if (!address || !address.startsWith("0x") || address.length !== 42) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  try {
    const name = await resolveEnsName(address as `0x${string}`);
    if (!name) {
      return NextResponse.json({ name: null }, { status: 200 });
    }
    return NextResponse.json({ name });
  } catch (err) {
    console.error("[/api/ens/reverse]", err);
    return NextResponse.json({ error: "Reverse resolution failed" }, { status: 502 });
  }
}

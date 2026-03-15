import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

const ENS_RPC = "https://eth.llamarpc.com";

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name")?.trim();
  if (!name || !name.endsWith(".eth")) {
    return NextResponse.json({ error: "Invalid ENS name (must end with .eth)" }, { status: 400 });
  }
  try {
    const provider = new ethers.JsonRpcProvider(ENS_RPC);
    const address = await provider.resolveName(name.toLowerCase());
    if (!address) {
      return NextResponse.json({ error: "ENS name not found or not resolved" }, { status: 404 });
    }
    return NextResponse.json({ name: name.toLowerCase(), address: address.toLowerCase() });
  } catch (err) {
    console.error("[/api/ens/resolve]", err);
    return NextResponse.json({ error: "Resolution failed" }, { status: 502 });
  }
}

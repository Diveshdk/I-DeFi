import { NextRequest, NextResponse } from "next/server";
import { getEnsTextRecord, ENS_TEXT_EMAIL, ENS_TEXT_PHONE } from "../../../lib/ens";

/**
 * GET /api/ens/contact?name=yourname.eth
 * Returns email and phone from ENS text records (linked to ENS on-chain).
 */
export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name")?.trim();
  if (!name || !name.endsWith(".eth")) {
    return NextResponse.json({ error: "Invalid ENS name (must end with .eth)" }, { status: 400 });
  }
  try {
    const [email, phone] = await Promise.all([
      getEnsTextRecord(name.toLowerCase(), ENS_TEXT_EMAIL),
      getEnsTextRecord(name.toLowerCase(), ENS_TEXT_PHONE),
    ]);
    return NextResponse.json({ email: email ?? null, phone: phone ?? null });
  } catch (err) {
    console.error("[/api/ens/contact]", err);
    return NextResponse.json({ error: "Failed to read ENS contact" }, { status: 502 });
  }
}

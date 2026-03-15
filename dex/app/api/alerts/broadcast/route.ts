import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { getEnsTextRecord, ENS_TEXT_EMAIL } from "../../../lib/ens";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE_PATH = path.join(DATA_DIR, "alert-rules.json");

async function readAll(): Promise<Record<string, { ens_name: string; rules: unknown[] }>> {
  try {
    if (!existsSync(FILE_PATH)) return {};
    const raw = await readFile(FILE_PATH, "utf-8");
    const data = JSON.parse(raw);
    return typeof data === "object" && data !== null ? data : {};
  } catch {
    return {};
  }
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? "alerts@resend.dev",
        to: [to],
        subject,
        html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * POST /api/alerts/broadcast
 * Body: { message: string }
 * Sends an emergency alert to all ENS users who have registered for alerts (have email set on ENS).
 * Optional: Authorization: Bearer BROADCAST_SECRET to restrict who can broadcast.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.BROADCAST_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: { message?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const message = (body.message ?? "").trim() || "Emergency: Please check your assets and verified links. Stay safe.";
  const subject = "I-DeFI Emergency Alert";

  const data = await readAll();
  const results: { ens: string; email: string | null; sent: boolean }[] = [];

  for (const ensName of Object.keys(data)) {
    const email = await getEnsTextRecord(ensName, ENS_TEXT_EMAIL);
    results.push({ ens: ensName, email, sent: false });
    if (email) {
      const html = `
        <p><strong>I-DeFI Emergency Alert</strong></p>
        <p>${message.replace(/\n/g, "<br/>")}</p>
        <p>You received this because you registered for alerts with ENS <strong>${ensName}</strong>.</p>
        <p>Always verify links and contracts. Never share your seed phrase.</p>
      `;
      const ok = await sendEmail(email, subject, html);
      results[results.length - 1].sent = ok;
    }
  }

  const sentCount = results.filter((r) => r.sent).length;
  return NextResponse.json({ ok: true, total: results.length, sent: sentCount, results });
}

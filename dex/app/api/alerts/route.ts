import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE_PATH = path.join(DATA_DIR, "alert-rules.json");

export type AlertRule = {
  id: string;
  type: "portfolio" | "token";
  threshold_usd: number;
  token_address?: string;
  /** When true, also alert when portfolio drops 20% from previous check. (portfolio only) */
  alert_on_drop_20?: boolean;
  /** Last known value for 20% drop detection. Updated by check job. */
  last_value?: number;
};

export type AlertRulesByEns = {
  ens_name: string;
  rules: AlertRule[];
};

function normalizeEns(ens: string): string {
  return ens.trim().toLowerCase().replace(/\.eth$/, "") + ".eth";
}

export async function readAll(): Promise<Record<string, AlertRulesByEns>> {
  try {
    if (!existsSync(FILE_PATH)) return {};
    const raw = await readFile(FILE_PATH, "utf-8");
    const data = JSON.parse(raw);
    return typeof data === "object" && data !== null ? data : {};
  } catch {
    return {};
  }
}

export async function writeAll(data: Record<string, AlertRulesByEns>): Promise<void> {
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
  await writeFile(FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * GET /api/alerts?ens=yourname.eth
 * Returns alert rules for this ENS. Contact (email/phone) is read from ENS when sending.
 */
export async function GET(req: NextRequest) {
  const ens = req.nextUrl.searchParams.get("ens");
  if (!ens) return NextResponse.json({ error: "Missing ens" }, { status: 400 });
  const key = normalizeEns(ens);
  const data = await readAll();
  const entry = data[key];
  if (!entry) return NextResponse.json({ ens_name: key, rules: [] });
  return NextResponse.json(entry);
}

/**
 * POST /api/alerts
 * Body: { ens_name: string, rules: AlertRule[] }
 * Saves alert rules keyed by ENS. Email/phone for delivery are read from ENS text records when we run the check.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ens_name, rules }: { ens_name: string; rules: AlertRule[] } = body;
    if (!ens_name || !ens_name.endsWith(".eth")) {
      return NextResponse.json({ error: "ens_name required (e.g. yourname.eth)" }, { status: 400 });
    }
    const key = normalizeEns(ens_name);
    const data = await readAll();
    const validRules = (Array.isArray(rules) ? rules : [])
      .filter((r: AlertRule) => r && (r.type === "portfolio" || (r.type === "token" && r.token_address)))
      .map((r: AlertRule) => ({
        id: r.id || `rule-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        type: r.type,
        threshold_usd: Number(r.threshold_usd) || 0,
        token_address: r.type === "token" ? r.token_address : undefined,
        alert_on_drop_20: r.type === "portfolio" ? Boolean(r.alert_on_drop_20) : undefined,
        last_value: typeof r.last_value === "number" ? r.last_value : undefined,
      }));
    data[key] = { ens_name: key, rules: validRules };
    await writeAll(data);
    return NextResponse.json(data[key]);
  } catch (e) {
    console.error("[POST /api/alerts]", e);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

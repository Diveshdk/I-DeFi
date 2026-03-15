import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import type { EnsProfile, EnsPreferences } from "../../../lib/ens-preferences";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE_PATH = path.join(DATA_DIR, "ens-profiles.json");

async function readProfiles(): Promise<Record<string, EnsProfile>> {
  try {
    if (!existsSync(FILE_PATH)) return {};
    const raw = await readFile(FILE_PATH, "utf-8");
    const data = JSON.parse(raw);
    return typeof data === "object" && data !== null ? data : {};
  } catch {
    return {};
  }
}

async function writeProfiles(profiles: Record<string, EnsProfile>): Promise<void> {
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
  await writeFile(FILE_PATH, JSON.stringify(profiles, null, 2), "utf-8");
}

function normalizeEns(ens: string): string {
  return ens.trim().toLowerCase().replace(/\.eth$/, "") + ".eth";
}

function addressKey(addr: string): string {
  return "addr:" + addr.toLowerCase();
}

/**
 * GET /api/user/preferences?ens=divesh.eth  OR  ?address=0x...
 * Returns the profile (preferences + watchlist) or 404.
 */
export async function GET(req: NextRequest) {
  const ens = req.nextUrl.searchParams.get("ens");
  const address = req.nextUrl.searchParams.get("address");
  if (!ens && !address) return NextResponse.json({ error: "Missing ens or address" }, { status: 400 });

  const profiles = await readProfiles();
  const key = ens ? normalizeEns(ens) : addressKey(address!);
  const profile = profiles[key];
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  return NextResponse.json(profile);
}

/**
 * POST /api/user/preferences
 * Body: { ens_name?, wallet_address, preferences, watchlist? }
 * Creates or updates the profile. Key by ENS if ens_name provided, else by wallet address.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      ens_name,
      wallet_address,
      preferences,
      watchlist,
    }: {
      ens_name?: string;
      wallet_address: string;
      preferences: EnsPreferences;
      watchlist?: string[];
    } = body;

    if (!wallet_address || !preferences) {
      return NextResponse.json(
        { error: "Missing wallet_address or preferences" },
        { status: 400 }
      );
    }

    const addr = wallet_address.toLowerCase();
    const key = ens_name ? normalizeEns(ens_name) : addressKey(addr);
    const now = new Date().toISOString();
    const profiles = await readProfiles();
    const existing = profiles[key];

    const profile: EnsProfile = {
      ens_name: ens_name ? normalizeEns(ens_name) : "",
      wallet_address: addr,
      preferences: {
        trading_style: preferences.trading_style ?? "swing_trader",
        risk_level: preferences.risk_level ?? "moderate",
        sectors: Array.isArray(preferences.sectors) ? preferences.sectors : [],
        ecosystems: Array.isArray(preferences.ecosystems) ? preferences.ecosystems : [],
        portfolio_size: preferences.portfolio_size,
        signals: Array.isArray(preferences.signals) ? preferences.signals : [],
        notifications: Array.isArray(preferences.notifications) ? preferences.notifications : ["daily_summary"],
      },
      watchlist: Array.isArray(watchlist) ? watchlist : existing?.watchlist ?? [],
      created_at: existing?.created_at ?? now,
      updated_at: now,
    };

    profiles[key] = profile;
    await writeProfiles(profiles);

    return NextResponse.json(profile);
  } catch (e) {
    console.error("[POST /api/user/preferences]", e);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

/**
 * PATCH /api/user/preferences
 * Body: { ens_name?, address?, watchlist?, preferences? }
 * Updates watchlist and/or preferences. Identify profile by ens_name or address.
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      ens_name,
      address,
      watchlist,
      preferences: prefUpdate,
    }: {
      ens_name?: string;
      address?: string;
      watchlist?: string[];
      preferences?: EnsPreferences;
    } = body;

    if (!ens_name && !address) {
      return NextResponse.json({ error: "Missing ens_name or address" }, { status: 400 });
    }
    const key = ens_name ? normalizeEns(ens_name) : addressKey(address!);
    const profiles = await readProfiles();
    const existing = profiles[key];
    if (!existing) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const updated: EnsProfile = {
      ...existing,
      updated_at: new Date().toISOString(),
    };
    if (Array.isArray(watchlist)) updated.watchlist = watchlist;
    if (prefUpdate && typeof prefUpdate === "object") {
      updated.preferences = {
        trading_style: prefUpdate.trading_style ?? existing.preferences.trading_style,
        risk_level: prefUpdate.risk_level ?? existing.preferences.risk_level,
        sectors: Array.isArray(prefUpdate.sectors) ? prefUpdate.sectors : existing.preferences.sectors,
        ecosystems: Array.isArray(prefUpdate.ecosystems) ? prefUpdate.ecosystems : existing.preferences.ecosystems,
        portfolio_size: prefUpdate.portfolio_size !== undefined ? prefUpdate.portfolio_size : existing.preferences.portfolio_size,
        signals: Array.isArray(prefUpdate.signals) ? prefUpdate.signals : existing.preferences.signals,
        notifications: Array.isArray(prefUpdate.notifications) ? prefUpdate.notifications : existing.preferences.notifications,
      };
    }

    profiles[key] = updated;
    await writeProfiles(profiles);
    return NextResponse.json(updated);
  } catch (e) {
    console.error("[PATCH /api/user/preferences]", e);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import type { EnsProfile } from "../../lib/ens-preferences";
import { ECOSYSTEM_LABELS, SECTOR_LABELS, RISK_LEVEL_LABELS } from "../../lib/ens-preferences";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE_PATH = path.join(DATA_DIR, "ens-profiles.json");

export interface FeedItem {
  id: string;
  type: "insight" | "narrative" | "whale" | "signal" | "token";
  title: string;
  body: string;
  cta?: string;
  ctaUrl?: string;
  tokens?: string[];
  narrative?: string;
  createdAt: string;
}

function addressKey(addr: string): string {
  return "addr:" + addr.toLowerCase();
}

async function getProfileByKey(key: string): Promise<EnsProfile | null> {
  try {
    if (!existsSync(FILE_PATH)) return null;
    const raw = await readFile(FILE_PATH, "utf-8");
    const data = JSON.parse(raw);
    return data[key] ?? null;
  } catch {
    return null;
  }
}

/**
 * GET /api/feed?ens=divesh.eth  OR  ?address=0x...
 * Returns personalized feed items for the profile.
 */
export async function GET(req: NextRequest) {
  const ens = req.nextUrl.searchParams.get("ens");
  const address = req.nextUrl.searchParams.get("address");
  if (!ens && !address) return NextResponse.json({ error: "Missing ens or address" }, { status: 400 });

  const key = ens ? ens.trim().toLowerCase().replace(/\.eth$/, "") + ".eth" : addressKey(address!);
  const profile = await getProfileByKey(key);
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const items: FeedItem[] = [];
  const now = new Date().toISOString();
  const { preferences } = profile;

  // 1. Welcome / preference summary
  const sectorsLabel = preferences.sectors.slice(0, 3).map((s) => SECTOR_LABELS[s]).join(", ") || "DeFi";
  const ecosystemsLabel = preferences.ecosystems.slice(0, 3).map((e) => ECOSYSTEM_LABELS[e]).join(", ") || "Ethereum";
  items.push({
    id: "welcome",
    type: "insight",
    title: "Your market profile",
    body: `We're tracking ${sectorsLabel} with a ${RISK_LEVEL_LABELS[preferences.risk_level]} risk lens. Favorite ecosystems: ${ecosystemsLabel}. Feed updates as we detect narrative and on-chain signals.`,
    createdAt: now,
  });

  // 2. Narrative-style item based on sectors
  if (preferences.sectors.includes("layer2")) {
    items.push({
      id: "narrative-l2",
      type: "narrative",
      title: "Layer 2 narrative",
      body: "L2 ecosystems (Base, Arbitrum, Optimism) continue to capture volume and TVL. Rollup token valuations and fee revenue are key metrics to watch.",
      tokens: ["ARB", "OP", "BASE"],
      narrative: "Layer 2s",
      cta: "View L2 tokens",
      ctaUrl: "/?tab=layer2",
      createdAt: now,
    });
  }
  if (preferences.sectors.includes("ai_tokens")) {
    items.push({
      id: "narrative-ai",
      type: "narrative",
      title: "AI token segment",
      body: "AI-related tokens remain volatile. On-chain activity and model deployment milestones tend to move prices. Sentiment is mixed.",
      tokens: ["FET", "RENDER", "TAO"],
      narrative: "AI tokens",
      createdAt: now,
    });
  }
  if (preferences.sectors.includes("defi")) {
    items.push({
      id: "signal-defi",
      type: "signal",
      title: "DeFi signal",
      body: "TVL and yield trends on your preferred chains (Ethereum, Base) are stable. Look for protocol-specific catalysts and governance events.",
      createdAt: now,
    });
  }

  // 3. Whale / on-chain placeholder (rule-based)
  if (preferences.signals.includes("whale_activity")) {
    items.push({
      id: "whale-placeholder",
      type: "whale",
      title: "Whale activity",
      body: "Smart money flows are being tracked. Enable on-chain data sources in settings for live whale alerts tailored to your watchlist.",
      cta: "Set watchlist",
      ctaUrl: "/feed",
      createdAt: now,
    });
  }

  // 4. Optional AI-generated item
  const aiKey = process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;
  if (aiKey && process.env.OPENAI_API_KEY) {
    try {
      const aiItem = await generateAIFeedItem(profile, aiKey);
      if (aiItem) items.push(aiItem);
    } catch {
      // ignore AI failure
    }
  }

  return NextResponse.json(
    { feed: items, ens_name: profile.ens_name },
    { headers: { "Cache-Control": "s-maxage=120, stale-while-revalidate=300" } }
  );
}

async function generateAIFeedItem(profile: EnsProfile, apiKey: string): Promise<FeedItem | null> {
  const prefs = JSON.stringify(profile.preferences, null, 0);
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a crypto market intelligence assistant. Return a single short feed item as JSON only, no markdown. Keys: id (string), type ('insight'), title (string), body (2-3 sentences), createdAt (ISO string). Be specific to the user's preferences.",
        },
        {
          role: "user",
          content: `User preferences: ${prefs}. Generate one personalized market insight. Return only valid JSON.`,
        },
      ],
      max_tokens: 300,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    return {
      id: parsed.id ?? "ai-1",
      type: "insight",
      title: parsed.title ?? "AI Insight",
      body: parsed.body ?? "",
      createdAt: parsed.createdAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

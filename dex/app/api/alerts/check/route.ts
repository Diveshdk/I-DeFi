import { NextRequest, NextResponse } from "next/server";
import type { AlertRule, AlertRulesByEns } from "../route";
import { readAll, writeAll } from "../route";
import { resolveEnsAddress, getEnsTextRecord, ENS_TEXT_EMAIL, ENS_TEXT_PHONE } from "../../../lib/ens";
import { basePublicClient, TOKEN_LIST, ERC20_ABI } from "../../../lib/contracts";

async function getPricesUsd(): Promise<Record<string, number>> {
  const ids = TOKEN_LIST.map((t) => t.coingeckoId).join(",");
  const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/prices?ids=${ids}`, { cache: "no-store" });
  if (!res.ok) return {};
  const data = await res.json();
  const out: Record<string, number> = {};
  for (const t of TOKEN_LIST) {
    out[t.address.toLowerCase()] = data[t.coingeckoId]?.usd ?? 0;
  }
  return out;
}

async function getPortfolioValueUsd(address: string): Promise<number> {
  const prices = await getPricesUsd();
  let total = 0;
  for (const token of TOKEN_LIST) {
    try {
      const raw = await basePublicClient.readContract({
        address: token.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      });
      const bal = Number(raw) / Math.pow(10, token.decimals);
      const price = prices[token.address.toLowerCase()] ?? 0;
      total += bal * price;
    } catch {
      // skip token on error
    }
  }
  return total;
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[alerts/check] RESEND_API_KEY not set; skipping email send");
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? "alerts@resend.dev",
        to: [to],
        subject,
        html,
      }),
    });
    return res.ok;
  } catch (e) {
    console.error("[alerts/check] sendEmail", e);
    return false;
  }
}

/**
 * POST /api/alerts/check
 * Runs alert checks: for each ENS with rules, resolve address & contact from ENS,
 * compute portfolio or token value; if below threshold, send email (and optionally SMS) from ENS-linked contact.
 * Call from a cron (e.g. Vercel Cron) every 5–15 min.
 */
export async function POST(req: NextRequest) {
  // Optional: require a secret to prevent public abuse
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await readAll();
  const results: { ens: string; sent: string[]; errors: string[] }[] = [];

  for (const ensName of Object.keys(data)) {
    const entry = data[ensName];
    if (!entry?.rules?.length) continue;

    const address = await resolveEnsAddress(ensName);
    if (!address) {
      results.push({ ens: ensName, sent: [], errors: ["ENS could not be resolved to address"] });
      continue;
    }

    const [email, phone] = await Promise.all([
      getEnsTextRecord(ensName, ENS_TEXT_EMAIL),
      getEnsTextRecord(ensName, ENS_TEXT_PHONE),
    ]);
    if (!email && !phone) {
      results.push({ ens: ensName, sent: [], errors: ["No email or phone on ENS; set email at app.ens.domains"] });
      continue;
    }

    const prices = await getPricesUsd();
    const sent: string[] = [];
    const errors: string[] = [];

    for (const rule of entry.rules) {
      let currentValue = 0;
      if (rule.type === "portfolio") {
        currentValue = await getPortfolioValueUsd(address);
        const prev = (rule as AlertRule).last_value;
        if ((rule as AlertRule).alert_on_drop_20 && prev != null && prev > 0 && currentValue < prev * 0.8) {
          const subject = "I-DeFI Alert: Portfolio dropped 20%";
          const html = `
            <p>Your I-DeFI alert triggered for <strong>${ensName}</strong>.</p>
            <p><strong>Portfolio dropped 20%</strong> from previous check (was ~$${prev.toFixed(2)}, now ~$${currentValue.toFixed(2)}).</p>
            <p>Verify your assets and links. Stay safe.</p>
          `;
          if (email) {
            const ok = await sendEmail(email, subject, html);
            if (ok) sent.push(`email:${email}(20% drop)`);
            else errors.push(`Failed to send 20% drop email to ${email}`);
          }
        }
        (rule as AlertRule).last_value = currentValue;
      } else if (rule.type === "token" && rule.token_address) {
        const token = TOKEN_LIST.find((t) => t.address.toLowerCase() === rule.token_address!.toLowerCase());
        const price = prices[rule.token_address.toLowerCase()] ?? 0;
        if (token) {
          try {
            const raw = await basePublicClient.readContract({
              address: rule.token_address as `0x${string}`,
              abi: ERC20_ABI,
              functionName: "balanceOf",
              args: [address],
            });
            const bal = Number(raw) / Math.pow(10, token.decimals);
            currentValue = bal * price;
          } catch {
            currentValue = 0;
          }
        }
      }

      if (currentValue < rule.threshold_usd) {
        const subject = `I-DeFI Alert: ${rule.type === "portfolio" ? "Portfolio" : "Token"} below $${rule.threshold_usd}`;
        const html = `
          <p>Your I-DeFI alert triggered for <strong>${ensName}</strong>.</p>
          <p><strong>Rule:</strong> ${rule.type === "portfolio" ? "Portfolio value" : "Token value"} below $${rule.threshold_usd}.</p>
          <p><strong>Current value:</strong> $${currentValue.toFixed(2)}</p>
          <p>Set your email/phone on your ENS at <a href="https://app.ens.domains">app.ens.domains</a> to receive these alerts.</p>
        `;
        if (email) {
          const ok = await sendEmail(email, subject, html);
          if (ok) sent.push(`email:${email}`);
          else errors.push(`Failed to send email to ${email}`);
        }
        if (phone) {
          errors.push("SMS not configured (set Twilio env vars for SMS)");
        }
      }
    }

    results.push({ ens: ensName, sent, errors });
  }

  await writeAll(data);
  return NextResponse.json({ ok: true, results });
}

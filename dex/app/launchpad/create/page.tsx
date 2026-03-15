"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import Link from "next/link";

const CATEGORIES = ["DeFi", "NFT", "Gaming", "AI", "Infrastructure", "Media"];
const CHAINS = ["Base", "Ethereum", "Polygon", "Arbitrum"];
const STANDARDS = ["ERC20", "ERC721", "ERC1155"];
const CONTRACT_TYPES = ["Upgradeable Proxy", "Non-Upgradeable"];
const SALE_TYPES = ["Public sale", "Whitelist sale", "Private round"];

export default function CreateProjectPage() {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [image, setImage] = useState("");
  const [banner, setBanner] = useState("");
  const [gallery, setGallery] = useState("");
  const [chain, setChain] = useState("Base");
  const [standard, setStandard] = useState("ERC20");
  const [contractType, setContractType] = useState("Upgradeable Proxy");
  const [launchDate, setLaunchDate] = useState("");
  const [launchTime, setLaunchTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [vestingPeriod, setVestingPeriod] = useState("");
  const [claimDate, setClaimDate] = useState("");
  const [saleType, setSaleType] = useState("Public sale");
  const [whitelistData, setWhitelistData] = useState("");
  const [status, setStatus] = useState("draft");

  const [totalSupply, setTotalSupply] = useState("");
  const [tokenPrice, setTokenPrice] = useState("");
  const [softCap, setSoftCap] = useState("");
  const [hardCap, setHardCap] = useState("");
  const [minBuy, setMinBuy] = useState("");
  const [maxBuy, setMaxBuy] = useState("");
  const [publicSalePct, setPublicSalePct] = useState("");
  const [teamPct, setTeamPct] = useState("");
  const [marketingPct, setMarketingPct] = useState("");
  const [liquidityPct, setLiquidityPct] = useState("");
  const [treasuryPct, setTreasuryPct] = useState("");

  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [discord, setDiscord] = useState("");
  const [telegram, setTelegram] = useState("");
  const [github, setGithub] = useState("");
  const [medium, setMedium] = useState("");

  const [whitepaperUrl, setWhitepaperUrl] = useState("");
  const [litepaperUrl, setLitepaperUrl] = useState("");
  const [tokenomicsPdfUrl, setTokenomicsPdfUrl] = useState("");
  const [pitchDeckUrl, setPitchDeckUrl] = useState("");

  const [roadmap, setRoadmap] = useState<{ quarter: string; title: string; body: string }[]>([
    { quarter: "Q1 2026", title: "", body: "" },
    { quarter: "Q2 2026", title: "", body: "" },
    { quarter: "Q3 2026", title: "", body: "" },
  ]);

  const payload = {
    name: name.trim(),
    symbol: symbol.trim().toUpperCase().slice(0, 10),
    description: description.trim() || null,
    category: category || null,
    image: image.trim() || null,
    banner: banner.trim() || null,
    gallery: gallery.trim() ? gallery.split("\n").map((u) => u.trim()).filter(Boolean) : [],
    chain,
    standard,
    contractType,
    creatorAddress: address,
    launchDate: launchDate || null,
    launchTime: launchTime.trim() || null,
    endDate: endDate || null,
    vestingPeriod: vestingPeriod.trim() || null,
    claimDate: claimDate || null,
    saleType: saleType,
    whitelistData: whitelistData.trim() || null,
    status,
    tokenomics: {
      totalSupply: totalSupply.trim() || null,
      tokenPrice: tokenPrice.trim() || null,
      softCap: softCap.trim() || null,
      hardCap: hardCap.trim() || null,
      minBuy: minBuy.trim() || null,
      maxBuy: maxBuy.trim() || null,
      publicSale: publicSalePct.trim() || null,
      team: teamPct.trim() || null,
      marketing: marketingPct.trim() || null,
      liquidity: liquidityPct.trim() || null,
      treasury: treasuryPct.trim() || null,
    },
    social: {
      website: website.trim() || null,
      twitter: twitter.trim() || null,
      discord: discord.trim() || null,
      telegram: telegram.trim() || null,
      github: github.trim() || null,
      medium: medium.trim() || null,
    },
    roadmap: roadmap.filter((r) => r.title.trim()).map((r) => ({ quarter: r.quarter, title: r.title, body: r.body })),
    documents: [
      whitepaperUrl.trim() && { type: "whitepaper", url: whitepaperUrl.trim(), name: "Whitepaper" },
      litepaperUrl.trim() && { type: "litepaper", url: litepaperUrl.trim(), name: "Litepaper" },
      tokenomicsPdfUrl.trim() && { type: "tokenomics", url: tokenomicsPdfUrl.trim(), name: "Tokenomics" },
      pitchDeckUrl.trim() && { type: "pitchdeck", url: pitchDeckUrl.trim(), name: "Pitch Deck" },
    ].filter(Boolean) as { type: string; url: string; name: string }[],
  };

  const handleSubmit = async () => {
    if (!name.trim() || !symbol.trim()) {
      setError("Project name and token symbol are required.");
      return;
    }
    if (!isConnected || !address) {
      setError("Connect your wallet to create a project.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/launchpad/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create");
      router.push(`/launchpad/${data.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = {
    width: "100%",
    padding: "12px 14px",
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--border)",
    background: "var(--bg-input)",
    color: "var(--text-primary)",
    fontSize: 14,
  };

  const labelClass = "token-input-label";
  const sectionTitle = "card-title";

  if (!isConnected) {
    return (
      <div className="main-content" style={{ maxWidth: 640, margin: "0 auto", padding: "0 16px" }}>
        <div className="page-header">
          <h1>Create Project</h1>
          <p>Connect your wallet to create a launchpad project.</p>
        </div>
        <div className="card" style={{ padding: 24 }}>
          <p style={{ color: "var(--text-muted)" }}>Use the navbar to connect your wallet, then return here.</p>
          <Link href="/launchpad" className="btn-secondary" style={{ marginTop: 16, display: "inline-block" }}>Back to Launchpad</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content" style={{ maxWidth: 720, margin: "0 auto", padding: "0 16px" }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <Link href="/launchpad" style={{ fontSize: 14, color: "var(--accent)", marginBottom: 8, display: "inline-block" }}>← Launchpad</Link>
        <h1>Create Project</h1>
        <p>Add your token launch with metadata, tokenomics, and launch settings. You can save as draft and deploy the contract later.</p>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              className={step === s ? "btn-primary" : "btn-secondary"}
              style={{ padding: "8px 14px", fontSize: 13 }}
              onClick={() => setStep(s)}
            >
              {s === 1 && "Basic"}
              {s === 2 && "Chain & Contract"}
              {s === 3 && "Tokenomics"}
              {s === 4 && "Launch & Docs"}
              {s === 5 && "Community"}
            </button>
          ))}
        </div>

        {step === 1 && (
          <>
            <div className={sectionTitle} style={{ marginBottom: 16 }}>Basic Info</div>
            <label className={labelClass} style={{ display: "block", marginBottom: 6 }}>Project Name *</label>
            <input style={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Project Name" />
            <label className={labelClass} style={{ display: "block", marginBottom: 6, marginTop: 12 }}>Token Symbol *</label>
            <input style={inputClass} value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase().slice(0, 10))} placeholder="SYMBOL" />
            <label className={labelClass} style={{ display: "block", marginBottom: 6, marginTop: 12 }}>Description</label>
            <textarea style={{ ...inputClass, minHeight: 100 }} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" />
            <label className={labelClass} style={{ display: "block", marginBottom: 6, marginTop: 12 }}>Category</label>
            <select style={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Select</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div className={sectionTitle} style={{ marginTop: 24, marginBottom: 12 }}>Upload (URLs)</div>
            <label className={labelClass} style={{ display: "block", marginBottom: 6 }}>Project Logo URL</label>
            <input style={inputClass} value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://..." />
            <label className={labelClass} style={{ display: "block", marginBottom: 6, marginTop: 12 }}>Banner Image URL</label>
            <input style={inputClass} value={banner} onChange={(e) => setBanner(e.target.value)} placeholder="https://..." />
            <label className={labelClass} style={{ display: "block", marginBottom: 6, marginTop: 12 }}>Gallery (one URL per line)</label>
            <textarea style={{ ...inputClass, minHeight: 80 }} value={gallery} onChange={(e) => setGallery(e.target.value)} placeholder="https://...\nhttps://..." />
          </>
        )}

        {step === 2 && (
          <>
            <div className={sectionTitle} style={{ marginBottom: 16 }}>Chain & Contract</div>
            <label className={labelClass} style={{ display: "block", marginBottom: 6 }}>Blockchain</label>
            <select style={inputClass} value={chain} onChange={(e) => setChain(e.target.value)}>
              {CHAINS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <label className={labelClass} style={{ display: "block", marginBottom: 6, marginTop: 12 }}>Token Standard</label>
            <select style={inputClass} value={standard} onChange={(e) => setStandard(e.target.value)}>
              {STANDARDS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <label className={labelClass} style={{ display: "block", marginBottom: 6, marginTop: 12 }}>Contract Type</label>
            <select style={inputClass} value={contractType} onChange={(e) => setContractType(e.target.value)}>
              {CONTRACT_TYPES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12 }}>Contract deployment can be done from the project page after creation (wagmi + viem).</p>
          </>
        )}

        {step === 3 && (
          <>
            <div className={sectionTitle} style={{ marginBottom: 16 }}>Tokenomics</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label className={labelClass} style={{ display: "block", marginBottom: 6 }}>Total Supply</label>
                <input style={inputClass} value={totalSupply} onChange={(e) => setTotalSupply(e.target.value)} placeholder="e.g. 1000000000" />
              </div>
              <div>
                <label className={labelClass} style={{ display: "block", marginBottom: 6 }}>Token Price (ETH)</label>
                <input style={inputClass} value={tokenPrice} onChange={(e) => setTokenPrice(e.target.value)} placeholder="0.001" />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <div>
                <label className={labelClass} style={{ display: "block", marginBottom: 6 }}>Soft Cap (ETH)</label>
                <input style={inputClass} value={softCap} onChange={(e) => setSoftCap(e.target.value)} placeholder="100" />
              </div>
              <div>
                <label className={labelClass} style={{ display: "block", marginBottom: 6 }}>Hard Cap (ETH)</label>
                <input style={inputClass} value={hardCap} onChange={(e) => setHardCap(e.target.value)} placeholder="500" />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <div>
                <label className={labelClass} style={{ display: "block", marginBottom: 6 }}>Min Buy</label>
                <input style={inputClass} value={minBuy} onChange={(e) => setMinBuy(e.target.value)} placeholder="0.1" />
              </div>
              <div>
                <label className={labelClass} style={{ display: "block", marginBottom: 6 }}>Max Buy</label>
                <input style={inputClass} value={maxBuy} onChange={(e) => setMaxBuy(e.target.value)} placeholder="10" />
              </div>
            </div>
            <div className={sectionTitle} style={{ marginTop: 20, marginBottom: 8 }}>Distribution %</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div><label className={labelClass} style={{ display: "block", marginBottom: 6 }}>Public Sale</label><input style={inputClass} value={publicSalePct} onChange={(e) => setPublicSalePct(e.target.value)} placeholder="40" /></div>
              <div><label className={labelClass} style={{ display: "block", marginBottom: 6 }}>Team</label><input style={inputClass} value={teamPct} onChange={(e) => setTeamPct(e.target.value)} placeholder="20" /></div>
              <div><label className={labelClass} style={{ display: "block", marginBottom: 6 }}>Marketing</label><input style={inputClass} value={marketingPct} onChange={(e) => setMarketingPct(e.target.value)} placeholder="10" /></div>
              <div><label className={labelClass} style={{ display: "block", marginBottom: 6 }}>Liquidity</label><input style={inputClass} value={liquidityPct} onChange={(e) => setLiquidityPct(e.target.value)} placeholder="20" /></div>
              <div><label className={labelClass} style={{ display: "block", marginBottom: 6 }}>Treasury</label><input style={inputClass} value={treasuryPct} onChange={(e) => setTreasuryPct(e.target.value)} placeholder="10" /></div>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div className={sectionTitle} style={{ marginBottom: 16 }}>Launch Settings</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label className={labelClass} style={{ display: "block", marginBottom: 6 }}>Launch Date</label>
                <input style={inputClass} type="date" value={launchDate} onChange={(e) => setLaunchDate(e.target.value)} />
              </div>
              <div>
                <label className={labelClass} style={{ display: "block", marginBottom: 6 }}>Launch Time</label>
                <input style={inputClass} type="time" value={launchTime} onChange={(e) => setLaunchTime(e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label className={labelClass} style={{ display: "block", marginBottom: 6 }}>End Date</label>
              <input style={inputClass} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div style={{ marginTop: 12 }}>
              <label className={labelClass} style={{ display: "block", marginBottom: 6 }}>Vesting Period</label>
              <input style={inputClass} value={vestingPeriod} onChange={(e) => setVestingPeriod(e.target.value)} placeholder="e.g. 6 months" />
            </div>
            <div style={{ marginTop: 12 }}>
              <label className={labelClass} style={{ display: "block", marginBottom: 6 }}>Claim Date</label>
              <input style={inputClass} type="date" value={claimDate} onChange={(e) => setClaimDate(e.target.value)} />
            </div>
            <div style={{ marginTop: 12 }}>
              <label className={labelClass} style={{ display: "block", marginBottom: 6 }}>Sale Type</label>
              <select style={inputClass} value={saleType} onChange={(e) => setSaleType(e.target.value)}>
                {SALE_TYPES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            {saleType === "Whitelist sale" && (
              <div style={{ marginTop: 12 }}>
                <label className={labelClass} style={{ display: "block", marginBottom: 6 }}>Whitelist (comma-separated addresses or IPFS hash)</label>
                <textarea style={{ ...inputClass, minHeight: 80 }} value={whitelistData} onChange={(e) => setWhitelistData(e.target.value)} placeholder="0x... or ipfs://..." />
              </div>
            )}
            <div style={{ marginTop: 12 }}>
              <label className={labelClass} style={{ display: "block", marginBottom: 6 }}>Initial Status</label>
              <select style={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="draft">Draft</option>
                <option value="upcoming">Upcoming</option>
                <option value="live">Live</option>
              </select>
            </div>
            <div className={sectionTitle} style={{ marginTop: 24, marginBottom: 12 }}>Documents (URLs)</div>
            <input style={inputClass} value={whitepaperUrl} onChange={(e) => setWhitepaperUrl(e.target.value)} placeholder="Whitepaper PDF URL" />
            <input style={{ ...inputClass, marginTop: 8 }} value={litepaperUrl} onChange={(e) => setLitepaperUrl(e.target.value)} placeholder="Litepaper URL" />
            <input style={{ ...inputClass, marginTop: 8 }} value={tokenomicsPdfUrl} onChange={(e) => setTokenomicsPdfUrl(e.target.value)} placeholder="Tokenomics PDF URL" />
            <input style={{ ...inputClass, marginTop: 8 }} value={pitchDeckUrl} onChange={(e) => setPitchDeckUrl(e.target.value)} placeholder="Pitch Deck URL" />
            <div className={sectionTitle} style={{ marginTop: 20, marginBottom: 8 }}>Roadmap</div>
            {roadmap.map((r, i) => (
              <div key={i} style={{ marginBottom: 12, padding: 12, background: "var(--bg-secondary)", borderRadius: "var(--radius-md)" }}>
                <input style={{ ...inputClass, marginBottom: 8 }} value={r.quarter} onChange={(e) => setRoadmap((prev) => prev.map((x, j) => (j === i ? { ...x, quarter: e.target.value } : x)))} placeholder="Q1 2026" />
                <input style={inputClass} value={r.title} onChange={(e) => setRoadmap((prev) => prev.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder="Title" />
                <input style={inputClass} value={r.body} onChange={(e) => setRoadmap((prev) => prev.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} placeholder="Description" />
              </div>
            ))}
          </>
        )}

        {step === 5 && (
          <>
            <div className={sectionTitle} style={{ marginBottom: 16 }}>Community Links</div>
            <label className={labelClass} style={{ display: "block", marginBottom: 6 }}>Website</label>
            <input style={inputClass} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://..." />
            <label className={labelClass} style={{ display: "block", marginBottom: 6, marginTop: 12 }}>Twitter</label>
            <input style={inputClass} value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="https://twitter.com/..." />
            <label className={labelClass} style={{ display: "block", marginBottom: 6, marginTop: 12 }}>Discord</label>
            <input style={inputClass} value={discord} onChange={(e) => setDiscord(e.target.value)} placeholder="https://discord.gg/..." />
            <label className={labelClass} style={{ display: "block", marginBottom: 6, marginTop: 12 }}>Telegram</label>
            <input style={inputClass} value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="https://t.me/..." />
            <label className={labelClass} style={{ display: "block", marginBottom: 6, marginTop: 12 }}>GitHub</label>
            <input style={inputClass} value={github} onChange={(e) => setGithub(e.target.value)} placeholder="https://github.com/..." />
            <label className={labelClass} style={{ display: "block", marginBottom: 6, marginTop: 12 }}>Medium</label>
            <input style={inputClass} value={medium} onChange={(e) => setMedium(e.target.value)} placeholder="https://medium.com/..." />
          </>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 24, flexWrap: "wrap", gap: 12 }}>
          <button type="button" className="btn-secondary" onClick={() => setStep((s) => Math.max(1, s - 1))} style={{ padding: "12px 20px" }}>
            Back
          </button>
          {step < 5 ? (
            <button type="button" className="btn-primary" onClick={() => setStep((s) => Math.min(5, s + 1))} style={{ padding: "12px 20px" }}>
              Next
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={handleSubmit} disabled={saving} style={{ padding: "12px 24px" }}>
              {saving ? "Creating…" : "Create Project"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="card" style={{ padding: 16, marginBottom: 24, border: "1px solid var(--red)", background: "var(--bg-secondary)" }}>
          <p style={{ color: "var(--red)", fontSize: 14 }}>{error}</p>
        </div>
      )}
    </div>
  );
}

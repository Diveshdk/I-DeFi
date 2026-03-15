import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const dbUrl = process.env.DATABASE_URL?.startsWith("file:")
  ? process.env.DATABASE_URL
  : "file:./prisma/dev.db";
const dbPath = dbUrl.startsWith("file:") ? dbUrl.slice(5) : dbUrl;
const absolutePath = path.isAbsolute(dbPath) ? dbPath : path.resolve(process.cwd(), dbPath);
const adapter = new PrismaBetterSqlite3({ url: absolutePath });
const prisma = new PrismaClient({ adapter });

const CREATOR = "0x0000000000000000000000000000000000000001";

const projects = [
  {
    name: "Rahul Token",
    symbol: "RAHUL",
    description: "The official token for builders and dreamers. Community-first, fair launch on Base.",
    category: "DeFi",
    image: "https://api.dicebear.com/7.x/identicon/svg?seed=rahul",
    banner: "https://picsum.photos/800/300?random=1",
    chain: "Base",
    standard: "ERC20",
    status: "live",
    launchDate: new Date("2026-02-01"),
    endDate: new Date("2026-04-01"),
    raisedAmount: "185",
    tokenomics: { totalSupply: "1000000000", tokenPrice: "0.0001", softCap: "50", hardCap: "500", minBuy: "0.01", maxBuy: "10", publicSale: "50", team: "15", marketing: "10", liquidity: "15", treasury: "10" },
    social: { website: "https://example.com", twitter: "https://twitter.com", discord: null, telegram: null, github: null, medium: null },
    roadmap: [
      { quarter: "Q1 2026", title: "Token launch", body: "Fair launch on Base" },
      { quarter: "Q2 2026", title: "DEX listing", body: "List on major DEXes" },
      { quarter: "Q3 2026", title: "Governance", body: "DAO and voting" },
    ],
  },
  {
    name: "ChillGuy Token",
    symbol: "CHILL",
    description: "Stay chill. The token for the relaxed degens. No FUD, only vibes.",
    category: "Gaming",
    image: "https://api.dicebear.com/7.x/identicon/svg?seed=chill",
    banner: "https://picsum.photos/800/300?random=2",
    chain: "Base",
    standard: "ERC20",
    status: "upcoming",
    launchDate: new Date("2026-07-15"),
    endDate: new Date("2026-08-15"),
    raisedAmount: "0",
    tokenomics: { totalSupply: "500000000", tokenPrice: "0.0002", softCap: "30", hardCap: "300", minBuy: "0.05", maxBuy: "5", publicSale: "60", team: "10", marketing: "15", liquidity: "10", treasury: "5" },
    social: { website: null, twitter: "https://twitter.com", discord: "https://discord.gg", telegram: null, github: null, medium: null },
    roadmap: [
      { quarter: "Q2 2026", title: "Community build", body: "Discord and TG live" },
      { quarter: "Q3 2026", title: "Token sale", body: "Public sale" },
    ],
  },
  {
    name: "Dogesh Token",
    symbol: "DOGESH",
    description: "Much wow. The friendliest dog on Base. For the people, by the people.",
    category: "Meme",
    image: "https://api.dicebear.com/7.x/identicon/svg?seed=dogesh",
    banner: "https://picsum.photos/800/300?random=3",
    chain: "Base",
    standard: "ERC20",
    status: "live",
    launchDate: new Date("2026-03-01"),
    endDate: new Date("2026-05-31"),
    raisedAmount: "320",
    tokenomics: { totalSupply: "1000000000000", tokenPrice: "0.0000001", softCap: "100", hardCap: "500", minBuy: "0.001", maxBuy: "2", publicSale: "70", team: "5", marketing: "10", liquidity: "10", treasury: "5" },
    social: { website: null, twitter: "https://twitter.com", discord: null, telegram: "https://t.me", github: null, medium: null },
    roadmap: [
      { quarter: "Q1 2026", title: "Meme launch", body: "Community token" },
      { quarter: "Q2 2026", title: "CEX listings", body: "Apply to listings" },
    ],
  },
  {
    name: "MoonRocket Token",
    symbol: "MOON",
    description: "To the moon. High-ambition project building the next-gen DeFi stack on Base.",
    category: "DeFi",
    image: "https://api.dicebear.com/7.x/identicon/svg?seed=moon",
    banner: "https://picsum.photos/800/300?random=4",
    chain: "Base",
    standard: "ERC20",
    status: "upcoming",
    launchDate: new Date("2026-08-01"),
    endDate: new Date("2026-09-30"),
    raisedAmount: "0",
    tokenomics: { totalSupply: "200000000", tokenPrice: "0.001", softCap: "80", hardCap: "400", minBuy: "0.1", maxBuy: "20", publicSale: "40", team: "20", marketing: "15", liquidity: "15", treasury: "10" },
    social: { website: "https://example.com", twitter: null, discord: null, telegram: null, github: "https://github.com", medium: null },
    roadmap: [
      { quarter: "Q3 2026", title: "Token launch", body: "IDO on launchpad" },
      { quarter: "Q4 2026", title: "Product beta", body: "Protocol beta" },
    ],
  },
  {
    name: "BasePepe Token",
    symbol: "PEPE",
    description: "The green frog has landed on Base. Meme with utility and community rewards.",
    category: "Meme",
    image: "https://api.dicebear.com/7.x/identicon/svg?seed=pepe",
    banner: "https://picsum.photos/800/300?random=5",
    chain: "Base",
    standard: "ERC20",
    status: "ended",
    launchDate: new Date("2026-01-10"),
    endDate: new Date("2026-02-28"),
    raisedAmount: "500",
    tokenomics: { totalSupply: "999999999999", tokenPrice: "0.0000002", softCap: "50", hardCap: "500", minBuy: "0.01", maxBuy: "5", publicSale: "80", team: "5", marketing: "5", liquidity: "5", treasury: "5" },
    social: { website: null, twitter: "https://twitter.com", discord: null, telegram: null, github: null, medium: null },
    roadmap: [
      { quarter: "Q1 2026", title: "Sale completed", body: "Sold out" },
      { quarter: "Q2 2026", title: "DEX launch", body: "Trading live" },
    ],
  },
  {
    name: "DeFi King",
    symbol: "DFK",
    description: "Rule your portfolio. DeFi King brings gamified yield and NFT staking to Base.",
    category: "Gaming",
    image: "https://api.dicebear.com/7.x/identicon/svg?seed=dfk",
    banner: "https://picsum.photos/800/300?random=6",
    chain: "Base",
    standard: "ERC20",
    status: "live",
    launchDate: new Date("2026-04-01"),
    endDate: new Date("2026-06-30"),
    raisedAmount: "112",
    tokenomics: { totalSupply: "100000000", tokenPrice: "0.005", softCap: "100", hardCap: "600", minBuy: "0.5", maxBuy: "50", publicSale: "35", team: "25", marketing: "15", liquidity: "15", treasury: "10" },
    social: { website: "https://example.com", twitter: "https://twitter.com", discord: "https://discord.gg", telegram: "https://t.me", github: null, medium: "https://medium.com" },
    roadmap: [
      { quarter: "Q2 2026", title: "Token sale", body: "Public sale" },
      { quarter: "Q3 2026", title: "Game beta", body: "Play-to-earn beta" },
      { quarter: "Q4 2026", title: "NFT mint", body: "Character NFTs" },
    ],
  },
];

async function main() {
  console.log("Seeding launchpad projects...");
  for (const p of projects) {
    const { tokenomics, social, roadmap, ...projectData } = p;
    const project = await prisma.project.create({
      data: {
        ...projectData,
        creatorAddress: CREATOR,
        category: p.category as string,
      },
    });
    await prisma.tokenomics.create({
      data: {
        projectId: project.id,
        ...tokenomics,
      },
    });
    await prisma.social.create({
      data: {
        projectId: project.id,
        ...social,
      },
    });
    for (let i = 0; i < roadmap.length; i++) {
      await prisma.roadmapItem.create({
        data: {
          projectId: project.id,
          quarter: roadmap[i].quarter,
          title: roadmap[i].title,
          body: roadmap[i].body,
          sortOrder: i,
        },
      });
    }
    console.log(`  Created: ${project.name} (${project.symbol})`);
  }
  console.log("Done. 6 tokens for sale seeded.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

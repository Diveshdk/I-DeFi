import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";

export const dynamic = "force-dynamic";

/** GET /api/launchpad/projects — list all projects. Sorted: live → upcoming → ended. */
export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      include: {
        tokenomics: true,
        social: true,
        _count: { select: { updates: true } },
      },
      orderBy: [{ createdAt: "desc" }],
    });
    // Sort: live first, then upcoming (by launchDate), then ended
    const now = new Date();
    const live = projects.filter((p) => p.status === "live");
    const upcoming = projects
      .filter((p) => p.status === "upcoming")
      .sort((a, b) => (a.launchDate?.getTime() ?? 0) - (b.launchDate?.getTime() ?? 0));
    const ended = projects.filter((p) => p.status === "ended");
    const draft = projects.filter((p) => p.status === "draft");
    const sorted = [...live, ...upcoming, ...ended, ...draft];
    return NextResponse.json(sorted);
  } catch (e) {
    console.error("launchpad projects GET", e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}

/** POST /api/launchpad/projects — create project (creator must be in body). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      symbol,
      description,
      category,
      image,
      banner,
      gallery,
      chain,
      standard,
      contractType,
      creatorAddress,
      launchDate,
      launchTime,
      endDate,
      vestingPeriod,
      claimDate,
      saleType,
      whitelistData,
      status,
      tokenomics,
      social,
      roadmap,
      documents,
    } = body;
    if (!name?.trim() || !symbol?.trim() || !creatorAddress) {
      return NextResponse.json(
        { error: "Missing name, symbol, or creatorAddress" },
        { status: 400 }
      );
    }
    const project = await prisma.project.create({
      data: {
        name: name.trim(),
        symbol: symbol.trim().toUpperCase().slice(0, 10),
        description: description?.trim() || null,
        category: category || null,
        image: image || null,
        banner: banner || null,
        gallery: Array.isArray(gallery) ? JSON.stringify(gallery) : gallery || null,
        chain: chain || "Base",
        standard: standard || "ERC20",
        contractType: contractType || null,
        creatorAddress,
        launchDate: launchDate ? new Date(launchDate) : null,
        launchTime: launchTime || null,
        endDate: endDate ? new Date(endDate) : null,
        vestingPeriod: vestingPeriod || null,
        claimDate: claimDate ? new Date(claimDate) : null,
        saleType: saleType || null,
        whitelistData: whitelistData || null,
        status: status || "draft",
      },
    });
    if (tokenomics && typeof tokenomics === "object") {
      await prisma.tokenomics.create({
        data: {
          projectId: project.id,
          totalSupply: tokenomics.totalSupply ?? null,
          tokenPrice: tokenomics.tokenPrice ?? null,
          softCap: tokenomics.softCap ?? null,
          hardCap: tokenomics.hardCap ?? null,
          minBuy: tokenomics.minBuy ?? null,
          maxBuy: tokenomics.maxBuy ?? null,
          publicSale: tokenomics.publicSale ?? null,
          team: tokenomics.team ?? null,
          marketing: tokenomics.marketing ?? null,
          liquidity: tokenomics.liquidity ?? null,
          treasury: tokenomics.treasury ?? null,
        },
      });
    }
    if (social && typeof social === "object") {
      await prisma.social.create({
        data: {
          projectId: project.id,
          website: social.website ?? null,
          twitter: social.twitter ?? null,
          discord: social.discord ?? null,
          telegram: social.telegram ?? null,
          github: social.github ?? null,
          medium: social.medium ?? null,
        },
      });
    }
    if (Array.isArray(roadmap) && roadmap.length) {
      await prisma.roadmapItem.createMany({
        data: roadmap.map((r: { quarter?: string; title: string; body?: string }, i: number) => ({
          projectId: project.id,
          quarter: r.quarter ?? null,
          title: r.title,
          body: r.body ?? null,
          sortOrder: i,
        })),
      });
    }
    if (Array.isArray(documents) && documents.length) {
      await prisma.document.createMany({
        data: documents.map((d: { type: string; url: string; name?: string }) => ({
          projectId: project.id,
          type: d.type,
          url: d.url,
          name: d.name ?? null,
        })),
      });
    }
    const full = await prisma.project.findUnique({
      where: { id: project.id },
      include: { tokenomics: true, social: true, roadmap: true, documents: true },
    });
    return NextResponse.json(full);
  } catch (e) {
    console.error("launchpad projects POST", e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}

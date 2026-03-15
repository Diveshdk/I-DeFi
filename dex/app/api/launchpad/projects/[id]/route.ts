import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";

export const dynamic = "force-dynamic";

/** GET /api/launchpad/projects/[id] */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        tokenomics: true,
        social: true,
        updates: { orderBy: { createdAt: "desc" } },
        roadmap: { orderBy: { sortOrder: "asc" } },
        documents: true,
      },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json(project);
  } catch (e) {
    console.error("launchpad project GET", e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}

/** PATCH /api/launchpad/projects/[id] — update project (partial). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await req.json();
    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const allowed = [
      "name", "symbol", "description", "category", "image", "banner", "gallery",
      "chain", "standard", "contractType", "contractAddress", "launchDate", "launchTime",
      "endDate", "vestingPeriod", "claimDate", "saleType", "whitelistData", "status",
      "featured", "approved", "raisedAmount",
    ] as const;
    const data: Record<string, unknown> = {};
    for (const k of allowed) {
      if (body[k] !== undefined) {
        if (k === "launchDate" || k === "endDate" || k === "claimDate") {
          data[k] = body[k] ? new Date(body[k]) : null;
        } else {
          data[k] = body[k];
        }
      }
    }
    const project = await prisma.project.update({
      where: { id },
      data,
      include: { tokenomics: true, social: true, updates: true, roadmap: true, documents: true },
    });
    return NextResponse.json(project);
  } catch (e) {
    console.error("launchpad project PATCH", e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}

/** DELETE /api/launchpad/projects/[id] */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("launchpad project DELETE", e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";

export const dynamic = "force-dynamic";

/** GET /api/launchpad/projects/[id]/updates */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const updates = await prisma.update.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(updates);
  } catch (e) {
    console.error("launchpad updates GET", e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}

/** POST /api/launchpad/projects/[id]/updates — add update (creator should verify server-side in production). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    const body = await req.json();
    const { title, description, image } = body;
    if (!title?.trim()) {
      return NextResponse.json({ error: "Missing title" }, { status: 400 });
    }
    const update = await prisma.update.create({
      data: {
        projectId: id,
        title: title.trim(),
        description: description?.trim() ?? null,
        image: image ?? null,
      },
    });
    return NextResponse.json(update);
  } catch (e) {
    console.error("launchpad updates POST", e);
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}

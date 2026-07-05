import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff, AuthError } from "@/lib/auth";

export const runtime = "nodejs";

const querySchema = z.object({
  status: z.enum(["PENDING", "PROCESSING", "APPROVED", "REJECTED"]).default("PENDING"),
  cursor: z.string().cuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** GET /api/admin/videos?status=PENDING — moderation queue. */
export async function GET(req: NextRequest) {
  try {
    await requireStaff();

    const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { status, cursor, limit } = parsed.data;

    const videos = await prisma.video.findMany({
      where: { status },
      orderBy: { createdAt: "asc" }, // oldest submissions first — FIFO queue
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        sourceKey: true,
        createdAt: true,
        publishedAt: true,
        rejectedReason: true,
        uploader: { select: { id: true, username: true, isBanned: true } },
        category: { select: { name: true } },
      },
    });

    const hasMore = videos.length > limit;
    const page = hasMore ? videos.slice(0, limit) : videos;

    return NextResponse.json({
      items: page,
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api/admin/videos] GET failed", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

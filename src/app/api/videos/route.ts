import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { FeedPageDto } from "@/lib/types";

export const runtime = "nodejs";

const querySchema = z.object({
  cursor: z.string().cuid().optional(),
  limit: z.coerce.number().int().min(1).max(48).default(24),
  category: z.string().max(64).optional(),
});

/**
 * GET /api/videos — public paginated feed (newest approved first).
 * Cursor pagination (id of the last item) instead of OFFSET: constant-time
 * regardless of scroll depth, which matters for infinite scroll.
 */
export async function GET(req: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { cursor, limit, category } = parsed.data;

  try {
    const videos = await prisma.video.findMany({
      where: {
        status: "APPROVED",
        publishedAt: { lte: new Date() },
        ...(category ? { category: { slug: category } } : {}),
      },
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: limit + 1, // one extra to know if there's a next page
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        slug: true,
        title: true,
        thumbnailUrl: true,
        durationSec: true,
        viewCount: true,
        publishedAt: true,
        category: { select: { name: true } },
        uploader: { select: { username: true } },
      },
    });

    const hasMore = videos.length > limit;
    const page = hasMore ? videos.slice(0, limit) : videos;

    const body: FeedPageDto = {
      items: page.map((v) => ({
        id: v.id,
        slug: v.slug,
        title: v.title,
        thumbnailUrl: v.thumbnailUrl,
        durationSec: v.durationSec,
        viewCount: v.viewCount.toString(),
        publishedAt: v.publishedAt?.toISOString() ?? null,
        categoryName: v.category?.name ?? null,
        uploaderName: v.uploader.username,
      })),
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
    };

    return NextResponse.json(body, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" },
    });
  } catch (err) {
    console.error("[api/videos] feed query failed", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

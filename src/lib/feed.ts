import { prisma } from "@/lib/prisma";
import type { FeedPageDto } from "@/lib/types";

// ---------------------------------------------------------------------------
// Single feed implementation shared by the homepage, category/channel/search
// pages, and the /api/videos route — one place for the where-clause, the
// cursor logic, and the DTO mapping.
// ---------------------------------------------------------------------------

export interface FeedFilter {
  category?: string; // category slug
  author?: string; // exact authorName (channel pages)
  q?: string; // title search
}

export async function getFeedPage(
  filter: FeedFilter,
  cursor?: string,
  limit = 24,
): Promise<FeedPageDto> {
  const videos = await prisma.video.findMany({
    where: {
      status: "APPROVED",
      publishedAt: { lte: new Date() },
      ...(filter.category ? { category: { slug: filter.category } } : {}),
      ...(filter.author ? { authorName: filter.author } : {}),
      ...(filter.q ? { title: { contains: filter.q, mode: "insensitive" } } : {}),
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
      authorName: true,
      category: { select: { name: true } },
      uploader: { select: { username: true } },
    },
  });

  const hasMore = videos.length > limit;
  const page = hasMore ? videos.slice(0, limit) : videos;

  return {
    items: page.map((v) => ({
      id: v.id,
      slug: v.slug,
      title: v.title,
      thumbnailUrl: v.thumbnailUrl,
      durationSec: v.durationSec,
      viewCount: v.viewCount.toString(),
      publishedAt: v.publishedAt?.toISOString() ?? null,
      categoryName: v.category?.name ?? null,
      uploaderName: v.authorName ?? v.uploader.username,
    })),
    nextCursor: hasMore ? page[page.length - 1]!.id : null,
  };
}

export const EMPTY_FEED: FeedPageDto = { items: [], nextCursor: null };

import {
  redis,
  KEYS,
  TRENDING_TTL_SECONDS,
  TRENDING_STALE_TTL_SECONDS,
} from "@/lib/redis";
import { prisma } from "@/lib/prisma";

export interface TrendingVideo {
  id: string;
  slug: string;
  title: string;
  thumbnailUrl: string | null;
  durationSec: number | null;
  viewCount: string; // BigInt serialized
  recentViews: number;
  categoryName: string | null;
}

const TRENDING_SIZE = 10;
const TRENDING_WINDOW_HOURS = 48;

/**
 * Trending feed, cached in Redis for 5 minutes.
 *
 * Stampede protection: on a cache miss only ONE process (the SET NX lock
 * winner) rebuilds from Postgres; everyone else serves the stale copy (kept
 * 1h) so the DB sees at most one trending query per 5-minute window even at
 * thousands of concurrent requests.
 */
export async function getTrendingFeed(): Promise<TrendingVideo[]> {
  try {
    const cached = await redis.get(KEYS.trendingFeed);
    if (cached) return JSON.parse(cached) as TrendingVideo[];

    const gotLock = await redis.set(KEYS.trendingLock, "1", "EX", 30, "NX");
    if (gotLock !== "OK") {
      const stale = await redis.get(KEYS.trendingFeedStale);
      if (stale) return JSON.parse(stale) as TrendingVideo[];
      // No stale copy either (cold start) — fall through and query.
    }

    const feed = await buildTrendingFromDb();

    const payload = JSON.stringify(feed);
    await redis
      .multi()
      .set(KEYS.trendingFeed, payload, "EX", TRENDING_TTL_SECONDS)
      .set(KEYS.trendingFeedStale, payload, "EX", TRENDING_STALE_TTL_SECONDS)
      .del(KEYS.trendingLock)
      .exec();

    return feed;
  } catch (err) {
    // Redis outage: keep the site up by querying Postgres directly.
    console.error("[trending] cache path failed, falling back to DB", err);
    return buildTrendingFromDb();
  }
}

async function buildTrendingFromDb(): Promise<TrendingVideo[]> {
  const since = new Date(Date.now() - TRENDING_WINDOW_HOURS * 3600 * 1000);

  // Rank by view velocity inside the window, not lifetime views —
  // that's what makes it "trending" instead of "all-time top".
  const grouped = await prisma.viewLog.groupBy({
    by: ["videoId"],
    where: { createdAt: { gte: since } },
    _count: { videoId: true },
    orderBy: { _count: { videoId: "desc" } },
    take: TRENDING_SIZE * 2, // headroom: some may no longer be public
  });

  const recentCounts = new Map(grouped.map((g) => [g.videoId, g._count.videoId]));

  const videos = await prisma.video.findMany({
    where: {
      id: { in: grouped.map((g) => g.videoId) },
      status: "APPROVED",
      publishedAt: { lte: new Date() },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      thumbnailUrl: true,
      durationSec: true,
      viewCount: true,
      category: { select: { name: true } },
    },
  });

  const feed = videos
    .map((v) => ({
      id: v.id,
      slug: v.slug,
      title: v.title,
      thumbnailUrl: v.thumbnailUrl,
      durationSec: v.durationSec,
      viewCount: v.viewCount.toString(),
      recentViews: recentCounts.get(v.id) ?? 0,
      categoryName: v.category?.name ?? null,
    }))
    .sort((a, b) => b.recentViews - a.recentViews)
    .slice(0, TRENDING_SIZE);

  // Cold-start fallback: no view logs yet → newest approved videos.
  if (feed.length === 0) {
    const newest = await prisma.video.findMany({
      where: { status: "APPROVED", publishedAt: { lte: new Date() } },
      orderBy: { publishedAt: "desc" },
      take: TRENDING_SIZE,
      select: {
        id: true,
        slug: true,
        title: true,
        thumbnailUrl: true,
        durationSec: true,
        viewCount: true,
        category: { select: { name: true } },
      },
    });
    return newest.map((v) => ({
      id: v.id,
      slug: v.slug,
      title: v.title,
      thumbnailUrl: v.thumbnailUrl,
      durationSec: v.durationSec,
      viewCount: v.viewCount.toString(),
      recentViews: 0,
      categoryName: v.category?.name ?? null,
    }));
  }

  return feed;
}

/** Call after staff actions that change what's public. */
export async function invalidateTrendingCache(): Promise<void> {
  await redis.del(KEYS.trendingFeed).catch(() => {});
}

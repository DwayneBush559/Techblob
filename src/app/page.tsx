import { prisma } from "@/lib/prisma";
import { getTrendingFeed } from "@/lib/trending";
import InfiniteFeed from "@/components/InfiniteFeed";
import TrendingSidebar from "@/components/TrendingSidebar";
import AdBanner from "@/components/AdBanner";
import type { VideoCardDto } from "@/lib/types";

export const revalidate = 30; // ISR: the shell regenerates at most every 30s

const PAGE_SIZE = 24;

async function getFirstPage(category?: string): Promise<{
  items: VideoCardDto[];
  nextCursor: string | null;
}> {
  const videos = await prisma.video.findMany({
    where: {
      status: "APPROVED",
      publishedAt: { lte: new Date() },
      ...(category ? { category: { slug: category } } : {}),
    },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
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

  const hasMore = videos.length > PAGE_SIZE;
  const page = hasMore ? videos.slice(0, PAGE_SIZE) : videos;

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

export default async function HomePage({
  searchParams,
}: {
  searchParams: { category?: string };
}) {
  const category = searchParams.category;

  // First feed page and trending load in parallel. Neither may take down the
  // page: on failure (including build-time prerender with no DB reachable)
  // render the empty shell — ISR refills it within `revalidate` seconds.
  const [firstPage, trending] = await Promise.all([
    getFirstPage(category).catch((err) => {
      console.error("[home] feed query failed", err);
      return { items: [], nextCursor: null };
    }),
    getTrendingFeed().catch(() => []),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-3 py-4 sm:px-4">
      {/* Top leaderboard — desktop; compact banner on mobile */}
      <AdBanner slot="leaderboard" className="mb-4 hidden md:flex" />
      <AdBanner slot="mobileBanner" className="mb-4 md:hidden" />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section>
          <h1 className="mb-3 text-lg font-black uppercase tracking-wide">
            {category ? `${category} Videos` : "Latest Videos"}
          </h1>
          <InfiniteFeed
            initialItems={firstPage.items}
            initialCursor={firstPage.nextCursor}
            category={category}
          />
        </section>

        <TrendingSidebar items={trending} />
      </div>
    </main>
  );
}

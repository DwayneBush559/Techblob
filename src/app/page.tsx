import { getFeedPage, EMPTY_FEED } from "@/lib/feed";
import { getTrendingFeed } from "@/lib/trending";
import InfiniteFeed from "@/components/InfiniteFeed";
import TrendingSidebar from "@/components/TrendingSidebar";
import AdBanner from "@/components/AdBanner";

export const revalidate = 30; // ISR: the shell regenerates at most every 30s

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
    getFeedPage({ category }).catch((err) => {
      console.error("[home] feed query failed", err);
      return EMPTY_FEED;
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

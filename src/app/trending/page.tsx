import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getTrendingFeed } from "@/lib/trending";
import AdBanner from "@/components/AdBanner";

export const metadata: Metadata = {
  title: "Trending",
  description: "The hottest tech, AI, and coding videos on Techblob right now.",
};

export const revalidate = 60;

export default async function TrendingPage() {
  const items = await getTrendingFeed().catch(() => []);

  return (
    <main className="mx-auto max-w-4xl px-3 py-4 sm:px-4">
      <AdBanner slot="leaderboard" className="mb-4 hidden md:flex" />
      <AdBanner slot="mobileBanner" className="mb-4 md:hidden" />

      <h1 className="mb-1 text-lg font-black uppercase tracking-wide">
        🔥 Trending <span className="text-brand">Now</span>
      </h1>
      <p className="mb-4 text-sm text-neutral-400">
        Ranked by what Techblob viewers watched in the last 48 hours.
      </p>

      {items.length === 0 ? (
        <p className="rounded-lg bg-surface-raised px-4 py-8 text-center text-sm text-neutral-400">
          Not enough view data yet — watch some videos and check back!
        </p>
      ) : (
        <ol className="space-y-3">
          {items.map((video, i) => (
            <li key={video.id}>
              <Link
                href={`/watch/${video.slug}`}
                prefetch={false}
                className="flex items-center gap-3 rounded-lg bg-surface-raised p-3 transition hover:bg-white/5 sm:gap-5"
              >
                <span className="w-8 shrink-0 text-center text-2xl font-black text-brand">
                  {i + 1}
                </span>
                <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded bg-black sm:w-48">
                  {video.thumbnailUrl && (
                    <Image
                      src={video.thumbnailUrl}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 128px, 192px"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="line-clamp-2 text-sm font-semibold leading-snug sm:text-base">
                    {video.title}
                  </h2>
                  <p className="mt-1 text-xs text-neutral-400 sm:text-sm">
                    {video.recentViews.toLocaleString()} views in 48h
                    {video.categoryName ? ` · ${video.categoryName}` : ""}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

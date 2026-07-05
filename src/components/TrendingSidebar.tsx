import Link from "next/link";
import Image from "next/image";
import AdBanner from "@/components/AdBanner";
import type { TrendingVideo } from "@/lib/trending";

export default function TrendingSidebar({ items }: { items: TrendingVideo[] }) {
  return (
    <aside className="space-y-4">
      <AdBanner slot="mediumRectangle" />

      <section className="rounded-lg bg-surface-raised">
        <h2 className="border-b border-surface-border px-3 py-2.5 text-sm font-bold uppercase tracking-wide">
          🔥 Trending Now
        </h2>
        {items.length === 0 ? (
          <p className="px-3 py-4 text-sm text-neutral-500">Nothing trending yet.</p>
        ) : (
          <ol className="divide-y divide-surface-border">
            {items.map((video, i) => (
              <li key={video.id}>
                <Link
                  href={`/watch/${video.slug}`}
                  prefetch={false}
                  className="flex gap-2.5 p-2.5 transition hover:bg-white/5"
                >
                  <span className="w-5 shrink-0 pt-0.5 text-center text-sm font-black text-brand">
                    {i + 1}
                  </span>
                  <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded bg-black">
                    {video.thumbnailUrl && (
                      <Image
                        src={video.thumbnailUrl}
                        alt=""
                        fill
                        sizes="96px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-xs font-semibold leading-snug">
                      {video.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-neutral-400">
                      {video.recentViews.toLocaleString()} views · 48h
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      <AdBanner slot="halfPage" className="hidden xl:flex" />
    </aside>
  );
}

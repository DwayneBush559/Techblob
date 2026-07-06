import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { CHANNELS } from "@/lib/youtube";
import AdBanner from "@/components/AdBanner";

export const metadata: Metadata = {
  title: "Channels",
  description: "The tech, AI, and coding creators featured on Techblob.",
};

export const revalidate = 300;

const CATEGORY_LABEL: Record<string, string> = {
  tech: "Tech",
  ai: "AI",
  coding: "Coding",
  gadgets: "Gadgets",
};

export default async function ChannelsPage() {
  // Video counts per channel, one grouped query.
  const counts = await prisma.video
    .groupBy({
      by: ["authorName"],
      where: { status: "APPROVED", authorName: { in: CHANNELS.map((c) => c.name) } },
      _count: { _all: true },
    })
    .catch(() => []);
  const countByName = new Map(counts.map((c) => [c.authorName, c._count._all]));

  return (
    <main className="mx-auto max-w-5xl px-3 py-4 sm:px-4">
      <h1 className="mb-1 text-lg font-black uppercase tracking-wide">
        Featured <span className="text-brand">Channels</span>
      </h1>
      <p className="mb-5 text-sm text-neutral-400">
        Techblob pulls the newest videos from these creators automatically. All videos play as
        official YouTube embeds with full credit to the channel.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CHANNELS.map((channel) => (
          <Link
            key={channel.slug}
            href={`/channel/${channel.slug}`}
            className="group rounded-lg bg-surface-raised p-4 transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/40"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-lg font-black text-white">
                {channel.name.slice(0, 1)}
              </span>
              <div className="min-w-0">
                <h2 className="truncate font-bold group-hover:text-brand">{channel.name}</h2>
                <p className="text-xs text-neutral-400">
                  {CATEGORY_LABEL[channel.categorySlug]} ·{" "}
                  {countByName.get(channel.name) ?? 0} videos
                </p>
              </div>
            </div>
            <p className="mt-3 line-clamp-2 text-sm text-neutral-400">{channel.tagline}</p>
          </Link>
        ))}
      </div>

      <AdBanner slot="leaderboard" className="mt-8 hidden md:flex" />
      <AdBanner slot="mobileBanner" className="mt-8 md:hidden" />
    </main>
  );
}

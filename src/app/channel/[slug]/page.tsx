import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CHANNELS } from "@/lib/youtube";
import { getFeedPage } from "@/lib/feed";
import InfiniteFeed from "@/components/InfiniteFeed";
import AdBanner from "@/components/AdBanner";

export const revalidate = 60;

function getChannel(slug: string) {
  return CHANNELS.find((c) => c.slug === slug) ?? null;
}

export function generateStaticParams() {
  return CHANNELS.map((c) => ({ slug: c.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const channel = getChannel(params.slug);
  if (!channel) return { title: "Channel not found" };
  return {
    title: channel.name,
    description: `${channel.name} on Techblob — ${channel.tagline}`,
  };
}

export default async function ChannelPage({ params }: { params: { slug: string } }) {
  const channel = getChannel(params.slug);
  if (!channel) notFound();

  const firstPage = await getFeedPage({ author: channel.name });

  return (
    <main className="mx-auto max-w-7xl px-3 py-4 sm:px-4">
      <header className="mb-5 flex items-center gap-4 rounded-lg bg-surface-raised p-4 sm:p-5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-2xl font-black text-white sm:h-16 sm:w-16">
          {channel.name.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-black sm:text-2xl">{channel.name}</h1>
          <p className="text-sm text-neutral-400">{channel.tagline}</p>
          <a
            href={`https://www.youtube.com/channel/${channel.channelId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-xs text-neutral-500 underline hover:text-white"
          >
            View on YouTube
          </a>
        </div>
        <Link
          href="/channels"
          className="ml-auto hidden shrink-0 rounded border border-surface-border px-3 py-1.5 text-xs font-semibold text-neutral-300 hover:bg-white/5 sm:block"
        >
          All channels
        </Link>
      </header>

      {firstPage.items.length === 0 ? (
        <p className="rounded-lg bg-surface-raised px-4 py-8 text-center text-sm text-neutral-400">
          No videos from this channel yet — the next ingest run will pull them in.
        </p>
      ) : (
        <InfiniteFeed
          initialItems={firstPage.items}
          initialCursor={firstPage.nextCursor}
          author={channel.name}
        />
      )}

      <AdBanner slot="leaderboard" className="mt-8 hidden md:flex" />
      <AdBanner slot="mobileBanner" className="mt-8 md:hidden" />
    </main>
  );
}

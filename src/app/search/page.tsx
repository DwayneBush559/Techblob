import type { Metadata } from "next";
import { getFeedPage, EMPTY_FEED } from "@/lib/feed";
import InfiniteFeed from "@/components/InfiniteFeed";

export const metadata: Metadata = {
  title: "Search",
  description: "Search tech, AI, and coding videos on Techblob.",
};

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = searchParams.q?.trim().slice(0, 100) ?? "";
  const results = q ? await getFeedPage({ q }).catch(() => EMPTY_FEED) : EMPTY_FEED;

  return (
    <main className="mx-auto max-w-7xl px-3 py-4 sm:px-4">
      <h1 className="mb-3 text-lg font-black uppercase tracking-wide">Search</h1>

      <form action="/search" method="GET" className="mb-6 flex max-w-xl gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search videos… (e.g. GPT, RTX, rust)"
          autoFocus
          className="w-full rounded border border-surface-border bg-surface-raised px-3 py-2.5 text-sm outline-none placeholder:text-neutral-600 focus:border-brand"
        />
        <button
          type="submit"
          className="shrink-0 rounded bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-dark"
        >
          Search
        </button>
      </form>

      {q === "" ? (
        <p className="text-sm text-neutral-500">Type something to search all videos by title.</p>
      ) : results.items.length === 0 ? (
        <p className="rounded-lg bg-surface-raised px-4 py-8 text-center text-sm text-neutral-400">
          No videos matching “{q}”. Try a different term.
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm text-neutral-400">
            Results for <span className="font-semibold text-white">“{q}”</span>
          </p>
          <InfiniteFeed
            initialItems={results.items}
            initialCursor={results.nextCursor}
            q={q}
          />
        </>
      )}
    </main>
  );
}

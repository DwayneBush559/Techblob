"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import VideoCard from "@/components/VideoCard";
import AdBanner from "@/components/AdBanner";
import type { FeedPageDto, VideoCardDto } from "@/lib/types";

// ---------------------------------------------------------------------------
// Infinite scroll via IntersectionObserver:
//  * a sentinel div sits after the grid; when it enters a 800px pre-fetch
//    margin we load the next cursor page
//  * an in-flight lock prevents duplicate fetches during fast flings
//  * an in-feed ad unit is injected every AD_EVERY cards
// ---------------------------------------------------------------------------

const AD_EVERY = 8;

interface InfiniteFeedProps {
  initialItems: VideoCardDto[];
  initialCursor: string | null;
  category?: string;
  author?: string;
  q?: string;
}

export default function InfiniteFeed({
  initialItems,
  initialCursor,
  category,
  author,
  q,
}: InfiniteFeedProps) {
  const [items, setItems] = useState<VideoCardDto[]>(initialItems);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);

  const loadMore = useCallback(async () => {
    if (inFlightRef.current || !cursor) return;
    inFlightRef.current = true;
    setIsLoading(true);
    setLoadError(false);

    try {
      const params = new URLSearchParams({ cursor, limit: "24" });
      if (category) params.set("category", category);
      if (author) params.set("author", author);
      if (q) params.set("q", q);
      const res = await fetch(`/api/videos?${params}`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`Feed request failed: ${res.status}`);
      const page = (await res.json()) as FeedPageDto;

      setItems((prev) => {
        // Guard against duplicates if a video moved between pages mid-scroll.
        const seen = new Set(prev.map((v) => v.id));
        return [...prev, ...page.items.filter((v) => !seen.has(v.id))];
      });
      setCursor(page.nextCursor);
    } catch (err) {
      console.error("[feed] load more failed", err);
      setLoadError(true);
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
    }
  }, [cursor, category, author, q]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !cursor) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      // Start fetching well before the user reaches the bottom.
      { rootMargin: "800px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [cursor, loadMore]);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((video, i) => (
          <Fragment key={video.id}>
            <VideoCard video={video} />
            {(i + 1) % AD_EVERY === 0 && (
              <AdBanner slot="inFeed" className="sm:col-span-2 lg:col-span-1" />
            )}
          </Fragment>
        ))}
      </div>

      {/* Sentinel + status row */}
      <div ref={sentinelRef} className="flex h-16 items-center justify-center">
        {isLoading && (
          <div
            className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-600 border-t-brand"
            role="status"
            aria-label="Loading more videos"
          />
        )}
        {loadError && (
          <button
            type="button"
            onClick={() => void loadMore()}
            className="rounded bg-surface-raised px-4 py-2 text-sm text-neutral-300 hover:bg-surface-border"
          >
            Couldn&apos;t load more — tap to retry
          </button>
        )}
        {!cursor && !isLoading && items.length > 0 && (
          <p className="text-xs text-neutral-500">You&apos;re all caught up.</p>
        )}
      </div>
    </>
  );
}

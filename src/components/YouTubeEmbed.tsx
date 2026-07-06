"use client";

import { useState } from "react";
import Image from "next/image";

// ---------------------------------------------------------------------------
// Click-to-load YouTube embed:
//  * renders only the thumbnail until the user presses play — no YouTube
//    JavaScript on page load (fast, private, good Core Web Vitals)
//  * fires our "start" view beacon at the moment of intent, so ingested
//    videos participate in the same Redis view pipeline as uploads
// ---------------------------------------------------------------------------

interface YouTubeEmbedProps {
  videoId: string; // our internal Video.id, for the view beacon
  youtubeId: string; // the YouTube video id, for the iframe
  title: string;
  thumbnailUrl?: string | null;
}

export default function YouTubeEmbed({
  videoId,
  youtubeId,
  title,
  thumbnailUrl,
}: YouTubeEmbedProps) {
  const [activated, setActivated] = useState(false);

  const activate = () => {
    setActivated(true);
    try {
      const payload = JSON.stringify({ event: "start" });
      if ("sendBeacon" in navigator) {
        navigator.sendBeacon(
          `/api/videos/${videoId}/view`,
          new Blob([payload], { type: "text/plain" }),
        );
      } else {
        void fetch(`/api/videos/${videoId}/view`, {
          method: "POST",
          body: payload,
          headers: { "Content-Type": "application/json" },
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // Analytics must never break playback.
    }
  };

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
      {activated ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : (
        <button
          type="button"
          onClick={activate}
          aria-label={`Play ${title}`}
          className="group absolute inset-0 h-full w-full"
        >
          {thumbnailUrl ? (
            <Image
              src={thumbnailUrl}
              alt=""
              fill
              sizes="(max-width: 1024px) 100vw, 66vw"
              className="object-cover"
              priority
            />
          ) : (
            <div className="absolute inset-0 bg-surface-raised" />
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/30 transition group-hover:bg-black/20">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-white shadow-lg sm:h-20 sm:w-20">
              <svg viewBox="0 0 24 24" fill="currentColor" className="ml-1 h-8 w-8">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </span>
        </button>
      )}
    </div>
  );
}

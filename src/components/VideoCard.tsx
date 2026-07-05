import Link from "next/link";
import Image from "next/image";
import type { VideoCardDto } from "@/lib/types";

function formatViews(count: string): string {
  const n = Number(count);
  if (!Number.isFinite(n)) return count;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDuration(sec: number | null): string | null {
  if (sec == null) return null;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function VideoCard({ video }: { video: VideoCardDto }) {
  const duration = formatDuration(video.durationSec);

  return (
    <Link
      href={`/watch/${video.slug}`}
      className="group block overflow-hidden rounded-lg bg-surface-raised transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/40"
      prefetch={false}
    >
      <div className="relative aspect-video bg-black">
        {video.thumbnailUrl ? (
          <Image
            src={video.thumbnailUrl}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-neutral-600">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-10 w-10">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        )}
        {duration && (
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums">
            {duration}
          </span>
        )}
        {video.categoryName && (
          <span className="absolute left-1.5 top-1.5 rounded bg-brand px-1.5 py-0.5 text-[10px] font-bold uppercase">
            {video.categoryName}
          </span>
        )}
      </div>
      <div className="p-2.5">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-brand">
          {video.title}
        </h3>
        <p className="mt-1 text-xs text-neutral-400">
          {formatViews(video.viewCount)} views · {video.uploaderName}
        </p>
      </div>
    </Link>
  );
}

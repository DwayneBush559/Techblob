import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getDisplayViewCount } from "@/lib/views";
import { getTrendingFeed } from "@/lib/trending";
import VideoPlayer from "@/components/VideoPlayer";
import TrendingSidebar from "@/components/TrendingSidebar";
import AdBanner from "@/components/AdBanner";
import type { VideoSourceDto } from "@/lib/types";

export const revalidate = 60;

const RESOLUTION_LABEL: Record<string, string> = {
  P240: "240p",
  P360: "360p",
  P480: "480p",
  P720: "720p",
  P1080: "1080p",
};

async function getPublicVideo(slug: string) {
  const video = await prisma.video.findUnique({
    where: { slug },
    include: {
      renditions: { orderBy: { bitrateKbps: "desc" } },
      uploader: { select: { username: true } },
      category: { select: { name: true } },
    },
  });

  const isPublic =
    video &&
    video.status === "APPROVED" &&
    video.publishedAt !== null &&
    video.publishedAt <= new Date() &&
    video.renditions.length > 0;

  return isPublic ? video : null;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const video = await getPublicVideo(params.slug);
  if (!video) return { title: "Video not found" };
  return {
    title: video.title,
    description: video.description?.slice(0, 160) ?? video.title,
    openGraph: {
      title: video.title,
      images: video.thumbnailUrl ? [video.thumbnailUrl] : [],
      type: "video.other",
    },
  };
}

export default async function WatchPage({ params }: { params: { slug: string } }) {
  const video = await getPublicVideo(params.slug);
  if (!video) notFound();

  const [displayCount, trending] = await Promise.all([
    getDisplayViewCount(video.id, video.viewCount),
    getTrendingFeed().catch(() => []),
  ]);

  const sources: VideoSourceDto[] = video.renditions.map((r) => ({
    resolution: r.resolution,
    label: RESOLUTION_LABEL[r.resolution] ?? r.resolution,
    url: r.url,
    mimeType: r.mimeType,
    bitrateKbps: r.bitrateKbps,
  }));

  return (
    <main className="mx-auto max-w-7xl px-3 py-4 sm:px-4">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section>
          <VideoPlayer
            videoId={video.id}
            title={video.title}
            poster={video.thumbnailUrl}
            sources={sources}
          />

          <div className="mt-3">
            <h1 className="text-lg font-bold leading-snug sm:text-xl">{video.title}</h1>
            <p className="mt-1 text-sm text-neutral-400">
              {Number(displayCount).toLocaleString()} views · by {video.uploader.username}
              {video.category ? ` · ${video.category.name}` : ""}
            </p>
            {video.description && (
              <p className="mt-3 whitespace-pre-line text-sm text-neutral-300">
                {video.description}
              </p>
            )}
          </div>

          <AdBanner slot="leaderboard" className="mt-5 hidden md:flex" />
          <AdBanner slot="mobileBanner" className="mt-5 md:hidden" />
        </section>

        <TrendingSidebar items={trending} />
      </div>
    </main>
  );
}

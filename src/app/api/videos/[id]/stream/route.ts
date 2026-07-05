import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDisplayViewCount } from "@/lib/views";
import type { StreamMetadataDto, VideoSourceDto } from "@/lib/types";

export const runtime = "nodejs";

const RESOLUTION_LABEL: Record<string, string> = {
  P240: "240p",
  P360: "360p",
  P480: "480p",
  P720: "720p",
  P1080: "1080p",
};

/**
 * GET /api/videos/:id/stream — streaming metadata + rendition URLs.
 * The actual bytes are served by the CDN; this endpoint only hands out
 * playlist/MP4 links and is edge-cacheable (s-maxage=60 via next.config).
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const video = await prisma.video.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        thumbnailUrl: true,
        durationSec: true,
        viewCount: true,
        status: true,
        publishedAt: true,
        renditions: {
          orderBy: { bitrateKbps: "desc" },
          select: { resolution: true, url: true, mimeType: true, bitrateKbps: true },
        },
      },
    });

    const isPublic =
      video &&
      video.status === "APPROVED" &&
      video.publishedAt !== null &&
      video.publishedAt <= new Date();

    if (!video || !isPublic) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    if (video.renditions.length === 0) {
      return NextResponse.json({ error: "Video is still processing" }, { status: 409 });
    }

    const sources: VideoSourceDto[] = video.renditions.map((r) => ({
      resolution: r.resolution,
      label: RESOLUTION_LABEL[r.resolution] ?? r.resolution,
      url: r.url,
      mimeType: r.mimeType,
      bitrateKbps: r.bitrateKbps,
    }));

    const body: StreamMetadataDto = {
      id: video.id,
      slug: video.slug,
      title: video.title,
      description: video.description,
      thumbnailUrl: video.thumbnailUrl,
      durationSec: video.durationSec,
      viewCount: (await getDisplayViewCount(video.id, video.viewCount)).toString(),
      sources,
    };

    return NextResponse.json(body);
  } catch (err) {
    console.error("[api/videos/:id/stream] failed", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

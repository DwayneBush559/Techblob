/**
 * One-off repair: Google's gtv-videos-bucket sample URLs (used by the original
 * seed) now return 403. Re-point every video's renditions at working public
 * sample media, with genuinely different files per resolution so the player's
 * quality selector is real.
 *
 *   DATABASE_URL=<neon-direct-url> npx tsx scripts/fix-media-urls.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface MediaEntry {
  p720: string;
  p360: string;
  durationSec: number;
}

const POOL: MediaEntry[] = [
  {
    p720: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4",
    p360: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4",
    durationSec: 10,
  },
  {
    p720: "https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_1MB.mp4",
    p360: "https://test-videos.co.uk/vids/jellyfish/mp4/h264/360/Jellyfish_360_10s_1MB.mp4",
    durationSec: 10,
  },
  {
    p720: "https://test-videos.co.uk/vids/sintel/mp4/h264/720/Sintel_720_10s_1MB.mp4",
    p360: "https://test-videos.co.uk/vids/sintel/mp4/h264/360/Sintel_360_10s_1MB.mp4",
    durationSec: 10,
  },
  {
    p720: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    p360: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    durationSec: 14,
  },
  {
    // Long-form entry: the full Big Buck Bunny movie from Blender's own server
    p720: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_640x360.m4v",
    p360: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4",
    durationSec: 596,
  },
];

async function main(): Promise<void> {
  const videos = await prisma.video.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, slug: true },
  });

  let updated = 0;
  for (let i = 0; i < videos.length; i++) {
    const video = videos[i]!;
    const media = POOL[i % POOL.length]!;

    await prisma.$transaction([
      prisma.videoRendition.updateMany({
        where: { videoId: video.id, resolution: "P720" },
        data: { url: media.p720, mimeType: "video/mp4" },
      }),
      prisma.videoRendition.updateMany({
        where: { videoId: video.id, resolution: "P360" },
        data: { url: media.p360, mimeType: "video/mp4" },
      }),
      prisma.video.update({
        where: { id: video.id },
        data: { durationSec: media.durationSec },
      }),
    ]);
    updated++;
  }

  console.log(`Re-pointed media for ${updated} videos.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

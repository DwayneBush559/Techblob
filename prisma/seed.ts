/**
 * Dev seed: categories, users, and a set of APPROVED videos with renditions
 * pointing at Google's public sample MP4s so playback works immediately.
 *
 *   npx prisma db seed   (after adding "prisma": { "seed": "tsx prisma/seed.ts" }
 *                         to package.json, or run: npx tsx prisma/seed.ts)
 */
import { PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";

const prisma = new PrismaClient();

const SAMPLE_MP4S = [
  "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4",
  "https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_1MB.mp4",
  "https://test-videos.co.uk/vids/sintel/mp4/h264/720/Sintel_720_10s_1MB.mp4",
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_640x360.m4v",
];

const TITLES = [
  "He Really Did That On Camera 😳",
  "New Heat: Underground Cypher Goes Off",
  "Wildest Block Party Of The Summer",
  "You Won't Believe How This Ends",
  "Street Interview Gets Real Quick",
  "Freestyle Friday: Bars On Bars",
  "Caught On Dashcam: Unreal Save",
  "This Kid Has A Future In The League",
  "Backyard Show Turns Into Concert",
  "The Whole Crowd Went Silent",
  "Rooftop Session Hits Different",
  "When The Beat Dropped, Chaos",
  "Corner Store Legend Strikes Again",
  "Pull Up Or Shut Up: Park Run",
  "First Take vs Real Life",
  "Late Night Drive-Thru Madness",
  "The Rematch Everyone Asked For",
  "How Is This Even Legal?",
  "Studio Leak: Unreleased Verse",
  "Tourist Meets The Neighborhood",
  "Halftime Show, But It's The Stands",
  "This Dance Trend Is Taking Over",
  "Open Mic Night Goes Sideways",
  "Champion Behavior Only",
  "Cookout Debate Reaches Boiling Point",
  "Sneaker Unboxing Turns Emotional",
  "Subway Performer Silences Critics",
  "Neighborhood Watch: Comedy Edition",
  "The Assist Nobody Saw Coming",
  "Last Day Of Summer, Full Send",
];

function fakeHash(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

async function main(): Promise<void> {
  const [music, news, fights, sports] = await Promise.all(
    [
      { name: "Music", slug: "music", sortOrder: 1 },
      { name: "News", slug: "news", sortOrder: 2 },
      { name: "Wild", slug: "fights", sortOrder: 3 },
      { name: "Sports", slug: "sports", sortOrder: 4 },
    ].map((c) =>
      prisma.category.upsert({ where: { slug: c.slug }, update: {}, create: c }),
    ),
  );
  const categories = [music!, news!, fights!, sports!];

  const admin = await prisma.user.upsert({
    where: { email: "admin@streetview.local" },
    update: {},
    create: {
      email: "admin@streetview.local",
      username: "admin",
      passwordHash: fakeHash("dev-only-not-a-real-password"),
      role: "ADMIN",
    },
  });

  const uploader = await prisma.user.upsert({
    where: { email: "uploader@streetview.local" },
    update: {},
    create: {
      email: "uploader@streetview.local",
      username: "streetcam",
      passwordHash: fakeHash("dev-only-not-a-real-password"),
      role: "USER",
    },
  });

  for (let i = 0; i < TITLES.length; i++) {
    const title = TITLES[i]!;
    const slug = `${title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")}-${i}`;
    const mediaUrl = SAMPLE_MP4S[i % SAMPLE_MP4S.length]!;
    const category = categories[i % categories.length]!;
    const publishedAt = new Date(Date.now() - i * 3 * 3600 * 1000);

    await prisma.video.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        title,
        description: `Seeded demo video #${i + 1}. Replace with real content.`,
        status: "APPROVED",
        sourceKey: `seed/${slug}.mp4`,
        thumbnailUrl: `https://picsum.photos/seed/${slug}/640/360`,
        durationSec: 90 + (i % 8) * 45,
        viewCount: BigInt(Math.floor(1000 + ((i * 7919) % 900_000))),
        publishedAt,
        uploaderId: uploader.id,
        moderatorId: admin.id,
        categoryId: category.id,
        renditions: {
          create: [
            {
              resolution: "P720",
              url: mediaUrl,
              mimeType: "video/mp4",
              bitrateKbps: 2500,
              fileSizeB: BigInt(50_000_000),
            },
            {
              resolution: "P360",
              url: mediaUrl,
              mimeType: "video/mp4",
              bitrateKbps: 800,
              fileSizeB: BigInt(18_000_000),
            },
          ],
        },
      },
    });
  }

  // Recent view logs so the trending sidebar has something to rank.
  const videos = await prisma.video.findMany({ select: { id: true }, take: 10 });
  const logs = videos.flatMap((v, i) =>
    Array.from({ length: (10 - i) * 5 }, (_, j) => ({
      videoId: v.id,
      viewerHash: fakeHash(`seed-viewer-${i}-${j}`),
      watchedPct: [0, 25, 50, 75, 100][j % 5]!,
      createdAt: new Date(Date.now() - Math.floor(j * 17 * 60 * 1000)),
    })),
  );
  await prisma.viewLog.createMany({ data: logs, skipDuplicates: true });

  console.log(`Seeded ${TITLES.length} videos, ${logs.length} view logs.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

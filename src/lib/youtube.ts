import { prisma } from "@/lib/prisma";
import { createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// YouTube channel ingestion via public RSS feeds — no API key required.
// Each channel publishes its latest ~15 videos at:
//   https://www.youtube.com/feeds/videos.xml?channel_id=<ID>
// We store metadata only and render the videos as official embeds; the
// media itself always streams from YouTube (ToS-compliant).
// ---------------------------------------------------------------------------

interface ChannelConfig {
  channelId: string;
  name: string;
  categorySlug: "tech" | "ai" | "coding" | "gadgets";
}

// All channel ids verified against their live RSS feeds.
export const CHANNELS: ChannelConfig[] = [
  { channelId: "UCsBjURrPoezykLs9EqgamOA", name: "Fireship", categorySlug: "coding" },
  { channelId: "UCBJycsmduvYEL83R_U4JriQ", name: "Marques Brownlee", categorySlug: "gadgets" },
  { channelId: "UCbfYPyITQ-7l4upoX8nvctg", name: "Two Minute Papers", categorySlug: "ai" },
  { channelId: "UCXuqSBlHAE6Xw-yeJA0Tunw", name: "Linus Tech Tips", categorySlug: "tech" },
  { channelId: "UCddiUEpeqJcYeBxX1IVBKvQ", name: "The Verge", categorySlug: "tech" },
  { channelId: "UC9-y-6csu5WGm29I7JiwpnA", name: "Computerphile", categorySlug: "coding" },
  { channelId: "UCYO_jab_esuFRV4b17AJtAw", name: "3Blue1Brown", categorySlug: "ai" },
  { channelId: "UCSHZKyawb77ixDdsGog4iWA", name: "Lex Fridman", categorySlug: "ai" },
];

const CATEGORIES = [
  { name: "Tech", slug: "tech", sortOrder: 1 },
  { name: "AI", slug: "ai", sortOrder: 2 },
  { name: "Coding", slug: "coding", sortOrder: 3 },
  { name: "Gadgets", slug: "gadgets", sortOrder: 4 },
];

interface FeedEntry {
  videoId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  publishedAt: Date;
  youtubeViews: number;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function extract(block: string, regex: RegExp): string | null {
  const m = block.match(regex);
  return m?.[1] ?? null;
}

export function parseFeed(xml: string): FeedEntry[] {
  const entries: FeedEntry[] = [];
  const blocks = xml.split("<entry>").slice(1);

  for (const raw of blocks) {
    const block = raw.split("</entry>")[0] ?? raw;

    const videoId = extract(block, /<yt:videoId>([^<]+)<\/yt:videoId>/);
    const title = extract(block, /<title>([^<]*)<\/title>/);
    const published = extract(block, /<published>([^<]+)<\/published>/);
    if (!videoId || !title || !published) continue;

    const publishedAt = new Date(published);
    if (Number.isNaN(publishedAt.getTime())) continue;

    const thumbnailUrl =
      extract(block, /<media:thumbnail url="([^"]+)"/) ??
      `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    const description = extract(block, /<media:description>([\s\S]*?)<\/media:description>/) ?? "";
    const views = Number(extract(block, /<media:statistics views="(\d+)"/) ?? 0);

    entries.push({
      videoId,
      title: decodeEntities(title).slice(0, 200),
      description: decodeEntities(description).slice(0, 5000),
      thumbnailUrl,
      publishedAt,
      youtubeViews: Number.isFinite(views) ? views : 0,
    });
  }

  return entries;
}

function slugify(title: string, videoId: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
  return `${base || "video"}-${videoId.toLowerCase()}`;
}

export interface IngestResult {
  channelsFetched: number;
  channelsFailed: number;
  created: number;
  seen: number;
}

/**
 * Pull all channel feeds and upsert new videos as APPROVED.
 * Idempotent: (sourceType, externalId) is unique, existing rows only get a
 * lightweight metadata refresh. Safe to run as often as you like.
 */
export async function ingestYouTubeVideos(): Promise<IngestResult> {
  // Ensure categories and the system account exist (idempotent).
  const categories = new Map<string, string>();
  for (const c of CATEGORIES) {
    const cat = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { sortOrder: c.sortOrder },
      create: c,
    });
    categories.set(c.slug, cat.id);
  }

  const system = await prisma.user.upsert({
    where: { email: "ingest@techblob.system" },
    update: {},
    create: {
      email: "ingest@techblob.system",
      username: "techblob",
      passwordHash: createHash("sha256").update("system-account-no-login").digest("hex"),
      role: "ADMIN",
    },
  });

  const result: IngestResult = { channelsFetched: 0, channelsFailed: 0, created: 0, seen: 0 };

  // Sequential fetch: 8 requests, kind to YouTube, well within cron budget.
  for (const channel of CHANNELS) {
    let entries: FeedEntry[];
    try {
      const res = await fetch(
        `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channelId}`,
        { signal: AbortSignal.timeout(10_000), headers: { "user-agent": "techblob-ingest/1.0" } },
      );
      if (!res.ok) throw new Error(`feed returned ${res.status}`);
      entries = parseFeed(await res.text());
      result.channelsFetched++;
    } catch (err) {
      console.error(`[ingest] channel ${channel.name} failed`, err);
      result.channelsFailed++;
      continue; // one broken feed must not stop the others
    }

    for (const entry of entries) {
      result.seen++;
      try {
        const existing = await prisma.video.findUnique({
          where: {
            sourceType_externalId: { sourceType: "YOUTUBE", externalId: entry.videoId },
          },
          select: { id: true },
        });

        if (existing) {
          // Refresh mutable metadata; never touch our own view counters.
          await prisma.video.update({
            where: { id: existing.id },
            data: { title: entry.title, thumbnailUrl: entry.thumbnailUrl },
          });
          continue;
        }

        await prisma.video.create({
          data: {
            sourceType: "YOUTUBE",
            externalId: entry.videoId,
            sourceKey: `youtube/${entry.videoId}`,
            slug: slugify(entry.title, entry.videoId),
            title: entry.title,
            description: entry.description || null,
            thumbnailUrl: entry.thumbnailUrl,
            authorName: channel.name,
            status: "APPROVED",
            publishedAt: entry.publishedAt,
            viewCount: BigInt(0),
            uploaderId: system.id,
            categoryId: categories.get(channel.categorySlug) ?? null,
          },
        });
        result.created++;
      } catch (err) {
        console.error(`[ingest] upsert failed for ${entry.videoId}`, err);
      }
    }
  }

  return result;
}

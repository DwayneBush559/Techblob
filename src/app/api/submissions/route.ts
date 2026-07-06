import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { viewerHashFromRequest } from "@/lib/auth";
import { slugify } from "@/lib/youtube";
import { invalidateTrendingCache } from "@/lib/trending";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// POST /api/submissions — community-submitted YouTube links.
//  * accepts any watch/short/share URL form, extracts the 11-char video id
//  * verifies the video exists and is embeddable via YouTube oEmbed (no key)
//  * dedupes against everything already on the site
//  * rate-limits per viewer fingerprint (Redis)
// AUTO_APPROVE=true publishes immediately; set false to route submissions
// into the staff moderation queue instead (status PENDING).
// ---------------------------------------------------------------------------

const AUTO_APPROVE = true;
const MAX_SUBMISSIONS_PER_HOUR = 5;

const bodySchema = z.object({
  url: z.string().trim().min(11).max(500),
  categoryId: z.string().cuid().optional(),
});

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

function extractYouTubeId(input: string): string | null {
  // Bare id
  if (YT_ID.test(input)) return input;

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\.|^m\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.slice(1).split("/")[0] ?? "";
    return YT_ID.test(id) ? id : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const v = url.searchParams.get("v");
    if (v && YT_ID.test(v)) return v;
    const parts = url.pathname.split("/").filter(Boolean);
    // /shorts/<id>, /embed/<id>, /live/<id>
    if (parts.length >= 2 && ["shorts", "embed", "live"].includes(parts[0]!)) {
      const id = parts[1]!;
      return YT_ID.test(id) ? id : null;
    }
  }
  return null;
}

interface OEmbed {
  title: string;
  author_name: string;
  thumbnail_url: string;
}

async function fetchOEmbed(youtubeId: string): Promise<OEmbed | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(
        `https://www.youtube.com/watch?v=${youtubeId}`,
      )}&format=json`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null; // 404/401 = video missing, private, or not embeddable
    const data = (await res.json()) as Partial<OEmbed>;
    if (!data.title || !data.author_name) return null;
    return {
      title: data.title,
      author_name: data.author_name,
      thumbnail_url:
        data.thumbnail_url ?? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
    };
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Paste a YouTube link." }, { status: 400 });
  }

  const youtubeId = extractYouTubeId(parsed.data.url);
  if (!youtubeId) {
    return NextResponse.json(
      { error: "That doesn't look like a YouTube link. Try a youtube.com or youtu.be URL." },
      { status: 400 },
    );
  }

  // Rate limit per viewer fingerprint. If Redis is down, allow the request —
  // a submission lost to abuse is cheaper than blocking real users.
  const viewerHash = viewerHashFromRequest();
  try {
    const key = `ratelimit:submit:${viewerHash}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 3600);
    if (count > MAX_SUBMISSIONS_PER_HOUR) {
      return NextResponse.json(
        { error: "You're submitting too fast. Try again in an hour." },
        { status: 429 },
      );
    }
  } catch (err) {
    console.error("[submissions] rate limit check failed", err);
  }

  try {
    const existing = await prisma.video.findUnique({
      where: { sourceType_externalId: { sourceType: "YOUTUBE", externalId: youtubeId } },
      select: { slug: true, status: true },
    });
    if (existing) {
      if (existing.status === "APPROVED") {
        return NextResponse.json(
          { status: "duplicate", slug: existing.slug, message: "Already on Techblob!" },
          { status: 200 },
        );
      }
      return NextResponse.json(
        { status: "pending", message: "That video was already submitted and is awaiting review." },
        { status: 200 },
      );
    }

    const meta = await fetchOEmbed(youtubeId);
    if (!meta) {
      return NextResponse.json(
        { error: "Couldn't verify that video on YouTube. It may be private or unembeddable." },
        { status: 422 },
      );
    }

    if (parsed.data.categoryId) {
      const cat = await prisma.category.findUnique({ where: { id: parsed.data.categoryId } });
      if (!cat) {
        return NextResponse.json({ error: "Unknown category" }, { status: 400 });
      }
    }

    const submitter = await prisma.user.upsert({
      where: { email: "community@techblob.system" },
      update: {},
      create: {
        email: "community@techblob.system",
        username: "community",
        passwordHash: createHash("sha256").update("system-account-no-login").digest("hex"),
        role: "USER",
      },
    });

    const title = meta.title.slice(0, 200);
    const video = await prisma.video.create({
      data: {
        sourceType: "YOUTUBE",
        externalId: youtubeId,
        sourceKey: `youtube/${youtubeId}`,
        slug: slugify(title, youtubeId),
        title,
        thumbnailUrl: meta.thumbnail_url,
        authorName: meta.author_name.slice(0, 120),
        status: AUTO_APPROVE ? "APPROVED" : "PENDING",
        publishedAt: AUTO_APPROVE ? new Date() : null,
        uploaderId: submitter.id,
        categoryId: parsed.data.categoryId ?? null,
      },
      select: { slug: true, status: true },
    });

    if (video.status === "APPROVED") await invalidateTrendingCache();

    return NextResponse.json(
      {
        status: video.status === "APPROVED" ? "published" : "pending",
        slug: video.slug,
        message:
          video.status === "APPROVED"
            ? "Your video is live!"
            : "Submitted! It'll appear once approved.",
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[submissions] failed", err);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}

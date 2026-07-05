import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recordView, recordMilestone } from "@/lib/views";
import { viewerHashFromRequest } from "@/lib/auth";
import { redis } from "@/lib/redis";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// POST /api/videos/:id/view — THE high-concurrency endpoint.
//
// Design constraints:
//  * Called once per playback start by every viewer, plus 4 milestone beacons.
//  * Must never touch Postgres: all writes land in Redis (HINCRBY + LPUSH),
//    which handles ~100k ops/s on a single node. A cron job batch-flushes
//    to Postgres (see /api/cron/flush-views).
//  * Must tolerate navigator.sendBeacon(): beacons arrive as text/plain and
//    the client never reads the response, so we parse defensively and always
//    return quickly.
//  * Per-viewer dedupe (1 counted view/video/hour) + a coarse per-IP-hash
//    rate limit stop trivial count inflation.
// ---------------------------------------------------------------------------

const bodySchema = z.object({
  event: z
    .enum(["start", "milestone_25", "milestone_50", "milestone_75", "milestone_100"])
    .default("start"),
});

const idSchema = z.string().cuid();

const RATE_LIMIT_MAX = 120; // events/min per viewer hash — generous for real use
const RATE_LIMIT_WINDOW_SEC = 60;

async function isRateLimited(viewerHash: string): Promise<boolean> {
  const key = `ratelimit:view:${viewerHash}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, RATE_LIMIT_WINDOW_SEC);
  return count > RATE_LIMIT_MAX;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const idResult = idSchema.safeParse(params.id);
  if (!idResult.success) {
    return NextResponse.json({ error: "Invalid video id" }, { status: 400 });
  }
  const videoId = idResult.data;

  // sendBeacon sends text/plain (or nothing); regular fetch sends JSON.
  let rawBody: unknown = {};
  try {
    const text = await req.text();
    if (text) rawBody = JSON.parse(text);
  } catch {
    rawBody = {};
  }
  const parsed = bodySchema.safeParse(rawBody);
  const event = parsed.success ? parsed.data.event : "start";

  const viewerHash = viewerHashFromRequest();

  try {
    if (await isRateLimited(viewerHash)) {
      // 202 not 429: beacons don't retry, and we don't want abusive clients
      // probing which requests actually counted.
      return NextResponse.json({ counted: false }, { status: 202 });
    }

    if (event === "start") {
      const country = req.headers.get("x-vercel-ip-country") ?? req.headers.get("cf-ipcountry");
      const result = await recordView({ videoId, viewerHash, country });
      return NextResponse.json(
        { counted: result.counted, liveCount: result.liveCount },
        { status: 202 },
      );
    }

    const pct = Number(event.split("_")[1]) as 25 | 50 | 75 | 100;
    await recordMilestone({ videoId, viewerHash, watchedPct: pct });
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch (err) {
    // Redis down: swallow the error. Losing a view beacon is acceptable;
    // failing the request (and spamming client consoles) is not.
    console.error("[api/videos/:id/view] redis write failed", err);
    return NextResponse.json({ counted: false }, { status: 202 });
  }
}

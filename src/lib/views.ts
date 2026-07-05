import { redis, KEYS, VIEW_DEDUPE_TTL_SECONDS } from "@/lib/redis";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// WRITE PATH (hot, per-request): everything goes to Redis only.
//   - HINCRBY views:pending  <videoId> 1     (delta awaiting flush)
//   - INCR   views:live:<id>                  (near-realtime UI overlay)
//   - LPUSH  views:logbuffer <json>           (ViewLog row awaiting insert)
// Postgres is touched ONLY by flushViewsToPostgres(), on a schedule.
// ---------------------------------------------------------------------------

export interface RecordViewResult {
  counted: boolean; // false when deduped (same viewer, same video, <1h)
  liveCount: number;
}

export async function recordView(params: {
  videoId: string;
  viewerHash: string;
  country?: string | null;
}): Promise<RecordViewResult> {
  const { videoId, viewerHash, country } = params;

  // 1 counted view per viewer per video per hour. SET NX EX is atomic, so
  // concurrent duplicate requests race safely — exactly one wins.
  const dedupeKey = KEYS.viewDedupe(videoId, viewerHash);
  const isFirst = await redis.set(dedupeKey, "1", "EX", VIEW_DEDUPE_TTL_SECONDS, "NX");

  if (isFirst !== "OK") {
    const live = await redis.get(KEYS.liveCount(videoId));
    return { counted: false, liveCount: Number(live ?? 0) };
  }

  const logRow = JSON.stringify({
    videoId,
    viewerHash,
    country: country ?? null,
    watchedPct: 0,
    ts: Date.now(),
  });

  const [, liveCount] = await redis
    .multi()
    .hincrby(KEYS.pendingViews, videoId, 1)
    .incr(KEYS.liveCount(videoId))
    .expire(KEYS.liveCount(videoId), 86400)
    .lpush(KEYS.viewLogBuffer, logRow)
    .exec()
    .then((results) => {
      if (!results) throw new Error("Redis MULTI aborted");
      for (const [err] of results) if (err) throw err;
      return [results[0]![1] as number, results[1]![1] as number] as const;
    });

  return { counted: true, liveCount };
}

/**
 * Milestone updates (25/50/75/100%) don't change the view count — they enrich
 * the most recent buffered log row's watchedPct. To stay O(1) we just push a
 * lightweight "milestone" row; the flush job folds them into ViewLogs.
 */
export async function recordMilestone(params: {
  videoId: string;
  viewerHash: string;
  watchedPct: 25 | 50 | 75 | 100;
}): Promise<void> {
  await redis.lpush(
    KEYS.viewLogBuffer,
    JSON.stringify({ ...params, milestone: true, ts: Date.now() }),
  );
}

/** Persisted count + unflushed Redis overlay, for display. */
export async function getDisplayViewCount(videoId: string, persisted: bigint): Promise<bigint> {
  try {
    const pending = await redis.hget(KEYS.pendingViews, videoId);
    return persisted + BigInt(pending ?? 0);
  } catch {
    return persisted; // Redis down → degrade to the persisted number
  }
}

// ---------------------------------------------------------------------------
// FLUSH PATH (cold, scheduled): drains Redis into Postgres in one batch.
// Crash-safe hand-off:
//   1. RENAME views:pending -> views:flushing (atomic snapshot; new views
//      keep accumulating in a fresh views:pending)
//   2. Apply the snapshot to Postgres
//   3. DEL views:flushing only after commit
// If the process dies between 2 and 3, the next run re-merges views:flushing
// back into views:pending before snapshotting, so no counts are ever lost.
// ---------------------------------------------------------------------------

const LOG_BATCH_SIZE = 1000;
const FLUSH_LOCK_TTL_SECONDS = 55;

interface BufferedLog {
  videoId: string;
  viewerHash: string;
  country?: string | null;
  watchedPct?: number;
  milestone?: boolean;
  ts: number;
}

export interface FlushResult {
  videosUpdated: number;
  viewsFlushed: number;
  logsInserted: number;
  skipped: boolean;
}

export async function flushViewsToPostgres(): Promise<FlushResult> {
  // Distributed lock: cron overlap or multiple instances must not double-flush.
  const gotLock = await redis.set(KEYS.flushLock, "1", "EX", FLUSH_LOCK_TTL_SECONDS, "NX");
  if (gotLock !== "OK") {
    return { videosUpdated: 0, viewsFlushed: 0, logsInserted: 0, skipped: true };
  }

  try {
    // Recover a snapshot orphaned by a crash mid-flush.
    const orphaned = await redis.hgetall(KEYS.flushingViews);
    if (Object.keys(orphaned).length > 0) {
      const merge = redis.multi();
      for (const [videoId, delta] of Object.entries(orphaned)) {
        merge.hincrby(KEYS.pendingViews, videoId, Number(delta));
      }
      merge.del(KEYS.flushingViews);
      await merge.exec();
    }

    // Atomic snapshot. RENAME fails with "no such key" when there's nothing
    // pending — that's a normal idle tick, not an error.
    try {
      await redis.rename(KEYS.pendingViews, KEYS.flushingViews);
    } catch (err) {
      if (err instanceof Error && err.message.includes("no such key")) {
        const logsInserted = await drainLogBuffer();
        return { videosUpdated: 0, viewsFlushed: 0, logsInserted, skipped: false };
      }
      throw err;
    }

    const snapshot = await redis.hgetall(KEYS.flushingViews);
    const entries = Object.entries(snapshot)
      .map(([videoId, delta]) => ({ videoId, delta: Number(delta) }))
      .filter((e) => Number.isFinite(e.delta) && e.delta > 0);

    let viewsFlushed = 0;
    if (entries.length > 0) {
      // Single statement, single round-trip, no per-row locks held across
      // requests: UPDATE ... FROM (VALUES ...) applies every delta at once.
      const values = Prisma.join(
        entries.map((e) => Prisma.sql`(${e.videoId}, ${e.delta}::bigint)`),
      );
      await prisma.$executeRaw`
        UPDATE videos AS v
        SET "viewCount" = v."viewCount" + d.delta
        FROM (VALUES ${values}) AS d(id, delta)
        WHERE v.id = d.id
      `;
      viewsFlushed = entries.reduce((sum, e) => sum + e.delta, 0);
    }

    // Commit point: the snapshot is in Postgres, drop it.
    await redis.del(KEYS.flushingViews);

    const logsInserted = await drainLogBuffer();

    return {
      videosUpdated: entries.length,
      viewsFlushed,
      logsInserted,
      skipped: false,
    };
  } finally {
    await redis.del(KEYS.flushLock).catch(() => {});
  }
}

/**
 * Drain buffered log rows into ViewLog with createMany. Milestone rows are
 * folded into the base row for the same (videoId, viewerHash) in this batch;
 * stragglers become their own row so the data is never dropped.
 */
async function drainLogBuffer(): Promise<number> {
  let inserted = 0;

  for (;;) {
    const raw = await redis.lpop(KEYS.viewLogBuffer, LOG_BATCH_SIZE);
    if (!raw || raw.length === 0) break;

    const parsed: BufferedLog[] = [];
    for (const item of raw) {
      try {
        parsed.push(JSON.parse(item) as BufferedLog);
      } catch {
        // A corrupt entry must not poison the whole batch.
        console.error("[views] dropping malformed log buffer entry");
      }
    }

    const byViewer = new Map<string, BufferedLog>();
    for (const row of parsed) {
      const key = `${row.videoId}:${row.viewerHash}`;
      const existing = byViewer.get(key);
      if (!existing) {
        byViewer.set(key, { ...row });
      } else {
        existing.watchedPct = Math.max(existing.watchedPct ?? 0, row.watchedPct ?? 0);
        existing.country = existing.country ?? row.country;
      }
    }

    const rows = [...byViewer.values()];
    if (rows.length > 0) {
      const result = await prisma.viewLog.createMany({
        data: rows.map((r) => ({
          videoId: r.videoId,
          viewerHash: r.viewerHash,
          watchedPct: r.watchedPct ?? 0,
          country: r.country ?? null,
          createdAt: new Date(r.ts),
        })),
        skipDuplicates: true,
      });
      inserted += result.count;
    }

    if (raw.length < LOG_BATCH_SIZE) break;
  }

  return inserted;
}

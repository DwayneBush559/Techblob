import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { redis?: Redis };

function createClient(): Redis {
  const client = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
    maxRetriesPerRequest: 2,
    enableAutoPipelining: true, // coalesces concurrent commands into pipelines
    // Connect on first command, not at import — required for serverless
    // cold starts and for building without a reachable Redis.
    lazyConnect: true,
  });
  client.on("error", (err) => {
    console.error("[redis]", err.message);
  });
  return client;
}

export const redis = globalForRedis.redis ?? createClient();

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

// ---------------------------------------------------------------------------
// Key names — single source of truth so the increment path and the flush job
// can never drift apart.
// ---------------------------------------------------------------------------
export const KEYS = {
  /** HASH: videoId -> pending view delta (not yet flushed to Postgres) */
  pendingViews: "views:pending",
  /** HASH: snapshot being flushed (crash-safe hand-off target) */
  flushingViews: "views:flushing",
  /** LIST: JSON-encoded ViewLog rows awaiting batch insert */
  viewLogBuffer: "views:logbuffer",
  /** STRING (NX lock): prevents concurrent flush jobs */
  flushLock: "views:flush:lock",
  /** STRING: cached trending feed JSON */
  trendingFeed: "feed:trending",
  /** STRING: stale copy kept longer, served if a rebuild is in flight */
  trendingFeedStale: "feed:trending:stale",
  /** STRING (NX lock): only one process rebuilds trending at a time */
  trendingLock: "feed:trending:lock",
  /** Per-viewer dedupe: one counted view per video per viewer per hour */
  viewDedupe: (videoId: string, viewerHash: string) =>
    `views:dedupe:${videoId}:${viewerHash}`,
  /** Live (unflushed) count overlay so the UI shows near-realtime numbers */
  liveCount: (videoId: string) => `views:live:${videoId}`,
} as const;

export const TRENDING_TTL_SECONDS = 300; // 5 minutes, per spec
export const TRENDING_STALE_TTL_SECONDS = 3600;
export const VIEW_DEDUPE_TTL_SECONDS = 3600;

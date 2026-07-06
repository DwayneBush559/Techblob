# StreetView — High-Traffic Video Platform

A WorldStarHipHop-style video-sharing application: Next.js 14 (App Router) +
TypeScript + Tailwind on the front, Next.js Route Handlers on the back,
PostgreSQL (Prisma) as the system of record, Redis as the hot-path buffer and
cache, S3-compatible object storage + CDN for the video bytes themselves.

## System architecture

```
 Browser ──────────────────────────────────────────────────────────────┐
   │  page loads (ISR, 30s)          │  video bytes (never touch app)  │
   ▼                                 ▼                                 │
 Next.js app  ──reads──▶  PostgreSQL (Prisma)          CDN ◀── S3/R2 ◀─┘
   │                        ▲                                   ▲
   │  hot writes            │  batched UPDATE + createMany      │ presigned PUT
   ▼                        │                                   │ (direct upload)
 Redis  ◀──────── cron flush (1/min, NX-locked) ────────────────┘
   • views:pending  (HASH: videoId → delta)
   • views:logbuffer (LIST: pending ViewLog rows)
   • feed:trending   (STRING: cached JSON, TTL 300s)
```

**Load-bearing decisions**

1. **Video bytes never touch the app servers.** Uploads go browser → S3 via
   presigned PUT; playback goes CDN → browser. The Node tier only moves
   metadata, so it scales on cheap instances.
2. **Postgres is never written on the view hot path.** Every view/milestone
   beacon lands in Redis (`HINCRBY` + `LPUSH`, ~O(1), no locks). A once-a-minute
   flush applies all deltas in a **single** `UPDATE ... FROM (VALUES ...)`
   statement and bulk-inserts logs with `createMany`. 50k concurrent viewers
   produce ~1 write transaction per minute, not 50k row locks per second.
3. **The flush is crash-safe.** `RENAME views:pending → views:flushing`
   snapshots atomically; the snapshot is deleted only after the SQL commits.
   A crash mid-flush is recovered by merging the orphaned snapshot back on the
   next run. An NX lock makes overlapping cron fires no-ops.
4. **Trending is stampede-proof.** Cache miss → one `SET NX` lock winner
   rebuilds from Postgres; everyone else serves a stale copy (kept 1h). The DB
   sees ≤1 trending query per 5-minute window regardless of traffic.
5. **Feeds use cursor pagination**, not OFFSET — page 400 of infinite scroll
   costs the same as page 1, served by the `(status, publishedAt DESC)` index.
6. **Graceful degradation everywhere.** Redis down → view beacons are dropped
   silently (202) and trending falls back to a direct DB query. Ad server
   down → the player skips straight to content. A broken ad creative can
   never block playback.

## Repository layout

| Path | What it is |
|---|---|
| `prisma/schema.prisma` | Full schema: Users, Videos (+statuses), Categories, Comments, ViewLogs, VideoRenditions |
| `prisma/seed.ts` | Dev seed: 30 playable videos, categories, view logs |
| `src/lib/redis.ts` | Redis client + every key name and TTL in one place |
| `src/lib/views.ts` | **View pipeline**: `recordView` (hot path), `flushViewsToPostgres` (batch path) |
| `src/lib/trending.ts` | 5-min cached trending feed with lock + stale fallback |
| `src/lib/s3.ts` | Presigned direct-to-bucket uploads |
| `src/lib/ads.ts` | Simulated ad decision server (swap for VAST/VMAP) |
| `src/lib/auth.ts` | HMAC session tokens, scrypt password hashing, `requireUser`/`requireStaff`, viewer fingerprint |
| `src/components/VideoPlayer.tsx` | Custom HTML5 player: pre-roll ads, milestone analytics, quality switch, fullscreen, keyboard |
| `src/components/InfiniteFeed.tsx` | IntersectionObserver infinite scroll + in-feed ad injection |
| `src/app/page.tsx` | High-density homepage: latest grid + trending sidebar + ad slots |
| `src/app/watch/[slug]/page.tsx` | Watch page (ISR 60s) |
| `src/app/api/videos/route.ts` | Public feed (cursor pagination) |
| `src/app/api/videos/[id]/stream/route.ts` | Stream metadata + rendition URLs (edge-cached) |
| `src/app/api/videos/[id]/view/route.ts` | **High-concurrency view/milestone ingest** (Redis-only) |
| `src/app/api/cron/flush-views/route.ts` | Batched Redis → Postgres flush (Vercel Cron / curl) |
| `src/app/api/uploads/presign/route.ts` | Presigned upload + PENDING Video row |
| `src/app/api/admin/videos/*` | Staff CMS: queue list, approve, schedule, reject, delete |
| `src/app/api/auth/*` | Signup, login (email or username), logout, session lookup |
| `src/app/login`, `src/app/signup` | Account pages; `?next=` returns users where they came from |
| `src/app/api/videos/[id]/comments/route.ts` | Comments: cursor-paginated GET, rate-limited POST with single-level replies |
| `src/components/CommentsSection.tsx` | Watch-page comments UI (client-side, keeps the page ISR) |
| `src/app/api/trending/route.ts` | Cached trending JSON |
| `src/app/api/ads/preroll/route.ts` | Ad decision endpoint |
| `scripts/flush-views.ts` | Long-lived flush worker for non-serverless deploys |

## Data lifecycle

**Upload → live:**
`POST /api/uploads/presign` (creates `PENDING` Video + presigned URL) →
browser PUTs to S3 → bucket event triggers the transcoder (MediaConvert /
ffmpeg workers — external to this repo) which writes `VideoRendition` rows →
staff `PATCH /api/admin/videos/:id {action:"approve"}` (or `"schedule"`,
`publishAt`) → status `APPROVED`, visible once `publishedAt <= now()`.
Scheduling needs no cron: visibility is the query predicate itself.

**View counting:**
Player fires `start` once per playback plus `milestone_25/50/75/100` beacons
(`navigator.sendBeacon`, so abandons still report). The endpoint dedupes
per viewer-hash per hour (`SET NX EX`), rate-limits, then `HINCRBY`s the
pending hash and `LPUSH`es a log row. Displayed counts = persisted count +
unflushed Redis delta, so numbers look live while Postgres stays cold.

## Running locally

```bash
cp .env.example .env        # fill in DATABASE_URL, REDIS_URL, secrets
npm install
npx prisma migrate dev      # creates schema
npx tsx prisma/seed.ts      # 30 playable demo videos
npm run dev                 # http://localhost:3000

# in another terminal — the view flusher:
npm run views:flush
```

Docker one-liners for the dependencies:

```bash
docker run -d --name pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=worldstar -p 5432:5432 postgres:16
docker run -d --name redis -p 6379:6379 redis:7
```

## Production notes / next steps

- **Transcoding**: wire the S3 `ObjectCreated` event to AWS MediaConvert or an
  ffmpeg worker fleet producing HLS ladders (240p–1080p); write
  `VideoRendition` rows and flip `PROCESSING → APPROVED` on completion.
- **Auth**: email/username + password accounts are built in (scrypt hashing,
  HMAC sessions). To add OAuth providers, swap in NextAuth/Clerk;
  `requireUser`/`requireStaff` call sites don't change.
- **Ads**: replace `selectPrerollAd` with a VAST/VMAP exchange call and mount
  GPT/Prebid units in `AdBanner`; the component contracts already match.
- **ViewLog growth**: partition by month (`pg_partman`) and roll old
  partitions into a warehouse; the table is append-only by design.
- **Redis HA**: use a managed Redis with AOF persistence; worst-case loss on
  failover is one flush interval (~1 min) of view deltas.
- **Comments**: live — signed-in users comment and reply (single-level
  threads) on watch pages; staff can hide rows via `isHidden`. A moderation
  UI over that flag is a natural next slice.
```

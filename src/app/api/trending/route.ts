import { NextResponse } from "next/server";
import { getTrendingFeed } from "@/lib/trending";

export const runtime = "nodejs";
// Without this, Next bakes the route's response at build time; trending must
// re-read the Redis cache on every request.
export const dynamic = "force-dynamic";

/** GET /api/trending — Redis-cached (5 min) trending feed. */
export async function GET() {
  try {
    const feed = await getTrendingFeed();
    return NextResponse.json(
      { items: feed },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=240" } },
    );
  } catch (err) {
    console.error("[api/trending] failed", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

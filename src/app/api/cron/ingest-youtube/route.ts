import { NextRequest, NextResponse } from "next/server";
import { ingestYouTubeVideos } from "@/lib/youtube";
import { invalidateTrendingCache } from "@/lib/trending";

export const runtime = "nodejs";
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// POST/GET /api/cron/ingest-youtube — pulls the latest videos from all
// configured tech/AI channels. Idempotent; run hourly or daily.
// Auth: Authorization: Bearer <CRON_SECRET>  or  ?key=<CRON_SECRET>
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const key = req.nextUrl.searchParams.get("key");
  const expected = process.env.CRON_SECRET;
  const authorized =
    Boolean(expected) && (auth === `Bearer ${expected}` || key === expected);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await ingestYouTubeVideos();
    if (result.created > 0) await invalidateTrendingCache();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/ingest-youtube] failed", err);
    return NextResponse.json({ error: "Ingest failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}

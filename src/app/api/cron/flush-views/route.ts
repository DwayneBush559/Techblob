import { NextRequest, NextResponse } from "next/server";
import { flushViewsToPostgres } from "@/lib/views";

export const runtime = "nodejs";
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// POST /api/cron/flush-views — drains Redis view counters into Postgres.
//
// Trigger every minute:
//   * Vercel: { "crons": [{ "path": "/api/cron/flush-views", "schedule": "* * * * *" }] }
//   * Anywhere else: curl -X POST -H "Authorization: Bearer $CRON_SECRET" .../api/cron/flush-views
//   * Long-lived deploys can instead run scripts/flush-views.ts as a worker.
//
// Safe to over-trigger: a Redis NX lock inside flushViewsToPostgres makes
// concurrent invocations no-ops.
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // Accept the secret via Authorization header OR ?key= query param — some
  // external cron services make custom headers awkward to configure.
  const auth = req.headers.get("authorization");
  const key = req.nextUrl.searchParams.get("key");
  const expected = process.env.CRON_SECRET;
  const authorized =
    Boolean(expected) && (auth === `Bearer ${expected}` || key === expected);
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await flushViewsToPostgres();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/flush-views] flush failed", err);
    // 500 so the cron platform records the failure; the crash-safe snapshot
    // in Redis means no counts were lost — the next run recovers them.
    return NextResponse.json({ error: "Flush failed" }, { status: 500 });
  }
}

// Vercel Cron uses GET.
export async function GET(req: NextRequest) {
  return POST(req);
}

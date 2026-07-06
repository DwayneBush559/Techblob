import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getFeedPage } from "@/lib/feed";

export const runtime = "nodejs";

const querySchema = z.object({
  cursor: z.string().cuid().optional(),
  limit: z.coerce.number().int().min(1).max(48).default(24),
  category: z.string().max(64).optional(),
  author: z.string().max(120).optional(),
  q: z.string().max(100).optional(),
});

/**
 * GET /api/videos — public paginated feed (newest approved first).
 * Cursor pagination (id of the last item) instead of OFFSET: constant-time
 * regardless of scroll depth, which matters for infinite scroll.
 * Filters: ?category=<slug>  ?author=<channel name>  ?q=<title search>
 */
export async function GET(req: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { cursor, limit, category, author, q } = parsed.data;

  try {
    const body = await getFeedPage({ category, author, q }, cursor, limit);
    return NextResponse.json(body, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" },
    });
  } catch (err) {
    console.error("[api/videos] feed query failed", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { selectPrerollAd } from "@/lib/ads";

export const runtime = "nodejs";

const querySchema = z.object({ videoId: z.string().cuid() });

/**
 * GET /api/ads/preroll?videoId=... — ad decision endpoint.
 * Simulated here; production swaps the body of selectPrerollAd for a
 * VAST/VMAP exchange call without touching the player.
 */
export async function GET(req: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: "videoId required" }, { status: 400 });
  }

  try {
    const ad = selectPrerollAd(parsed.data.videoId);
    return NextResponse.json(
      { ad },
      // Cacheable within the hour bucket the rotation uses.
      { headers: { "Cache-Control": "public, s-maxage=300" } },
    );
  } catch (err) {
    console.error("[api/ads/preroll] failed", err);
    // No ad is never a fatal condition for playback.
    return NextResponse.json({ ad: null });
  }
}

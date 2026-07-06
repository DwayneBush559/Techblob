import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/auth/me — the client-side source of truth for "am I signed in?".
// Pages stay static/ISR; anything session-aware asks this endpoint instead.
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({
    user: user ? { id: user.id, username: user.username, role: user.role } : null,
  });
}

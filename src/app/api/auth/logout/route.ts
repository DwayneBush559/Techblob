import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export const runtime = "nodejs";

// POST /api/auth/logout — end the session. Always succeeds.
export async function POST() {
  clearSessionCookie();
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { verifyPassword, setSessionCookie, viewerHashFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// POST /api/auth/login — email OR username + password.
// Every failure returns the same message so the endpoint can't be used to
// enumerate accounts.
// ---------------------------------------------------------------------------

const MAX_ATTEMPTS_PER_15_MIN = 10;
const INVALID = "Invalid credentials.";

const bodySchema = z.object({
  identifier: z.string().trim().min(3).max(254), // email or username
  password: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: INVALID }, { status: 400 });
  }
  const { identifier, password } = parsed.data;

  try {
    const key = `ratelimit:login:${viewerHashFromRequest()}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 900);
    if (count > MAX_ATTEMPTS_PER_15_MIN) {
      return NextResponse.json(
        { error: "Too many attempts. Try again in 15 minutes." },
        { status: 429 },
      );
    }
  } catch (err) {
    console.error("[auth/login] rate limit check failed", err);
  }

  try {
    const user = await prisma.user.findFirst({
      where: identifier.includes("@")
        ? { email: identifier.toLowerCase() }
        : { username: { equals: identifier, mode: "insensitive" } },
    });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: INVALID }, { status: 401 });
    }
    if (user.isBanned) {
      return NextResponse.json({ error: "This account is banned." }, { status: 403 });
    }

    setSessionCookie(user.id);
    return NextResponse.json({
      user: { id: user.id, username: user.username, role: user.role },
    });
  } catch (err) {
    console.error("[auth/login] failed", err);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}

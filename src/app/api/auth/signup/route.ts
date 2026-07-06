import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { hashPassword, setSessionCookie, viewerHashFromRequest } from "@/lib/auth";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// POST /api/auth/signup — create an account and start a session.
// Rate-limited per viewer fingerprint so a script can't mass-register.
// ---------------------------------------------------------------------------

const MAX_SIGNUPS_PER_HOUR = 5;

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  username: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_]{3,32}$/, "3–32 letters, numbers, or underscores"),
  password: z.string().min(8).max(200),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid request" },
      { status: 400 },
    );
  }
  const { email, username, password } = parsed.data;

  // Fail-open rate limit, same trade-off as /api/submissions.
  try {
    const key = `ratelimit:signup:${viewerHashFromRequest()}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 3600);
    if (count > MAX_SIGNUPS_PER_HOUR) {
      return NextResponse.json(
        { error: "Too many signups from this device. Try again later." },
        { status: 429 },
      );
    }
  } catch (err) {
    console.error("[auth/signup] rate limit check failed", err);
  }

  try {
    const clash = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username: { equals: username, mode: "insensitive" } }],
      },
      select: { email: true },
    });
    if (clash) {
      return NextResponse.json(
        {
          error:
            clash.email === email
              ? "An account with that email already exists."
              : "That username is taken.",
        },
        { status: 409 },
      );
    }

    const user = await prisma.user.create({
      data: { email, username, passwordHash: hashPassword(password) },
      select: { id: true, username: true, role: true },
    });

    setSessionCookie(user.id);
    return NextResponse.json(
      { user: { id: user.id, username: user.username, role: user.role } },
      { status: 201 },
    );
  } catch (err) {
    // Unique-constraint race between the check and the create.
    if (typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "That email or username is already taken." },
        { status: 409 },
      );
    }
    console.error("[auth/signup] failed", err);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
}

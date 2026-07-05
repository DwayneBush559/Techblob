import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { Role, User } from "@prisma/client";

// ---------------------------------------------------------------------------
// Minimal HMAC-signed session tokens (swap for NextAuth/Clerk in production —
// the requireUser/requireStaff call sites stay identical).
// Token format: base64url(payload).base64url(hmac-sha256(payload))
// Payload: { uid, exp }
// ---------------------------------------------------------------------------

const SESSION_COOKIE = "ws_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14; // 14 days

function secret(): Buffer {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not configured");
  return Buffer.from(s, "utf8");
}

export function createSessionToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, exp: Date.now() + SESSION_TTL_MS }),
    "utf8",
  ).toString("base64url");
  const sig = createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string): string | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const expected = createHmac("sha256", secret()).update(payload).digest();
  let given: Buffer;
  try {
    given = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      uid?: string;
      exp?: number;
    };
    if (typeof data.uid !== "string" || typeof data.exp !== "number") return null;
    if (data.exp < Date.now()) return null;
    return data.uid;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = verifySessionToken(token);
  if (!userId) return null;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.isBanned) return null;
  return user;
}

export class AuthError extends Error {
  constructor(public status: 401 | 403, message: string) {
    super(message);
  }
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError(401, "Authentication required");
  return user;
}

const STAFF_ROLES: Role[] = ["MODERATOR", "ADMIN"];

export async function requireStaff(): Promise<User> {
  const user = await requireUser();
  if (!STAFF_ROLES.includes(user.role)) {
    throw new AuthError(403, "Staff access required");
  }
  return user;
}

// ---------------------------------------------------------------------------
// Anonymous viewer fingerprint for view dedupe — never stores raw IP.
// ---------------------------------------------------------------------------
export function viewerHashFromRequest(): string {
  const h = headers();
  const ip =
    h.get("x-real-ip") ??
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "0.0.0.0";
  const ua = h.get("user-agent") ?? "unknown";
  // Daily salt so hashes can't be joined across days
  const daySalt = new Date().toISOString().slice(0, 10);
  return createHash("sha256")
    .update(`${ip}|${ua}|${daySalt}|${process.env.SESSION_SECRET ?? ""}`)
    .digest("hex");
}

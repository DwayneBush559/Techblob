import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthError, requireUser } from "@/lib/auth";

export const runtime = "nodejs";

const bodySchema = z.object({ userId: z.string().cuid() });

/** POST /api/blocks — block someone: their comments stop showing for you. DELETE unblocks. */
export async function POST(req: NextRequest) {
  return handle(req, "block");
}
export async function DELETE(req: NextRequest) {
  return handle(req, "unblock");
}

async function handle(req: NextRequest, mode: "block" | "unblock") {
  try {
    const user = await requireUser();
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "userId required" }, { status: 400 });
    if (parsed.data.userId === user.id) return NextResponse.json({ error: "You can't block yourself." }, { status: 400 });
    const key = { blockerId_blockedId: { blockerId: user.id, blockedId: parsed.data.userId } };
    if (mode === "block") await prisma.userBlock.upsert({ where: key, create: { blockerId: user.id, blockedId: parsed.data.userId }, update: {} });
    else await prisma.userBlock.deleteMany({ where: { blockerId: user.id, blockedId: parsed.data.userId } });
    return NextResponse.json({ ok: true, blocked: mode === "block" });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[api/blocks] failed", err);
    return NextResponse.json({ error: "Couldn't update the block." }, { status: 500 });
  }
}

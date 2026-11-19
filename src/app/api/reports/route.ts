import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthError, requireUser } from "@/lib/auth";
import { REPORT_REASONS } from "@/lib/techblob";

export const runtime = "nodejs";

const bodySchema = z
  .object({
    videoId: z.string().cuid().optional(),
    commentId: z.string().cuid().optional(),
    reason: z.enum(REPORT_REASONS),
    details: z.string().trim().max(1000).optional(),
  })
  .refine((b) => Boolean(b.videoId) !== Boolean(b.commentId), { message: "report one video or one comment" });

/** POST /api/reports — report a video or a comment. Staff review every report within 24 hours. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid report" }, { status: 400 });
    const { videoId, commentId, reason, details } = parsed.data;
    let targetVideo = videoId ?? null;
    if (commentId) {
      const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { videoId: true } });
      if (!comment) return NextResponse.json({ error: "Comment not found" }, { status: 404 });
      targetVideo = comment.videoId;
    }
    const report = await prisma.report.create({
      data: { reporterId: user.id, videoId: targetVideo, commentId: commentId ?? null, reason, details: details || null },
      select: { id: true, createdAt: true },
    });
    return NextResponse.json({ ok: true, id: report.id, message: "Thanks. We review every report within 24 hours." }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[api/reports] failed", err);
    return NextResponse.json({ error: "Couldn't send the report." }, { status: 500 });
  }
}

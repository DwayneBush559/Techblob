import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthError, requireStaff } from "@/lib/auth";

export const runtime = "nodejs";

const bodySchema = z.object({ action: z.enum(["remove", "keep"]) });

/** PATCH /api/reports/:id — staff close a report: remove hides the reported comment or video, keep leaves it. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const staff = await requireStaff();
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "action must be remove or keep" }, { status: 400 });
    const report = await prisma.report.findUnique({ where: { id: params.id } });
    if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
    if (parsed.data.action === "remove") {
      if (report.commentId) await prisma.comment.updateMany({ where: { id: report.commentId }, data: { isHidden: true } });
      else if (report.videoId) await prisma.video.update({ where: { id: report.videoId }, data: { status: "REJECTED", rejectedReason: `Removed after a report: ${report.reason}`, moderatorId: staff.id } });
    }
    await prisma.report.update({ where: { id: report.id }, data: { resolvedAt: new Date(), resolution: parsed.data.action === "remove" ? "Removed" : "Kept" } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[api/reports/:id] failed", err);
    return NextResponse.json({ error: "Couldn't update the report." }, { status: 500 });
  }
}

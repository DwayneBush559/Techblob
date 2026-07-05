import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff, AuthError } from "@/lib/auth";
import { invalidateTrendingCache } from "@/lib/trending";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Staff CMS actions.
//   PATCH  /api/admin/videos/:id   { action: "approve" }                — go live now
//   PATCH  /api/admin/videos/:id   { action: "schedule", publishAt }    — go live later
//   PATCH  /api/admin/videos/:id   { action: "reject", reason }         — decline
//   DELETE /api/admin/videos/:id                                        — remove
// ---------------------------------------------------------------------------

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({
    action: z.literal("schedule"),
    publishAt: z.coerce.date().refine((d) => d.getTime() > Date.now(), {
      message: "publishAt must be in the future",
    }),
  }),
  z.object({
    action: z.literal("reject"),
    reason: z.string().trim().min(3).max(500),
  }),
]);

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const staff = await requireStaff();

    const json = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const video = await prisma.video.findUnique({
      where: { id: params.id },
      select: { id: true, status: true },
    });
    if (!video) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    const body = parsed.data;

    if (body.action === "reject") {
      const updated = await prisma.video.update({
        where: { id: video.id },
        data: {
          status: "REJECTED",
          rejectedReason: body.reason,
          moderatorId: staff.id,
          publishedAt: null,
        },
        select: { id: true, status: true },
      });
      await invalidateTrendingCache();
      return NextResponse.json(updated);
    }

    // approve / schedule: only PENDING or PROCESSING submissions qualify.
    if (video.status === "REJECTED") {
      return NextResponse.json(
        { error: "Rejected videos must be resubmitted, not approved" },
        { status: 409 },
      );
    }

    // A video with no renditions yet goes to PROCESSING; the transcoding
    // pipeline promotes it to APPROVED when renditions land. If renditions
    // already exist (re-approval), it goes straight to APPROVED.
    const renditionCount = await prisma.videoRendition.count({
      where: { videoId: video.id },
    });

    const publishedAt = body.action === "schedule" ? body.publishAt : new Date();

    const updated = await prisma.video.update({
      where: { id: video.id },
      data: {
        status: renditionCount > 0 ? "APPROVED" : "PROCESSING",
        publishedAt,
        moderatorId: staff.id,
        rejectedReason: null,
      },
      select: { id: true, status: true, publishedAt: true },
    });

    await invalidateTrendingCache();
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api/admin/videos/:id] PATCH failed", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireStaff();

    // Cascades to renditions, comments, and view logs via schema onDelete.
    // Object-storage cleanup happens async via a lifecycle rule / janitor job.
    const deleted = await prisma.video
      .delete({ where: { id: params.id }, select: { id: true } })
      .catch(() => null);

    if (!deleted) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    await invalidateTrendingCache();
    return NextResponse.json({ deleted: deleted.id });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api/admin/videos/:id] DELETE failed", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { requireUser, AuthError } from "@/lib/auth";
import {
  createPresignedUpload,
  ALLOWED_VIDEO_TYPES,
  MAX_UPLOAD_BYTES,
} from "@/lib/s3";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// POST /api/uploads/presign
// 1. Validates the file the client *claims* it will upload.
// 2. Creates a PENDING Video row (so staff can see/track the submission).
// 3. Returns a presigned PUT URL — the browser uploads directly to S3/R2;
//    our servers never proxy video bytes.
// The transcoding pipeline is kicked off by the bucket's object-created
// notification (S3 -> SQS/EventBridge), not by this API.
// ---------------------------------------------------------------------------

const bodySchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(5000).optional(),
  categoryId: z.string().cuid().optional(),
  contentType: z.string(),
  contentLength: z.number().int().positive(),
});

const COMBINING_MARKS = /[̀-ͯ]/g;

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(COMBINING_MARKS, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();

    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { title, description, categoryId, contentType, contentLength } = parsed.data;

    if (!ALLOWED_VIDEO_TYPES.has(contentType)) {
      return NextResponse.json(
        { error: `Unsupported type. Allowed: ${[...ALLOWED_VIDEO_TYPES.keys()].join(", ")}` },
        { status: 415 },
      );
    }
    if (contentLength > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `File exceeds ${MAX_UPLOAD_BYTES / 1024 ** 3} GB limit` },
        { status: 413 },
      );
    }

    if (categoryId) {
      const exists = await prisma.category.findUnique({ where: { id: categoryId } });
      if (!exists) {
        return NextResponse.json({ error: "Unknown category" }, { status: 400 });
      }
    }

    const presigned = await createPresignedUpload(user.id, contentType, contentLength);

    const video = await prisma.video.create({
      data: {
        title,
        description: description ?? null,
        slug: `${slugify(title)}-${nanoid(8).toLowerCase()}`,
        status: "PENDING",
        sourceKey: presigned.sourceKey,
        uploaderId: user.id,
        categoryId: categoryId ?? null,
      },
      select: { id: true, slug: true },
    });

    return NextResponse.json(
      {
        videoId: video.id,
        slug: video.slug,
        uploadUrl: presigned.uploadUrl,
        sourceKey: presigned.sourceKey,
        expiresInSeconds: presigned.expiresInSeconds,
        method: "PUT",
        requiredHeaders: { "Content-Type": contentType },
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api/uploads/presign] failed", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

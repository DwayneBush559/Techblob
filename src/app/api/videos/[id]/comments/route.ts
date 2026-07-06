import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { requireUser, AuthError } from "@/lib/auth";
import type { CommentDto, CommentPageDto } from "@/lib/types";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET  /api/videos/:id/comments?cursor=<id>  — newest-first top-level comments
//        with their replies, cursor-paginated (same pattern as the video feed:
//        no OFFSET, served by the (videoId, createdAt DESC) index).
// POST /api/videos/:id/comments  { body, parentId? } — signed-in users only.
//        Single-level threading: replying to a reply attaches to its root.
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;
const MAX_COMMENTS_PER_5_MIN = 10;

const commentInclude = {
  author: { select: { username: true, avatarUrl: true } },
} satisfies Prisma.CommentInclude;

type CommentRow = Prisma.CommentGetPayload<{ include: typeof commentInclude }>;

function toDto(row: CommentRow, replies?: CommentDto[]): CommentDto {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    author: { username: row.author.username, avatarUrl: row.author.avatarUrl },
    ...(replies ? { replies } : {}),
  };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const cursor = req.nextUrl.searchParams.get("cursor");

  try {
    const [topLevel, totalCount] = await Promise.all([
      prisma.comment.findMany({
        where: { videoId: params.id, isHidden: false, parentId: null },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: PAGE_SIZE + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: commentInclude,
      }),
      prisma.comment.count({ where: { videoId: params.id, isHidden: false } }),
    ]);

    const hasMore = topLevel.length > PAGE_SIZE;
    const page = hasMore ? topLevel.slice(0, PAGE_SIZE) : topLevel;

    const replies = page.length
      ? await prisma.comment.findMany({
          where: { parentId: { in: page.map((c) => c.id) }, isHidden: false },
          orderBy: { createdAt: "asc" },
          include: commentInclude,
        })
      : [];
    const repliesByParent = new Map<string, CommentDto[]>();
    for (const r of replies) {
      const list = repliesByParent.get(r.parentId!) ?? [];
      list.push(toDto(r));
      repliesByParent.set(r.parentId!, list);
    }

    const payload: CommentPageDto = {
      items: page.map((c) => toDto(c, repliesByParent.get(c.id) ?? [])),
      nextCursor: hasMore ? page[page.length - 1]!.id : null,
      totalCount,
    };
    return NextResponse.json(payload);
  } catch (err) {
    console.error("[api/videos/:id/comments] GET failed", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const postSchema = z.object({
  body: z.string().trim().min(1, "Say something first").max(2000),
  parentId: z.string().cuid().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();

    const json = await req.json().catch(() => null);
    const parsed = postSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid comment" },
        { status: 400 },
      );
    }

    // Fail-open rate limit, same trade-off as /api/submissions.
    try {
      const key = `ratelimit:comment:${user.id}`;
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, 300);
      if (count > MAX_COMMENTS_PER_5_MIN) {
        return NextResponse.json(
          { error: "You're commenting too fast. Take a breath." },
          { status: 429 },
        );
      }
    } catch (err) {
      console.error("[api/videos/:id/comments] rate limit check failed", err);
    }

    const video = await prisma.video.findUnique({
      where: { id: params.id },
      select: { id: true, status: true, publishedAt: true },
    });
    const isPublic =
      video &&
      video.status === "APPROVED" &&
      video.publishedAt !== null &&
      video.publishedAt <= new Date();
    if (!isPublic) {
      return NextResponse.json({ error: "Video not found" }, { status: 404 });
    }

    // Single-level threading: a reply always hangs off a top-level comment.
    let parentId: string | null = null;
    if (parsed.data.parentId) {
      const parent = await prisma.comment.findUnique({
        where: { id: parsed.data.parentId },
        select: { id: true, videoId: true, parentId: true, isHidden: true },
      });
      if (!parent || parent.videoId !== video.id || parent.isHidden) {
        return NextResponse.json({ error: "Comment not found" }, { status: 404 });
      }
      parentId = parent.parentId ?? parent.id;
    }

    const [comment] = await prisma.$transaction([
      prisma.comment.create({
        data: { body: parsed.data.body, authorId: user.id, videoId: video.id, parentId },
        include: commentInclude,
      }),
      prisma.video.update({
        where: { id: video.id },
        data: { commentCount: { increment: 1 } },
        select: { id: true },
      }),
    ]);

    return NextResponse.json(
      { comment: toDto(comment), parentId },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[api/videos/:id/comments] POST failed", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

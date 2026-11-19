// TECHBLOB_PREVIEW_SAMPLE_DATA. Seeds the local preview database (PGlite, see db.mjs) with labeled sample data:
// the four tech categories, three sample creators, six sample videos (generated color-card clips served by
// /api/preview-media), a few comments, one open report, a staff account and a viewer account. Never run against a
// real database: it refuses any DATABASE_URL that isn't 127.0.0.1.
import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";

/** Local-preview sign-ins (also listed in the launcher README). These accounts exist only in the throwaway database. */
export const PREVIEW_ACCOUNTS = {
  viewer: { email: "viewer@techblob.local", username: "preview_viewer", password: "preview-viewer-pass" },
  staff: { email: "staff@techblob.local", username: "preview_staff", password: "preview-staff-pass" },
};

const hash = (pw) => {
  const salt = randomBytes(16);
  return `scrypt.${salt.toString("base64url")}.${scryptSync(pw, salt, 64).toString("base64url")}`;
};

export async function seedPreview(url) {
  if (!/@127\.0\.0\.1:/.test(url)) throw new Error("The preview seed only runs against the local 127.0.0.1 database.");
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const cats = {};
    for (const [i, [slug, name]] of [["ai-fails", "AI Fails"], ["terminal-speedruns", "Terminal Speedruns"], ["tool-premieres", "Tool Premieres"], ["builder-breakdowns", "Builder Breakdowns"]].entries()) {
      cats[slug] = await prisma.category.create({ data: { slug, name, sortOrder: i } });
    }
    const { staff: S, viewer: V } = PREVIEW_ACCOUNTS;
    const staff = await prisma.user.create({ data: { email: S.email, username: S.username, passwordHash: hash(S.password), role: "MODERATOR" } });
    const viewer = await prisma.user.create({ data: { email: V.email, username: V.username, passwordHash: hash(V.password) } });
    const creators = [];
    for (const name of ["sample_ai_lab", "sample_terminal", "sample_builders"]) {
      creators.push(await prisma.user.create({ data: { email: `${name}@techblob.local`, username: name, passwordHash: hash(randomBytes(12).toString("hex")) } }));
    }
    const videos = [
      ["Sample: an AI agent deletes the repo it was asked to fix", "ai-fails", 0],
      ["Sample: git rebase in 9 seconds", "terminal-speedruns", 1],
      ["Sample: a new CLI drops today", "tool-premieres", 2],
      ["Sample: how a two-person team shipped v2", "builder-breakdowns", 2],
      ["Sample: a chatbot invents an API that doesn't exist", "ai-fails", 0],
      ["Sample: Vim golf, fewest keystrokes", "terminal-speedruns", 1],
    ];
    const made = [];
    for (const [i, [title, cat, who]] of videos.entries()) {
      const n = i + 1;
      made.push(
        await prisma.video.create({
          data: {
            slug: `sample-${n}`,
            title,
            description: "A labeled sample for the local TechBlob preview. Generated color card, no real footage.",
            status: "APPROVED",
            sourceKey: `preview/clip-${n}.mp4`,
            thumbnailUrl: `/api/preview-media/clip-${n}.jpg`,
            durationSec: 6,
            publishedAt: new Date(Date.now() - (i + 1) * 20 * 3_600_000),
            viewCount: BigInt(3 + i),
            uploaderId: creators[who].id,
            categoryId: cats[cat].id,
            renditions: { create: [{ resolution: "P360", url: `/api/preview-media/clip-${n}.mp4`, mimeType: "video/mp4", bitrateKbps: 400, fileSizeB: BigInt(25000) }] },
          },
        })
      );
    }
    await prisma.comment.create({ data: { body: "Sample comment: this happened to me last week.", authorId: creators[1].id, videoId: made[0].id } });
    await prisma.comment.create({ data: { body: "Sample comment: what flags did you use?", authorId: creators[2].id, videoId: made[1].id } });
    await prisma.report.create({ data: { reason: "Spam or scam", details: "Sample report for the preview queue", reporterId: viewer.id, videoId: made[4].id, createdAt: new Date(Date.now() - 20 * 3_600_000) } });
    return { categories: Object.keys(cats).length, videos: made.length, staff: staff.username };
  } finally {
    await prisma.$disconnect();
  }
}

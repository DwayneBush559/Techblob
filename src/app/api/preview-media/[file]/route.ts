import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sample clips for the local preview only (TECHBLOB_PREVIEW=1); a 404 everywhere else. */
export async function GET(_req: Request, { params }: { params: { file: string } }) {
  if (process.env.TECHBLOB_PREVIEW !== "1" || !/^clip-\d\.(mp4|jpg)$/.test(params.file)) return new NextResponse(null, { status: 404 });
  const body = await readFile(join(process.cwd(), "preview-media", params.file));
  return new NextResponse(body, { headers: { "Content-Type": params.file.endsWith(".mp4") ? "video/mp4" : "image/jpeg", "Cache-Control": "no-store" } });
}

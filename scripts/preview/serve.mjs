#!/usr/bin/env node
// The TechBlob local preview: a throwaway database (PGlite on 127.0.0.1:5544, the real migrations, the labeled sample
// seed), then the production build on http://127.0.0.1:4340 with TECHBLOB_PREVIEW=1 (in-memory Redis, sample clips).
// Builds first if .next is missing or was built without the preview data. Nothing leaves this computer.
//   node scripts/preview/serve.mjs [--port 4340] [--rebuild]
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { startPreviewDb } from "./db.mjs";
import { seedPreview } from "./seed.mjs";

const root = process.cwd();
const args = process.argv.slice(2);
const port = Number(args[args.indexOf("--port") + 1]) || 4340;
const marker = join(root, ".next", "PREVIEW_BUILD");

const run = (cmd, argv, env) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cmd, ...argv], { cwd: root, env, stdio: "inherit" });
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`))));
  });

const db = await startPreviewDb({ root });
const seeded = await seedPreview(db.url);
console.log(`[preview] database up with ${seeded.videos} sample videos`);
const env = {
  ...process.env,
  NODE_ENV: "production",
  NEXT_TELEMETRY_DISABLED: "1",
  TECHBLOB_PREVIEW: "1",
  TECHBLOB_SINGLE_BUILD_WORKER: "1",
  DATABASE_URL: db.url,
  SESSION_SECRET: process.env.SESSION_SECRET ?? randomBytes(32).toString("hex"),
  CRON_SECRET: randomBytes(16).toString("hex"),
};
const next = join(root, "node_modules", "next", "dist", "bin", "next");
if (args.includes("--rebuild") || !existsSync(marker) || readFileSync(marker, "utf8") !== "preview") {
  console.log("[preview] building (about two minutes)");
  await run(next, ["build"], env);
  writeFileSync(marker, "preview");
}
const server = spawn(process.execPath, [next, "start", "-H", "127.0.0.1", "-p", String(port)], { cwd: root, env, stdio: "inherit" });
const stop = async () => {
  server.kill();
  await db.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("close", async () => {
  await db.stop();
  process.exit(0);
});
console.log(`[preview] TechBlob at http://127.0.0.1:${port}/`);

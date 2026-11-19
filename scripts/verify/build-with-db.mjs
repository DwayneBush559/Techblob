#!/usr/bin/env node
// The normal production build for the full check. Next prerenders the ISR pages at build time, which reads the
// database, so this starts an empty throwaway Postgres on 127.0.0.1 (scripts/preview/db.mjs: PGlite with the real
// migrations, no sample data), builds against it with one build worker, then stops it. No preview flag is set, so
// this is the build that would ship.
import { spawn } from "node:child_process";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { startPreviewDb } from "../preview/db.mjs";

const root = process.cwd();
const db = await startPreviewDb({ root });
console.log("[build] empty local database up, migrations applied");
const env = {
  ...process.env,
  NODE_ENV: "production",
  NEXT_TELEMETRY_DISABLED: "1",
  TECHBLOB_PREVIEW: "",
  TECHBLOB_SINGLE_BUILD_WORKER: "1",
  DATABASE_URL: db.url,
  SESSION_SECRET: randomBytes(32).toString("hex"),
};
const next = join(root, "node_modules", "next", "dist", "bin", "next");
const code = await new Promise((resolve) => {
  const child = spawn(process.execPath, [next, "build"], { cwd: root, env, stdio: "inherit" });
  child.on("close", resolve);
});
await db.stop();
console.log(`[build] next build exited ${code}`);
process.exit(code ?? 1);

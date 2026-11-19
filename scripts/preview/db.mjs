// A throwaway Postgres for this computer only: PGlite (Postgres compiled to WebAssembly, in memory) served over a
// local socket, so Prisma and the app talk to it exactly as they would to a real database. Nothing is written to
// disk and nothing leaves 127.0.0.1. One connection at a time (connection_limit=1), and pgbouncer=true so Prisma
// uses unnamed statements instead of named ones that would collide on the shared session. Used by the full check (build and smoke) and the local preview.
import { spawn } from "node:child_process";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

export async function startPreviewDb({ port = 5544, root = process.cwd() } = {}) {
  const db = await PGlite.create();
  const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1" });
  await server.start();
  const url = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable&connection_limit=1&pool_timeout=60&pgbouncer=true`;
  const prisma = join(root, "node_modules", "prisma", "build", "index.js");
  // Async on purpose: this process also serves the database, so it must not block while Prisma connects.
  const res = await new Promise((resolve) => {
    const child = spawn(process.execPath, [prisma, "migrate", "deploy"], { cwd: root, env: { ...process.env, DATABASE_URL: url } });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
  if (res.status !== 0) {
    await server.stop();
    await db.close();
    throw new Error(`prisma migrate deploy failed:\n${res.stdout}\n${res.stderr}`);
  }
  return {
    url,
    migrateLog: res.stdout,
    async stop() {
      await server.stop();
      await db.close();
    },
  };
}

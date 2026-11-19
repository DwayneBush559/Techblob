#!/usr/bin/env node
// Headless Chromium smoke of the TechBlob preview on 127.0.0.1: a throwaway database with the labeled sample seed,
// the preview build (TECHBLOB_PREVIEW=1: in-memory Redis, sample clips), then the pages and the report, block and
// delete flows. Every browser request that leaves 127.0.0.1 is aborted and counted; the server runs with the
// live-service block from NODE_OPTIONS. Screenshots go to --out.
//   node scripts/verify/route-smoke.mjs [--out dir] [--port 4341]
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { chromium } from "playwright";
import { startPreviewDb } from "../preview/db.mjs";
import { PREVIEW_ACCOUNTS, seedPreview } from "../preview/seed.mjs";

const root = process.cwd();
const argv = process.argv.slice(2);
const opt = (name, dflt) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : dflt);
const out = path.resolve(opt("--out", path.join(root, ".next", "smoke")));
const port = Number(opt("--port", "4341"));
const base = `http://127.0.0.1:${port}`;
fs.mkdirSync(out, { recursive: true });

const results = [];
let outside = 0;
const check = (name, ok, detail = "") => {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
};

const db = await startPreviewDb({ root });
const seeded = await seedPreview(db.url);
console.log(`[smoke] database up with ${seeded.videos} sample videos`);
const env = {
  ...process.env,
  NODE_ENV: "production",
  NEXT_TELEMETRY_DISABLED: "1",
  TECHBLOB_PREVIEW: "1",
  TECHBLOB_SINGLE_BUILD_WORKER: "1",
  DATABASE_URL: db.url,
  SESSION_SECRET: randomBytes(32).toString("hex"),
  CRON_SECRET: randomBytes(16).toString("hex"),
};
const next = path.join(root, "node_modules", "next", "dist", "bin", "next");
const built = await new Promise((resolve) => {
  const child = spawn(process.execPath, [next, "build"], { cwd: root, env, stdio: "inherit" });
  child.on("close", resolve);
});
if (built !== 0) {
  await db.stop();
  console.error(`[smoke] preview build exited ${built}`);
  process.exit(1);
}
fs.writeFileSync(path.join(root, ".next", "PREVIEW_BUILD"), "preview");

const server = spawn(process.execPath, [next, "start", "-H", "127.0.0.1", "-p", String(port)], { cwd: root, env, stdio: "inherit" });
const stopServer = () => {
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  else server.kill("SIGTERM");
};

// Calls the API from inside the page, so the request carries the browser's session cookie (Playwright's own request
// client won't send a Secure cookie over plain http to 127.0.0.1).
const api = (page, method, url, body) =>
  page.evaluate(
    async ({ method, url, body }) => {
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      let json = null;
      try {
        json = await r.json();
      } catch {}
      return { status: r.status, ok: r.ok, json };
    },
    { method, url, body },
  );

async function waitUp() {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`${base}/legal/support`);
      if (r.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

let browser;
try {
  check("server starts on 127.0.0.1", await waitUp(), base);
  browser = await chromium.launch();
  const newContext = async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.route("**/*", (route) => {
      const host = new URL(route.request().url()).hostname;
      if (host === "127.0.0.1" || route.request().url().startsWith("data:") || route.request().url().startsWith("blob:")) return route.continue();
      outside += 1;
      console.log(`blocked outside request: ${route.request().url().slice(0, 120)}`);
      return route.abort();
    });
    return ctx;
  };
  const shot = (page, name) => page.screenshot({ path: path.join(out, `${name}.png`), fullPage: false });

  // Signed out: pages and legal.
  const anon = await newContext();
  const page = await anon.newPage();
  let res = await page.goto(`${base}/`);
  let body = await page.content();
  check("home lists the sample videos", res?.status() === 200 && body.includes("Sample:"), `status ${res?.status()}`);
  check("home nav has the four tech categories", ["AI Fails", "Terminal Speedruns", "Tool Premieres", "Builder Breakdowns"].every((c) => body.includes(c)));
  check("home shows a labeled Kavaro house-ad card", (await page.locator("[data-house-ad]").count()) > 0 && body.includes("Kavaro LLC"));
  check("footer links the legal pages and says 18+", ["/legal/privacy", "/legal/terms", "/legal/dmca", "/legal/delete-account", "/legal/support"].every((l) => body.includes(l)) && body.includes("18"));
  await shot(page, "01-home");

  res = await page.goto(`${base}/watch/sample-1`);
  body = await page.content();
  check("watch page plays the local sample clip", res?.status() === 200 && body.includes("/api/preview-media/clip-1.mp4"), `status ${res?.status()}`);
  check("watch page has a Report button", (await page.getByRole("button", { name: "Report" }).count()) > 0);
  await shot(page, "02-watch");

  for (const slug of ["ai-fails", "terminal-speedruns", "tool-premieres", "builder-breakdowns"]) {
    res = await page.goto(`${base}/category/${slug}`);
    check(`category ${slug}`, res?.status() === 200, `status ${res?.status()}`);
  }
  res = await page.goto(`${base}/trending`);
  check("trending", res?.status() === 200, `status ${res?.status()}`);
  for (const slug of ["privacy", "terms", "dmca", "delete-account", "support"]) {
    res = await page.goto(`${base}/legal/${slug}`);
    body = await page.content();
    check(`legal ${slug} names Kavaro LLC and the contact`, res?.status() === 200 && body.includes("Kavaro LLC") && body.includes("info@kavarollc.com"), `status ${res?.status()}`);
  }
  await shot(page, "03-legal-dmca");
  res = await page.goto(`${base}/signup`);
  check("sign-up asks for the 18+ confirmation", res?.status() === 200 && (await page.content()).includes("18 or older"));
  await shot(page, "04-signup");
  const clip = await page.request.get(`${base}/api/preview-media/clip-2.mp4`);
  check("sample clip is served locally", clip.status() === 200 && (clip.headers()["content-type"] ?? "").includes("video/mp4"));
  res = await page.goto(`${base}/admin/reports`);
  check("report queue is hidden from signed-out visitors", res?.status() === 404, `status ${res?.status()}`);

  // Viewer: report a video from the watch page.
  const viewerCtx = await newContext();
  const viewer = await viewerCtx.newPage();
  const v = PREVIEW_ACCOUNTS.viewer;
  let login = await viewer.request.post(`${base}/api/auth/login`, { data: { identifier: v.email, password: v.password } });
  check("viewer signs in", login.status() === 200, `status ${login.status()}`);
  await viewer.goto(`${base}/watch/sample-2`);
  await viewer.getByRole("button", { name: "Report" }).first().click();
  await viewer.getByRole("button", { name: "Send report" }).click();
  check("viewer report is accepted with the 24-hour promise", await viewer.getByText("We review every report within 24 hours").first().waitFor({ state: "visible", timeout: 15000 }).then(() => true, () => false));
  await shot(viewer, "05-reported");

  // Staff: the queue shows the seeded report and the new one.
  const staffCtx = await newContext();
  const staff = await staffCtx.newPage();
  const s = PREVIEW_ACCOUNTS.staff;
  login = await staff.request.post(`${base}/api/auth/login`, { data: { identifier: s.email, password: s.password } });
  check("staff signs in", login.status() === 200, `status ${login.status()}`);
  res = await staff.goto(`${base}/admin/reports`);
  body = await staff.locator("main").innerText();
  check("staff report queue lists both open reports", res?.status() === 200 && /\b2 open\b/.test(body), `status ${res?.status()}`);
  await shot(staff, "06-report-queue");

  // Viewer: block a commenter, then delete the account.
  const feed = await api(viewer, "GET", "/api/videos?limit=48");
  const sample1 = (feed.json?.items ?? []).find((x) => x.slug === "sample-1");
  const commentsUrl = `/api/videos/${encodeURIComponent(sample1?.id ?? "none")}/comments`;
  const before = await api(viewer, "GET", commentsUrl);
  const author = (before.json?.items ?? [])[0]?.author?.id;
  if (author) {
    const blocked = await api(viewer, "POST", "/api/blocks", { userId: author });
    check("viewer blocks a commenter", blocked.ok, `status ${blocked.status}`);
    const after = await api(viewer, "GET", commentsUrl);
    check("the blocked commenter's comments are hidden from the viewer", after.ok && !(after.json?.items ?? []).some((c) => c.author?.id === author));
  } else {
    check("viewer blocks a commenter", false, `no comment author found (feed ${feed.status}, comments ${before.status})`);
  }
  await viewer.goto(`${base}/account`);
  await shot(viewer, "07-account");
  const del = await api(viewer, "DELETE", "/api/account");
  check("viewer deletes the account", del.ok, `status ${del.status}`);
  const again = await api(viewer, "POST", "/api/auth/login", { identifier: v.email, password: v.password });
  check("deleted account can't sign in", again.status !== 200, `status ${again.status}`);
} catch (err) {
  check("smoke ran to the end", false, String(err?.message ?? err).slice(0, 200));
} finally {
  await browser?.close();
  stopServer();
  await db.stop();
}

check("no request left 127.0.0.1", outside === 0, `${outside} blocked`);
const failed = results.filter((r) => !r.ok).length;
fs.writeFileSync(path.join(out, "results.json"), JSON.stringify({ base, outside, results }, null, 2));
console.log(`SMOKE: ${results.length - failed}/${results.length} checks passed, ${outside} outside requests`);
process.exit(failed ? 1 : 0);

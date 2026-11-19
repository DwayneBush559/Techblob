#!/usr/bin/env node
// Scans a normal production build (.next) for anything that must not ship:
// - browser code: the preview Redis stand-in, server secrets by name, AWS access keys
// - everywhere: the personal handle or a github.io address (D-028), and the preview seed's marker
//   node scripts/verify/check-bundle.mjs .next
import fs from "node:fs";
import path from "node:path";

const dir = path.resolve(process.argv[2] ?? ".next");
if (!fs.existsSync(path.join(dir, "BUILD_ID"))) {
  console.error(`No production build at ${dir}`);
  process.exit(2);
}
if (fs.existsSync(path.join(dir, "PREVIEW_BUILD"))) {
  console.error("This is the preview build; scan the normal build.");
  process.exit(2);
}

const walk = (d, acc = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === "cache") continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(js|json|html|rsc|txt|css|map)$/.test(e.name)) acc.push(p);
  }
  return acc;
};

const handle = ["dwayne", "bush", "559"].join("");
const everywhere = [
  ["personal handle", (t) => t.toLowerCase().includes(handle)],
  ["github.io address", (t) => t.toLowerCase().includes(["github", "io"].join("."))],
  ["preview seed data", (t) => t.includes("TECHBLOB_PREVIEW_SAMPLE_DATA") || t.includes("preview-viewer-pass")],
];
const browserOnly = [
  ["preview Redis stand-in", (t) => t.includes("PreviewRedis")],
  ["server secret by name", (t) => /SESSION_SECRET|CRON_SECRET|AWS_SECRET_ACCESS_KEY|DATABASE_URL|YOUTUBE_API_KEY/.test(t)],
  ["AWS access key", (t) => /AKIA[0-9A-Z]{16}/.test(t)],
];

const files = walk(dir);
const browser = new Set(walk(path.join(dir, "static")));
const hits = [];
for (const f of files) {
  const t = fs.readFileSync(f, "utf8");
  for (const [what, test] of everywhere) if (test(t)) hits.push(`${what}: ${path.relative(dir, f)}`);
  if (browser.has(f)) for (const [what, test] of browserOnly) if (test(t)) hits.push(`${what}: ${path.relative(dir, f)}`);
}
console.log(`scanned ${files.length} files (${browser.size} browser files)`);
if (hits.length) {
  for (const h of hits.slice(0, 20)) console.log(`FOUND ${h}`);
  process.exit(1);
}
console.log("clean: no preview data, personal handle, github.io address or server secret in the build");

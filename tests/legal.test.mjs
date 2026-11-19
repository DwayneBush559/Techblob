import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CONTACT, PAGES } from "../src/legal/content.ts";
import { renderPages } from "../scripts/build-legal.mjs";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(repo, p), "utf8");
// Built from pieces so this file doesn't trip its own sweep.
const BANNED = [["dwayne", "bush", "559"].join(""), ["dwayne", "dwight"].join(" "), ["world", "star"].join(""), ["github", "io"].join(".")];
const SKIP = new Set(["node_modules", ".next", ".git", "preview-media"]);

function files(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files(p, acc);
    else if (/\.(ts|tsx|mjs|js|json|md|html|sql|prisma|sh|example)$/.test(e.name) && e.name !== "package-lock.json") acc.push(p);
  }
  return acc;
}

test("D-028: no personal name or handle, and no clone branding, anywhere in the repo", () => {
  const hits = files(repo).filter((f) => {
    const t = fs.readFileSync(f, "utf8").toLowerCase();
    return BANNED.some((b) => t.includes(b));
  });
  assert.deepEqual(hits.map((f) => path.relative(repo, f)), []);
});

test("legal/*.html is exactly what /legal/<page> shows (one source)", () => {
  for (const [name, html] of Object.entries(renderPages())) {
    assert.equal(read(`legal/${name}`).replace(/\r\n/g, "\n"), html, name);
  }
  assert.deepEqual(PAGES.map((p) => p.slug), ["privacy", "terms", "dmca", "delete-account", "support"]);
  assert.match(read("src/app/legal/[page]/page.tsx"), /generateStaticParams/);
});

test("D-031 and the PRD rules: Kavaro LLC, 18+, 24-hour reports, DMCA notice elements and repeat infringers", () => {
  assert.equal(CONTACT, "info@kavarollc.com");
  const all = JSON.stringify(PAGES);
  for (const re of [/Kavaro LLC/, /must be 18 or older/, /within 24 hours/, /penalty of perjury/, /Repeat infringers/, /are closed/, /Counter-notice/, /always labeled/]) {
    assert.match(all, re);
  }
  const layout = read("src/app/layout.tsx");
  for (const slug of ["privacy", "terms", "dmca", "delete-account", "support"]) assert.ok(layout.includes(`/legal/${slug}`), slug);
});

test("sign-up needs the 18+ confirmation; Account can delete the account; reports and blocks need a sign-in", () => {
  assert.ok(read("src/app/api/auth/signup/route.ts").includes("adult: z.literal(true"));
  assert.ok(read("src/components/AuthForm.tsx").includes("I&apos;m 18 or older"));
  assert.ok(read("src/app/api/account/route.ts").includes("prisma.user.delete({ where: { id: user.id } })"));
  for (const f of ["src/app/api/reports/route.ts", "src/app/api/blocks/route.ts"]) assert.ok(read(f).includes("await requireUser()"), f);
  assert.ok(read("src/app/api/reports/[id]/route.ts").includes("await requireStaff()"));
  assert.ok(read("src/app/api/videos/[id]/comments/route.ts").includes("authorId: { notIn: blocked }"));
});

test("preview pieces stay preview-only", () => {
  assert.ok(read("src/app/api/preview-media/[file]/route.ts").includes('process.env.TECHBLOB_PREVIEW !== "1"'));
  assert.ok(read("src/lib/redis.ts").includes('process.env.TECHBLOB_PREVIEW === "1"'));
  assert.ok(read("scripts/preview/seed.mjs").includes("only runs against the local 127.0.0.1 database"));
  assert.ok(read("next.config.mjs").includes('TECHBLOB_SINGLE_BUILD_WORKER === "1"'));
});

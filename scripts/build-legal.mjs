// Writes legal/*.html (for www.kavarollc.com/legal/techblob/, published only after the founder's OK) from the same text
// the site's /legal pages render: src/legal/content.ts. Run: node scripts/build-legal.mjs. tests/legal.test.mjs checks they match.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CONTACT, LEGAL_UPDATED, PAGES } from "../src/legal/content.ts";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const linkEmail = (s) => esc(s).replaceAll(CONTACT, `<a href="mailto:${CONTACT}">${CONTACT}</a>`);
const NAV = '<nav><a href="privacy.html">Privacy</a> · <a href="terms.html">Terms</a> · <a href="dmca.html">DMCA</a> · <a href="delete-account.html">Delete your account</a> · <a href="support.html">Support</a></nav>';

function shell(title, body) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · TechBlob</title>
<style>body{margin:0;background:#0b0a12;color:#f5f3ff;font:16px/1.6 -apple-system,BlinkMacSystemFont,"Inter",system-ui,sans-serif}main{max-width:720px;margin:0 auto;padding:32px 20px 64px}h1{font-size:28px;margin:0 0 4px}h2{font-size:19px;margin:28px 0 8px}.muted{color:#a1a1aa;font-size:14px}a{color:#c4b5fd}nav{margin-top:40px;font-size:14px}</style>
</head><body><main>
<h1>${esc(title)}</h1><p class="muted">TechBlob by Kavaro LLC. Last updated ${esc(LEGAL_UPDATED)}.</p>
${body}
${NAV}
</main></body></html>
`;
}

export function renderPages() {
  const out = {};
  for (const p of PAGES) {
    const body = [`<p>${linkEmail(p.intro)}</p>`];
    for (const s of p.sections) {
      body.push(`<h2>${esc(s.title)}</h2>`);
      for (const b of s.body) body.push(typeof b === "string" ? `<p>${linkEmail(b)}</p>` : `<ul>${b.list.map((i) => `<li>${linkEmail(i)}</li>`).join("")}</ul>`);
    }
    out[`${p.slug}.html`] = shell(p.title, body.join("\n"));
  }
  out["index.html"] = shell(
    "TechBlob",
    `<p>TechBlob is a tech video site (AI Fails, Terminal Speedruns, Tool Premieres, Builder Breakdowns) made by Kavaro LLC.</p>\n<ul>${PAGES.map((p) => `<li><a href="${p.slug}.html">${esc(p.title)}</a></li>`).join("")}</ul>\n<p>Contact: <a href="mailto:${CONTACT}">${CONTACT}</a></p>`
  );
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const [name, html] of Object.entries(renderPages())) fs.writeFileSync(path.join(repo, "legal", name), html, "utf8");
  console.log("wrote legal/" + Object.keys(renderPages()).join(", legal/"));
}

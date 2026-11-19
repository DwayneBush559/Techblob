# TechBlob work state

Branch `combined/techblob`. Nothing is deployed and `main` is untouched.

## What's in this branch (Nov 19, 2026)
- The four PRD-023 categories in the nav and on category pages: AI Fails, Terminal Speedruns, Tool Premieres,
  Builder Breakdowns (`src/lib/techblob.ts`).
- Ad slots show labeled cards for Kavaro's own apps (DateProper, RoadRite, PIM, Handled, HerTier, Stream Echo,
  SnapSort AI, Business Copilot, ScholarPilot, Method AI). Pre-roll plays nothing until a real campaign is booked;
  the made-up advertisers are gone (`src/lib/ads.ts`).
- Sponsored premiere slots: weekly slots in Tool Premieres, always labeled "Sponsored premiere". No price is set.
- Report and block: Report on every video and comment, Block on comments, blocked people's comments hidden, a staff
  queue at `/admin/reports` sorted by the 24-hour review deadline, with Remove and Keep (migration
  `20261119120000_reports_and_blocks`).
- Accounts: sign-up requires the 18+ and Terms box; Account > Delete account removes the account and everything tied
  to it.
- Legal: privacy, terms, DMCA, delete-account and support pages, written once in `src/legal/content.ts`, shown at
  `/legal/<page>` and written to `legal/*.html` by `npm run legal`. All name Kavaro LLC and info@kavarollc.com.
- The view buffer (Redis) and presigned upload guardrails were already here and are unchanged.

## Check it
`bash scripts/verify/full-check.sh` (clean tree, no node_modules): fresh install, lint, tests, the normal build against
an empty throwaway Postgres on 127.0.0.1, type check, a scan of that build, then the preview build and a headless
Chromium smoke of 29 checks. Live S3, YouTube, hosted Redis/Postgres and Sentry calls are blocked and counted; the
browser blocks every request that leaves 127.0.0.1.

Local preview: `npm run preview:local` (needs node_modules) serves sample data at http://127.0.0.1:4340.
Accounts: viewer@techblob.local / preview-viewer-pass, staff@techblob.local / preview-staff-pass (preview only).

## Needs the founder
- DMCA: the designated agent must be registered with the U.S. Copyright Office before relying on the safe harbor
  (the Office charges a filing fee). The DMCA page lists info@kavarollc.com until then.
- Sponsored premiere and outside ad pricing: not set; nothing is sold.
- Hosting, database, S3 bucket, Redis and YouTube API key: none connected. The new migration isn't applied anywhere.
- The legal text is pending a lawyer's read.

#!/usr/bin/env bash
# TechBlob's full check, run from anywhere:  bash scripts/verify/full-check.sh
# Fresh npm ci, ESLint, every unit and policy test, the normal production build (against an empty throwaway Postgres
# on 127.0.0.1, because Next prerenders pages from the database), a type check, a scan of that build for anything
# that must not ship, then the preview build (TECHBLOB_PREVIEW=1, labeled sample seed) and a headless Chromium smoke
# of it on 127.0.0.1 that blocks and counts every request leaving the computer. Live S3, YouTube, hosted Redis or
# Postgres and Sentry calls from Node are blocked and counted too. Settings are in lib.sh.
APP_NAME=techblob
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
begin
export NEXT_TELEMETRY_DISABLED=1
step install npm ci --no-audit --no-fund --prefer-offline "${CACHE_ARGS[@]}"
step lint npx next lint
NODE_OPTIONS="$HOOK" step test npm test
NODE_OPTIONS="$HOOK" step build node scripts/verify/build-with-db.mjs
step typecheck npx tsc --noEmit
step bundle-scan node scripts/verify/check-bundle.mjs .next
tail -3 "$L/bundle-scan.log" | cut -c1-160 >> "$L/summary.txt"
NODE_OPTIONS="$HOOK" step route-smoke node scripts/verify/route-smoke.mjs --out "$(mixed_path "$L/smoke")"
grep -E "^(FAIL|SMOKE)" "$L/route-smoke.log" | cut -c1-160 >> "$L/summary.txt"
finish

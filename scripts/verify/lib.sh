#!/usr/bin/env bash
# Shared steps for the scripts in this folder. Source it, don't run it.
#
# A check run needs a clean tree and no node_modules, so a shared install can't hide a broken lockfile.
# Live calls from Node (S3, YouTube, hosted Redis or Postgres, Sentry) are blocked by block-live-services.mjs and counted
# as a failure.
#
# Settings:
#   VERIFY_LOG_DIR       where logs go (default: ../verify-logs/<app> beside the repo)
#   NPM_CACHE_DIR        npm cache folder
#   VERIFY_KEEP_INSTALL  set to 1 to keep node_modules and .next afterwards
#   VERIFY_MIN_RAM_GB    free memory to wait for before each step, Windows only (default 1.0)

VERIFY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(git -C "$VERIFY_DIR" rev-parse --show-toplevel)"
APP_NAME="${APP_NAME:-$(basename "$REPO")}"
L="${VERIFY_LOG_DIR:-$REPO/../verify-logs/$APP_NAME}"
PY="$(command -v python || command -v python3)"
FAILED=0

mixed_path() { if command -v cygpath > /dev/null; then cygpath -m "$1"; else printf '%s' "$1"; fi; }

if [ -n "${NPM_CACHE_DIR:-}" ]; then CACHE_ARGS=(--cache "$NPM_CACHE_DIR")
elif [ -d /c/agent_scratch ]; then CACHE_ARGS=(--cache C:/agent_scratch/npm-cache)
else CACHE_ARGS=(); fi

mkdir -p "$L"
BLOCK_FILE="$(mixed_path "$VERIFY_DIR/block-live-services.mjs")"
case "$BLOCK_FILE" in
  /*) HOOK="--import=file://$BLOCK_FILE" ;;
  *) HOOK="--import=file:///$BLOCK_FILE" ;;
esac
export BLOCK_LOG="$(mixed_path "$L/blocked.log")"

free_ram() {
  command -v powershell > /dev/null || { echo 99; return; }
  powershell -NoProfile -Command "[math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1MB,1)" | tr -d '\r'
}
wait_for_ram() {
  for _ in $(seq 1 15); do
    [ "$(awk "BEGIN{print ($(free_ram)>=${VERIFY_MIN_RAM_GB:-1.0})}")" = 1 ] && return
    sleep 60
  done
}
note() { printf '%s\n' "$*" >> "$L/summary.txt"; }

# Runs a command that counts toward the result.
step() {
  local name=$1 started free code
  shift
  wait_for_ram
  started=$(date -u +%H:%M); free=$(free_ram)
  "$@" > "$L/$name.log" 2>&1
  code=$?
  note "$name | exit=$code | started $started UTC with ${free} GB free | ended $(date -u +%H:%M)"
  NODE_OPTIONS= "$PY" -I "$VERIFY_DIR/summarize-log.py" "$L/$name.log" >> "$L/summary.txt"
  [ "$code" -eq 0 ] || FAILED=$((FAILED + 1))
}

# Records a failure from a check that isn't a single command.
fail_check() { note "   FAILED: $*"; FAILED=$((FAILED + 1)); }

begin() {
  cd "$REPO" || exit 2
  rm -f "$L"/*.log "$L/summary.txt"
  note "== $APP_NAME $(git branch --show-current) $(git rev-parse --short=8 HEAD)"
  if [ -n "$(git status --porcelain)" ]; then
    note "The tree has uncommitted changes, stopping. Verified needs a clean tree."
    cat "$L/summary.txt"; exit 2
  fi
  if [ -e node_modules ]; then
    note "node_modules already exists, stopping. Verified needs a fresh install, so remove it first."
    cat "$L/summary.txt"; exit 2
  fi
}

# Prints the result and exits non-zero if anything failed. Pass the result word to use when everything passed.
finish() {
  local blocked=0 dirty
  [ -f "$L/blocked.log" ] && blocked=$(wc -l < "$L/blocked.log")
  note "blocked live attempts: $blocked"
  [ "$blocked" -eq 0 ] || FAILED=$((FAILED + 1))
  dirty=$(git status --porcelain | wc -l)
  note "tracked files changed by the checks: $dirty"
  [ "$dirty" -eq 0 ] || { git status --short | cut -c1-70 | head -8 >> "$L/summary.txt"; FAILED=$((FAILED + 1)); }
  if [ "${VERIFY_KEEP_INSTALL:-0}" != 1 ]; then
    rm -rf "$REPO/node_modules" "$REPO/.next"
  fi
  note "end: $(date -u +%H:%M) UTC"
  if [ "$FAILED" -eq 0 ]; then note "RESULT: ${1:-PASS}"; else note "RESULT: FAIL ($FAILED failed)"; fi
  cat "$L/summary.txt"
  [ "$FAILED" -eq 0 ]
  exit $?
}

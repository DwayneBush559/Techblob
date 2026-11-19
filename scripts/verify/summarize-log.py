"""Prints the counts and errors from one check's log."""
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")
text = open(sys.argv[1], encoding="utf-8", errors="ignore").read()
text = re.sub(r"\x1b\[[0-9;]*m", "", text)
keep = []
for pattern in (
    r"(?:tests|pass|fail|skipped) \d+",
    r"Tests +\d+[^\n]*",
    r"Test Files +\d+[^\n]*",
    r"\d+ (?:passed|failed|flaky|skipped)[^\n]*",
    r"\d+ checked,[^\n]*",
    r"\d+ modules transformed",
    r"All \d+ PGlite[^\n]*",
    r"added \d+ packages[^\n]*",
):
    found = re.findall(pattern, text)
    keep.extend(found[-4:] if pattern.startswith("(?:tests") else found[-2:])
for line in keep:
    print("   " + line[:110])
errors = re.findall(r"(?m)^\s*(?:✖ [^\n]+|FAIL [^\n]+|\d+\) \[[^\n]+|[^\n]*error TS\d+[^\n]*|npm error [^\n]+)", text)
seen = []
for error in errors:
    error = error.strip()[:130]
    if error not in seen and not error.startswith("✖ failing tests"):
        seen.append(error)
for error in seen[:10]:
    print("   ! " + error)

#!/usr/bin/env bash
# Stop: block "done" while test code changed and verify fails. stop_hook_active prevents loops.
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
active="$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(String(JSON.parse(s).stop_hook_active??false))}catch{process.stdout.write("false")}})')"
[ "$active" = "true" ] && exit 0
changed="$( { git diff --name-only HEAD; git ls-files --others --exclude-standard; } 2>/dev/null | grep -E '\.(ts|tsx|mts|cts)$' )"
[ -z "$changed" ] && exit 0
state="$(node -e 'try{const p=require("./package.json");process.stdout.write(p.scripts&&p.scripts.verify?"ok":"none")}catch(e){process.stdout.write(e.code==="MODULE_NOT_FOUND"?"none":"bad")}' 2>/dev/null)"
case "$state" in
  ok) ;;
  bad) echo "Test code changed, but package.json could not be read (is it valid JSON?). Fix it so 'npm run verify' can run." >&2; exit 2 ;;
  *) echo "Test code changed, but this repository has no 'npm run verify' yet. Run project-setup to create it, then finish." >&2; exit 2 ;;
esac
if ! out="$(npm run -s verify 2>&1)"; then
  { echo "Test code changed but 'npm run verify' fails. Fix before finishing:"; echo "$out" | tail -n 80; } >&2
  exit 2
fi
exit 0

#!/usr/bin/env bash
# PostToolUse: lint the TypeScript file that was just edited. Exit 2 sends the errors back to Claude.
# Inert until project-setup has installed ESLint, so the files setup itself writes are never blocked.
set -uo pipefail
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
file="$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(JSON.parse(s).tool_input?.file_path??"")}catch{}})')"
case "$file" in *.ts|*.tsx|*.mts|*.cts) ;; *) exit 0 ;; esac
[ -x node_modules/.bin/eslint ] || exit 0
if ! out="$(node_modules/.bin/eslint --no-warn-ignored --max-warnings=0 "$file" 2>&1)"; then
  { echo "Governance violation in $file. Fix before continuing:"; echo "$out"; } >&2
  exit 2
fi
exit 0

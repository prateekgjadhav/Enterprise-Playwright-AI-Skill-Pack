#!/usr/bin/env bash
# Expose the pack's skills to Claude Code: .claude/skills/<name> -> .agents/skills/<name>.
# One copy in .agents/skills serves every agent tool. Safe to re-run; removes links to skills that are gone.
# Usage: scripts/link-skills.sh [--copy]   (--copy copies instead of linking, for systems without symlinks)
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
src="$root/.agents/skills"
dst="$root/.claude/skills"
mode=link
[ "${1:-}" = "--copy" ] && mode=copy
[ -d "$src" ] || { echo "link-skills: $src not found" >&2; exit 1; }
mkdir -p "$root/.claude"

if [ -L "$dst" ]; then
  if [ "$(readlink "$dst")" = "../.agents/skills" ]; then echo "link-skills: .claude/skills already links to .agents/skills"; exit 0; fi
  echo "link-skills: .claude/skills is a link to $(readlink "$dst"); leaving it alone" >&2; exit 1
fi

count() { find "$src" -mindepth 1 -maxdepth 1 -type d ! -name '.*' | wc -l | tr -d ' '; }
if [ ! -e "$dst" ] && [ "$mode" = link ]; then
  ln -s ../.agents/skills "$dst" 2>/dev/null || true
  if [ -L "$dst" ]; then echo "link-skills: linked .claude/skills -> .agents/skills ($(count) skills)"; exit 0; fi
  # Some systems (Git Bash on Windows without developer mode) copy instead of linking.
  [ -e "$dst" ] && rm -rf "$dst"
  mode=copy
  echo "link-skills: symlinks are not available here; copying instead (re-run after you update skills)"
fi

mkdir -p "$dst"
linked=0; copied=0; kept=0; removed=0
for dir in "$src"/*/; do
  name="$(basename "$dir")"
  case "$name" in .*) continue ;; esac
  target="$dst/$name"
  if [ -L "$target" ]; then
    if [ "$(readlink "$target")" = "../../.agents/skills/$name" ]; then continue; fi
    echo "link-skills: kept .claude/skills/$name (it links elsewhere)"; kept=$((kept+1)); continue
  fi
  if [ -d "$target" ]; then
    if [ -f "$target/.copied-by-link-skills" ]; then
      rm -rf "$target"
    else
      echo "link-skills: kept your own .claude/skills/$name"; kept=$((kept+1)); continue
    fi
  fi
  if [ "$mode" = link ] && ln -s "../../.agents/skills/$name" "$target" 2>/dev/null && [ -L "$target" ]; then
    linked=$((linked+1))
  else
    rm -rf "$target"; cp -R "$dir" "$target"; : > "$target/.copied-by-link-skills"; copied=$((copied+1))
  fi
done
for target in "$dst"/*; do
  [ -L "$target" ] || continue
  case "$(readlink "$target")" in
    ../../.agents/skills/*) [ -e "$target" ] || { rm "$target"; removed=$((removed+1)); } ;;
  esac
done
echo "link-skills: $linked linked, $copied copied, $kept kept as they were, $removed stale link(s) removed in .claude/skills"

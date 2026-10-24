#!/usr/bin/env bash
# Install the Enterprise Playwright AI Skill Pack into a repository.
#
#   ./setup.sh [options] [TARGET]        TARGET defaults to the current directory
#
# It never overwrites your work. A pack file that differs from yours is kept as yours, and the pack's copy
# is saved beside it as <file>.pack-new. An existing .claude/settings.json is merged (the pack's permissions
# and hooks are added; nothing is removed), and an existing CLAUDE.md gets a one-line import of the pack
# orchestrator instead of being replaced. Both merges ask first and keep a backup.
#
# Options:
#   --force     replace pack files that differ, such as an earlier copy of the pack; originals are backed up
#               (your own CLAUDE.md, AGENTS.md and settings.json are still merged, never replaced)
#   --dry-run   show what would change and write nothing
#   --yes       answer yes to the merge questions, for scripted installs
#   --copy      copy the skills into .claude/skills instead of linking them
#   --no-link   leave .claude/skills alone
#   -h, --help  show this help
set -euo pipefail

usage() { sed -n '2,/^set -euo pipefail/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'; }
PACK="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FORCE=0; DRY=0; YES=0; LINK=1; LINKARG=""; TARGET="."
while [ $# -gt 0 ]; do
  case "$1" in
    --force) FORCE=1 ;;
    --dry-run) DRY=1 ;;
    --yes|-y) YES=1 ;;
    --copy) LINKARG="--copy" ;;
    --no-link) LINK=0 ;;
    -h|--help) usage; exit 0 ;;
    -*) echo "setup: unknown option $1 (try --help)" >&2; exit 64 ;;
    *) TARGET="$1" ;;
  esac
  shift
done

say()  { printf '%s\n' "$*"; }
note() { printf '  %s\n' "$*"; }
warn() { printf 'warning: %s\n' "$*" >&2; }
have() { command -v "$1" >/dev/null 2>&1; }
ask() {  # yes on Enter; no when not interactive, unless --yes
  [ "$YES" = 1 ] && return 0
  [ -t 0 ] || return 1
  printf '%s [Y/n] ' "$1"
  read -r reply || return 1
  case "$reply" in ""|y|Y|yes|Yes|YES) return 0 ;; esac
  return 1
}

if [ ! -d "$TARGET" ]; then
  if [ "$DRY" = 1 ]; then say "setup: $TARGET does not exist; a real run would create it and add every pack file."; exit 0; fi
  mkdir -p "$TARGET"
fi
TARGET="$(cd "$TARGET" && pwd)"
if [ "$TARGET" = "$PACK" ]; then
  say "This folder is the pack itself, so there is nothing to copy. Linking its skills for Claude Code:"
  [ "$DRY" = 1 ] || bash "$PACK/scripts/link-skills.sh" $LINKARG
  exit 0
fi

say "Installing the Enterprise Playwright AI Skill Pack into $TARGET"
[ "$DRY" = 1 ] && say "(dry run: nothing will be written)"
if have node; then
  node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 18 ? 0 : 1)' \
    || warn "the hooks and scripts need Node.js 18 or newer (found $(node -v))"
else
  warn "Node.js was not found; the hooks and scripts need Node.js 18 or newer"
fi
if have git; then
  git -C "$TARGET" rev-parse --is-inside-work-tree >/dev/null 2>&1 \
    || warn "$TARGET is not a git repository yet; the stop hook uses git to find changed files (run git init)"
else
  warn "git was not found; the stop hook uses git to find changed files"
fi

PAYLOAD="CLAUDE.md AGENTS.md .agents .claude .github/workflows/skill-validation.yml scripts tests/skills"
BACKUP_DIR=".skill-pack-backup/$(date +%Y%m%d-%H%M%S)"
added=0; same=0; replaced=0; conflicts=0; backups=0; PENDING=""

put() {  # put <file in pack> <path in target>
  [ "$DRY" = 1 ] && return 0
  mkdir -p "$(dirname "$TARGET/$2")"
  cp "$PACK/$1" "$TARGET/$2"
}
backup() {  # backup <path in target>
  [ "$DRY" = 1 ] && return 0
  mkdir -p "$(dirname "$TARGET/$BACKUP_DIR/$1")"
  cp -p "$TARGET/$1" "$TARGET/$BACKUP_DIR/$1"
  backups=$((backups + 1))
}
pending() { PENDING="$PENDING
  - $*"; }
first_line() { head -n 1 "$1" 2>/dev/null || true; }
own_file() {  # the target has its own file here (not absent, not identical, not an earlier copy of the pack's)
  [ -e "$TARGET/$1" ] && ! cmp -s "$PACK/$1" "$TARGET/$1" && [ "$(first_line "$PACK/$1")" != "$(first_line "$TARGET/$1")" ]
}
list_payload() {
  (cd "$PACK" && for p in $PAYLOAD; do
    if [ -e "$p" ]; then find "$p" -type f ! -name '.DS_Store' ! -name '*.pack-new'; fi
  done) | LC_ALL=C sort
}

ORCH=CLAUDE.md
if own_file CLAUDE.md; then ORCH=.agents/CLAUDE.pack.md; fi

say ""
say "Files:"
while IFS= read -r rel; do
  case "$rel" in
    CLAUDE.md|AGENTS.md|.claude/settings.json|.agents/skills-manifest.json) continue ;;  # handled below
  esac
  dst="$TARGET/$rel"
  if [ ! -e "$dst" ]; then
    put "$rel" "$rel"; added=$((added + 1)); note "+ $rel"
  elif cmp -s "$PACK/$rel" "$dst"; then
    same=$((same + 1))
  elif [ "$FORCE" = 1 ]; then
    backup "$rel"; put "$rel" "$rel"; replaced=$((replaced + 1)); note "~ $rel (replaced; yours is in $BACKUP_DIR)"
  else
    put "$rel" "$rel.pack-new"; conflicts=$((conflicts + 1)); note "! $rel differs: kept yours; the pack's copy is $rel.pack-new"
  fi
done < <(list_payload)

# The orchestrator: CLAUDE.md, or an import of .agents/CLAUDE.pack.md when the repository has its own CLAUDE.md
if [ "$ORCH" = CLAUDE.md ]; then
  if [ ! -e "$TARGET/CLAUDE.md" ]; then put CLAUDE.md CLAUDE.md; added=$((added + 1)); note "+ CLAUDE.md"
  elif cmp -s "$PACK/CLAUDE.md" "$TARGET/CLAUDE.md"; then same=$((same + 1))
  elif [ "$FORCE" = 1 ]; then backup CLAUDE.md; put CLAUDE.md CLAUDE.md; replaced=$((replaced + 1)); note "~ CLAUDE.md (replaced; yours is in $BACKUP_DIR)"
  else put CLAUDE.md CLAUDE.md.pack-new; conflicts=$((conflicts + 1)); note "! CLAUDE.md differs: kept yours; the pack's copy is CLAUDE.md.pack-new"
  fi
else
  if [ ! -e "$TARGET/$ORCH" ]; then put CLAUDE.md "$ORCH"; added=$((added + 1)); note "+ $ORCH (the pack orchestrator)"
  elif cmp -s "$PACK/CLAUDE.md" "$TARGET/$ORCH"; then same=$((same + 1))
  else backup "$ORCH"; put CLAUDE.md "$ORCH"; replaced=$((replaced + 1)); note "~ $ORCH (updated)"
  fi
  if grep -q '@\.agents/CLAUDE\.pack\.md' "$TARGET/CLAUDE.md"; then
    note "= CLAUDE.md already imports the pack orchestrator"
  elif [ "$DRY" = 1 ]; then
    note "? CLAUDE.md is your own: setup would offer to add the line @.agents/CLAUDE.pack.md to it"
  elif ask "Your repository already has a CLAUDE.md. Add one line to it that imports the pack orchestrator?"; then
    backup CLAUDE.md
    printf '\n<!-- Enterprise Playwright AI Skill Pack: orchestrator, routing and rules -->\n@.agents/CLAUDE.pack.md\n' >> "$TARGET/CLAUDE.md"
    note "~ CLAUDE.md: added @.agents/CLAUDE.pack.md (yours is backed up)"
  else
    pending "Add this line to CLAUDE.md so Claude Code loads the orchestrator: @.agents/CLAUDE.pack.md"
  fi
fi

# AGENTS.md for other agent tools, pointing at wherever the orchestrator lives
AGENTS_NEW="$(mktemp)"; trap 'rm -f "$AGENTS_NEW"' EXIT
sed "s#\[\`CLAUDE.md\`\](CLAUDE.md)#[\`$ORCH\`]($ORCH)#" "$PACK/AGENTS.md" > "$AGENTS_NEW"
if [ ! -e "$TARGET/AGENTS.md" ]; then
  [ "$DRY" = 1 ] || cp "$AGENTS_NEW" "$TARGET/AGENTS.md"; added=$((added + 1)); note "+ AGENTS.md"
elif cmp -s "$AGENTS_NEW" "$TARGET/AGENTS.md"; then
  same=$((same + 1))
elif [ "$(first_line "$AGENTS_NEW")" = "$(first_line "$TARGET/AGENTS.md")" ]; then
  if [ "$FORCE" = 1 ]; then backup AGENTS.md; [ "$DRY" = 1 ] || cp "$AGENTS_NEW" "$TARGET/AGENTS.md"; replaced=$((replaced + 1)); note "~ AGENTS.md (replaced; yours is in $BACKUP_DIR)"
  else [ "$DRY" = 1 ] || cp "$AGENTS_NEW" "$TARGET/AGENTS.md.pack-new"; conflicts=$((conflicts + 1)); note "! AGENTS.md differs: kept yours; the pack's copy is AGENTS.md.pack-new"
  fi
elif grep -q 'Enterprise Playwright AI Skill Pack' "$TARGET/AGENTS.md"; then
  note "= AGENTS.md already points to the pack"
elif [ "$DRY" = 1 ]; then
  note "? AGENTS.md is your own: setup would offer to add a short section pointing to $ORCH"
elif ask "Your repository already has an AGENTS.md. Add a short section that points other agent tools to the pack orchestrator?"; then
  backup AGENTS.md
  printf '\n## Enterprise Playwright AI Skill Pack\nFollow [`%s`](%s): it holds the setup-first onboarding, the eight-step workflow, the routing table, the\nnon-negotiables and the evidence block that every reply ends with. Project values live in `.agents/qa.config.json`.\n' "$ORCH" "$ORCH" >> "$TARGET/AGENTS.md"
  note "~ AGENTS.md: added a section pointing to $ORCH (yours is backed up)"
else
  pending "Point other agent tools to the pack: add a line to AGENTS.md telling them to follow $ORCH"
fi

# .claude/settings.json: add the pack's permissions and hooks to yours; never remove anything
MERGE='const fs=require("fs");const[mine,pack,mode]=process.argv.slice(1);let a;
try{a=JSON.parse(fs.readFileSync(mine,"utf8"))}catch(e){console.error("cannot parse "+mine+": "+e.message);process.exit(2)}
const b=JSON.parse(fs.readFileSync(pack,"utf8"));const out=[];a.permissions=a.permissions||{};
for(const k of["allow","ask","deny"])for(const r of(b.permissions||{})[k]||[]){const l=a.permissions[k]=a.permissions[k]||[];if(!l.includes(r)){l.push(r);out.push(k+": "+r)}}
a.hooks=a.hooks||{};for(const[ev,list]of Object.entries(b.hooks||{})){const have=(a.hooks[ev]||[]).flatMap(e=>(e.hooks||[]).map(h=>h.command));
for(const e of list)if((e.hooks||[]).some(h=>!have.includes(h.command))){(a.hooks[ev]=a.hooks[ev]||[]).push(e);out.push(ev+" hook: "+e.hooks.map(h=>h.command).join(", "))}}
if(mode==="write"&&out.length)fs.writeFileSync(mine,JSON.stringify(a,null,2)+"\n");for(const x of out)console.log(x);'
S=.claude/settings.json
if [ ! -e "$TARGET/$S" ]; then
  put "$S" "$S"; added=$((added + 1)); note "+ $S"
elif cmp -s "$PACK/$S" "$TARGET/$S"; then
  same=$((same + 1))
elif ! have node; then
  put "$S" "$S.pack-new"; conflicts=$((conflicts + 1)); note "! $S is your own; the pack's copy is $S.pack-new"
  pending "Merge the permissions and hooks from $S.pack-new into $S (Node.js was not available to do it)"
else
  if additions="$(node -e "$MERGE" "$TARGET/$S" "$PACK/$S" plan)"; then
    if [ -z "$additions" ]; then
      note "= $S already has the pack's permissions and hooks"
    elif [ "$DRY" = 1 ]; then
      note "? $S is your own: setup would offer to add $(printf '%s\n' "$additions" | wc -l | tr -d ' ') pack permission(s) and hook(s):"
      printf '%s\n' "$additions" | sed 's/^/      /'
    elif ask "Your repository already has $S. Add the pack's $(printf '%s\n' "$additions" | wc -l | tr -d ' ') permission(s) and hook(s) to it? Nothing is removed."; then
      backup "$S"; node -e "$MERGE" "$TARGET/$S" "$PACK/$S" write >/dev/null
      note "~ $S: added the pack's permissions and hooks (yours is backed up):"
      printf '%s\n' "$additions" | sed 's/^/      /'
    else
      put "$S" "$S.pack-new"; conflicts=$((conflicts + 1))
      pending "Merge the permissions and hooks from $S.pack-new into $S; the governance hooks are not active until you do"
    fi
  else
    put "$S" "$S.pack-new"; conflicts=$((conflicts + 1))
    pending "Merge $S.pack-new into $S by hand (your file is not valid JSON)"
  fi
fi

if [ "$DRY" = 1 ]; then
  say ""
  say "Dry run: $added to add, $same already up to date, $replaced to replace, $conflicts kept as yours. Nothing was written."
  exit 0
fi

# Make the hooks runnable, rebuild the manifest from the skills now present, link them, and check them
chmod +x "$TARGET"/.claude/hooks/*.sh "$TARGET"/scripts/*.sh 2>/dev/null || true
say ""
if have node; then
  (cd "$TARGET" && node scripts/build-skill-manifest.mjs .agents/skills > .agents/skills-manifest.json) \
    && note "= .agents/skills-manifest.json built from the installed skills"
fi
if [ "$LINK" = 1 ]; then
  linker="$TARGET/scripts/link-skills.sh"; [ -e "$linker.pack-new" ] && linker="$linker.pack-new"
  bash "$linker" $LINKARG | sed 's/^/  /'
fi
if have node; then
  say ""
  say "Skill checks:"
  (cd "$TARGET" && node scripts/check-skills.mjs .agents/skills-manifest.json tests/skills/trigger-cases.json || true) \
    | grep -E '^(FAIL|WARN)|hard failure' | sed 's/^/  /' || true
fi

say ""
say "Done: $added added, $same already up to date, $replaced replaced, $conflicts kept as yours."
[ "$backups" -gt 0 ] && say "Anything changed was backed up to $BACKUP_DIR/ first."
if [ "$conflicts" -gt 0 ] || [ "$backups" -gt 0 ]; then
  say "Compare a kept file with the pack's copy using: diff <file> <file>.pack-new"
  say "Keep .skill-pack-backup/ and *.pack-new out of git (add them to .gitignore)."
fi
if [ -n "$PENDING" ]; then
  say ""
  say "Still to do:$PENDING"
fi
say ""
say "Next: open the repository in Claude Code and ask it to \"set up the project\". project-setup reads the repo,"
say "fills in .agents/qa.config.json and scaffolds npm run verify; after that the governance hooks are live."

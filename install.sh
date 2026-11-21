#!/usr/bin/env bash
# Install the pack into a repository as a reviewable change. Preview first, apply second:
#   ./install.sh <target-repo>            verify the release, write <target>/.skill-pack.patch, change nothing else
#   ./install.sh <target-repo> --apply    same checks, then a branch qa-pack/pack-<digest12> with the change committed
#   ./install.sh <target-repo> --apply --pr   also push the branch and open a pull request (needs gh)
# It never writes .claude/settings*.json (permissions and hooks come from managed settings), never appends to an
# existing CLAUDE.md, keeps no backups (git history is the rollback) and refuses an unsigned or tampered pack.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
command -v node >/dev/null || { echo "install.sh: Node.js 24 or newer is required" >&2; exit 1; }
exec node "$here/scripts/install.mjs" --pack "$here" "$@"

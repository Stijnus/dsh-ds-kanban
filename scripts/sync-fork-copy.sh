#!/usr/bin/env bash
# Mirror a tagged release of this repo back into the deepseek-harness fork's
# plugins/ds-kanban copy. Usage: scripts/sync-fork-copy.sh <tag>
set -euo pipefail

TAG="${1:?usage: scripts/sync-fork-copy.sh <tag>}"
FORK_ROOT="${DS_KANBAN_FORK_ROOT:-/Users/stijnus/Documents/GitHub/deepseek-harness}"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$FORK_ROOT/plugins/ds-kanban"

if [[ "$TAG" != v* ]]; then TAG="v$TAG"; fi
git -C "$SRC" rev-parse --verify "$TAG^{commit}" >/dev/null 2>&1 || { echo "tag $TAG not found in $SRC" >&2; exit 1; }
[[ -d "$DEST" ]] || { echo "destination $DEST is not a directory" >&2; exit 1; }

# Export the tagged tree, then copy over the tracked sources/configs/docs.
TMP="$(mktemp -d)"
git -C "$SRC" archive "$TAG" | tar -x -C "$TMP"
rsync -a --delete \
  --exclude node_modules --exclude .artifacts --exclude pnpm-lock.yaml \
  --exclude tsconfig.tsbuildinfo --exclude .git --exclude .github \
  --exclude scripts --exclude LICENSE \
  "$TMP/" "$DEST/"
rm -rf "$TMP"

echo "mirrored $TAG from $SRC into $DEST"
echo "next: cd $FORK_ROOT && pnpm --dir plugins/ds-kanban install && pnpm --dir plugins/ds-kanban test"

#!/bin/bash
# worktree-batch status — check all active worktrees for commits and state
# usage: status.sh [target-branch]

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$REPO_ROOT" ]; then
  echo "error: not in a git repo" >&2
  exit 1
fi

cd "$REPO_ROOT"
TARGET="${1:-}"

echo "=== active worktrees ==="
git worktree list
echo ""

# check each /tmp/opensaas-dev-* worktree
for WT in /tmp/opensaas-dev-*/; do
  [ -d "$WT" ] || continue
  TASK=$(basename "$WT" | sed 's/opensaas-//' | tr '[:lower:]' '[:upper:]')
  BRANCH=$(cd "$WT" && git branch --show-current 2>/dev/null)
  
  echo "--- $TASK ($WT) ---"
  echo "branch: $BRANCH"
  
  # commits ahead of target
  if [ -n "$TARGET" ]; then
    AHEAD=$(cd "$WT" && git rev-list "${TARGET}..HEAD" --count 2>/dev/null || echo "?")
    echo "commits ahead of ${TARGET}: $AHEAD"
    if [ "$AHEAD" != "0" ] && [ "$AHEAD" != "?" ]; then
      (cd "$WT" && git log "${TARGET}..HEAD" --oneline)
    fi
  else
    echo "latest commits:"
    (cd "$WT" && git log --oneline -3)
  fi
  
  # working tree status
  DIRTY=$(cd "$WT" && git status --short | wc -l | tr -d ' ')
  if [ "$DIRTY" -gt 0 ]; then
    echo "dirty files: $DIRTY"
    (cd "$WT" && git status --short | head -5)
  else
    echo "working tree: clean"
  fi
  echo ""
done

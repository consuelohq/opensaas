#!/bin/bash
# worktree-batch cleanup — removes worktrees and deletes feature branches
# usage: cleanup.sh DEV-820 DEV-821 DEV-822 ...
# optional: cleanup.sh --target <branch> DEV-820 ...  (default: auto-detect)

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$REPO_ROOT" ]; then
  echo "error: not in a git repo" >&2
  exit 1
fi

cd "$REPO_ROOT"

# parse optional --target flag
TARGET_BRANCH=""
if [ "${1:-}" = "--target" ]; then
  TARGET_BRANCH="$2"
  shift 2
fi

if [ $# -eq 0 ]; then
  echo "error: provide at least one task ID" >&2
  exit 1
fi

for TASK_ID in "$@"; do
  TASK_LOWER=$(echo "$TASK_ID" | tr '[:upper:]' '[:lower:]')
  WORKTREE_DIR="/tmp/opensaas-${TASK_LOWER}"

  # remove worktree
  if [ -d "$WORKTREE_DIR" ]; then
    git worktree remove "$WORKTREE_DIR" --force 2>/dev/null || rm -rf "$WORKTREE_DIR"
    echo "✓ removed worktree: $WORKTREE_DIR"
  else
    echo "- worktree not found: $WORKTREE_DIR (already removed?)"
  fi

  # find and delete the branch (try common target prefixes)
  DELETED=false
  if [ -n "$TARGET_BRANCH" ]; then
    BRANCH_NAME="${TARGET_BRANCH}-${TASK_LOWER}"
    if git branch -D "$BRANCH_NAME" 2>/dev/null; then
      echo "✓ deleted branch: $BRANCH_NAME"
      DELETED=true
    fi
  else
    # auto-detect: try common targets
    for PREFIX in main twenty-fork phase2-code-quality; do
      BRANCH_NAME="${PREFIX}-${TASK_LOWER}"
      if git branch -D "$BRANCH_NAME" 2>/dev/null; then
        echo "✓ deleted branch: $BRANCH_NAME"
        DELETED=true
        break
      fi
    done
  fi

  if [ "$DELETED" = false ]; then
    echo "- no branch found for $TASK_ID (already deleted?)"
  fi
done

# prune worktree metadata
git worktree prune 2>/dev/null
echo ""
echo "cleanup done."

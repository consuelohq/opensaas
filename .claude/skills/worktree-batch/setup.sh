#!/bin/bash
# worktree-batch setup — creates parallel worktrees for opencode sessions
# usage: setup.sh <target-branch> DEV-820 DEV-821 DEV-822 ...

set -euo pipefail

TARGET_BRANCH="${1:?usage: setup.sh <target-branch> DEV-XXX DEV-YYY ...}"
shift

if [ $# -eq 0 ]; then
  echo "error: provide at least one task ID" >&2
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [ -z "$REPO_ROOT" ]; then
  echo "error: not in a git repo" >&2
  exit 1
fi

cd "$REPO_ROOT"

# ensure target branch is up to date
git checkout "$TARGET_BRANCH" 2>/dev/null
git pull origin "$TARGET_BRANCH" 2>/dev/null || true

echo ""
for TASK_ID in "$@"; do
  # normalize: DEV-820 → dev-820
  TASK_LOWER=$(echo "$TASK_ID" | tr '[:upper:]' '[:lower:]')
  WORKTREE_DIR="/tmp/opensaas-${TASK_LOWER}"
  BRANCH_NAME="${TARGET_BRANCH}-${TASK_LOWER}"

  # clean up existing worktree if present
  if [ -d "$WORKTREE_DIR" ]; then
    echo "removing existing worktree: $WORKTREE_DIR"
    git worktree remove "$WORKTREE_DIR" --force 2>/dev/null || rm -rf "$WORKTREE_DIR"
  fi

  # delete branch if it exists (from a previous run)
  git branch -D "$BRANCH_NAME" 2>/dev/null || true

  # create worktree with new branch
  git worktree add "$WORKTREE_DIR" -b "$BRANCH_NAME" "$TARGET_BRANCH"
  echo "✓ ${TASK_ID}: ${WORKTREE_DIR} (branch: ${BRANCH_NAME})"
done

echo ""
echo "all worktrees ready. run opencode in each directory."

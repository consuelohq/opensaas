#!/bin/bash
set -e

# Sync upstream twentyhq/twenty repository
# Creates a PR with upstream changes

DATE=$(date +%Y-%m-%d)
BRANCH_NAME="upstream-sync-${DATE}"

echo "=== Syncing upstream twentyhq/twenty ==="
echo "Date: $DATE"
echo ""

# Fetch upstream
echo "Fetching upstream..."
git fetch upstream

# Check for new commits
echo ""
echo "=== New commits since last sync ==="
NEW_COMMITS=$(git log --oneline HEAD..upstream/main)
if [ -z "$NEW_COMMITS" ]; then
  echo "No new commits. Already up to date."
  exit 0
fi

echo "$NEW_COMMITS"
echo ""
COMMIT_COUNT=$(echo "$NEW_COMMITS" | wc -l)
echo "Total: $COMMIT_COUNT commits"
echo ""

# Create branch from current HEAD
echo "Creating branch: $BRANCH_NAME"
git checkout -b "$BRANCH_NAME"

# Merge upstream/main
echo "Merging upstream/main..."
if ! git merge upstream/main --no-edit; then
  echo ""
  echo "=== MERGE CONFLICTS DETECTED ==="
  echo "Conflicting files:"
  git diff --name-only --diff-filter=U
  echo ""
  echo "Resolve conflicts manually, then:"
  echo "  git add ."
  echo "  git commit"
  echo "  git push origin $BRANCH_NAME"
  exit 1
fi

# Push branch
echo ""
echo "Pushing branch to origin..."
git push origin "$BRANCH_NAME"

# Create PR via gh CLI if available
if command -v gh &> /dev/null; then
  echo ""
  echo "Creating PR via gh CLI..."
  gh pr create \
    --title "chore: sync upstream twenty ($DATE)" \
    --body "Sync changes from twentyhq/twenty upstream repository.\n\n## Commits included:\n\n\`\`\`\n$NEW_COMMITS\n\`\`\`\n\nTotal: $COMMIT_COUNT commits" \
    --base "$(git branch --show-current)" \
    --head "$BRANCH_NAME" \
    --repo "$(git remote get-url origin | sed 's/.*github.com[:/]//;s/.git$//')"
else
  echo ""
  echo "gh CLI not found. Create PR manually at:"
  echo "https://github.com/$(git remote get-url origin | sed 's/.*github.com[:/]//;s/.git$//')/compare/$BRANCH_NAME"
fi

echo ""
echo "=== Sync complete ==="

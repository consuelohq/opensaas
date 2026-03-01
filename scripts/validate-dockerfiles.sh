#!/usr/bin/env bash
# Validates that all workspace packages in package.json are included in Dockerfiles.
# Run this in CI or as a pre-push hook to prevent broken deployments.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ERRORS=0

# Extract workspace package directories from root package.json
WORKSPACES=$(node -e "
  const pkg = require('$ROOT_DIR/package.json');
  const dirs = pkg.workspaces?.packages || pkg.workspaces || [];
  dirs.forEach(d => console.log(d));
")

DOCKERFILES=(
  "$ROOT_DIR/packages/twenty-docker/twenty/Dockerfile"
  "$ROOT_DIR/packages/twenty-docker/twenty/Dockerfile.worker"
)

for dockerfile in "${DOCKERFILES[@]}"; do
  if [ ! -f "$dockerfile" ]; then
    continue
  fi

  basename=$(basename "$dockerfile")

  for ws in $WORKSPACES; do
    # Skip glob patterns
    if [[ "$ws" == *"*"* ]]; then
      continue
    fi

    pkg_name=$(basename "$ws")

    # Check if this workspace package.json is copied in the common-deps stage
    if ! grep -q "COPY.*$ws/package.json" "$dockerfile"; then
      echo "ERROR: $basename is missing COPY for $ws/package.json"
      ERRORS=$((ERRORS + 1))
    fi
  done
done

if [ $ERRORS -gt 0 ]; then
  echo ""
  echo "Found $ERRORS missing workspace package(s) in Dockerfiles."
  echo "When adding a new workspace package, update ALL Dockerfiles in packages/twenty-docker/twenty/"
  exit 1
else
  echo "All workspace packages are present in Dockerfiles."
fi

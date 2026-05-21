#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
home_dir="${CONSUELO_HOME:-$HOME/.consuelo/os}"

if ! command -v bun >/dev/null 2>&1; then
  echo "bun is required for Consuelo OS local runtime" >&2
  echo "install bun, then rerun setup" >&2
  exit 1
fi

bun "$root_dir/scripts/install.ts" --yes --home "$home_dir"

echo
echo "start server: cd $root_dir && bun run server -- start"
echo "check health: cd $root_dir && bun run doctor -- --home $home_dir"

#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
env_file="$root_dir/.env"
home_dir="${CONSUELO_HOME:-$HOME/.consuelo/os}"

if ! command -v bun >/dev/null 2>&1; then
  echo "bun is required for Consuelo OS local runtime" >&2
  echo "install bun, then rerun setup" >&2
  exit 1
fi

mkdir -p "$home_dir/artifacts" "$home_dir/logs" "$home_dir/runs" "$home_dir/tmp"

if [ ! -f "$env_file" ]; then
  cp "$root_dir/.env.example" "$env_file"
  echo "wrote $env_file"
fi

# Initialize the local runtime database and verify the Bun spine.
CONSUELO_HOME="$home_dir" bun "$root_dir/scripts/os.ts" call '{"name":"daily-revenue-brief"}' >/dev/null

echo
echo "setup complete"
echo "consuelo home: $home_dir"
echo "env file: $env_file"
echo "start server: cd $root_dir && bun run server:run"
echo "manage server: cd $root_dir && bun run server -- status"

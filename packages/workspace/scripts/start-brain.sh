#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$script_dir/.." && pwd)"
env_file="$root_dir/.env"

if [ -f "$env_file" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a
fi

export PORT="${PORT:-8850}"
export STEERING_FILE="${STEERING_FILE:-$root_dir/BRAIN.md}"
export WORKSPACE_DIR="${WORKSPACE_DIR:-$root_dir}"

python_bin="${PYTHON_BIN:-$root_dir/.venv/bin/python3}"
if [ ! -x "$python_bin" ]; then
  python_bin="$(command -v python3)"
fi

exec "$python_bin" "$root_dir/server.py"

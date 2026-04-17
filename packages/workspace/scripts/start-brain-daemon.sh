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

export HOME="${WORKSPACE_DAEMON_HOME:-${HOME:-/Users/kokayi}}"
export USER="${WORKSPACE_DAEMON_USER:-${USER:-kokayi}}"
export PATH="${WORKSPACE_DAEMON_PATH:-/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin}"
export PYTHONUNBUFFERED="1"
export PORT="${WORKSPACE_DAEMON_PORT:-${PORT:-8850}}"
export STEERING_FILE="${WORKSPACE_DAEMON_STEERING_FILE:-${STEERING_FILE:-$root_dir/BRAIN.md}}"
export WORKSPACE_DIR="${WORKSPACE_DAEMON_WORKSPACE_DIR:-${WORKSPACE_DIR:-$root_dir}}"

python_bin="${PYTHON_BIN:-$root_dir/.venv/bin/python3}"
if [ ! -x "$python_bin" ]; then
  python_bin="$(command -v python3)"
fi

exec "$python_bin" "$root_dir/server.py"

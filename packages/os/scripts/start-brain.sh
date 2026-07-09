#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$script_dir/.." && pwd)"
env_file="$root_dir/.env"

load_env_file() {
  local file="$1"
  if [ ! -f "$file" ]; then
    return 0
  fi

  local line key value
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ''|'#'*) continue ;;
    esac
    key="${line%%=*}"
    value="${line#*=}"
    if [ "$key" = "$line" ]; then
      continue
    fi
    case "$key" in
      ''|*[!A-Za-z0-9_]*|[0-9]*) continue ;;
    esac
    value="${value%$'\r'}"
    value="${value%\"}"
    value="${value#\"}"
    value="${value%\'}"
    value="${value#\'}"
    export "$key=$value"
  done < "$file"
}

load_env_file "$env_file"

export PATH="${WORKSPACE_DAEMON_PATH:-/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin}"
export CONSUELO_OS_PORT="${WORKSPACE_DAEMON_PORT:-${CONSUELO_OS_PORT:-${PORT:-8960}}}"
export PORT="$CONSUELO_OS_PORT"
export CONSUELO_HOME="${WORKSPACE_DAEMON_CONSUELO_HOME:-${CONSUELO_HOME:-${HOME:-/tmp}/.consuelo/os}}"

bun_bin="${BUN_BIN:-}"
if [ -z "$bun_bin" ]; then
  bun_bin="$(command -v bun || true)"
fi
if [ -z "$bun_bin" ]; then
  echo "bun binary not found in PATH=$PATH" >&2
  exit 1
fi

exec "$bun_bin" "$root_dir/scripts/server.ts"
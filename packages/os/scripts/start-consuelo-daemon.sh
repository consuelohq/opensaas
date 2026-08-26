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

unset WORKSPACE_MCP_TOKEN
unset INTERNAL_CONSUELO_API_KEY
unset CLOUDFLARE_API_TOKEN

export HOME="${WORKSPACE_DAEMON_HOME:-${HOME:-/Users/$(id -un)}}"
export USER="${WORKSPACE_DAEMON_USER:-${USER:-$(id -un)}}"
export PATH="${WORKSPACE_DAEMON_PATH:-/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin}"
export CONSUELO_OS_PORT="${WORKSPACE_DAEMON_PORT:-${CONSUELO_OS_WORKER_BASE_PORT:-${CONSUELO_OS_PORT:-${PORT:-46321}}}}"
export CONSUELO_OS_WORKER_BASE_PORT="$CONSUELO_OS_PORT"
export PORT="$CONSUELO_OS_PORT"
export CONSUELO_HOME="${WORKSPACE_DAEMON_CONSUELO_HOME:-${CONSUELO_HOME:-$HOME/.consuelo}}"
export CONSUELO_TRACE_DB="${CONSUELO_TRACE_DB:-$CONSUELO_HOME/node/db/traces.db}"

bun_bin="${BUN_BIN:-}"
if [ -z "$bun_bin" ]; then
  bun_bin="$(command -v bun || true)"
fi
if [ -z "$bun_bin" ]; then
  echo "bun binary not found in PATH=$PATH" >&2
  exit 1
fi

bun_dir="$(dirname "$bun_bin")"
case ":$PATH:" in
  *":$bun_dir:"*) ;;
  *) export PATH="$bun_dir:$PATH" ;;
esac

if [ "${CONSUELO_OS_SINGLE_WORKER_SMOKE_TEST:-0}" = "1" ]; then
  export CONSUELO_OS_WORKER_PROCESS="1"
  export CONSUELO_OS_WORKER_ID="smoke-worker"
  export CONSUELO_OS_WORKER_INSTANCE_ID="smoke-$$"
  export CONSUELO_OS_WORKER_RELEASE_PATH="$root_dir"
  unset CONSUELO_OS_SUPERVISOR_PID
  exec "$bun_bin" "$root_dir/scripts/server/main.ts"
fi

run_with_timeout() {
  local timeout_seconds="$1"
  shift

  "$@" &
  local command_pid=$!
  (
    sleep "$timeout_seconds"
    kill -TERM "$command_pid" 2>/dev/null || true
  ) &
  local watchdog_pid=$!
  local command_status=0
  if wait "$command_pid"; then
    command_status=0
  else
    command_status=$?
  fi
  kill "$watchdog_pid" 2>/dev/null || true
  wait "$watchdog_pid" 2>/dev/null || true
  return "$command_status"
}

sites_refresh_timeout="${WORKSPACE_DAEMON_SITES_REFRESH_TIMEOUT_SECONDS:-15}"
case "$sites_refresh_timeout" in
  ''|*[!0-9]*) sites_refresh_timeout=15 ;;
esac
if [ "$sites_refresh_timeout" -lt 1 ]; then
  sites_refresh_timeout=15
fi

sites_refresh_log="$CONSUELO_HOME/node/logs/managed-sites-refresh.log"
mkdir -p "$(dirname "$sites_refresh_log")"
(
  if ! run_with_timeout "$sites_refresh_timeout" "$bun_bin" "$root_dir/scripts/os.ts" sites refresh --json >/dev/null; then
    echo "managed Sites refresh failed; continuing daemon startup" >&2
  fi
) </dev/null >>"$sites_refresh_log" 2>&1 &

exec "$bun_bin" "$root_dir/scripts/server/supervisor.ts"

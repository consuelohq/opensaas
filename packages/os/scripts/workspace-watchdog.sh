#!/usr/bin/env bash
set -euo pipefail

umask 077

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$script_dir/.." && pwd)"
env_file="${WORKSPACE_WATCHDOG_ENV_FILE:-$root_dir/.env}"

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

PATH="${WORKSPACE_WATCHDOG_PATH:-/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin}"
export PATH

workspace_label="${WORKSPACE_DAEMON_LABEL:-com.consuelo.system}"
external_label="${WORKSPACE_WATCHDOG_EXTERNAL_LABEL:-${PORTLESS_DAEMON_LABEL:-com.consuelo.portless.system}}"
min_restart_gap_seconds="${WORKSPACE_WATCHDOG_MIN_RESTART_GAP_SECONDS:-60}"
local_tcp_failure_threshold="${WORKSPACE_WATCHDOG_LOCAL_TCP_FAILURE_THRESHOLD:-3}"
local_http_failure_threshold="${WORKSPACE_WATCHDOG_LOCAL_HTTP_FAILURE_THRESHOLD:-3}"
external_failure_threshold="${WORKSPACE_WATCHDOG_EXTERNAL_FAILURE_THRESHOLD:-3}"
http_connect_timeout_seconds="${WORKSPACE_WATCHDOG_HTTP_CONNECT_TIMEOUT_SECONDS:-2}"
http_timeout_seconds="${WORKSPACE_WATCHDOG_HTTP_TIMEOUT_SECONDS:-5}"
max_restarts_per_window="${WORKSPACE_WATCHDOG_MAX_RESTARTS_PER_WINDOW:-3}"
restart_window_seconds="${WORKSPACE_WATCHDOG_RESTART_WINDOW_SECONDS:-600}"
local_port="${WORKSPACE_WATCHDOG_LOCAL_PORT:-${WORKSPACE_DAEMON_PORT:-${PORT:-46321}}}"
local_health_url="${WORKSPACE_WATCHDOG_LOCAL_URL:-http://127.0.0.1:${local_port}/health}"
consuelo_home="${CONSUELO_HOME:-${WORKSPACE_DAEMON_CONSUELO_HOME:-${HOME:-/Users/$(id -un)}/.consuelo}}"
default_state_dir="$consuelo_home/node/runtime/watchdog"
state_dir="${WORKSPACE_WATCHDOG_STATE_DIR:-$default_state_dir}"
launch_domain="gui/$(id -u)"

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

require_nonnegative_integer() {
  local name="$1"
  local value="$2"
  case "$value" in
    ''|*[!0-9]*)
      log "invalid $name=$value; expected a nonnegative integer"
      exit 1
      ;;
  esac
}

require_positive_integer() {
  local name="$1"
  local value="$2"
  require_nonnegative_integer "$name" "$value"
  if [ "$value" -lt 1 ]; then
    log "invalid $name=$value; expected an integer greater than zero"
    exit 1
  fi
}

require_nonnegative_integer WORKSPACE_WATCHDOG_MIN_RESTART_GAP_SECONDS "$min_restart_gap_seconds"
require_positive_integer WORKSPACE_WATCHDOG_LOCAL_TCP_FAILURE_THRESHOLD "$local_tcp_failure_threshold"
require_positive_integer WORKSPACE_WATCHDOG_LOCAL_HTTP_FAILURE_THRESHOLD "$local_http_failure_threshold"
require_positive_integer WORKSPACE_WATCHDOG_EXTERNAL_FAILURE_THRESHOLD "$external_failure_threshold"
require_positive_integer WORKSPACE_WATCHDOG_HTTP_CONNECT_TIMEOUT_SECONDS "$http_connect_timeout_seconds"
require_positive_integer WORKSPACE_WATCHDOG_HTTP_TIMEOUT_SECONDS "$http_timeout_seconds"
require_positive_integer WORKSPACE_WATCHDOG_MAX_RESTARTS_PER_WINDOW "$max_restarts_per_window"
require_positive_integer WORKSPACE_WATCHDOG_RESTART_WINDOW_SECONDS "$restart_window_seconds"
require_positive_integer WORKSPACE_WATCHDOG_LOCAL_PORT "$local_port"

mkdir -p "$state_dir"

lock_dir="$state_dir/run.lock"
cleanup_lock() {
  rm -f "$lock_dir/pid"
  rmdir "$lock_dir" 2>/dev/null || true
}

acquire_lock() {
  if mkdir "$lock_dir" 2>/dev/null; then
    printf '%s\n' "$$" > "$lock_dir/pid"
    trap cleanup_lock EXIT INT TERM
    return 0
  fi

  local existing_pid=""
  if [ -f "$lock_dir/pid" ]; then
    existing_pid="$(cat "$lock_dir/pid" 2>/dev/null || true)"
  fi
  case "$existing_pid" in
    ''|*[!0-9]*) ;;
    *)
      if kill -0 "$existing_pid" 2>/dev/null; then
        log "another watchdog check is still running as pid $existing_pid; skipping"
        exit 0
      fi
      ;;
  esac

  rm -f "$lock_dir/pid"
  rmdir "$lock_dir" 2>/dev/null || true
  if ! mkdir "$lock_dir" 2>/dev/null; then
    log "watchdog lock is unavailable; skipping"
    exit 0
  fi
  printf '%s\n' "$$" > "$lock_dir/pid"
  trap cleanup_lock EXIT INT TERM
}

acquire_lock

local_tcp_failure_file="$state_dir/local-tcp-failure-count"
local_http_failure_file="$state_dir/local-http-failure-count"
external_failure_file="$state_dir/external-failure-count"

read_counter() {
  local counter_file="$1"
  local value="0"
  if [ -f "$counter_file" ]; then
    value="$(cat "$counter_file" 2>/dev/null || true)"
  fi
  case "$value" in
    ''|*[!0-9]*) value="0" ;;
  esac
  printf '%s\n' "$value"
}

write_counter() {
  local counter_file="$1"
  local value="$2"
  printf '%s\n' "$value" > "$counter_file"
}

increment_counter() {
  local counter_file="$1"
  local current_value
  current_value="$(read_counter "$counter_file")"
  current_value="$((current_value + 1))"
  write_counter "$counter_file" "$current_value"
  printf '%s\n' "$current_value"
}

reset_counter() {
  write_counter "$1" 0
}

healthy_http() {
  local url="$1"
  curl --fail --silent --show-error \
    --connect-timeout "$http_connect_timeout_seconds" \
    --max-time "$http_timeout_seconds" \
    "$url" >/dev/null
}

local_port_listening() {
  lsof -nP -iTCP:"$local_port" -sTCP:LISTEN >/dev/null 2>&1
}

derive_external_health_url() {
  if [ "${WORKSPACE_WATCHDOG_DISABLE_EXTERNAL:-0}" = "1" ]; then
    return 0
  fi
  if [ -n "${WORKSPACE_WATCHDOG_EXTERNAL_URL:-}" ]; then
    printf '%s\n' "$WORKSPACE_WATCHDOG_EXTERNAL_URL"
    return 0
  fi
  if [ -z "${MCP_SERVER_URL:-}" ]; then
    return 0
  fi

  local base_url="${MCP_SERVER_URL%/}"
  if [[ "$base_url" == */mcp ]]; then
    printf '%s/health\n' "${base_url%/mcp}"
  else
    printf '%s/health\n' "$base_url"
  fi
}

prune_restart_history() {
  local history_file="$1"
  local now="$2"
  local cutoff="$((now - restart_window_seconds))"
  local temporary_file="$history_file.tmp.$$"

  if [ -f "$history_file" ]; then
    awk -v cutoff="$cutoff" '$1 ~ /^[0-9]+$/ && $1 >= cutoff { print $1 }' \
      "$history_file" > "$temporary_file"
  else
    : > "$temporary_file"
  fi
  mv "$temporary_file" "$history_file"
}

maybe_restart() {
  local label="$1"
  local reason="$2"
  local stamp_file="$state_dir/${label}.last-restart"
  local history_file="$state_dir/${label}.restart-history"
  local degraded_file="$state_dir/${label}.degraded"
  local now last_restart restart_count
  now="$(date +%s)"

  if [ -f "$stamp_file" ]; then
    last_restart="$(cat "$stamp_file" 2>/dev/null || true)"
    case "$last_restart" in
      ''|*[!0-9]*) last_restart="0" ;;
    esac
    if [ $((now - last_restart)) -lt "$min_restart_gap_seconds" ]; then
      log "skip restart for $label; still inside restart gap after $reason"
      return 0
    fi
  fi

  prune_restart_history "$history_file" "$now"
  restart_count="$(wc -l < "$history_file" | tr -d '[:space:]')"
  if [ "$restart_count" -ge "$max_restarts_per_window" ]; then
    printf '%s %s\n' "$now" "$reason" > "$degraded_file"
    log "recovery circuit open for $label after $restart_count restarts in ${restart_window_seconds}s; $reason"
    return 0
  fi

  printf '%s\n' "$now" >> "$history_file"
  printf '%s\n' "$now" > "$stamp_file"
  rm -f "$degraded_file"
  log "restarting $label because $reason"
  if ! launchctl kickstart -k "$launch_domain/$label"; then
    log "restart command failed for $label; launchd will remain the primary process supervisor"
  fi
}

external_health_url="$(derive_external_health_url || true)"

if ! local_port_listening; then
  local_tcp_failures="$(increment_counter "$local_tcp_failure_file")"
  log "local tcp probe failed on port $local_port (consecutive=$local_tcp_failures)"
  if [ "$local_tcp_failures" -ge "$local_tcp_failure_threshold" ]; then
    maybe_restart "$workspace_label" "local tcp probe failed ${local_tcp_failures} times"
    reset_counter "$local_tcp_failure_file"
  fi
  exit 0
fi
reset_counter "$local_tcp_failure_file"

if ! healthy_http "$local_health_url"; then
  local_http_failures="$(increment_counter "$local_http_failure_file")"
  log "local http health failed for $local_health_url (consecutive=$local_http_failures)"
  if [ "$local_http_failures" -ge "$local_http_failure_threshold" ]; then
    maybe_restart "$workspace_label" "local http health failed ${local_http_failures} times"
    reset_counter "$local_http_failure_file"
  fi
  exit 0
fi
reset_counter "$local_http_failure_file"
rm -f "$state_dir/${workspace_label}.degraded"

if [ -n "$external_health_url" ] && ! healthy_http "$external_health_url"; then
  external_failures="$(increment_counter "$external_failure_file")"
  log "external health failed for $external_health_url (consecutive=$external_failures)"
  if [ "$external_failures" -ge "$external_failure_threshold" ]; then
    maybe_restart "$external_label" "external health failed ${external_failures} times"
    reset_counter "$external_failure_file"
  fi
  exit 0
fi
reset_counter "$external_failure_file"
rm -f "$state_dir/${external_label}.degraded"

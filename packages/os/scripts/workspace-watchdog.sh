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

PATH="${WORKSPACE_WATCHDOG_PATH:-/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin}"
export PATH

workspace_label="${WORKSPACE_DAEMON_LABEL:-com.consuelo.system}"
portless_label="${PORTLESS_DAEMON_LABEL:-com.consuelo.portless.system}"
interval_seconds="${WORKSPACE_WATCHDOG_INTERVAL_SECONDS:-30}"
min_restart_gap_seconds="${WORKSPACE_WATCHDOG_MIN_RESTART_GAP_SECONDS:-60}"
local_tcp_failure_threshold="${WORKSPACE_WATCHDOG_LOCAL_TCP_FAILURE_THRESHOLD:-3}"
local_http_failure_threshold="${WORKSPACE_WATCHDOG_LOCAL_HTTP_FAILURE_THRESHOLD:-10}"
external_failure_threshold="${WORKSPACE_WATCHDOG_EXTERNAL_FAILURE_THRESHOLD:-3}"
http_timeout_seconds="${WORKSPACE_WATCHDOG_HTTP_TIMEOUT_SECONDS:-15}"
local_port="${WORKSPACE_WATCHDOG_LOCAL_PORT:-${WORKSPACE_DAEMON_PORT:-${PORT:-8960}}}"
local_health_url="${WORKSPACE_WATCHDOG_LOCAL_URL:-http://127.0.0.1:${local_port}/health}"
default_state_dir="${HOME:-/Users/$(id -un)}/Library/Caches/Consuelo/watchdog"
state_dir="${WORKSPACE_WATCHDOG_STATE_DIR:-$default_state_dir}"
launch_domain="gui/$(id -u)"
mkdir -p "$state_dir"

local_tcp_failure_file="$state_dir/local-tcp-failure-count"
local_http_failure_file="$state_dir/local-http-failure-count"
external_failure_file="$state_dir/external-failure-count"

log() {
  printf '%s %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

read_counter() {
  local counter_file="$1"
  if [ ! -f "$counter_file" ]; then
    printf '0\n'
    return 0
  fi
  cat "$counter_file"
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
  local counter_file="$1"
  write_counter "$counter_file" 0
}

healthy_http() {
  local url="$1"
  curl --fail --silent --show-error --max-time "$http_timeout_seconds" "$url" >/dev/null
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
    return 0
  fi

  printf '%s/health\n' "$base_url"
}

maybe_restart() {
  local label="$1"
  local reason="$2"
  local stamp_file="$state_dir/${label}.last-restart"
  local now
  now="$(date +%s)"

  if [ -f "$stamp_file" ]; then
    local last_restart
    last_restart="$(cat "$stamp_file")"
    if [ $((now - last_restart)) -lt "$min_restart_gap_seconds" ]; then
      log "skip restart for $label; still inside restart gap after $reason"
      return 0
    fi
  fi

  log "restarting $label because $reason"
  echo "$now" > "$stamp_file"
  launchctl kickstart -k "$launch_domain/$label"
}

external_health_url="$(derive_external_health_url || true)"
reset_counter "$local_tcp_failure_file"
reset_counter "$local_http_failure_file"
reset_counter "$external_failure_file"
log "watchdog started local=$local_health_url external=${external_health_url:-disabled} local-tcp-threshold=$local_tcp_failure_threshold local-http-threshold=$local_http_failure_threshold external-threshold=$external_failure_threshold timeout=${http_timeout_seconds}s"

while true; do
  if ! local_port_listening; then
    local_tcp_failures="$(increment_counter "$local_tcp_failure_file")"
    log "local tcp probe failed on port $local_port (consecutive=$local_tcp_failures)"
    if [ "$local_tcp_failures" -ge "$local_tcp_failure_threshold" ]; then
      maybe_restart "$workspace_label" "local tcp probe failed ${local_tcp_failures} times"
      reset_counter "$local_tcp_failure_file"
    fi
    sleep "$interval_seconds"
    continue
  fi

  reset_counter "$local_tcp_failure_file"

  if ! healthy_http "$local_health_url"; then
    local_http_failures="$(increment_counter "$local_http_failure_file")"
    log "local http health failed for $local_health_url (consecutive=$local_http_failures)"
    if [ "$local_http_failures" -ge "$local_http_failure_threshold" ]; then
      maybe_restart "$workspace_label" "local http health failed ${local_http_failures} times"
      reset_counter "$local_http_failure_file"
    fi
    sleep "$interval_seconds"
    continue
  fi

  if [ "$(read_counter "$local_http_failure_file")" != "0" ]; then
    log "local http health recovered"
    reset_counter "$local_http_failure_file"
  fi

  if [ -n "$external_health_url" ] && ! healthy_http "$external_health_url"; then
    external_failures="$(increment_counter "$external_failure_file")"
    log "external health failed for $external_health_url (consecutive=$external_failures)"
    if [ "$external_failures" -ge "$external_failure_threshold" ]; then
      maybe_restart "$portless_label" "external health failed ${external_failures} times"
      reset_counter "$external_failure_file"
    fi
    sleep "$interval_seconds"
    continue
  fi

  if [ -n "$external_health_url" ] && [ "$(read_counter "$external_failure_file")" != "0" ]; then
    log "external health recovered"
    reset_counter "$external_failure_file"
  fi

  sleep "$interval_seconds"
done

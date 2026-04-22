#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "run this script with sudo" >&2
  exit 1
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$script_dir/.." && pwd)"
log_prefix="[workspace-system-install]"

daemon_user="${CONSUELO_DAEMON_USER:-kokayi}"
daemon_home="${CONSUELO_DAEMON_HOME:-/Users/$daemon_user}"
log_dir="${CONSUELO_DAEMON_LOG_DIR:-$daemon_home/Library/Logs/Consuelo}"
workspace_label="${WORKSPACE_DAEMON_LABEL:-com.consuelo.workspace.system}"
portless_label="${PORTLESS_DAEMON_LABEL:-com.consuelo.portless.system}"
watchdog_label="${WORKSPACE_WATCHDOG_LABEL:-com.consuelo.workspace.watchdog}"
workspace_agent_label="com.consuelo.workspace"
portless_agent_label="com.consuelo.portless"
workspace_agent_plist="$daemon_home/Library/LaunchAgents/${workspace_agent_label}.plist"
portless_agent_plist="$daemon_home/Library/LaunchAgents/${portless_agent_label}.plist"
workspace_daemon_plist="$script_dir/generated/${workspace_label}.plist"
portless_daemon_plist="$script_dir/generated/${portless_label}.plist"
watchdog_daemon_plist="$script_dir/generated/${watchdog_label}.plist"
stage_port="${WORKSPACE_STAGE_PORT:-}"
if [ -z "$stage_port" ]; then
  for candidate_port in 8961 8962 8963 9851 10851; do
    if ! lsof -nP -iTCP:"$candidate_port" -sTCP:LISTEN >/dev/null 2>&1; then
      stage_port="$candidate_port"
      break
    fi
  done
fi
if [ -z "$stage_port" ]; then
  echo "unable to find a free stage port" >&2
  exit 1
fi
local_health_url="${WORKSPACE_CUTOVER_LOCAL_HEALTH_URL:-http://127.0.0.1:8850/health}"
uid_value="$(id -u "$daemon_user")"

log() {
  printf '%s %s\n' "$log_prefix" "$*"
}

derive_external_health_url() {
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

wait_for_health() {
  local url="$1"
  local attempts="$2"
  local sleep_seconds="$3"
  local attempt
  for attempt in $(seq 1 "$attempts"); do
    if curl --fail --silent --show-error --max-time 5 "$url" >/dev/null; then
      return 0
    fi
    sleep "$sleep_seconds"
  done
  return 1
}

rollback_to_agents() {
  log "rolling back to user launchagents"
  launchctl bootout "system/$watchdog_label" 2>/dev/null || true
  launchctl bootout "system/$portless_label" 2>/dev/null || true
  launchctl bootout "system/$workspace_label" 2>/dev/null || true

  if [ -f "$workspace_agent_plist" ]; then
    launchctl bootstrap "gui/$uid_value" "$workspace_agent_plist" 2>/dev/null || true
    launchctl kickstart -k "gui/$uid_value/$workspace_agent_label" 2>/dev/null || true
  fi

  if [ -f "$portless_agent_plist" ]; then
    launchctl bootstrap "gui/$uid_value" "$portless_agent_plist" 2>/dev/null || true
    launchctl kickstart -k "gui/$uid_value/$portless_agent_label" 2>/dev/null || true
  fi
}

mkdir -p "$log_dir"
chown "$daemon_user":staff "$log_dir"
chmod 755 "$log_dir"

bash "$script_dir/generate-system-daemons.sh"

bash -n "$script_dir/start-brain-daemon.sh"
bash -n "$script_dir/start-portless-daemon.sh"
bash -n "$script_dir/workspace-watchdog.sh"
bash -n "$script_dir/generate-system-daemons.sh"
bash -n "$script_dir/install-system-daemons.sh"
plutil -lint "$workspace_daemon_plist" "$portless_daemon_plist" "$watchdog_daemon_plist"

log "running workspace smoke test on port $stage_port"
WORKSPACE_DAEMON_PORT="$stage_port" "$script_dir/start-brain-daemon.sh" > /tmp/workspace-daemon-stage.log 2>&1 &
stage_pid=$!
trap 'kill "$stage_pid" 2>/dev/null || true' EXIT
if ! wait_for_health "http://127.0.0.1:${stage_port}/health" 20 1; then
  log "stage workspace daemon did not become healthy"
  exit 1
fi
kill "$stage_pid" 2>/dev/null || true
wait "$stage_pid" 2>/dev/null || true
trap - EXIT

install -o root -g wheel -m 644 "$workspace_daemon_plist" "/Library/LaunchDaemons/${workspace_label}.plist"
install -o root -g wheel -m 644 "$portless_daemon_plist" "/Library/LaunchDaemons/${portless_label}.plist"
install -o root -g wheel -m 644 "$watchdog_daemon_plist" "/Library/LaunchDaemons/${watchdog_label}.plist"

launchctl bootout "system/$watchdog_label" 2>/dev/null || true
launchctl bootout "system/$portless_label" 2>/dev/null || true
launchctl bootout "system/$workspace_label" 2>/dev/null || true

launchctl bootout "gui/$uid_value/$workspace_agent_label" 2>/dev/null || true
launchctl bootout "gui/$uid_value/$portless_agent_label" 2>/dev/null || true

launchctl bootstrap system "/Library/LaunchDaemons/${workspace_label}.plist"
launchctl bootstrap system "/Library/LaunchDaemons/${portless_label}.plist"
launchctl bootstrap system "/Library/LaunchDaemons/${watchdog_label}.plist"

launchctl kickstart -k "system/$workspace_label"
launchctl kickstart -k "system/$portless_label"
launchctl kickstart -k "system/$watchdog_label"

if ! wait_for_health "$local_health_url" 20 1; then
  log "local workspace health failed after cutover"
  rollback_to_agents
  exit 1
fi

external_health_url="$(derive_external_health_url || true)"
if [ -n "$external_health_url" ] && ! wait_for_health "$external_health_url" 20 1; then
  log "external health failed after cutover"
  rollback_to_agents
  exit 1
fi

log "cutover complete"
launchctl print "system/$workspace_label" | sed -n '1,80p'
launchctl print "system/$portless_label" | sed -n '1,80p'
launchctl print "system/$watchdog_label" | sed -n '1,80p'

#!/usr/bin/env bash
set -euo pipefail

dry_run=0
quiet=0
debug="${CONSUELO_OS_DEBUG:-0}"
for arg in "$@"; do
  case "$arg" in
    --dry-run) dry_run=1 ;;
    --quiet) quiet=1 ;;
    --debug) debug=1 ;;
    --help|-h)
      echo "usage: bash scripts/install-system-daemons.sh [--dry-run] [--quiet] [--debug]"
      echo "installs Consuelo OS user LaunchAgents in ~/Library/LaunchAgents"
      echo "  --quiet  suppress normal success details for hosted bootstrap output"
      exit 0
      ;;
    *)
      echo "unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$script_dir/.." && pwd)"
log_prefix="[consuelo-os-launchagent-install]"

daemon_user="${CONSUELO_DAEMON_USER:-${USER:-$(id -un)}}"
if ! id -u "$daemon_user" >/dev/null 2>&1; then
  echo "daemon user does not exist: $daemon_user" >&2
  exit 1
fi
daemon_home="${CONSUELO_DAEMON_HOME:-${HOME:-/Users/$daemon_user}}"
launch_agent_dir="$daemon_home/Library/LaunchAgents"
log_dir="${CONSUELO_DAEMON_LOG_DIR:-$root_dir/logs}"
workspace_label="${WORKSPACE_DAEMON_LABEL:-com.consuelo.system}"
portless_label="${PORTLESS_DAEMON_LABEL:-com.consuelo.portless.system}"
watchdog_label="${WORKSPACE_WATCHDOG_LABEL:-com.consuelo.watchdog}"
workspace_agent_plist="$launch_agent_dir/${workspace_label}.plist"
portless_agent_plist="$launch_agent_dir/${portless_label}.plist"
watchdog_agent_plist="$launch_agent_dir/${watchdog_label}.plist"
workspace_generated_plist="$script_dir/generated/${workspace_label}.plist"
portless_generated_plist="$script_dir/generated/${portless_label}.plist"
watchdog_generated_plist="$script_dir/generated/${watchdog_label}.plist"
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
launch_domain="gui/$uid_value"

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
    if [ "$debug" = "1" ]; then
      if curl --fail --silent --show-error --max-time 5 "$url" >/dev/null; then
        return 0
      fi
    else
      if curl --fail --silent --max-time 5 "$url" >/dev/null 2>&1; then
        return 0
      fi
    fi
    sleep "$sleep_seconds"
  done
  return 1
}

bootout_agent() {
  local label="$1"
  launchctl bootout "$launch_domain/$label" 2>/dev/null || true
}

bootstrap_agent() {
  local label="$1"
  local plist="$2"
  launchctl bootstrap "$launch_domain" "$plist"
  launchctl kickstart -k "$launch_domain/$label"
}

rollback_agents() {
  log "rolling back user LaunchAgents"
  bootout_agent "$watchdog_label"
  bootout_agent "$portless_label"
  bootout_agent "$workspace_label"
}

print_repair_hint() {
  log "Consuelo OS services were not healthy after LaunchAgent setup."
  log "Log directory: $log_dir"
  log "System log: $log_dir/system.log"
  log "Portless log: $log_dir/portless.log"
  log "Watchdog log: $log_dir/watchdog.log"
  log "Doctor: CONSUELO_HOME=$daemon_home/.consuelo/os bun --cwd $root_dir run doctor"
  log "Retry services: bash $script_dir/install-system-daemons.sh"
  log "Remove services only: bash $script_dir/uninstall-system-daemons.sh"
  log "Debug details: CONSUELO_OS_DEBUG=1 bash $script_dir/install-system-daemons.sh --debug"
}

print_success_summary() {
  [ "$quiet" = "1" ] && return 0
  log "background service setup complete"
  log "Services: $workspace_label, $portless_label, $watchdog_label"
  log "LaunchAgents: $launch_agent_dir"
  log "Logs: $log_dir"
  log "Doctor: CONSUELO_HOME=$daemon_home/.consuelo/os bun --cwd $root_dir run doctor"
  log "Tokens and secrets are saved in local config/state files and are not printed."
}

print_debug_state() {
  [ "$debug" = "1" ] || return 0
  launchctl print "$launch_domain/$workspace_label" | sed -n '1,80p'
  launchctl print "$launch_domain/$portless_label" | sed -n '1,80p'
  launchctl print "$launch_domain/$watchdog_label" | sed -n '1,80p'
}

run_generate_daemons() {
  if [ "$debug" = "1" ]; then
    bash "$script_dir/generate-system-daemons.sh"
  else
    bash "$script_dir/generate-system-daemons.sh" >/dev/null
  fi
}

run_plutil_lint() {
  if [ "$debug" = "1" ]; then
    plutil -lint "$workspace_generated_plist" "$portless_generated_plist" "$watchdog_generated_plist"
  else
    plutil -lint "$workspace_generated_plist" "$portless_generated_plist" "$watchdog_generated_plist" >/dev/null
  fi
}

if [ "$dry_run" -eq 0 ]; then
  mkdir -p "$launch_agent_dir" "$log_dir"
fi

run_generate_daemons

bash -n "$script_dir/start-consuelo-daemon.sh"
bash -n "$script_dir/start-portless-daemon.sh"
bash -n "$script_dir/workspace-watchdog.sh"
bash -n "$script_dir/generate-system-daemons.sh"
bash -n "$script_dir/install-system-daemons.sh"
run_plutil_lint
if [ "$dry_run" -eq 1 ]; then
  log "dry run complete; generated and linted user LaunchAgent plist files without installing services"
  exit 0
fi

[ "$quiet" = "1" ] || log "running Consuelo OS smoke test on port $stage_port"
WORKSPACE_DAEMON_PORT="$stage_port" bash "$script_dir/start-consuelo-daemon.sh" > /tmp/consuelo-os-stage.log 2>&1 &
stage_pid=$!
trap 'kill "$stage_pid" 2>/dev/null || true' EXIT
if ! wait_for_health "http://127.0.0.1:${stage_port}/health" 20 1; then
  log "stage Consuelo OS service did not become healthy"
  exit 1
fi
kill "$stage_pid" 2>/dev/null || true
wait "$stage_pid" 2>/dev/null || true
trap - EXIT

install -m 644 "$workspace_generated_plist" "$workspace_agent_plist"
install -m 644 "$portless_generated_plist" "$portless_agent_plist"
install -m 644 "$watchdog_generated_plist" "$watchdog_agent_plist"

bootout_agent "$watchdog_label"
bootout_agent "$portless_label"
bootout_agent "$workspace_label"

bootstrap_agent "$workspace_label" "$workspace_agent_plist"
bootstrap_agent "$portless_label" "$portless_agent_plist"
bootstrap_agent "$watchdog_label" "$watchdog_agent_plist"

if ! wait_for_health "$local_health_url" 20 1; then
  log "local Consuelo OS health failed after LaunchAgent cutover"
  print_repair_hint
  rollback_agents
  exit 1
fi

external_health_url="$(derive_external_health_url || true)"
if [ -n "$external_health_url" ] && ! wait_for_health "$external_health_url" 20 1; then
  log "external health failed after LaunchAgent cutover"
  print_repair_hint
  rollback_agents
  exit 1
fi

print_success_summary
print_debug_state

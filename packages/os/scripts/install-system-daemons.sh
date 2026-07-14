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
env_file="$root_dir/.env"
log_prefix="[consuelo-os-launchagent-install]"

daemon_user="${CONSUELO_DAEMON_USER:-${USER:-$(id -un)}}"
if ! id -u "$daemon_user" >/dev/null 2>&1; then
  echo "daemon user does not exist: $daemon_user" >&2
  exit 1
fi
daemon_home="${CONSUELO_DAEMON_HOME:-${HOME:-/Users/$daemon_user}}"
consuelo_data_home="${CONSUELO_HOME:-$daemon_home/.consuelo}"
launch_agent_dir="$daemon_home/Library/LaunchAgents"
log_dir="${CONSUELO_DAEMON_LOG_DIR:-$consuelo_data_home/node/logs}"
workspace_label="${WORKSPACE_DAEMON_LABEL:-com.consuelo.system}"
portless_label="${PORTLESS_DAEMON_LABEL:-com.consuelo.portless.system}"
watchdog_label="${WORKSPACE_WATCHDOG_LABEL:-com.consuelo.watchdog}"
workspace_agent_plist="$launch_agent_dir/${workspace_label}.plist"
portless_agent_plist="$launch_agent_dir/${portless_label}.plist"
watchdog_agent_plist="$launch_agent_dir/${watchdog_label}.plist"
workspace_generated_plist="$script_dir/generated/${workspace_label}.plist"
portless_generated_plist="$script_dir/generated/${portless_label}.plist"
watchdog_generated_plist="$script_dir/generated/${watchdog_label}.plist"
cloudflared_generated_dir="${CONSUELO_SECURITY_GENERATED_DIR:-$consuelo_data_home/node/security/generated}"
cloudflared_labels=()
cloudflared_generated_plists=()
cloudflared_agent_plists=()
portless_enabled=0
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
uid_value="$(id -u "$daemon_user")"
launch_domain="gui/$uid_value"

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

resolve_cutover_local_port() {
  local file="$1"
  (
    load_env_file "$file"
    printf '%s\n' "${WORKSPACE_DAEMON_PORT:-${CONSUELO_OS_PORT:-${PORT:-46321}}}"
  )
}

resolve_cutover_local_health_url() {
  local file="$1"
  if [ -n "${WORKSPACE_CUTOVER_LOCAL_HEALTH_URL:-}" ]; then
    printf '%s\n' "$WORKSPACE_CUTOVER_LOCAL_HEALTH_URL"
    return 0
  fi

  local port
  port="$(resolve_cutover_local_port "$file")"
  printf 'http://127.0.0.1:%s/health\n' "$port"
}

local_health_url="$(resolve_cutover_local_health_url "$env_file")"

log() {
  printf '%s %s\n' "$log_prefix" "$*"
}

extract_plist_label() {
  local plist="$1"
  sed -n '/<key>Label<\/key>/{n;s/.*<string>\(.*\)<\/string>.*/\1/p;q;}' "$plist"
}

append_cloudflared_plist() {
  local plist="$1"
  local label existing_label
  label="$(extract_plist_label "$plist")"
  if [ -z "$label" ]; then
    echo "unable to read Label from cloudflared plist: $plist" >&2
    exit 1
  fi

  for existing_label in "${cloudflared_labels[@]+"${cloudflared_labels[@]}"}"; do
    if [ "$existing_label" = "$label" ]; then
      return 0
    fi
  done

  cloudflared_labels+=("$label")
  cloudflared_generated_plists+=("$plist")
  cloudflared_agent_plists+=("$launch_agent_dir/${label}.plist")
}

collect_cloudflared_plists() {
  local plist
  if [ ! -d "$cloudflared_generated_dir" ]; then
    return 0
  fi
  for plist in "$cloudflared_generated_dir"/com.consuelo.os.cloudflared*.plist; do
    [ -e "$plist" ] || continue
    append_cloudflared_plist "$plist"
  done
}

service_labels_csv() {
  local labels="$workspace_label"
  local label
  if [ "$portless_enabled" = "1" ]; then
    labels="$labels, $portless_label"
  fi
  labels="$labels, $watchdog_label"
  for label in "${cloudflared_labels[@]+"${cloudflared_labels[@]}"}"; do
    labels="$labels, $label"
  done
  printf '%s\n' "$labels"
}

derive_connector_health_url() {
  if [ -n "${CONSUELO_CONNECTOR_HEALTH_URL:-}" ]; then
    printf '%s\n' "$CONSUELO_CONNECTOR_HEALTH_URL"
    return 0
  fi

  local config_file="$consuelo_data_home/config.json"
  local bun_bin="${BUN_BIN:-}"
  [ -f "$config_file" ] || return 1
  if [ -z "$bun_bin" ]; then
    bun_bin="$(command -v bun || true)"
  fi
  [ -n "$bun_bin" ] || return 1

  CONSUELO_CONNECTOR_CONFIG_PATH="$config_file" \
    CONSUELO_CONNECTOR_ORIGIN_BASE_DOMAIN="${CONSUELO_CONNECTOR_ORIGIN_BASE_DOMAIN:-consuelohq.com}" \
    "$bun_bin" --print '
(() => {
  const { createHash } = require("node:crypto");
  const { readFileSync } = require("node:fs");
  const config = JSON.parse(readFileSync(process.env.CONSUELO_CONNECTOR_CONFIG_PATH, "utf8"));
  const connectorId = String(config?.connector?.id || "").trim().toLowerCase();
  const baseDomain = String(process.env.CONSUELO_CONNECTOR_ORIGIN_BASE_DOMAIN || "").trim().toLowerCase();
  if (!/^[a-z0-9](?:[a-z0-9._:-]{0,253}[a-z0-9])?$/.test(connectorId)) {
    throw new Error("connector id is missing or invalid");
  }
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(baseDomain)) {
    throw new Error("connector origin base domain is invalid");
  }
  const digest = createHash("sha256")
    .update("consuelo:connector-origin:v1\0" + connectorId)
    .digest("hex")
    .slice(0, 32);
  return "https://c-" + digest + "." + baseDomain + "/health";
})()
'
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
  local label
  log "rolling back user LaunchAgents"
  for label in "${cloudflared_labels[@]+"${cloudflared_labels[@]}"}"; do
    bootout_agent "$label"
  done
  bootout_agent "$watchdog_label"
  if [ "$portless_enabled" = "1" ]; then
    bootout_agent "$portless_label"
  fi
  bootout_agent "$workspace_label"
}

print_repair_hint() {
  log "Consuelo OS services were not healthy after LaunchAgent setup."
  log "Log directory: $log_dir"
  log "System log: $log_dir/system.log"
  if [ "$portless_enabled" = "1" ]; then
    log "Portless log: $log_dir/portless.log"
  fi
  log "Watchdog log: $log_dir/watchdog.log"
  log "Doctor: CONSUELO_HOME=$consuelo_data_home bun --cwd $root_dir run doctor"
  log "Retry services: bash $script_dir/install-system-daemons.sh"
  log "Remove services only: bash $script_dir/uninstall-system-daemons.sh"
  log "Debug details: CONSUELO_OS_DEBUG=1 bash $script_dir/install-system-daemons.sh --debug"
}

print_success_summary() {
  [ "$quiet" = "1" ] && return 0
  log "background service setup complete"
  log "Services: $(service_labels_csv)"
  log "LaunchAgents: $launch_agent_dir"
  log "Logs: $log_dir"
  log "Doctor: CONSUELO_HOME=$consuelo_data_home bun --cwd $root_dir run doctor"
  log "Tokens and secrets are saved in local config/state files and are not printed."
}

print_debug_state() {
  [ "$debug" = "1" ] || return 0
  local label
  launchctl print "$launch_domain/$workspace_label" | sed -n '1,80p'
  if [ "$portless_enabled" = "1" ]; then
    launchctl print "$launch_domain/$portless_label" | sed -n '1,80p'
  fi
  launchctl print "$launch_domain/$watchdog_label" | sed -n '1,80p'
  for label in "${cloudflared_labels[@]+"${cloudflared_labels[@]}"}"; do
    launchctl print "$launch_domain/$label" | sed -n '1,80p'
  done
}

run_generate_daemons() {
  if [ "$debug" = "1" ]; then
    bash "$script_dir/generate-system-daemons.sh"
  else
    bash "$script_dir/generate-system-daemons.sh" >/dev/null
  fi
}

run_plutil_lint() {
  local plists=("$workspace_generated_plist" "$watchdog_generated_plist")
  local plist
  if [ "$portless_enabled" = "1" ]; then
    plists+=("$portless_generated_plist")
  fi
  for plist in "${cloudflared_generated_plists[@]+"${cloudflared_generated_plists[@]}"}"; do
    plists+=("$plist")
  done
  if [ "$debug" = "1" ]; then
    plutil -lint "${plists[@]}"
  else
    plutil -lint "${plists[@]}" >/dev/null
  fi
}

if [ "$dry_run" -eq 0 ]; then
  mkdir -p "$launch_agent_dir" "$log_dir"
fi

run_generate_daemons
if [ -f "$portless_generated_plist" ]; then
  portless_enabled=1
fi
collect_cloudflared_plists

bash -n "$script_dir/start-consuelo-daemon.sh"
bash -n "$script_dir/start-portless-daemon.sh"
bash -n "$script_dir/workspace-watchdog.sh"
bash -n "$script_dir/generate-system-daemons.sh"
bash -n "$script_dir/install-system-daemons.sh"
run_plutil_lint
if [ "$dry_run" -eq 1 ]; then
  log "Services: $(service_labels_csv)"
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
if [ "$portless_enabled" = "1" ]; then
  install -m 644 "$portless_generated_plist" "$portless_agent_plist"
fi
install -m 644 "$watchdog_generated_plist" "$watchdog_agent_plist"
for index in "${!cloudflared_generated_plists[@]}"; do
  install -m 644 "${cloudflared_generated_plists[$index]}" "${cloudflared_agent_plists[$index]}"
done

for label in "${cloudflared_labels[@]+"${cloudflared_labels[@]}"}"; do
  bootout_agent "$label"
done
bootout_agent "$watchdog_label"
if [ "$portless_enabled" = "1" ]; then
  bootout_agent "$portless_label"
fi
bootout_agent "$workspace_label"

bootstrap_agent "$workspace_label" "$workspace_agent_plist"
if [ "$portless_enabled" = "1" ]; then
  bootstrap_agent "$portless_label" "$portless_agent_plist"
fi
for index in "${!cloudflared_labels[@]}"; do
  bootstrap_agent "${cloudflared_labels[$index]}" "${cloudflared_agent_plists[$index]}"
done
bootstrap_agent "$watchdog_label" "$watchdog_agent_plist"

if ! wait_for_health "$local_health_url" 20 1; then
  log "local Consuelo OS health failed after LaunchAgent cutover"
  print_repair_hint
  rollback_agents
  exit 1
fi

if [ "${#cloudflared_labels[@]}" -gt 0 ]; then
  connector_health_url="$(derive_connector_health_url || true)"
  if [ -z "$connector_health_url" ]; then
    log "assigned connector health URL could not be derived after LaunchAgent cutover"
    print_repair_hint
    rollback_agents
    exit 1
  fi
  if ! wait_for_health "$connector_health_url" 40 1; then
    log "assigned connector health failed after LaunchAgent cutover"
    print_repair_hint
    rollback_agents
    exit 1
  fi
fi

print_success_summary
print_debug_state

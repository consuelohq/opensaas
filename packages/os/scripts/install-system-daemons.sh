#!/usr/bin/env bash
set -euo pipefail

dry_run=0
quiet=0
definitions_only=0
debug="${CONSUELO_OS_DEBUG:-0}"
for arg in "$@"; do
  case "$arg" in
    --dry-run) dry_run=1 ;;
    --quiet) quiet=1 ;;
    --definitions-only) definitions_only=1 ;;
    --debug) debug=1 ;;
    --help|-h)
      echo "usage: bash scripts/install-system-daemons.sh [--dry-run] [--definitions-only] [--quiet] [--debug]"
      echo "installs Consuelo OS user LaunchAgents in ~/Library/LaunchAgents"
      echo "  --definitions-only  refresh plist definitions without restarting live services"
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
install_id="${CONSUELO_INSTALL_ID:-}"
background_service_result_file="${CONSUELO_BACKGROUND_SERVICE_RESULT_FILE:-}"
background_service_failure_code="BACKGROUND_SERVICE_INSTALL_FAILED"
stage_pid=""

record_background_service_failure() {
  local status="$1"
  [ "$status" -ne 0 ] || return 0
  if [ -n "$background_service_result_file" ]; then
    {
      printf 'install_id=%s\n' "$install_id"
      printf 'error_code=%s\n' "$background_service_failure_code"
    } > "$background_service_result_file" 2>/dev/null || true
  fi
  if [ -n "$install_id" ]; then
    printf '%s install_id=%s error_code=%s\n' "$log_prefix" "$install_id" "$background_service_failure_code" >&2
  fi
}

cleanup_background_service_install() {
  local status=$?
  if [ -n "$stage_pid" ]; then
    kill "$stage_pid" 2>/dev/null || true
  fi
  record_background_service_failure "$status"
}

trap cleanup_background_service_install EXIT

daemon_user="${CONSUELO_DAEMON_USER:-${USER:-$(id -un)}}"
if ! id -u "$daemon_user" >/dev/null 2>&1; then
  echo "daemon user does not exist: $daemon_user" >&2
  exit 1
fi
daemon_home="${CONSUELO_DAEMON_HOME:-${HOME:-/Users/$daemon_user}}"
consuelo_data_home="${CONSUELO_HOME:-$daemon_home/.consuelo}"
state_env_file="$consuelo_data_home/.env"
launch_agent_dir="$daemon_home/Library/LaunchAgents"
log_dir="${CONSUELO_DAEMON_LOG_DIR:-$consuelo_data_home/node/logs}"
workspace_label="${WORKSPACE_DAEMON_LABEL:-com.consuelo.system}"
caddy_label="${CADDY_DAEMON_LABEL:-com.consuelo.caddy}"
portless_label="${PORTLESS_DAEMON_LABEL:-com.consuelo.portless.system}"
watchdog_label="${WORKSPACE_WATCHDOG_LABEL:-com.consuelo.watchdog}"
availability_label="${CONSUELO_AVAILABILITY_LABEL:-com.consuelo.availability}"
workspace_agent_plist="$launch_agent_dir/${workspace_label}.plist"
caddy_agent_plist="$launch_agent_dir/${caddy_label}.plist"
portless_agent_plist="$launch_agent_dir/${portless_label}.plist"
watchdog_agent_plist="$launch_agent_dir/${watchdog_label}.plist"
availability_agent_plist="$launch_agent_dir/${availability_label}.plist"
# Resolve from the mutable generated directory, falling back to the legacy in-release location so
# a node installed before the move keeps working until its plists are regenerated.
system_generated_dir="${CONSUELO_SECURITY_GENERATED_DIR:-$consuelo_data_home/node/security/generated}"
resolve_generated_plist() {
  local label="$1"
  if [ -f "$system_generated_dir/${label}.plist" ]; then
    printf '%s\n' "$system_generated_dir/${label}.plist"
  else
    printf '%s\n' "$script_dir/generated/${label}.plist"
  fi
}
workspace_generated_plist="$(resolve_generated_plist "$workspace_label")"
caddy_generated_plist="$(resolve_generated_plist "$caddy_label")"
portless_generated_plist="$(resolve_generated_plist "$portless_label")"
watchdog_generated_plist="$(resolve_generated_plist "$watchdog_label")"
availability_generated_plist="$(resolve_generated_plist "$availability_label")"
cloudflared_generated_dir="${CONSUELO_SECURITY_GENERATED_DIR:-$consuelo_data_home/node/security/generated}"
caddyfile="${CONSUELO_CADDYFILE:-$consuelo_data_home/node/caddy/Caddyfile}"
caddy_ingress_port="${CONSUELO_CADDY_INGRESS_PORT:-46320}"
portless_backup_dir="$consuelo_data_home/node/portless-backup"
cloudflared_labels=()
cloudflared_generated_plists=()
cloudflared_agent_plists=()
heartbeat_labels=()
heartbeat_generated_plists=()
heartbeat_agent_plists=()
portless_enabled=0
availability_enabled=0
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

xml_escape() {
  local value="$1"
  value="${value//&/&amp;}"
  value="${value//</&lt;}"
  value="${value//>/&gt;}"
  value="${value//\"/&quot;}"
  value="${value//\'/&apos;}"
  printf '%s\n' "$value"
}

reconcile_cloudflared_plist_binary() {
  local plist="$1"
  local cloudflared_bin="${CLOUDFLARED_BIN:-}"
  if [ -z "$cloudflared_bin" ] || [ ! -x "$cloudflared_bin" ]; then
    echo "managed cloudflared binary is missing or not executable while reconciling: $plist" >&2
    return 1
  fi

  local escaped_bin current_bin
  escaped_bin="$(xml_escape "$cloudflared_bin")"
  current_bin="$(awk '
    /<key>ProgramArguments<\/key>/ { in_args = 1; next }
    in_args {
      start = index($0, "<string>")
      finish = index($0, "</string>")
      if (start > 0 && finish > start) {
        print substr($0, start + length("<string>"), finish - start - length("<string>"))
        exit
      }
      if ($0 ~ /<\/array>/) exit
    }
  ' "$plist")"
  if [ "$current_bin" = "$escaped_bin" ]; then
    return 0
  fi
  if [ "$dry_run" -eq 1 ]; then
    log "dry-run: would update Cloudflared binary in $plist to $cloudflared_bin"
    return 0
  fi

  local temporary_path
  temporary_path="$(mktemp "${plist}.tmp.XXXXXX")"
  if ! awk -v replacement="$escaped_bin" '
    BEGIN { in_args = 0; replaced = 0 }
    {
      if ($0 ~ /<key>ProgramArguments<\/key>/) in_args = 1
      if (in_args && !replaced) {
        start = index($0, "<string>")
        finish = index($0, "</string>")
        if (start > 0 && finish > start) {
          prefix = substr($0, 1, start - 1)
          suffix = substr($0, finish + length("</string>"))
          $0 = prefix "<string>" replacement "</string>" suffix
          replaced = 1
        }
      }
      print
      if (in_args && $0 ~ /<\/array>/) in_args = 0
    }
    END { if (!replaced) exit 42 }
  ' "$plist" > "$temporary_path"; then
    rm -f "$temporary_path"
    echo "unable to rewrite Cloudflared ProgramArguments in plist: $plist" >&2
    return 1
  fi
  chmod 600 "$temporary_path"
  mv "$temporary_path" "$plist"
}

append_cloudflared_plist() {
  local plist="$1"
  local label existing_label
  reconcile_cloudflared_plist_binary "$plist"
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

append_heartbeat_plist() {
  local plist="$1"
  local label existing_label
  label="$(extract_plist_label "$plist")"
  if [ -z "$label" ]; then
    echo "unable to read Label from heartbeat plist: $plist" >&2
    exit 1
  fi

  for existing_label in "${heartbeat_labels[@]+"${heartbeat_labels[@]}"}"; do
    if [ "$existing_label" = "$label" ]; then
      return 0
    fi
  done

  heartbeat_labels+=("$label")
  heartbeat_generated_plists+=("$plist")
  heartbeat_agent_plists+=("$launch_agent_dir/${label}.plist")
}

collect_heartbeat_plists() {
  local plist
  if [ ! -d "$cloudflared_generated_dir" ]; then
    return 0
  fi
  for plist in "$cloudflared_generated_dir"/com.consuelo.os.node-heartbeat*.plist; do
    [ -e "$plist" ] || continue
    append_heartbeat_plist "$plist"
  done
}

service_labels_csv() {
  local labels="$workspace_label, $caddy_label"
  local label
  if [ "$portless_enabled" = "1" ]; then
    labels="$labels, $portless_label"
  fi
  labels="$labels, $watchdog_label"
  if [ "$availability_enabled" = "1" ]; then
    labels="$labels, $availability_label"
  fi
  for label in "${cloudflared_labels[@]+"${cloudflared_labels[@]}"}"; do
    labels="$labels, $label"
  done
  for label in "${heartbeat_labels[@]+"${heartbeat_labels[@]}"}"; do
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

derive_workspace_host() {
  local config_file="$consuelo_data_home/config.json"
  local bun_bin="${BUN_BIN:-}"
  [ -f "$config_file" ] || return 1
  if [ -z "$bun_bin" ]; then
    bun_bin="$(command -v bun || true)"
  fi
  [ -n "$bun_bin" ] || return 1

  CONSUELO_WORKSPACE_CONFIG_PATH="$config_file" "$bun_bin" --print '
(() => {
  const { readFileSync } = require("node:fs");
  const config = JSON.parse(readFileSync(process.env.CONSUELO_WORKSPACE_CONFIG_PATH, "utf8"));
  const host = String(config?.workspace?.host || "").trim().toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) {
    throw new Error("workspace host is missing or invalid");
  }
  return host;
})()
'
}

resolve_caddy_bin() {
  (
    load_env_file "$env_file"
    load_env_file "$state_env_file"
    managed_caddy_bin="$consuelo_data_home/bin/caddy"
    if [ -n "${CADDY_BIN:-}" ]; then
      printf '%s\n' "$CADDY_BIN"
    elif [ -x "$managed_caddy_bin" ]; then
      printf '%s\n' "$managed_caddy_bin"
    else
      command -v caddy || true
    fi
  )
}

resolve_cloudflared_bin() {
  (
    load_env_file "$env_file"
    load_env_file "$state_env_file"
    managed_cloudflared_bin="$consuelo_data_home/bin/cloudflared"
    if [ -n "${CLOUDFLARED_BIN:-}" ] && [ -x "$CLOUDFLARED_BIN" ]; then
      printf '%s\n' "$CLOUDFLARED_BIN"
    elif [ -x "$managed_cloudflared_bin" ]; then
      printf '%s\n' "$managed_cloudflared_bin"
    else
      command -v cloudflared || true
    fi
  )
}

resolve_bun_bin() {
  (
    load_env_file "$env_file"
    load_env_file "$state_env_file"
    if [ -n "${BUN_BIN:-}" ]; then
      printf '%s\n' "$BUN_BIN"
    else
      command -v bun || true
    fi
  )
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

wait_for_workspace_health() {
  wait_for_health "$local_health_url" 20 1
}

wait_for_caddy_health() {
  local workspace_host="$1"
  local url="http://127.0.0.1:${caddy_ingress_port}/health"
  local attempt
  for attempt in $(seq 1 20); do
    if [ "$debug" = "1" ]; then
      if curl --fail --silent --show-error --max-time 5 --header "Host: $workspace_host" "$url" >/dev/null; then
        return 0
      fi
    else
      if curl --fail --silent --max-time 5 --header "Host: $workspace_host" "$url" >/dev/null 2>&1; then
        return 0
      fi
    fi
    sleep 1
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

remove_disabled_agent() {
  local label="$1"
  local plist="$2"
  bootout_agent "$label"
  rm -f "$plist"
}

retire_legacy_portless_services() {
  local legacy_label legacy_plist timestamp
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  for legacy_label in com.consuelo.portless com.consuelo.portless.system; do
    if [ "$portless_enabled" = "1" ] && [ "$legacy_label" = "$portless_label" ]; then
      continue
    fi
    legacy_plist="$launch_agent_dir/${legacy_label}.plist"
    if [ "$dry_run" -eq 1 ]; then
      log "would retire recognized legacy Portless service: $legacy_label"
      continue
    fi
    bootout_agent "$legacy_label"
    if [ -f "$legacy_plist" ]; then
      mkdir -p "$portless_backup_dir"
      mv "$legacy_plist" "$portless_backup_dir/${legacy_label}.${timestamp}.plist"
      log "retired legacy Portless service to $portless_backup_dir"
    fi
  done
}

rollback_agents() {
  local label
  log "rolling back user LaunchAgents"
  for label in "${cloudflared_labels[@]+"${cloudflared_labels[@]}"}"; do
    bootout_agent "$label"
  done
  for label in "${heartbeat_labels[@]+"${heartbeat_labels[@]}"}"; do
    bootout_agent "$label"
  done
  bootout_agent "$watchdog_label"
  if [ "$availability_enabled" = "1" ]; then
    bootout_agent "$availability_label"
  fi
  if [ "$portless_enabled" = "1" ]; then
    bootout_agent "$portless_label"
  fi
  bootout_agent "$caddy_label"
  bootout_agent "$workspace_label"
}

print_repair_hint() {
  log "Consuelo OS services were not healthy after LaunchAgent setup."
  log "Log directory: $log_dir"
  log "System log: $log_dir/system.log"
  log "Caddy log: $log_dir/caddy.log"
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
  launchctl print "$launch_domain/$caddy_label" | sed -n '1,80p'
  if [ "$portless_enabled" = "1" ]; then
    launchctl print "$launch_domain/$portless_label" | sed -n '1,80p'
  fi
  launchctl print "$launch_domain/$watchdog_label" | sed -n '1,80p'
  if [ "$availability_enabled" = "1" ]; then
    launchctl print "$launch_domain/$availability_label" | sed -n '1,80p'
  fi
  for label in "${cloudflared_labels[@]+"${cloudflared_labels[@]}"}"; do
    launchctl print "$launch_domain/$label" | sed -n '1,80p'
  done
  for label in "${heartbeat_labels[@]+"${heartbeat_labels[@]}"}"; do
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
  local plists=("$workspace_generated_plist" "$caddy_generated_plist" "$watchdog_generated_plist")
  local plist
  if [ "$availability_enabled" = "1" ]; then
    plists+=("$availability_generated_plist")
  fi
  if [ "$portless_enabled" = "1" ]; then
    plists+=("$portless_generated_plist")
  fi
  for plist in "${cloudflared_generated_plists[@]+"${cloudflared_generated_plists[@]}"}"; do
    plists+=("$plist")
  done
  for plist in "${heartbeat_generated_plists[@]+"${heartbeat_generated_plists[@]}"}"; do
    plists+=("$plist")
  done
  if [ "$debug" = "1" ]; then
    plutil -lint "${plists[@]}"
  else
    plutil -lint "${plists[@]}" >/dev/null
  fi
}

install_launch_agent_definitions() {
  install -m 644 "$workspace_generated_plist" "$workspace_agent_plist"
  install -m 644 "$caddy_generated_plist" "$caddy_agent_plist"
  if [ "$portless_enabled" = "1" ]; then
    install -m 644 "$portless_generated_plist" "$portless_agent_plist"
  fi
  install -m 644 "$watchdog_generated_plist" "$watchdog_agent_plist"
  if [ "$availability_enabled" = "1" ]; then
    install -m 644 "$availability_generated_plist" "$availability_agent_plist"
  fi
  for index in "${!cloudflared_generated_plists[@]}"; do
    install -m 644 "${cloudflared_generated_plists[$index]}" "${cloudflared_agent_plists[$index]}"
  done
  for index in "${!heartbeat_generated_plists[@]}"; do
    install -m 600 "${heartbeat_generated_plists[$index]}" "${heartbeat_agent_plists[$index]}"
  done
}

if [ "$dry_run" -eq 0 ]; then
  mkdir -p "$launch_agent_dir" "$log_dir" "$consuelo_data_home/node/runtime/watchdog"
fi

run_generate_daemons
if [ -f "$portless_generated_plist" ]; then
  portless_enabled=1
fi
if [ -f "$availability_generated_plist" ]; then
  availability_enabled=1
fi
CLOUDFLARED_BIN="$(resolve_cloudflared_bin)"
export CLOUDFLARED_BIN
collect_cloudflared_plists
collect_heartbeat_plists

bash -n "$script_dir/start-consuelo-daemon.sh"
bash -n "$script_dir/start-caddy-daemon.sh"
bash -n "$script_dir/start-portless-daemon.sh"
bash -n "$script_dir/workspace-watchdog.sh"
bash -n "$script_dir/generate-system-daemons.sh"
bash -n "$script_dir/install-system-daemons.sh"
run_plutil_lint
if [ "$dry_run" -eq 1 ]; then
  retire_legacy_portless_services
  log "Services: $(service_labels_csv)"
  log "dry run complete; generated and linted user LaunchAgent plist files without installing services"
  exit 0
fi

if [ "$definitions_only" -eq 1 ]; then
  background_service_failure_code="BACKGROUND_SERVICE_INSTALL_FAILED"
  install_launch_agent_definitions
  log "LaunchAgent definitions refreshed without restarting services"
  exit 0
fi

caddy_bin="$(resolve_caddy_bin)"
if [ -z "$caddy_bin" ] || [ ! -x "$caddy_bin" ]; then
  log "managed Caddy binary is missing or not executable"
  exit 1
fi
if [ ! -f "$caddyfile" ]; then
  log "managed Caddyfile is missing: $caddyfile"
  exit 1
fi
if ! "$caddy_bin" validate --config "$caddyfile" --adapter caddyfile >/dev/null; then
  log "managed Caddyfile validation failed"
  exit 1
fi

[ "$quiet" = "1" ] || log "running Consuelo OS smoke test on port $stage_port"
background_service_failure_code="BACKGROUND_SERVICE_START_FAILED"
CONSUELO_OS_SINGLE_WORKER_SMOKE_TEST=1 \
  WORKSPACE_DAEMON_PORT="$stage_port" \
  bash "$script_dir/start-consuelo-daemon.sh" > /tmp/consuelo-os-stage.log 2>&1 &
stage_pid=$!
background_service_failure_code="BACKGROUND_SERVICE_HEALTHCHECK_FAILED"
if ! wait_for_health "http://127.0.0.1:${stage_port}/health" 20 1; then
  log "stage Consuelo OS service did not become healthy"
  exit 1
fi
kill "$stage_pid" 2>/dev/null || true
wait "$stage_pid" 2>/dev/null || true
stage_pid=""

retire_legacy_portless_services

background_service_failure_code="BACKGROUND_SERVICE_INSTALL_FAILED"
install_launch_agent_definitions
if [ "$availability_enabled" != "1" ]; then
  remove_disabled_agent "$availability_label" "$availability_agent_plist"
fi

for label in "${cloudflared_labels[@]+"${cloudflared_labels[@]}"}"; do
  bootout_agent "$label"
done
for label in "${heartbeat_labels[@]+"${heartbeat_labels[@]}"}"; do
  bootout_agent "$label"
done
bootout_agent "$watchdog_label"
if [ "$availability_enabled" = "1" ]; then
  bootout_agent "$availability_label"
fi
if [ "$portless_enabled" = "1" ]; then
  bootout_agent "$portless_label"
fi
bootout_agent "$caddy_label"
bootout_agent "$workspace_label"

background_service_failure_code="BACKGROUND_SERVICE_START_FAILED"
if [ "$availability_enabled" = "1" ]; then
  bootstrap_agent "$availability_label" "$availability_agent_plist"
fi
bootstrap_agent "$workspace_label" "$workspace_agent_plist"
bootstrap_agent "$caddy_label" "$caddy_agent_plist"
if [ "$portless_enabled" = "1" ]; then
  bootstrap_agent "$portless_label" "$portless_agent_plist"
fi
for index in "${!cloudflared_labels[@]}"; do
  bootstrap_agent "${cloudflared_labels[$index]}" "${cloudflared_agent_plists[$index]}"
done
for index in "${!heartbeat_labels[@]}"; do
  bootstrap_agent "${heartbeat_labels[$index]}" "${heartbeat_agent_plists[$index]}"
done
bootstrap_agent "$watchdog_label" "$watchdog_agent_plist"

background_service_failure_code="BACKGROUND_SERVICE_HEALTHCHECK_FAILED"
if ! wait_for_workspace_health; then
  log "local Consuelo OS health failed after LaunchAgent cutover"
  print_repair_hint
  rollback_agents
  exit 1
fi

workspace_host="$(derive_workspace_host || true)"
if [ -z "$workspace_host" ]; then
  log "workspace host could not be derived for the managed Caddy ingress check"
  print_repair_hint
  rollback_agents
  exit 1
fi
if ! wait_for_caddy_health "$workspace_host"; then
  log "managed Caddy ingress health failed after LaunchAgent cutover"
  print_repair_hint
  rollback_agents
  exit 1
fi

bun_bin="$(resolve_bun_bin)"
if [ -z "$bun_bin" ] || ! CONSUELO_HOME="$consuelo_data_home" "$bun_bin" "$script_dir/verify-local-agents.ts"; then
  log "configured local-agent MCP transport verification failed after LaunchAgent cutover"
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

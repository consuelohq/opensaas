#!/usr/bin/env bash
set -euo pipefail

dry_run=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) dry_run=1 ;;
    --help|-h)
      echo "usage: bash scripts/uninstall-system-daemons.sh [--dry-run]"
      echo "removes only Consuelo OS user LaunchAgents; it does not delete ~/.consuelo data"
      exit 0
      ;;
    *)
      echo "unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

daemon_user="${CONSUELO_DAEMON_USER:-${USER:-$(id -un)}}"
daemon_home="${CONSUELO_DAEMON_HOME:-${HOME:-/Users/$daemon_user}}"
uid_value="$(id -u "$daemon_user")"
launch_domain="gui/$uid_value"
launch_agent_dir="$daemon_home/Library/LaunchAgents"
workspace_label="${WORKSPACE_DAEMON_LABEL:-com.consuelo.system}"
portless_label="${PORTLESS_DAEMON_LABEL:-com.consuelo.portless.system}"
watchdog_label="${WORKSPACE_WATCHDOG_LABEL:-com.consuelo.watchdog}"
cloudflared_generated_dir="${CONSUELO_SECURITY_GENERATED_DIR:-$daemon_home/.consuelo/os/security/generated}"
cloudflared_labels=()

log() {
  printf '[consuelo-os-launchagent-uninstall] %s
' "$*"
}

extract_plist_label() {
  local plist="$1"
  sed -n '/<key>Label<\/key>/{n;s/.*<string>\(.*\)<\/string>.*/\1/p;q;}' "$plist"
}

append_cloudflared_label() {
  local label="$1"
  local existing_label
  [ -n "$label" ] || return 0
  for existing_label in "${cloudflared_labels[@]+"${cloudflared_labels[@]}"}"; do
    if [ "$existing_label" = "$label" ]; then
      return 0
    fi
  done
  cloudflared_labels+=("$label")
}

collect_cloudflared_labels() {
  local plist label
  for plist in "$launch_agent_dir"/com.consuelo.os.cloudflared*.plist; do
    [ -e "$plist" ] || continue
    label="$(extract_plist_label "$plist")"
    append_cloudflared_label "${label:-$(basename "$plist" .plist)}"
  done
  if [ -d "$cloudflared_generated_dir" ]; then
    for plist in "$cloudflared_generated_dir"/com.consuelo.os.cloudflared*.plist; do
      [ -e "$plist" ] || continue
      label="$(extract_plist_label "$plist")"
      append_cloudflared_label "${label:-$(basename "$plist" .plist)}"
    done
  fi
}

remove_agent() {
  local label="$1"
  local plist="$launch_agent_dir/${label}.plist"

  if [ "$dry_run" -eq 1 ]; then
    log "dry-run: would unload $launch_domain/$label"
    log "dry-run: would remove $plist"
    return 0
  fi

  launchctl bootout "$launch_domain/$label" 2>/dev/null || true
  if [ -e "$plist" ]; then
    rm -f "$plist"
    log "removed: $plist"
  else
    log "already absent: $plist"
  fi
}

collect_cloudflared_labels

remove_agent "$watchdog_label"
remove_agent "$portless_label"
remove_agent "$workspace_label"
for cloudflared_label in "${cloudflared_labels[@]+"${cloudflared_labels[@]}"}"; do
  remove_agent "$cloudflared_label"
done

if [ "$dry_run" -eq 1 ]; then
  log "dry run complete; no LaunchAgents changed"
else
  log "Consuelo OS LaunchAgents removed. Data preserved at $daemon_home/.consuelo/os"
fi

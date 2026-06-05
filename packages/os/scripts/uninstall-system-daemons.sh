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

log() {
  printf '[consuelo-os-launchagent-uninstall] %s
' "$*"
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

remove_agent "$watchdog_label"
remove_agent "$portless_label"
remove_agent "$workspace_label"

if [ "$dry_run" -eq 1 ]; then
  log "dry run complete; no LaunchAgents changed"
else
  log "Consuelo OS LaunchAgents removed. Data preserved at $daemon_home/.consuelo/os"
fi

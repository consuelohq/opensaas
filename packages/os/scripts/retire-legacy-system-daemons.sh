#!/bin/bash
set -u

mode="${1:---check}"
case "$mode" in
  --check|--dry-run|--apply) ;;
  *)
    echo "usage: retire-legacy-system-daemons.sh [--check|--dry-run|--apply]" >&2
    exit 64
    ;;
esac

if [ "$(uname -s 2>/dev/null || true)" != "Darwin" ]; then
  echo "No recognized legacy Consuelo system LaunchDaemons found."
  exit 0
fi

legacy_dir="${CONSUELO_LEGACY_LAUNCH_DAEMON_DIR:-/Library/LaunchDaemons}"
backup_root="${CONSUELO_LEGACY_LAUNCH_DAEMON_BACKUP_DIR:-/Library/Application Support/Consuelo/LegacyLaunchDaemons}"
plist_buddy="/usr/libexec/PlistBuddy"

labels=(
  "com.consuelo.workspace.system"
  "com.consuelo.portless.system"
  "com.consuelo.workspace.watchdog"
)

expected_script_suffix() {
  case "$1" in
    com.consuelo.workspace.system) printf '%s\n' '/packages/workspace/scripts/start-brain-daemon.sh' ;;
    com.consuelo.portless.system) printf '%s\n' '/packages/workspace/scripts/start-portless-daemon.sh' ;;
    com.consuelo.workspace.watchdog) printf '%s\n' '/packages/workspace/scripts/workspace-watchdog.sh' ;;
    *) return 1 ;;
  esac
}

recognized=()
unsafe=()
for label in "${labels[@]}"; do
  plist="$legacy_dir/$label.plist"
  [ -e "$plist" ] || continue
  if [ -L "$plist" ] || [ ! -f "$plist" ]; then
    unsafe+=("$plist")
    continue
  fi
  actual_label="$($plist_buddy -c 'Print :Label' "$plist" 2>/dev/null || true)"
  arg0="$($plist_buddy -c 'Print :ProgramArguments:0' "$plist" 2>/dev/null || true)"
  arg1="$($plist_buddy -c 'Print :ProgramArguments:1' "$plist" 2>/dev/null || true)"
  suffix="$(expected_script_suffix "$label")"
  case "$arg1" in
    *"$suffix") script_matches=1 ;;
    *) script_matches=0 ;;
  esac
  if [ "$actual_label" != "$label" ] || [ "$arg0" != "/bin/bash" ] || [ "$script_matches" -ne 1 ]; then
    unsafe+=("$plist")
    continue
  fi
  recognized+=("$label")
done

if [ "${#unsafe[@]}" -gt 0 ]; then
  echo "Refusing to modify unrecognized legacy Consuelo LaunchDaemon file(s):" >&2
  for path in "${unsafe[@]}"; do echo "  $path" >&2; done
  echo "The filename is known but its Label/ProgramArguments do not match the historical Consuelo contract." >&2
  exit 3
fi

if [ "${#recognized[@]}" -eq 0 ]; then
  echo "No recognized legacy Consuelo system LaunchDaemons found."
  exit 0
fi

echo "Recognized legacy Consuelo system LaunchDaemons:"
for label in "${recognized[@]}"; do echo "  $label"; done

if [ "$mode" = "--check" ]; then
  exit 2
fi

if [ "$mode" = "--dry-run" ]; then
  for label in "${recognized[@]}"; do
    echo "would: launchctl bootout system/$label"
    echo "would: retire $legacy_dir/$label.plist"
  done
  exit 0
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "Retiring legacy Consuelo system LaunchDaemons requires administrator privileges." >&2
  echo "Run: sudo bash '$0' --apply" >&2
  exit 4
fi

stamp="$(date -u '+%Y%m%dT%H%M%SZ')"
backup_dir="$backup_root/$stamp"
/bin/mkdir -p "$backup_dir"
/bin/chmod 700 "$backup_dir"

for label in "${recognized[@]}"; do
  plist="$legacy_dir/$label.plist"
  if /bin/launchctl print "system/$label" >/dev/null 2>&1; then
    if ! /bin/launchctl bootout "system/$label"; then
      echo "Failed to unload legacy service $label; refusing to move its plist." >&2
      exit 5
    fi
  fi
  /bin/mv "$plist" "$backup_dir/$label.plist"
  echo "Retired $label -> $backup_dir/$label.plist"
done

for label in "${recognized[@]}"; do
  if /bin/launchctl print "system/$label" >/dev/null 2>&1; then
    echo "Legacy service $label is still loaded after retirement." >&2
    exit 5
  fi
  if [ -e "$legacy_dir/$label.plist" ]; then
    echo "Legacy plist $legacy_dir/$label.plist still exists after retirement." >&2
    exit 5
  fi
done

echo "Legacy Consuelo system LaunchDaemons retired. Current user-level Consuelo services were not modified."

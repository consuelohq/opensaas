#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$script_dir/.." && pwd)"
generated_dir="$script_dir/generated"
env_file="$root_dir/.env"
mkdir -p "$generated_dir"

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

sanitize_label() {
  local fallback="$1"
  local raw="$2"
  local sanitized
  sanitized="$(printf '%s' "$raw" | tr -c 'A-Za-z0-9._-' '_')"
  while [[ "$sanitized" == *..* ]]; do
    sanitized="${sanitized//../_}"
  done
  sanitized="${sanitized#.}"
  sanitized="${sanitized#/}"
  if [ -z "$sanitized" ]; then
    sanitized="$fallback"
  fi
  printf '%s\n' "$sanitized"
}

xml_escape() {
  printf '%s' "$1" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g; s/"/\&quot;/g; s/'"'"'/\&apos;/g'
}

load_env_file "$env_file"

consuelo_user="${CONSUELO_DAEMON_USER:-${USER:-$(id -un)}}"
if ! id -u "$consuelo_user" >/dev/null 2>&1; then
  echo "daemon user does not exist: $consuelo_user" >&2
  exit 1
fi
consuelo_home="${CONSUELO_DAEMON_HOME:-${HOME:-/Users/$consuelo_user}}"
log_dir="${CONSUELO_DAEMON_LOG_DIR:-$root_dir/logs}"
workspace_label="$(sanitize_label 'com.consuelo.system' "${WORKSPACE_DAEMON_LABEL:-com.consuelo.system}")"
portless_label="$(sanitize_label 'com.consuelo.portless.system' "${PORTLESS_DAEMON_LABEL:-com.consuelo.portless.system}")"
watchdog_label="$(sanitize_label 'com.consuelo.watchdog' "${WORKSPACE_WATCHDOG_LABEL:-com.consuelo.watchdog}")"
workspace_path="${WORKSPACE_DAEMON_PATH:-/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin}"
portless_path="${PORTLESS_DAEMON_PATH:-/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin}"
watchdog_path="${WORKSPACE_WATCHDOG_PATH:-/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin}"
bun_bin="$(xml_escape "${BUN_BIN:-}")"
portless_bin="$(xml_escape "${PORTLESS_BIN:-}")"

cat > "$generated_dir/${workspace_label}.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${workspace_label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${root_dir}/scripts/start-consuelo-daemon.sh</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>WorkingDirectory</key>
  <string>${root_dir}</string>
  <key>StandardOutPath</key>
  <string>${log_dir}/system.log</string>
  <key>StandardErrorPath</key>
  <string>${log_dir}/system.log</string>
  <key>ThrottleInterval</key>
  <integer>5</integer>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>${consuelo_home}</string>
    <key>USER</key>
    <string>${consuelo_user}</string>
    <key>WORKSPACE_DAEMON_HOME</key>
    <string>${consuelo_home}</string>
    <key>WORKSPACE_DAEMON_USER</key>
    <string>${consuelo_user}</string>
    <key>WORKSPACE_DAEMON_PATH</key>
    <string>${workspace_path}</string>
    <key>BUN_BIN</key>
    <string>${bun_bin}</string>
  </dict>
</dict>
</plist>
PLIST

cat > "$generated_dir/${portless_label}.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${portless_label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${root_dir}/scripts/start-portless-daemon.sh</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>WorkingDirectory</key>
  <string>${consuelo_home}</string>
  <key>StandardOutPath</key>
  <string>${log_dir}/portless.log</string>
  <key>StandardErrorPath</key>
  <string>${log_dir}/portless.log</string>
  <key>ThrottleInterval</key>
  <integer>5</integer>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>${consuelo_home}</string>
    <key>USER</key>
    <string>${consuelo_user}</string>
    <key>PORTLESS_DAEMON_HOME</key>
    <string>${consuelo_home}</string>
    <key>PORTLESS_DAEMON_USER</key>
    <string>${consuelo_user}</string>
    <key>PORTLESS_DAEMON_PATH</key>
    <string>${portless_path}</string>
    <key>PORTLESS_BIN</key>
    <string>${portless_bin}</string>
  </dict>
</dict>
</plist>
PLIST

cat > "$generated_dir/${watchdog_label}.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${watchdog_label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${root_dir}/scripts/workspace-watchdog.sh</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>WorkingDirectory</key>
  <string>${root_dir}</string>
  <key>StandardOutPath</key>
  <string>${log_dir}/watchdog.log</string>
  <key>StandardErrorPath</key>
  <string>${log_dir}/watchdog.log</string>
  <key>ThrottleInterval</key>
  <integer>5</integer>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${watchdog_path}</string>
  </dict>
</dict>
</plist>
PLIST

echo "generated user LaunchAgent plists in $generated_dir"

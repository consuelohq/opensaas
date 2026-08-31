#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$script_dir/.." && pwd)"
# Generated plists must not land inside the runtime release: that directory is an immutable,
# fingerprinted bundle, and writing into it makes every node that has ever started its services
# report installState "corrupt" because the files are absent from the bundle manifest. This is the
# same mutable location the cloudflared plist already uses.
generated_dir="${CONSUELO_SECURITY_GENERATED_DIR:-${CONSUELO_HOME:-$HOME/.consuelo}/node/security/generated}"
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
consuelo_data_home="${CONSUELO_HOME:-$consuelo_home/.consuelo}"
managed_runtime_root="$consuelo_data_home/runtime/current"
if [ ! -e "$managed_runtime_root" ]; then
  managed_runtime_root="$root_dir"
fi
persisted_env_file="$consuelo_data_home/.env"
if [ "$persisted_env_file" != "$env_file" ]; then
  load_env_file "$persisted_env_file"
fi
log_dir="${CONSUELO_DAEMON_LOG_DIR:-$consuelo_data_home/node/logs}"
workspace_label="$(sanitize_label 'com.consuelo.system' "${WORKSPACE_DAEMON_LABEL:-com.consuelo.system}")"
caddy_label="$(sanitize_label 'com.consuelo.caddy' "${CADDY_DAEMON_LABEL:-com.consuelo.caddy}")"
portless_label="$(sanitize_label 'com.consuelo.portless.system' "${PORTLESS_DAEMON_LABEL:-com.consuelo.portless.system}")"
watchdog_label="$(sanitize_label 'com.consuelo.watchdog' "${WORKSPACE_WATCHDOG_LABEL:-com.consuelo.watchdog}")"
availability_label="$(sanitize_label 'com.consuelo.availability' "${CONSUELO_AVAILABILITY_LABEL:-com.consuelo.availability}")"
workspace_path="${WORKSPACE_DAEMON_PATH:-/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin}"
caddy_path="${CADDY_DAEMON_PATH:-/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin}"
portless_path="${PORTLESS_DAEMON_PATH:-/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin}"
watchdog_path="${WORKSPACE_WATCHDOG_PATH:-/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin}"
watchdog_interval_seconds="${WORKSPACE_WATCHDOG_INTERVAL_SECONDS:-30}"
watchdog_local_port="${WORKSPACE_WATCHDOG_LOCAL_PORT:-${CONSUELO_CADDY_INGRESS_PORT:-46320}}"
availability_enabled="${CONSUELO_AVAILABILITY_ENABLED:-0}"
case "$watchdog_interval_seconds" in
  ''|*[!0-9]*)
    echo "invalid WORKSPACE_WATCHDOG_INTERVAL_SECONDS: $watchdog_interval_seconds" >&2
    exit 1
    ;;
esac
if [ "$watchdog_interval_seconds" -lt 1 ]; then
  echo "WORKSPACE_WATCHDOG_INTERVAL_SECONDS must be greater than zero" >&2
  exit 1
fi
case "$watchdog_local_port" in
  ''|*[!0-9]*)
    echo "invalid WORKSPACE_WATCHDOG_LOCAL_PORT: $watchdog_local_port" >&2
    exit 1
    ;;
esac
if [ "$watchdog_local_port" -lt 1 ] || [ "$watchdog_local_port" -gt 65535 ]; then
  echo "WORKSPACE_WATCHDOG_LOCAL_PORT must be between 1 and 65535" >&2
  exit 1
fi
bun_bin="$(xml_escape "${BUN_BIN:-}")"
caddy_bin="$(xml_escape "${CADDY_BIN:-}")"
portless_bin="$(xml_escape "${PORTLESS_BIN:-}")"
portless_allow_path_lookup="${PORTLESS_ALLOW_PATH_LOOKUP:-0}"
if [ -z "${PORTLESS_BIN:-}" ] && [ ! -f "$env_file" ]; then
  portless_allow_path_lookup="1"
fi
portless_enabled="${PORTLESS_ENABLED:-0}"
portless_should_generate="0"
case "$portless_enabled" in
  0|false|no)
    portless_should_generate="0"
    ;;
  1|true|yes)
    portless_should_generate="1"
    if [ -z "${PORTLESS_BIN:-}" ]; then
      portless_allow_path_lookup="1"
    fi
    ;;
  *)
    if [ -n "${PORTLESS_BIN:-}" ]; then
      portless_should_generate="1"
    elif [ ! -f "$env_file" ] && PATH="$portless_path" command -v portless >/dev/null 2>&1; then
      portless_should_generate="1"
      portless_allow_path_lookup="1"
    fi
    ;;
esac
if [ "$portless_should_generate" != "1" ]; then
  rm -f "$generated_dir/${portless_label}.plist"
fi
case "$availability_enabled" in
  0|false|no) rm -f "$generated_dir/${availability_label}.plist" ;;
  *) availability_enabled="1" ;;
esac
portless_allow_path_lookup="$(xml_escape "$portless_allow_path_lookup")"

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
    <string>${managed_runtime_root}/scripts/start-consuelo-daemon.sh</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>WorkingDirectory</key>
  <string>${managed_runtime_root}</string>
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
    <key>WORKSPACE_DAEMON_CONSUELO_HOME</key>
    <string>${consuelo_data_home}</string>
    <!-- Canonical name. Runtime code reads CONSUELO_HOME; exporting only the WORKSPACE_DAEMON_
         prefixed form left it unset inside the server process, so anything resolving the OS home
         from the environment silently fell back to the runtime release directory. -->
    <key>CONSUELO_HOME</key>
    <string>${consuelo_data_home}</string>
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

if [ "$availability_enabled" = "1" ]; then
cat > "$generated_dir/${availability_label}.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${availability_label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/caffeinate</string>
    <string>-s</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>${log_dir}/availability.log</string>
  <key>StandardErrorPath</key>
  <string>${log_dir}/availability.log</string>
  <key>ThrottleInterval</key>
  <integer>10</integer>
</dict>
</plist>
PLIST
fi

cat > "$generated_dir/${caddy_label}.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${caddy_label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${managed_runtime_root}/scripts/start-caddy-daemon.sh</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>WorkingDirectory</key>
  <string>${managed_runtime_root}</string>
  <key>StandardOutPath</key>
  <string>${log_dir}/caddy.log</string>
  <key>StandardErrorPath</key>
  <string>${log_dir}/caddy.log</string>
  <key>ThrottleInterval</key>
  <integer>5</integer>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>${consuelo_home}</string>
    <key>USER</key>
    <string>${consuelo_user}</string>
    <key>CADDY_DAEMON_HOME</key>
    <string>${consuelo_home}</string>
    <key>CADDY_DAEMON_CONSUELO_HOME</key>
    <string>${consuelo_data_home}</string>
    <key>CADDY_DAEMON_USER</key>
    <string>${consuelo_user}</string>
    <key>CADDY_DAEMON_PATH</key>
    <string>${caddy_path}</string>
    <key>CADDY_BIN</key>
    <string>${caddy_bin}</string>
  </dict>
</dict>
</plist>
PLIST

if [ "$portless_should_generate" = "1" ]; then
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
    <string>${managed_runtime_root}/scripts/start-portless-daemon.sh</string>
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
    <key>PORTLESS_ALLOW_PATH_LOOKUP</key>
    <string>${portless_allow_path_lookup}</string>
  </dict>
</dict>
</plist>
PLIST

fi
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
    <string>${managed_runtime_root}/scripts/workspace-watchdog.sh</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>StartInterval</key>
  <integer>${watchdog_interval_seconds}</integer>
  <key>ProcessType</key>
  <string>Background</string>
  <key>WorkingDirectory</key>
  <string>${managed_runtime_root}</string>
  <key>StandardOutPath</key>
  <string>${log_dir}/watchdog.log</string>
  <key>StandardErrorPath</key>
  <string>${log_dir}/watchdog.log</string>
  <key>ThrottleInterval</key>
  <integer>5</integer>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>${consuelo_home}</string>
    <key>CONSUELO_HOME</key>
    <string>${consuelo_data_home}</string>
    <key>PATH</key>
    <string>${watchdog_path}</string>
    <key>WORKSPACE_DAEMON_LABEL</key>
    <string>${workspace_label}</string>
    <key>WORKSPACE_WATCHDOG_CADDY_LABEL</key>
    <string>${caddy_label}</string>
    <key>PORTLESS_DAEMON_LABEL</key>
    <string>${portless_label}</string>
    <key>WORKSPACE_WATCHDOG_LOCAL_PORT</key>
    <string>${watchdog_local_port}</string>
    <key>WORKSPACE_WATCHDOG_LOCAL_URL</key>
    <string>http://127.0.0.1:${watchdog_local_port}/health</string>
  </dict>
</dict>
</plist>
PLIST

echo "generated user LaunchAgent plists in $generated_dir"

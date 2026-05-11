#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$script_dir/.." && pwd)"
generated_dir="$script_dir/generated"
env_file="$root_dir/.env"
mkdir -p "$generated_dir"

if [ -f "$env_file" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a
fi

consuelo_user="${CONSUELO_DAEMON_USER:-kokayi}"
consuelo_home="${CONSUELO_DAEMON_HOME:-/Users/$consuelo_user}"
log_dir="${CONSUELO_DAEMON_LOG_DIR:-$consuelo_home/Library/Logs/Consuelo}"
workspace_label="${WORKSPACE_DAEMON_LABEL:-com.consuelo.workspace.system}"
portless_label="${PORTLESS_DAEMON_LABEL:-com.consuelo.portless.system}"
watchdog_label="${WORKSPACE_WATCHDOG_LABEL:-com.consuelo.workspace.watchdog}"
workspace_path="${WORKSPACE_DAEMON_PATH:-/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin}"
portless_path="${PORTLESS_DAEMON_PATH:-/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin}"
watchdog_path="${WORKSPACE_WATCHDOG_PATH:-/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin}"

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
    <string>${root_dir}/scripts/start-brain-daemon.sh</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>UserName</key>
  <string>${consuelo_user}</string>
  <key>WorkingDirectory</key>
  <string>${root_dir}</string>
  <key>StandardOutPath</key>
  <string>${log_dir}/workspace-daemon.log</string>
  <key>StandardErrorPath</key>
  <string>${log_dir}/workspace-daemon.log</string>
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
  <key>UserName</key>
  <string>${consuelo_user}</string>
  <key>WorkingDirectory</key>
  <string>${consuelo_home}</string>
  <key>StandardOutPath</key>
  <string>${log_dir}/portless-daemon.log</string>
  <key>StandardErrorPath</key>
  <string>${log_dir}/portless-daemon.log</string>
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
  <string>${log_dir}/workspace-watchdog.log</string>
  <key>StandardErrorPath</key>
  <string>${log_dir}/workspace-watchdog.log</string>
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

echo "generated system daemon plists in $generated_dir"

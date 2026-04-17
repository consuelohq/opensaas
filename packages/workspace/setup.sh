#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
generated_dir="$root_dir/scripts/generated"
env_file="$root_dir/.env"
venv_dir="$root_dir/.venv"

mkdir -p "$generated_dir"

if [ ! -d "$venv_dir" ]; then
  python3 -m venv "$venv_dir"
fi

"$venv_dir/bin/pip" install --upgrade pip >/dev/null
"$venv_dir/bin/pip" install -r "$root_dir/requirements.txt"

if [ ! -f "$env_file" ]; then
  cp "$root_dir/.env.example" "$env_file"
  echo "wrote $env_file"
fi

if [ ! -f "$root_dir/BRAIN.md" ]; then
  cp "$root_dir/BRAIN.example.md" "$root_dir/BRAIN.md"
  echo "wrote $root_dir/BRAIN.md"
fi

if [ -f "$env_file" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a
fi

workspace_dir="${WORKSPACE_DIR:-$root_dir}"
port="${PORT:-8850}"
hostname_value="${MCP_SERVER_URL:-https://your-mcp-hostname.example.com}"
hostname_only="${hostname_value#http://}"
hostname_only="${hostname_only#https://}"
hostname_only="${hostname_only%%/*}"
tunnel_name="${CLOUDFLARE_TUNNEL_NAME:-workspace}"

cat > "$generated_dir/openworkspace.server.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.openworkspace.server</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$root_dir/scripts/start-brain.sh</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>WorkingDirectory</key>
  <string>$root_dir</string>
  <key>StandardOutPath</key>
  <string>/tmp/openworkspace.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/openworkspace.log</string>
</dict>
</plist>
PLIST

cat > "$generated_dir/openworkspace.chat-export.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.openworkspace.chat-export</string>
  <key>ProgramArguments</key>
  <array>
    <string>$venv_dir/bin/python3</string>
    <string>$root_dir/scripts/export-chats.py</string>
  </array>
  <key>StartCalendarInterval</key>
  <array>
    <dict><key>Hour</key><integer>8</integer><key>Minute</key><integer>0</integer></dict>
    <dict><key>Hour</key><integer>20</integer><key>Minute</key><integer>0</integer></dict>
  </array>
  <key>StandardOutPath</key>
  <string>/tmp/openworkspace-chat-export.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/openworkspace-chat-export.log</string>
</dict>
</plist>
PLIST

cat > "$generated_dir/cloudflared-config.yml" <<YAML
tunnel: $tunnel_name
ingress:
  - hostname: $hostname_only
    service: http://localhost:$port
  - service: http_status:404
YAML

if command -v cloudflared >/dev/null 2>&1; then
  if [ -n "$hostname_only" ] && [ "$hostname_only" != "your-mcp-hostname.example.com" ]; then
    echo "cloudflared detected. login if needed, then run:"
    echo "  cloudflared tunnel create $tunnel_name"
    echo "  cloudflared tunnel route dns $tunnel_name $hostname_only"
  fi
else
  echo "cloudflared not found. install it manually if you want tunnel automation."
fi

bash "$root_dir/scripts/generate-system-daemons.sh"

echo
echo "setup complete"
echo "workspace dir: $workspace_dir"
echo "generated files: $generated_dir"
echo "start server: $venv_dir/bin/python3 $root_dir/server.py"
echo "install system daemons: sudo $root_dir/scripts/install-system-daemons.sh"

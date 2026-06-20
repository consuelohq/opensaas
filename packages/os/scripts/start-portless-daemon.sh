#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$script_dir/.." && pwd)"
env_file="$root_dir/.env"

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

load_env_file "$env_file"

export HOME="${PORTLESS_DAEMON_HOME:-${HOME:-/Users/$(id -un)}}"
export USER="${PORTLESS_DAEMON_USER:-${USER:-$(id -un)}}"
export PATH="${PORTLESS_DAEMON_PATH:-/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin}"
export PORTLESS_HTTPS="${PORTLESS_HTTPS:-1}"

portless_bin="${PORTLESS_BIN:-}"
if [ -n "$portless_bin" ] && [ ! -x "$portless_bin" ]; then
  echo "configured PORTLESS_BIN is not executable: $portless_bin" >&2
  exit 1
fi
if [ -z "$portless_bin" ] && [ "${PORTLESS_ALLOW_PATH_LOOKUP:-0}" = "1" ]; then
  portless_bin="$(command -v portless || true)"
fi
if [ -z "$portless_bin" ]; then
  echo "portless binary not configured. Set PORTLESS_BIN in $env_file or PORTLESS_ALLOW_PATH_LOOKUP=1." >&2
  exit 1
fi

exec "$portless_bin" proxy start --https --foreground

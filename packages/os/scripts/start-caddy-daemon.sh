#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$script_dir/.." && pwd)"
env_file="$root_dir/.env"

load_env_file() {
  local file="$1"
  [ -f "$file" ] || return 0

  local line key value
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ''|'#'*) continue ;;
    esac
    key="${line%%=*}"
    value="${line#*=}"
    [ "$key" != "$line" ] || continue
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

unset WORKSPACE_MCP_TOKEN
unset INTERNAL_CONSUELO_API_KEY
unset CLOUDFLARE_API_TOKEN

export HOME="${CADDY_DAEMON_HOME:-${HOME:-/Users/$(id -un)}}"
export USER="${CADDY_DAEMON_USER:-${USER:-$(id -un)}}"
export PATH="${CADDY_DAEMON_PATH:-/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin}"
export CONSUELO_HOME="${CADDY_DAEMON_CONSUELO_HOME:-${CONSUELO_HOME:-$HOME/.consuelo}}"

caddy_bin="${CADDY_BIN:-}"
caddyfile="${CONSUELO_CADDYFILE:-$CONSUELO_HOME/node/caddy/Caddyfile}"

if [ -z "$caddy_bin" ] || [ ! -x "$caddy_bin" ]; then
  echo "configured CADDY_BIN is missing or not executable: ${caddy_bin:-unset}" >&2
  exit 1
fi
if [ ! -f "$caddyfile" ]; then
  echo "generated Caddyfile is missing: $caddyfile" >&2
  exit 1
fi

"$caddy_bin" validate --config "$caddyfile" --adapter caddyfile
exec "$caddy_bin" run --config "$caddyfile" --adapter caddyfile

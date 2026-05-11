#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(cd "$script_dir/.." && pwd)"
env_file="$root_dir/.env"

if [ -f "$env_file" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a
fi

export HOME="${PORTLESS_DAEMON_HOME:-${HOME:-/Users/kokayi}}"
export USER="${PORTLESS_DAEMON_USER:-${USER:-kokayi}}"
export PATH="${PORTLESS_DAEMON_PATH:-/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin}"
export PORTLESS_HTTPS="${PORTLESS_HTTPS:-1}"

portless_bin="${PORTLESS_BIN:-}"
if [ -z "$portless_bin" ]; then
  portless_bin="$(command -v portless || true)"
fi
if [ -z "$portless_bin" ]; then
  echo "portless binary not found in PATH=$PATH" >&2
  exit 1
fi

exec "$portless_bin" proxy start --https --foreground

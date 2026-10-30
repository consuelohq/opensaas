#!/bin/sh
# agent-browser executable override: do not let Chrome inherit an undrained pipe.
# Keep fds 3+ intact for Chrome's DevTools pipe and preserve all Chrome argv.
if [ -z "${CONSUELO_BROWSER_CHROME_BINARY:-}" ]; then
  printf '%s\n' 'Consuelo Chrome executable is not configured' >&2
  exit 127
fi
exec "$CONSUELO_BROWSER_CHROME_BINARY" "$@" </dev/null >/dev/null 2>/dev/null

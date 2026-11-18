#!/bin/sh
# agent-browser executable override: do not let Chrome inherit an undrained pipe.
# Keep fds 3+ intact for Chrome's DevTools pipe and preserve all Chrome argv.
if [ -z "${CONSUELO_BROWSER_CHROME_BINARY:-}" ]; then
  printf '%s\n' 'Consuelo Chrome executable is not configured' >&2
  exit 127
fi
# Dia nests Chromium's user data one level below the supplied directory.
# agent-browser watches the Chromium directory for DevToolsActivePort.
if [ -n "${CONSUELO_BROWSER_DIA_PROFILE:-}" ]; then
  for argument do
    shift
    if [ "$argument" = "--user-data-dir=$CONSUELO_BROWSER_DIA_PROFILE/User Data" ]; then
      argument="--user-data-dir=$CONSUELO_BROWSER_DIA_PROFILE"
    fi
    set -- "$@" "$argument"
  done
fi
exec "$CONSUELO_BROWSER_CHROME_BINARY" "$@" </dev/null >/dev/null 2>/dev/null

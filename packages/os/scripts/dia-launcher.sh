#!/bin/sh
# Dia nests Chromium state below the supplied directory. Agent Browser watches
# that nested directory for DevToolsActivePort, so rewrite only our profile.
: "${CONSUELO_BROWSER_DIA_PROFILE:?managed Dia profile is required}"
for argument do
  shift
  if [ "$argument" = "--user-data-dir=$CONSUELO_BROWSER_DIA_PROFILE/User Data" ]; then
    argument="--user-data-dir=$CONSUELO_BROWSER_DIA_PROFILE"
  fi
  set -- "$@" "$argument"
done
exec /Applications/Dia.app/Contents/MacOS/Dia "$@" </dev/null >/dev/null 2>/dev/null

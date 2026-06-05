#!/usr/bin/env bash
set -euo pipefail

PROGRAM="Consuelo OS bootstrap"
HOSTED_INSTALL_COMMAND="curl -fsSL https://install.consuelohq.com/os | bash"
HOSTED_INSTALL_COMMAND_WITH_ARGS="curl -fsSL https://install.consuelohq.com/os | bash -s --"
OS_HOME="${CONSUELO_HOME:-$HOME/.consuelo/os}"
DEFAULT_SOURCE_DIR="${TMPDIR:-/tmp}/consuelo-os-source"
SOURCE_DIR="${CONSUELO_OS_SOURCE_DIR:-$DEFAULT_SOURCE_DIR}"
REPO_ARCHIVE_URL="${CONSUELO_OS_REPO_ARCHIVE_URL:-https://github.com/consuelohq/opensaas/archive/refs/heads/main.tar.gz}"

DRY_RUN=0
YES=0
NO_INSTALL_BUN=0
INSTALL_DAEMONS=0
SKIP_DAEMONS=0
JSON=0
REFRESH_SOURCE=0
DEBUG="${CONSUELO_OS_DEBUG:-0}"

BUN_BIN=""
REPO_DIR=""
ONBOARDING_STATUS="pending"
DAEMON_STATUS="pending"
BUN_STATUS="pending"
SOURCE_STATUS="pending"
ONBOARDING_JSON=""
DEPENDENCY_STATUS="pending"

usage() {
  cat <<'USAGE'
Usage: bash packages/os/scripts/bootstrap.sh [options]

Hosted first-time install:
  curl -fsSL https://install.consuelohq.com/os | bash

Repo-local testing:
  bash packages/os/scripts/bootstrap.sh --dry-run
  bash packages/os/scripts/bootstrap.sh --yes
  bash packages/os/scripts/bootstrap.sh --yes --install-daemons
  bash packages/os/scripts/bootstrap.sh --yes --skip-daemons
  bash packages/os/scripts/bootstrap.sh --yes --refresh-source

Options:
  --dry-run          print what would happen without installing Bun or LaunchAgents
  --yes             accept required prerequisite setup and run onboarding without prompts
  --no-install-bun  fail with manual instructions if Bun is missing
  --install-daemons install user LaunchAgents after onboarding
  --skip-daemons    skip user LaunchAgent setup after onboarding
  --refresh-source  refresh an existing hosted source checkout/archive before onboarding
  --json            print a machine-readable summary at the end
  --debug           print detailed daemon diagnostics
  --help, -h        show this help

Environment overrides:
  CONSUELO_OS_SOURCE_DIR       temporary checkout/download directory for hosted installs
  CONSUELO_OS_REPO_ARCHIVE_URL source archive URL; defaults to the main branch archive
USAGE
}

log() {
  if [ "$JSON" -eq 1 ]; then
    printf '%s\n' "$*" >&2
  else
    printf '%s\n' "$*"
  fi
}

fail() {
  printf '%s\n' "error: $*" >&2
  exit 1
}

json_escape() {
  local value
  value="$(printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g')"
  printf '"%s"' "$value"
}

emit_json_summary() {
  [ "$JSON" -eq 1 ] || return 0
  cat <<JSON
{
  "ok": true,
  "dryRun": $([ "$DRY_RUN" -eq 1 ] && printf 'true' || printf 'false'),
  "sourceDir": $(json_escape "$REPO_DIR"),
  "bun": $(json_escape "$BUN_BIN"),
  "bunStatus": $(json_escape "$BUN_STATUS"),
  "sourceStatus": $(json_escape "$SOURCE_STATUS"),
  "dependencyStatus": $(json_escape "$DEPENDENCY_STATUS"),
  "onboardingStatus": $(json_escape "$ONBOARDING_STATUS"),
  "daemonStatus": $(json_escape "$DAEMON_STATUS")
}
JSON
}

parse_args() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --dry-run) DRY_RUN=1 ;;
      --yes|-y) YES=1 ;;
      --no-install-bun) NO_INSTALL_BUN=1 ;;
      --install-daemons) INSTALL_DAEMONS=1 ;;
      --skip-daemons) SKIP_DAEMONS=1 ;;
      --refresh-source) REFRESH_SOURCE=1 ;;
      --json) JSON=1 ;;
      --debug) DEBUG=1 ;;
      --help|-h)
        usage
        exit 0
        ;;
      *)
        usage >&2
        fail "unknown option: $1"
        ;;
    esac
    shift
  done

  if [ "$INSTALL_DAEMONS" -eq 1 ] && [ "$SKIP_DAEMONS" -eq 1 ]; then
    fail "choose either --install-daemons or --skip-daemons, not both"
  fi
}

has_tty() {
  [ -r /dev/tty ] && [ -w /dev/tty ]
}

use_loading_dots() {
  [ "$JSON" -eq 0 ] && [ "$DEBUG" != "1" ] && [ -t 1 ]
}

run_with_loading_dots() {
  local loading_message="$1"
  shift

  if ! use_loading_dots; then
    log "${loading_message}..."
    "$@"
    return $?
  fi

  local frames=("" "." ".." "...")
  local frame_index=0
  local command_pid
  local status=0

  "$@" &
  command_pid=$!

  while kill -0 "$command_pid" >/dev/null 2>&1; do
    printf '\r%s%s   ' "$loading_message" "${frames[$frame_index]}"
    frame_index=$(( (frame_index + 1) % ${#frames[@]} ))
    sleep 0.25
  done

  wait "$command_pid" || status=$?

  if [ "$status" -eq 0 ]; then
    printf '\r%s... done\n' "$loading_message"
  else
    printf '\r%s... failed\n' "$loading_message"
  fi

  return "$status"
}

prompt_enter() {
  local message="$1"
  local rerun_hint="$2"

  if [ "$YES" -eq 1 ] || [ "$DRY_RUN" -eq 1 ]; then
    return 0
  fi

  if ! has_tty; then
    fail "$message

This shell is non-interactive. Re-run with:
  $rerun_hint"
  fi

  printf '%s\n' "$message" > /dev/tty
  IFS= read -r _ < /dev/tty
}
require_command() {
  local tool="$1"
  local explanation="$2"
  if command -v "$tool" >/dev/null 2>&1; then
    return 0
  fi
  fail "$explanation"
}
check_mac_prerequisites() {
  local os_name
  os_name="$(uname -s 2>/dev/null || true)"
  if [ "$os_name" != "Darwin" ]; then
    fail "Consuelo OS local bootstrap currently supports macOS. Detected: ${os_name:-unknown}."
  fi

  require_command curl "Consuelo OS needs curl to download Bun and source archives. curl is expected on supported macOS installs."
  require_command launchctl "Consuelo OS needs launchctl for user LaunchAgents. This Mac environment is incomplete, so onboarding cannot safely continue."
  require_command plutil "Consuelo OS needs plutil to validate LaunchAgent plists. This Mac environment is incomplete, so onboarding cannot safely continue."
  require_command lsof "Consuelo OS needs lsof to safely find free local ports. lsof is expected on supported macOS installs. This Mac environment is incomplete, so onboarding cannot safely continue."
}

find_bun() {
  if command -v bun >/dev/null 2>&1; then
    BUN_BIN="$(command -v bun)"
    return 0
  fi
  if [ -x "$HOME/.bun/bin/bun" ]; then
    export PATH="$HOME/.bun/bin:$PATH"
    BUN_BIN="$HOME/.bun/bin/bun"
    return 0
  fi
  return 1
}

manual_bun_instructions() {
  cat <<'TEXT'
Install Bun manually, then re-run this bootstrap:
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"
  bash packages/os/scripts/bootstrap.sh --yes
TEXT
}

ensure_bun() {
  if find_bun; then
    BUN_STATUS="present"
    log "Bun found: $BUN_BIN"
    return 0
  fi

  if [ "$NO_INSTALL_BUN" -eq 1 ]; then
    manual_bun_instructions >&2
    fail "Bun is required and --no-install-bun was passed."
  fi

  if [ "$DRY_RUN" -eq 1 ]; then
    BUN_STATUS="would_install"
    log "dry-run: Bun is missing and would be installed with: curl -fsSL https://bun.sh/install | bash"
    return 0
  fi

  prompt_enter "Consuelo OS uses Bun to run its local background runtime.
Press Enter to install Bun, or press Control-C to cancel." "$HOSTED_INSTALL_COMMAND_WITH_ARGS --yes"

  log "Installing Bun..."
  curl -fsSL https://bun.sh/install | bash
  export PATH="$HOME/.bun/bin:$PATH"

  if ! find_bun; then
    manual_bun_instructions >&2
    fail "Bun install finished, but bun was not available at $HOME/.bun/bin/bun."
  fi

  BUN_STATUS="installed"
  log "Bun installed: $BUN_BIN"
}

current_repo_dir() {
  if [ -f "packages/os/scripts/install.ts" ]; then
    pwd
    return 0
  fi
  if [ -f "scripts/install.ts" ] && [ -f "package.json" ]; then
    (cd ../.. && pwd)
    return 0
  fi
  return 1
}
download_source_archive() {
  local tmp_dir archive_file parent_dir staged_dir
  tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/consuelo-os-source.XXXXXX")"
  archive_file="$tmp_dir/source.tar.gz"
  staged_dir="$tmp_dir/source"
  parent_dir="$(dirname "$SOURCE_DIR")"

  mkdir -p "$parent_dir" "$staged_dir"

  if ! curl -fsSL "$REPO_ARCHIVE_URL" -o "$archive_file"; then
    rm -rf "$tmp_dir"
    return 1
  fi

  if ! tar -xzf "$archive_file" -C "$staged_dir" --strip-components=1; then
    rm -rf "$tmp_dir"
    return 1
  fi

  if [ ! -f "$staged_dir/packages/os/scripts/install.ts" ]; then
    rm -rf "$tmp_dir"
    return 1
  fi

  rm -rf "$SOURCE_DIR"
  mv "$staged_dir" "$SOURCE_DIR"
  rm -rf "$tmp_dir"
}

download_source() {
  if [ "$DRY_RUN" -eq 1 ]; then
    REPO_DIR="$SOURCE_DIR"
    if [ "$REFRESH_SOURCE" -eq 1 ] && [ -f "$SOURCE_DIR/packages/os/scripts/install.ts" ]; then
      SOURCE_STATUS="would_refresh"
      log "dry-run: would refresh Consuelo OS source from $REPO_ARCHIVE_URL at $SOURCE_DIR"
    else
      SOURCE_STATUS="would_download"
      log "dry-run: would download Consuelo OS source from $REPO_ARCHIVE_URL to $SOURCE_DIR"
    fi
    return 0
  fi

  prompt_enter "Consuelo OS needs the local runtime source to continue.
We can download/setup this now.
Press Enter to continue, or press Control-C to cancel." "$HOSTED_INSTALL_COMMAND_WITH_ARGS --yes"

  require_command tar "Consuelo OS needs tar to unpack the source archive. tar is expected on supported macOS installs."
  require_command mktemp "Consuelo OS needs mktemp to stage the source archive safely. mktemp is expected on supported macOS installs."

  if [ -e "$SOURCE_DIR" ] && [ ! -f "$SOURCE_DIR/packages/os/scripts/install.ts" ]; then
    fail "$SOURCE_DIR exists but does not contain packages/os/scripts/install.ts. Move it or set CONSUELO_OS_SOURCE_DIR to another temporary path."
  fi

  if [ -f "$SOURCE_DIR/packages/os/scripts/install.ts" ]; then
    if [ "$REFRESH_SOURCE" -eq 1 ]; then
      run_with_loading_dots "Refreshing Consuelo OS source" download_source_archive
      if [ ! -f "$SOURCE_DIR/packages/os/scripts/install.ts" ]; then
        fail "refreshed source did not contain packages/os/scripts/install.ts"
      fi
      REPO_DIR="$SOURCE_DIR"
      SOURCE_STATUS="refreshed"
      return 0
    fi

    REPO_DIR="$SOURCE_DIR"
    SOURCE_STATUS="present"
    log "Using existing Consuelo OS source: $REPO_DIR (pass --refresh-source to refresh it)"
    return 0
  fi

  run_with_loading_dots "Downloading Consuelo OS source" download_source_archive

  if [ ! -f "$SOURCE_DIR/packages/os/scripts/install.ts" ]; then
    fail "downloaded source did not contain packages/os/scripts/install.ts"
  fi

  REPO_DIR="$SOURCE_DIR"
  SOURCE_STATUS="downloaded"
}

resolve_source() {
  local local_repo
  if local_repo="$(current_repo_dir 2>/dev/null)"; then
    REPO_DIR="$local_repo"
    SOURCE_STATUS="local"
    if [ "$REFRESH_SOURCE" -eq 1 ]; then
      log "Using local Consuelo OS source: $REPO_DIR (--refresh-source applies only to hosted source checkouts)"
    else
      log "Using local Consuelo OS source: $REPO_DIR"
    fi
    return 0
  fi

  download_source
}
ensure_dependencies() {
  local os_dir="$REPO_DIR/packages/os"
  if [ -d "$os_dir/node_modules/@clack/prompts" ] || [ -d "$REPO_DIR/node_modules/@clack/prompts" ]; then
    DEPENDENCY_STATUS="present"
    return 0
  fi

  if [ "$DRY_RUN" -eq 1 ]; then
    DEPENDENCY_STATUS="would_install"
    log "dry-run: would install Consuelo OS runtime dependencies with: bun --cwd $os_dir install"
    return 0
  fi

  prompt_enter "Consuelo OS needs its local runtime dependencies to continue.
We can install/setup this now.
Press Enter to continue, or press Control-C to cancel." "$HOSTED_INSTALL_COMMAND_WITH_ARGS --yes"

  log "Installing Consuelo OS runtime dependencies..."
  (cd "$os_dir" && "$BUN_BIN" install)
  DEPENDENCY_STATUS="installed"
}


check_install_tty() {
  local os_dir="$1"
  if ! has_tty; then
    fail "Consuelo OS interactive setup needs a real terminal. Re-run non-interactively with:
  $HOSTED_INSTALL_COMMAND_WITH_ARGS --yes --install-daemons"
  fi
  if [ "$DEBUG" = "1" ]; then
    "$BUN_BIN" --cwd "$os_dir" ./scripts/install.ts --check-tty < /dev/tty
  fi
}

run_install_with_script_pty() {
  local os_dir="$1"
  local os_home="$2"
  require_command script "Consuelo OS interactive setup needs macOS script for keyboard input. Re-run non-interactively with:\n  $HOSTED_INSTALL_COMMAND_WITH_ARGS --yes --install-daemons"
  CONSUELO_ONBOARDING_RESULT_FILE="${ONBOARDING_RESULT_FILE:-}" script -q /dev/null "$BUN_BIN" --cwd "$os_dir" ./scripts/install.ts --home "$os_home" < /dev/tty
}

run_install_with_tty() {
  local os_dir="$1"
  local os_home="$2"
  check_install_tty "$os_dir"
  run_install_with_script_pty "$os_dir" "$os_home"
}

run_onboarding() { # run_onboarding_json
  local os_dir="$REPO_DIR/packages/os"
  local os_home="$OS_HOME"

  log "Consuelo OS runs a local background service on your Mac so agents and apps can reach your OS while you work. This is similar to common Mac utilities that run in the background. You can stop or uninstall it later."

  if [ "$DRY_RUN" -eq 1 ]; then
    if [ -n "$BUN_BIN" ]; then
      "$BUN_BIN" --cwd "$os_dir" ./scripts/install.ts --dry-run --yes --json
      ONBOARDING_STATUS="dry_run"
    else
      log "dry-run: would run: bun --cwd $os_dir ./scripts/install.ts --dry-run --yes --json"
      ONBOARDING_STATUS="would_run"
    fi
    return 0
  fi

  if [ "$YES" -eq 1 ] || [ "$JSON" -eq 1 ]; then
    local install_args=(./scripts/install.ts --yes --json --home "$os_home")
    if [ "$INSTALL_DAEMONS" -eq 1 ]; then
      install_args+=(--install-daemons)
    fi
    if [ "$SKIP_DAEMONS" -eq 1 ]; then
      install_args+=(--skip-daemons)
    fi
    ONBOARDING_JSON="$("$BUN_BIN" --cwd "$os_dir" "${install_args[@]}")"
    if [ "$JSON" -eq 1 ]; then
      printf '%s\n' "$ONBOARDING_JSON"
    fi
  else
    if ! has_tty; then
      fail "Consuelo OS onboarding needs an interactive terminal. Re-run with:

  $HOSTED_INSTALL_COMMAND_WITH_ARGS --yes"
    fi
    ONBOARDING_RESULT_FILE="$(mktemp "${TMPDIR:-/tmp}/consueloo-onboardin.XXXXXX")"
    run_install_with_tty "$os_dir" "$os_home"
    ONBOARDING_JSON="$(cat "$ONBOARDING_RESULT_FILE")"
    rm -f "$ONBOARDING_RESULT_FILE"
    if printf '%s' "$ONBOARDING_JSON" | grep -q '"installDaemons"[[:space:]]*:[[:space:]]*true'; then
      INSTALL_DAEMONS=1
    else
      SKIP_DAEMONS=1
    fi
  fi
  ONBOARDING_STATUS="installed"
}

run_daemon_dry_run() {
  local os_dir="$REPO_DIR/packages/os"
  (cd "$os_dir" && bash ./scripts/install-system-daemons.sh --dry-run --quiet)
  DAEMON_STATUS="dry_run"
}

install_daemons_quiet() {
  local os_dir="$OS_HOME"
  (cd "$os_dir" && bash ./scripts/install-system-daemons.sh --quiet)
}

maybe_install_daemons() {
  if [ "$SKIP_DAEMONS" -eq 1 ]; then
    DAEMON_STATUS="skipped"
    log "Skipping Consuelo OS user LaunchAgent setup."
    return 0
  fi

  if [ "$DRY_RUN" -eq 1 ]; then
    log "dry-run: would offer user LaunchAgent setup for com.consuelo.system, com.consuelo.watchdog, and com.consuelo.portless.system."
    run_daemon_dry_run
    return 0
  fi

  if [ "$INSTALL_DAEMONS" -eq 0 ] && [ "$YES" -eq 1 ]; then
    DAEMON_STATUS="skipped"
    log "Skipping LaunchAgent setup because --install-daemons was not passed. To install later, run: bash packages/os/scripts/bootstrap.sh --yes --install-daemons"
    return 0
  fi

  if [ "$INSTALL_DAEMONS" -eq 0 ]; then
    prompt_enter "Consuelo OS can install user LaunchAgents so it starts at login and restarts if it crashes.
Labels:
- com.consuelo.system
- com.consuelo.watchdog
- com.consuelo.portless.system

Press Enter to install these user LaunchAgents, or press Control-C to cancel." "$HOSTED_INSTALL_COMMAND_WITH_ARGS --yes --install-daemons"
  fi

  if [ "$DEBUG" = "1" ]; then
    local os_dir="$OS_HOME"
    CONSUELO_OS_DEBUG=1 "$BUN_BIN" run --cwd "$os_dir" install:system-daemons
  else
    run_with_loading_dots "setting up background service" install_daemons_quiet
    log "background service ready"
  fi
  DAEMON_STATUS="installed"
}

print_success_summary() {
  [ "$JSON" -eq 0 ] || return 0

  local os_home="$OS_HOME"
  local config_file="$os_home/config.json"
  local db_file="$os_home/consuelo.db"
  local log_dir="$HOME/Library/Logs/Consuelo"
  local doctor_cmd="CONSUELO_HOME=$os_home $BUN_BIN --cwd $os_home run doctor"

  log ""
  log "Consuelo OS setup complete"
  log "Home: $os_home"
  log "Package: $os_home"
  log "Config: $config_file"
  log "Database: $db_file"
  log "Logs: $log_dir"

  case "$DAEMON_STATUS" in
    installed)
      log "Services: com.consuelo.system, com.consuelo.portless.system, com.consuelo.watchdog"
      ;;
    skipped)
      log "Services: skipped"
      log "Install services later: $HOSTED_INSTALL_COMMAND_WITH_ARGS --yes --install-daemons"
      ;;
  esac

  log "Doctor: $doctor_cmd"
  log "Tokens and secrets are saved in local config/state files and are not printed."
}

main() {
  parse_args "$@"
  check_mac_prerequisites
  ensure_bun
  resolve_source
  ensure_dependencies
  run_onboarding
  maybe_install_daemons
  print_success_summary
  emit_json_summary
}

main "$@"

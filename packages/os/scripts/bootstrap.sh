#!/usr/bin/env bash
set -euo pipefail

PROGRAM="Consuelo OS bootstrap"
HOSTED_INSTALL_COMMAND="curl -fsSL https://install.consuelohq.com/os | bash"
HOSTED_INSTALL_COMMAND_WITH_ARGS="curl -fsSL https://install.consuelohq.com/os | bash -s --"
BOOTSTRAP_FILE_SOURCE="${BASH_SOURCE[0]:-}"
DEFAULT_OS_HOME="${CONSUELO_DEFAULT_HOME:-$HOME/.consuelo}"
LEGACY_OS_HOME="${CONSUELO_LEGACY_OS_HOME:-$HOME/.consuelo/os}"
resolve_os_home() {
  if [ -n "${CONSUELO_HOME:-}" ]; then
    printf '%s\n' "$CONSUELO_HOME"
    return 0
  fi
  if [ -d "$LEGACY_OS_HOME" ] && [ ! -f "$DEFAULT_OS_HOME/consuelo.yaml" ]; then
    printf '%s\n' "$LEGACY_OS_HOME"
    return 0
  fi
  printf '%s\n' "$DEFAULT_OS_HOME"
}
OS_HOME="$(resolve_os_home)"
resolve_runtime_home() {
  if [ -n "${CONSUELO_RUNTIME_HOME:-}" ]; then
    printf '%s\n' "$CONSUELO_RUNTIME_HOME"
    return 0
  fi
  printf '%s\n' "$OS_HOME/runtime/current"
}
RUNTIME_HOME="$(resolve_runtime_home)"
RUNTIME_RELEASES_DIR="${CONSUELO_RUNTIME_RELEASES_DIR:-$OS_HOME/runtime/releases}"
RUNTIME_BIN_DIR="${CONSUELO_OS_RUNTIME_BIN_DIR:-$OS_HOME/bin}"
HOSTED_RELEASE_BASE_URL="https://install.consuelohq.com/os/releases"
BAKED_RELEASE_PUBLIC_KEYS_BASE64="__CONSUELO_RELEASE_PUBLIC_KEYS_BASE64__"
if [ "${CONSUELO_OS_DEV:-0}" = "1" ]; then
  RELEASE_BASE_URL="${CONSUELO_RELEASE_BASE_URL:-$HOSTED_RELEASE_BASE_URL}"
  RELEASE_PUBLIC_KEYS_BASE64="${CONSUELO_RELEASE_PUBLIC_KEYS_BASE64:-$BAKED_RELEASE_PUBLIC_KEYS_BASE64}"
  RELEASE_CHANNEL="${CONSUELO_RELEASE_CHANNEL:-stable}"
else
  RELEASE_BASE_URL="$HOSTED_RELEASE_BASE_URL"
  RELEASE_PUBLIC_KEYS_BASE64="$BAKED_RELEASE_PUBLIC_KEYS_BASE64"
  RELEASE_CHANNEL="stable"
fi
TRUSTED_RELEASE_KEYS_PATH="$OS_HOME/runtime/trusted-release-keys.json"
RELEASE_CHANNEL_STATE_PATH="$OS_HOME/runtime/channels/$RELEASE_CHANNEL.json"
ALLOW_GLOBAL_RUNTIME_LOOKUP="${CONSUELO_OS_ALLOW_GLOBAL_RUNTIME_LOOKUP:-1}"
CLOUDFLARED_REQUIRED="${CONSUELO_OS_REQUIRE_CLOUDFLARED:-1}"
CLOUDFLARED_VERSION="${CONSUELO_CLOUDFLARED_VERSION:-2026.6.1}"
CLOUDFLARED_DARWIN_ARM64_SHA256="f6d4c439c6c782b83264951d327989ce5e23373acc5942b872411601fedb020d"
CLOUDFLARED_DARWIN_AMD64_SHA256="d7a66b525fe76820da6e5406611b61e48b40de682368ac00454d9158f085be4b"
CADDY_VERSION="2.11.4"
CADDY_DARWIN_ARM64_SHA256="9efb0af2d6cf09cfb5053c0e51721b9b3d4956d346234f39368d943d25a3c9a7"
CADDY_DARWIN_AMD64_SHA256="34bc9e5cceee8d67844ef51da624f5b79e8d070f27236e050c3f0066a2dba534"

MACOS_EXPECTED_SYSTEM_TOOLS=(curl tar mktemp launchctl plutil lsof script)
INSTALLER_MANAGED_RUNTIME_BINARIES=(bun caddy portless cloudflared)
PACKAGE_MANAGED_DEPENDENCIES_DESCRIPTION="dependencies installed by bun install from packages/os/package.json"
OPERATOR_ONLY_TOOLS=(
  wrangler
  cloudflare-account-credentials
  cloudflare-account-id
  cloudflare-zone-id
  cloudflare-ruleset-id
  r2-admin-authority
  d1-admin-authority
)

DRY_RUN=0
YES=0
NO_INSTALL_BUN=0
INSTALL_DAEMONS=0
SKIP_DAEMONS=0
JSON=0
DEBUG="${CONSUELO_OS_DEBUG:-0}"
DEV_DIAGNOSTICS="${CONSUELO_OS_DEV_DIAGNOSTICS:-0}"
DEV_REPORT_ROOT="${CONSUELO_OS_DEV_REPORTS_DIR:-$HOME/.consuelo-dev-reports}"
DEV_REPORT_DIR="${CONSUELO_OS_DEV_REPORT_DIR:-}"
CHILD_INSTALL_RAW_TRANSCRIPT=""
CHILD_INSTALL_TRANSCRIPT=""
CONSUELO_INSTALL_ID="${CONSUELO_INSTALL_ID:-}"

BUN_BIN=""
PORTLESS_BIN="${PORTLESS_BIN:-}"
PORTLESS_ENABLED="${PORTLESS_ENABLED:-0}"
PORTLESS_INSTALL="${CONSUELO_OS_INSTALL_PORTLESS:-0}"
PORTLESS_REQUIRED="${CONSUELO_OS_REQUIRE_PORTLESS:-0}"
CLOUDFLARED_BIN="${CLOUDFLARED_BIN:-}"
CADDY_BIN="${CADDY_BIN:-}"
REPO_DIR=""
ONBOARDING_STATUS="pending"
DAEMON_STATUS="pending"
BUN_STATUS="pending"
PORTLESS_STATUS="pending"
CLOUDFLARED_STATUS="pending"
CADDY_STATUS="pending"
SOURCE_STATUS="pending"
PENDING_RUNTIME_RELEASE_DIR=""
PENDING_CHANNEL_STATE_PATH=""
RUNTIME_STAGE_DIR=""
ONBOARDING_JSON=""
DEPENDENCY_STATUS="pending"
CONTACT_URL="https://consuelohq.com/contact/"
OS_MODE=""

ensure_install_id() {
  if printf '%s' "$CONSUELO_INSTALL_ID" | grep -Eq '^ins_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'; then
    export CONSUELO_INSTALL_ID
    return 0
  fi
  [ -n "$BUN_BIN" ] || fail "Consuelo OS could not create install telemetry correlation before Bun was ready"
  local install_uuid
  install_uuid="$("$BUN_BIN" --print 'crypto.randomUUID().toLowerCase()')" || fail "Consuelo OS could not create install telemetry correlation"
  if ! printf '%s' "$install_uuid" | grep -Eq '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'; then
    fail "Consuelo OS generated an invalid install telemetry correlation id"
  fi
  CONSUELO_INSTALL_ID="ins_$install_uuid"
  export CONSUELO_INSTALL_ID
}

cleanup_runtime_stage() {
  if [ -n "$RUNTIME_STAGE_DIR" ] && [ -d "$RUNTIME_STAGE_DIR" ]; then
    rm -rf "$RUNTIME_STAGE_DIR"
  fi
  if [ -n "$PENDING_CHANNEL_STATE_PATH" ]; then
    rm -f "$PENDING_CHANNEL_STATE_PATH"
  fi
}
trap cleanup_runtime_stage EXIT

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
  bash packages/os/scripts/bootstrap.sh --yes --use-existing-source

Options:
  --dry-run          print what would happen without installing Bun or LaunchAgents
  --yes             accept required prerequisite setup and run onboarding without prompts
  --no-install-bun  fail with manual instructions if Bun is missing
  --install-daemons install user LaunchAgents after onboarding
  --skip-daemons    skip user LaunchAgent setup after onboarding
  --refresh-source  accepted and ignored; hosted installs always resolve the current signed channel
  --use-existing-source accepted and ignored; kept for older install commands
  --mode <mode>      local or cloud
  --json            print a machine-readable summary at the end
  --debug           print detailed daemon diagnostics
  --help, -h        show this help

Environment overrides:
  CONSUELO_OS_DEV              set to 1 to permit development release-origin and key overrides
  CONSUELO_RELEASE_BASE_URL    development-only signed runtime release origin
  CONSUELO_RELEASE_CHANNEL     release channel; defaults to stable
  CONSUELO_RELEASE_PUBLIC_KEYS_BASE64 development-only trusted Ed25519 release-key JSON
  CONSUELO_OS_RUNTIME_BIN_DIR  local runtime binary directory; defaults to ~/.consuelo/bin
  CONSUELO_OS_DEV_DIAGNOSTICS  set to 1 to write temporary development install diagnostics
  PORTLESS_BIN                 absolute portless binary path to reuse
  CLOUDFLARED_BIN              absolute cloudflared binary path to reuse
USAGE
}

dev_diagnostics_enabled() {
  [ "$DEV_DIAGNOSTICS" = "1" ]
}

redact_dev_log_line() {
  if command -v perl >/dev/null 2>&1; then
    perl -CS -pe '
      s/\e\][^\a]*(?:\a|\e\\)//g;
      s/\e\[[0-9;?]*[ -\/]*[@-~]//g;
      s#/(Users|home)/[^/\s]+#/$1/[user]#g;
      s{([?&](?:access_token|authorization|bootstrap_token|client_secret|cloudflared?_tunnel_token|code|device_code|refresh_token|secret|state|token|user_code)=)[^&\#\s]+}{$1[redacted]}gi;
      s#\bAuthorization\s*:\s*Bearer\s+[^\s]+#Authorization: [redacted]#gi;
      s#\bBearer\s+[^\s]+#[redacted]#gi;
      s#\b((?:[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|KEY|AUTH|COOKIE|CODE|STATE)[A-Z0-9_]*|client_secret|device_code|user_code)\s*[:=]\s*)[^&\s]+#$1[redacted]#gi;
      s#\b(?:cbt|dev|mcp|osat|pat)_[A-Za-z0-9._-]+\b#[redacted]#gi;
      s#\b[A-Z0-9]{4}-[A-Z0-9]{4}\b#[redacted]#g;
    '
    return 0
  fi

  local esc bel
  esc="$(printf '\033')"
  bel="$(printf '\007')"

  sed -E \
    -e "s#${esc}\\][^${bel}]*${bel}##g" \
    -e "s#${esc}\\][^${esc}]*${esc}\\\\##g" \
    -e "s#${esc}\[[0-9;?]*[ -/]*[@-~]##g" \
    -e 's#(/(Users|home)/)[^/[:space:]]+#\1[user]#g' \
    -e 's#([?&](access_token|authorization|bootstrap_token|client_secret|cloudflared?_tunnel_token|code|device_code|refresh_token|secret|state|token|user_code)=)[^&#[:space:]]+#\1[redacted]#gi' \
    -e 's#(^|[^A-Za-z0-9_])(Authorization[[:space:]]*:[[:space:]]*Bearer[[:space:]]*)[^[:space:]]+#\1Authorization: [redacted]#gi' \
    -e 's#(^|[^A-Za-z0-9_])Bearer[[:space:]]+[^[:space:]]+#\1[redacted]#gi' \
    -e 's#(^|[^A-Za-z0-9_])([A-Za-z0-9_]*(TOKEN|SECRET|PASSWORD|KEY|AUTH|COOKIE|CODE|STATE)[A-Za-z0-9_]*|client_secret|device_code|user_code)[[:space:]]*[:=][[:space:]]*[^&[:space:]]+#\1\2=[redacted]#gi' \
    -e 's#(^|[^A-Za-z0-9_])((cbt|dev|mcp|osat|pat)_[A-Za-z0-9._-]+)#\1[redacted]#gi' \
    -e 's#(^|[^A-Za-z0-9])([A-Z0-9]{4}-[A-Z0-9]{4})([^A-Za-z0-9]|$)#\1[redacted]\3#g'
}

init_dev_diagnostics() {
  dev_diagnostics_enabled || return 0
  if [ -z "$DEV_REPORT_DIR" ]; then
    DEV_REPORT_DIR="$DEV_REPORT_ROOT/bootstrap-$(date -u +%Y%m%dT%H%M%SZ)-$$"
  fi
  mkdir -p "$DEV_REPORT_DIR"
  chmod 700 "$DEV_REPORT_DIR" 2>/dev/null || true
  CHILD_INSTALL_RAW_TRANSCRIPT="$DEV_REPORT_DIR/child-installer.raw.log"
  CHILD_INSTALL_TRANSCRIPT="$DEV_REPORT_DIR/child-installer.log"
  export CONSUELO_OS_DEV_REPORT_DIR="$DEV_REPORT_DIR"
  printf '%s
' "bootstrap diagnostics started" | redact_dev_log_line >> "$DEV_REPORT_DIR/bootstrap.log"
}

dev_log() {
  dev_diagnostics_enabled || return 0
  [ -n "$DEV_REPORT_DIR" ] || return 0
  printf '%s %s
' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | redact_dev_log_line >> "$DEV_REPORT_DIR/bootstrap.log"
}

finalize_child_install_transcript() {
  dev_diagnostics_enabled || return 0
  [ -n "$CHILD_INSTALL_RAW_TRANSCRIPT" ] || return 0
  [ -f "$CHILD_INSTALL_RAW_TRANSCRIPT" ] || return 0
  redact_dev_log_line < "$CHILD_INSTALL_RAW_TRANSCRIPT" > "$CHILD_INSTALL_TRANSCRIPT" || true
  rm -f "$CHILD_INSTALL_RAW_TRANSCRIPT"
  dev_log "child installer transcript: $CHILD_INSTALL_TRANSCRIPT"
}

child_install_transcript_hint() {
  if dev_diagnostics_enabled && [ -n "$CHILD_INSTALL_TRANSCRIPT" ] && [ -f "$CHILD_INSTALL_TRANSCRIPT" ]; then
    printf ' Child installer transcript: %s' "$CHILD_INSTALL_TRANSCRIPT"
  fi
}

log() {
  dev_log "$*"
  if [ "$JSON" -eq 1 ]; then
    printf '%s
' "$*" >&2
  else
    printf '%s
' "$*"
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

json_path_or_null() {
  if [ -z "$1" ]; then
    printf 'null'
    return 0
  fi
  json_escape "$1"
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
  "portless": $(json_path_or_null "$PORTLESS_BIN"),
  "portlessStatus": $(json_escape "$PORTLESS_STATUS"),
  "cloudflared": $(json_path_or_null "$CLOUDFLARED_BIN"),
  "cloudflaredStatus": $(json_escape "$CLOUDFLARED_STATUS"),
  "caddy": $(json_path_or_null "$CADDY_BIN"),
  "caddyStatus": $(json_escape "$CADDY_STATUS"),
  "sourceStatus": $(json_escape "$SOURCE_STATUS"),
  "dependencyStatus": $(json_escape "$DEPENDENCY_STATUS"),
  "onboardingStatus": $(json_escape "$ONBOARDING_STATUS"),
  "daemonStatus": $(json_escape "$DAEMON_STATUS"),
  "dependencies": {
    "system": {
      "curl": { "classification": "macos_expected", "status": "present" },
      "tar": { "classification": "macos_expected", "status": "present" },
      "mktemp": { "classification": "macos_expected", "status": "present" },
      "launchctl": { "classification": "macos_expected", "status": "present" },
      "plutil": { "classification": "macos_expected", "status": "present" },
      "lsof": { "classification": "macos_expected", "status": "present" },
      "script": { "classification": "macos_expected", "status": "present" }
    },
    "runtime": {
      "bun": { "classification": "installer_managed", "status": $(json_escape "$BUN_STATUS"), "path": $(json_path_or_null "$BUN_BIN") },
      "portless": { "classification": "optional_installer_managed", "status": $(json_escape "$PORTLESS_STATUS"), "path": $(json_path_or_null "$PORTLESS_BIN") },
      "cloudflared": { "classification": "installer_managed", "status": $(json_escape "$CLOUDFLARED_STATUS"), "path": $(json_path_or_null "$CLOUDFLARED_BIN") },
      "caddy": { "classification": "installer_managed", "status": $(json_escape "$CADDY_STATUS"), "path": $(json_path_or_null "$CADDY_BIN") }
    },
    "package": {
      "bunInstall": { "classification": "package_managed", "status": $(json_escape "$DEPENDENCY_STATUS"), "description": $(json_escape "$PACKAGE_MANAGED_DEPENDENCIES_DESCRIPTION") }
    },
    "operator": {
      "wrangler": { "classification": "operator_only" },
      "cloudflareAccountCredentials": { "classification": "operator_only" },
      "cloudflareAccountId": { "classification": "operator_only" },
      "cloudflareZoneId": { "classification": "operator_only" },
      "cloudflareRulesetId": { "classification": "operator_only" },
      "r2AdminAuthority": { "classification": "operator_only" },
      "d1AdminAuthority": { "classification": "operator_only" }
    }
  }
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
      --refresh-source|--use-existing-source) ;;
      --mode)
        shift
        if [ "$#" -eq 0 ]; then
          fail "--mode requires local or cloud"
        fi
        case "$1" in
          local|cloud) OS_MODE="$1" ;;
          *) fail "--mode must be local or cloud" ;;
        esac
        ;;
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
  if [ "$YES" -eq 1 ] && [ "$SKIP_DAEMONS" -eq 0 ]; then
    INSTALL_DAEMONS=1
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

prompt_select() {
  local message="$1"
  local default_choice="$2"
  local first_choice="$3"
  local second_choice="$4"
  local rerun_hint="$5"
  local selected=0
  local prompt_lines=4
  local rendered=0
  local key=""
  local rest=""

  if [ "$YES" -eq 1 ] || [ "$DRY_RUN" -eq 1 ]; then
    printf '%s\n' "$default_choice"
    return 0
  fi

  if ! has_tty; then
    fail "$message

This shell is non-interactive. Re-run with:
  $rerun_hint"
  fi

  if [ "$default_choice" = "$second_choice" ]; then
    selected=1
  fi

  while true; do
    if [ "$rendered" -eq 1 ]; then
      printf '\033[%sA' "$prompt_lines" > /dev/tty
    fi
    printf '\033[2K%s\n' "$message" > /dev/tty
    if [ "$selected" -eq 0 ]; then
      printf '\033[2K◆ %s\n' "$first_choice" > /dev/tty
      printf '\033[2K○ %s\n' "$second_choice" > /dev/tty
    else
      printf '\033[2K○ %s\n' "$first_choice" > /dev/tty
      printf '\033[2K◆ %s\n' "$second_choice" > /dev/tty
    fi
    printf '\033[2K%s\n' "Use arrow keys and Enter." > /dev/tty
    rendered=1

    IFS= read -rsn1 key < /dev/tty || key=""
    case "$key" in
      "")
        if [ "$selected" -eq 0 ]; then
          printf '%s\n' "$first_choice"
        else
          printf '%s\n' "$second_choice"
        fi
        return 0
        ;;
      $'\033')
        IFS= read -rsn2 rest < /dev/tty || rest=""
        case "$rest" in
          "[A"|"[D") selected=0 ;;
          "[B"|"[C") selected=1 ;;
        esac
        ;;
      [YyLl]) selected=0 ;;
      [NnCc]) selected=1 ;;
    esac
  done
}

open_url() {
  local url="$1"

  if [ "$DRY_RUN" -eq 1 ]; then
    log "dry-run: would open $url"
    return 0
  fi

  if command -v open >/dev/null 2>&1; then
    open "$url"
  else
    log "Open $url"
  fi
}

open_contact_url() {
  open_url "$CONTACT_URL"
}

render_os_mode_select() {
  local selected="$1"

  printf '\033[2KChoose Consuelo OS mode:\n' > /dev/tty
  if [ "$selected" -eq 0 ]; then
    printf '\033[2K> local\n' > /dev/tty
    printf '\033[2K  cloud\n' > /dev/tty
  else
    printf '\033[2K  local\n' > /dev/tty
    printf '\033[2K> cloud\n' > /dev/tty
  fi
}

choose_os_mode() {
  if [ -n "$OS_MODE" ]; then
    return 0
  fi

  if [ "$YES" -eq 1 ] || [ "$JSON" -eq 1 ] || [ "$DRY_RUN" -eq 1 ]; then
    OS_MODE="local"
    return 0
  fi

  if ! has_tty; then
    fail "Choose local or cloud before setup.

This shell is non-interactive. Re-run with:
  $HOSTED_INSTALL_COMMAND_WITH_ARGS --mode local
or:
  $HOSTED_INSTALL_COMMAND_WITH_ARGS --mode cloud"
  fi

  local selected=0
  local key=""
  local sequence=""
  local rendered=0
  local old_tty
  old_tty="$(stty -g < /dev/tty)"

  stty -echo -icanon min 1 time 0 < /dev/tty
  printf '\033[?25l' > /dev/tty
  trap 'stty "$old_tty" < /dev/tty; printf "\033[?25h" > /dev/tty; exit 130' INT TERM

  while true; do
    if [ "$rendered" -eq 1 ]; then
      printf '\033[3A' > /dev/tty
    fi
    render_os_mode_select "$selected"
    rendered=1

    IFS= read -r -s -n 1 key < /dev/tty || key=""
    case "$key" in
      $'\033')
        IFS= read -r -s -n 2 -t 1 sequence < /dev/tty || sequence=""
        case "$sequence" in
          "[A"|"[B")
            if [ "$selected" -eq 0 ]; then
              selected=1
            else
              selected=0
            fi
            ;;
        esac
        ;;
      ""|$'\n'|$'\r')
        if [ "$selected" -eq 0 ]; then
          OS_MODE="local"
        else
          OS_MODE="cloud"
        fi
        stty "$old_tty" < /dev/tty
        printf '\033[?25h\n' > /dev/tty
        trap - INT TERM
        return 0
        ;;
    esac
  done
}

handle_cloud_mode() {
  if [ "$OS_MODE" != "cloud" ]; then
    return 0
  fi

  log "Consuelo cloud is handled by the Consuelo team. Opening the contact page."
  open_contact_url
  DEPENDENCY_STATUS="skipped"
  ONBOARDING_STATUS="cloud_contact"
  DAEMON_STATUS="skipped"
  emit_json_summary
  exit 0
}

render_dependency_progress() {
  [ "$JSON" -eq 0 ] || return 0

  log "CONSUELO OS  ● dependencies  ○ workspace  ○ security  ○ skills  ○ agents  ○ service  ○ health"
  log ""
}

prompt_dependency_setup() {
  local dependency_choice
  dependency_choice="$(prompt_select "Consuelo OS needs its dependencies to continue." "yes" "yes" "no" "$HOSTED_INSTALL_COMMAND_WITH_ARGS --yes")"
  if [ "$dependency_choice" = "no" ]; then
    DEPENDENCY_STATUS="cancelled"
    fail "Consuelo OS setup cancelled."
  fi
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

  local tool
  for tool in "${MACOS_EXPECTED_SYSTEM_TOOLS[@]}"; do
    require_command "$tool" "Consuelo OS needs $tool during public install. $tool is expected on supported macOS installs. This Mac environment is incomplete, so onboarding cannot safely continue."
  done
}

find_bun() {
  if [ -n "${BUN_BIN:-}" ]; then
    if [ -x "$BUN_BIN" ]; then
      return 0
    fi
    fail "Configured BUN_BIN is not executable: $BUN_BIN"
  fi
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

install_bun_runtime() {
  curl -fsSL https://bun.sh/install | bash
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

  run_with_loading_dots "Installing Bun" install_bun_runtime
  export PATH="$HOME/.bun/bin:$PATH"

  if ! find_bun; then
    manual_bun_instructions >&2
    fail "Bun install finished, but bun was not available at $HOME/.bun/bin/bun."
  fi

  BUN_STATUS="installed"
  log "Bun installed: $BUN_BIN"
}

runtime_arch() {
  local machine
  machine="$(uname -m 2>/dev/null || true)"
  case "$machine" in
    arm64) printf 'arm64\n' ;;
    x86_64|amd64) printf 'amd64\n' ;;
    *) fail "unsupported macOS architecture for Consuelo OS runtime binaries: ${machine:-unknown}" ;;
  esac
}

find_runtime_binary() {
  local configured_path="$1"
  local name="$2"
  local managed_path="$3"

  if [ -n "$configured_path" ]; then
    if [ -x "$configured_path" ]; then
      printf '%s\n' "$configured_path"
      return 0
    fi
    fail "configured $name binary is not executable: $configured_path"
  fi

  if [ -x "$managed_path" ]; then
    printf '%s\n' "$managed_path"
    return 0
  fi

  if [ "$ALLOW_GLOBAL_RUNTIME_LOOKUP" = "1" ]; then
    local candidate
    for candidate in "/opt/homebrew/bin/$name" "/usr/local/bin/$name"; do
      if [ -x "$candidate" ]; then
        printf '%s\n' "$candidate"
        return 0
      fi
    done

    if command -v "$name" >/dev/null 2>&1; then
      command -v "$name"
      return 0
    fi
  fi

  return 1
}

curl_retry() {
  curl -fsSL --retry 3 --retry-delay 1 --retry-connrefused --connect-timeout 10 --max-time 120 "$@"
}

is_sha256() {
  local value="$1"
  [ "${#value}" -eq 64 ] || return 1
  case "$value" in
    *[!0123456789abcdefABCDEF]*) return 1 ;;
  esac
  return 0
}

parse_sha256_token() {
  local checksum_text="$1"
  printf '%s\n' "$checksum_text" | awk '
    {
      for (field_index = 1; field_index <= NF; field_index += 1) {
        token = $field_index
        sub(/^\*/, "", token)
        if (length(token) == 64 && token !~ /[^0-9A-Fa-f]/) {
          print token
          exit
        }
      }
    }
  '
}

read_remote_sha256() {
  local explicit_sha="$1"
  local sha_url="$2"
  local checksum_text checksum

  if [ -n "$explicit_sha" ]; then
    checksum="$(parse_sha256_token "$explicit_sha")"
    is_sha256 "$checksum" || return 1
    printf '%s\n' "$checksum"
    return 0
  fi

  if [ -z "$sha_url" ]; then
    return 1
  fi

  if ! checksum_text="$(curl_retry "$sha_url")"; then
    return 1
  fi
  checksum="$(parse_sha256_token "$checksum_text")"
  is_sha256 "$checksum" || return 1
  printf '%s\n' "$checksum"
}
verify_sha256() {
  local file_path="$1"
  local expected_sha="$2"
  local actual_sha

  require_command shasum "Consuelo OS needs shasum to verify downloaded runtime binaries. shasum is expected on supported macOS installs."
  if ! is_sha256 "$expected_sha"; then
    fail "malformed SHA-256 metadata for $(basename "$file_path"): $expected_sha"
  fi
  actual_sha="$(shasum -a 256 "$file_path")"
  actual_sha="${actual_sha%% *}"
  if [ "$actual_sha" != "$expected_sha" ]; then
    fail "checksum mismatch for $(basename "$file_path"): expected $expected_sha, got $actual_sha"
  fi
}

download_verified_file() {
  local name="$1"
  local url="$2"
  local sha="$3"
  local destination="$4"
  local tmp_dir tmp_file

  tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/consuelo-runtime-${name}.XXXXXX")"
  tmp_file="$tmp_dir/$name.download"
  if ! curl_retry "$url" -o "$tmp_file"; then
    rm -rf "$tmp_dir"
    return 1
  fi
  verify_sha256 "$tmp_file" "$sha"
  mkdir -p "$(dirname "$destination")"
  mv "$tmp_file" "$destination"
  chmod 755 "$destination"
  rm -rf "$tmp_dir"
}

install_portless_runtime() {
  local arch target url sha sha_url
  arch="$(runtime_arch)"
  target="$RUNTIME_BIN_DIR/portless"
  url="${CONSUELO_PORTLESS_DOWNLOAD_URL:-https://install.consuelohq.com/os/bin/portless/darwin-${arch}/portless}"
  sha_url="${CONSUELO_PORTLESS_SHA256_URL:-${url}.sha256}"
  sha="$(read_remote_sha256 "${CONSUELO_PORTLESS_SHA256:-}" "$sha_url" || true)"
  if [ -z "$sha" ]; then
    fail "portless download requires SHA-256 integrity metadata. Set CONSUELO_PORTLESS_SHA256 or publish $sha_url."
  fi
  download_verified_file portless "$url" "$sha" "$target"
}

install_cloudflared_runtime() {
  local arch asset_arch asset_name target url sha tmp_dir archive_file
  arch="$(runtime_arch)"
  asset_arch="$arch"
  asset_name="cloudflared-darwin-${asset_arch}.tgz"
  target="$RUNTIME_BIN_DIR/cloudflared"
  url="${CONSUELO_CLOUDFLARED_DOWNLOAD_URL:-https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/${asset_name}}"

  case "$asset_arch" in
    arm64) sha="${CONSUELO_CLOUDFLARED_SHA256:-$CLOUDFLARED_DARWIN_ARM64_SHA256}" ;;
    amd64) sha="${CONSUELO_CLOUDFLARED_SHA256:-$CLOUDFLARED_DARWIN_AMD64_SHA256}" ;;
    *) fail "unsupported cloudflared architecture: $asset_arch" ;;
  esac

  tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/consuelo-runtime-cloudflared.XXXXXX")"
  archive_file="$tmp_dir/$asset_name"
  if ! curl_retry "$url" -o "$archive_file"; then
    rm -rf "$tmp_dir"
    return 1
  fi
  verify_sha256 "$archive_file" "$sha"
  tar -xzf "$archive_file" -C "$tmp_dir"
  if [ ! -f "$tmp_dir/cloudflared" ]; then
    rm -rf "$tmp_dir"
    fail "cloudflared archive did not contain a cloudflared binary"
  fi
  mkdir -p "$(dirname "$target")"
  mv "$tmp_dir/cloudflared" "$target"
  chmod 755 "$target"
  rm -rf "$tmp_dir"
}

install_caddy_runtime() {
  local arch asset_arch asset_name target url sha tmp_dir archive_file
  arch="$(runtime_arch)"
  asset_arch="$arch"
  asset_name="caddy_${CADDY_VERSION}_mac_${asset_arch}.tar.gz"
  target="$RUNTIME_BIN_DIR/caddy"
  url="${CONSUELO_CADDY_DOWNLOAD_URL:-https://github.com/caddyserver/caddy/releases/download/v${CADDY_VERSION}/${asset_name}}"

  case "$asset_arch" in
    arm64) sha="${CONSUELO_CADDY_SHA256:-$CADDY_DARWIN_ARM64_SHA256}" ;;
    amd64) sha="${CONSUELO_CADDY_SHA256:-$CADDY_DARWIN_AMD64_SHA256}" ;;
    *) fail "unsupported Caddy architecture: $asset_arch" ;;
  esac

  tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/consuelo-runtime-caddy.XXXXXX")"
  archive_file="$tmp_dir/$asset_name"
  if ! curl_retry "$url" -o "$archive_file"; then
    rm -rf "$tmp_dir"
    return 1
  fi
  verify_sha256 "$archive_file" "$sha"
  tar -xzf "$archive_file" -C "$tmp_dir"
  if [ ! -f "$tmp_dir/caddy" ]; then
    rm -rf "$tmp_dir"
    fail "Caddy archive did not contain a caddy binary"
  fi
  mkdir -p "$(dirname "$target")"
  mv "$tmp_dir/caddy" "$target"
  chmod 755 "$target"
  rm -rf "$tmp_dir"
}

ensure_portless() {
  local managed_path="$RUNTIME_BIN_DIR/portless"

  case "${PORTLESS_ENABLED:-auto}" in
    0|false|no)
      if [ "$PORTLESS_REQUIRED" != "1" ] && [ "$PORTLESS_INSTALL" != "1" ]; then
        PORTLESS_BIN=""
        PORTLESS_ENABLED="0"
        PORTLESS_STATUS="skipped"
        log "portless disabled; Consuelo will use http://127.0.0.1:46321"
        return 0
      fi
      ;;
  esac

  if PORTLESS_BIN="$(find_runtime_binary "${PORTLESS_BIN:-}" portless "$managed_path")"; then
    PORTLESS_ENABLED="1"
    PORTLESS_STATUS="present"
    log "portless found: $PORTLESS_BIN"
    return 0
  fi

  PORTLESS_BIN=""
  PORTLESS_ENABLED="0"

  if [ "$PORTLESS_REQUIRED" = "1" ]; then
    PORTLESS_ENABLED="1"
    PORTLESS_BIN="$managed_path"
    if [ "$DRY_RUN" -eq 1 ]; then
      PORTLESS_STATUS="would_install"
      log "dry-run: required portless is missing and would be installed to $PORTLESS_BIN"
      return 0
    fi
    run_with_loading_dots "Installing portless" install_portless_runtime
    if [ ! -x "$PORTLESS_BIN" ]; then
      fail "portless install finished, but $PORTLESS_BIN was not executable."
    fi
    PORTLESS_STATUS="installed"
    log "portless installed: $PORTLESS_BIN"
    return 0
  fi

  if [ "$PORTLESS_INSTALL" = "1" ]; then
    PORTLESS_BIN="$managed_path"
    if [ "$DRY_RUN" -eq 1 ]; then
      PORTLESS_STATUS="would_install"
      log "dry-run: optional portless is missing and would be installed to $PORTLESS_BIN"
      return 0
    fi
    if run_with_loading_dots "Installing optional portless" install_portless_runtime; then
      if [ ! -x "$PORTLESS_BIN" ]; then
        PORTLESS_BIN=""
        PORTLESS_STATUS="optional_unavailable"
        log "optional portless install finished without an executable; Consuelo will use http://127.0.0.1:46321"
        return 0
      fi
      PORTLESS_ENABLED="1"
      PORTLESS_STATUS="installed"
      log "portless installed: $PORTLESS_BIN"
      return 0
    fi
    PORTLESS_BIN=""
    PORTLESS_STATUS="optional_unavailable"
    log "optional portless install unavailable; Consuelo will use http://127.0.0.1:46321"
    return 0
  fi

  PORTLESS_STATUS="optional_missing"
  log "portless is not installed; Consuelo will use http://127.0.0.1:46321"
}

ensure_cloudflared() {
  local managed_path="$RUNTIME_BIN_DIR/cloudflared"
  if [ "$CLOUDFLARED_REQUIRED" != "1" ]; then
    CLOUDFLARED_STATUS="skipped_not_needed"
    return 0
  fi

  if CLOUDFLARED_BIN="$(find_runtime_binary "${CLOUDFLARED_BIN:-}" cloudflared "$managed_path")"; then
    CLOUDFLARED_STATUS="present"
    log "cloudflared found: $CLOUDFLARED_BIN"
    return 0
  fi

  CLOUDFLARED_BIN="$managed_path"
  if [ "$DRY_RUN" -eq 1 ]; then
    CLOUDFLARED_STATUS="would_install"
    log "dry-run: cloudflared is missing and would be installed to $CLOUDFLARED_BIN"
    return 0
  fi

  run_with_loading_dots "Installing cloudflared" install_cloudflared_runtime
  if [ ! -x "$CLOUDFLARED_BIN" ]; then
    fail "cloudflared install finished, but $CLOUDFLARED_BIN was not executable."
  fi
  CLOUDFLARED_STATUS="installed"
  log "cloudflared installed: $CLOUDFLARED_BIN"
}

caddy_version_matches() {
  local candidate="$1"
  [ -x "$candidate" ] || return 1
  case "$("$candidate" version 2>/dev/null || true)" in
    "v${CADDY_VERSION}"*) return 0 ;;
    *) return 1 ;;
  esac
}

ensure_caddy() {
  local managed_path="$RUNTIME_BIN_DIR/caddy"
  local candidate=""

  candidate="$(find_runtime_binary "${CADDY_BIN:-}" caddy "$managed_path" || true)"
  if [ -n "$candidate" ] && caddy_version_matches "$candidate"; then
    CADDY_BIN="$candidate"
    CADDY_STATUS="present"
    log "Caddy found: $CADDY_BIN"
    return 0
  fi

  CADDY_BIN="$managed_path"
  if [ "$DRY_RUN" -eq 1 ]; then
    CADDY_STATUS="would_install"
    log "dry-run: pinned Caddy is missing and would be installed to $CADDY_BIN"
    return 0
  fi

  run_with_loading_dots "Installing Caddy" install_caddy_runtime
  if ! caddy_version_matches "$CADDY_BIN"; then
    fail "Caddy install finished, but $CADDY_BIN is not version v$CADDY_VERSION."
  fi
  CADDY_STATUS="installed"
  log "Caddy installed: $CADDY_BIN"
}

persist_env_value() {
  local file="$1"
  local key="$2"
  local value="$3"
  local tmp_file line current_key

  tmp_file="$(mktemp "${TMPDIR:-/tmp}/consuelo-os-env.XXXXXX")"
  if [ -f "$file" ]; then
    while IFS= read -r line || [ -n "$line" ]; do
      current_key="${line%%=*}"
      if [ "$current_key" = "$key" ]; then
        continue
      fi
      printf '%s\n' "$line" >> "$tmp_file"
    done < "$file"
  fi
  printf '%s=%s\n' "$key" "$value" >> "$tmp_file"
  mkdir -p "$(dirname "$file")"
  mv "$tmp_file" "$file"
  chmod 600 "$file"
}

remove_env_value() {
  local file="$1"
  local key="$2"
  local tmp_file line current_key

  [ -f "$file" ] || return 0
  tmp_file="$(mktemp "${TMPDIR:-/tmp}/consuelo-os-env.XXXXXX")"
  while IFS= read -r line || [ -n "$line" ]; do
    current_key="${line%%=*}"
    if [ "$current_key" = "$key" ]; then
      continue
    fi
    printf '%s\n' "$line" >> "$tmp_file"
  done < "$file"
  mv "$tmp_file" "$file"
  chmod 600 "$file"
}
persist_runtime_paths() {
  local env_file="$OS_HOME/.env"
  if [ "$DRY_RUN" -eq 1 ]; then
    log "dry-run: would persist runtime binary paths to $env_file"
    return 0
  fi

  persist_env_value "$env_file" BUN_BIN "$BUN_BIN"
  if [ "$SOURCE_STATUS" = "local" ] && [ -n "$REPO_DIR" ]; then
    persist_env_value "$env_file" CONSUELO_OS_PACKAGE_ROOT "$REPO_DIR"
  else
    remove_env_value "$env_file" CONSUELO_OS_PACKAGE_ROOT
  fi
  if [ -n "$PORTLESS_BIN" ]; then
    persist_env_value "$env_file" PORTLESS_BIN "$PORTLESS_BIN"
    persist_env_value "$env_file" PORTLESS_ENABLED "1"
  else
    remove_env_value "$env_file" PORTLESS_BIN
    persist_env_value "$env_file" PORTLESS_ENABLED "0"
  fi
  persist_env_value "$env_file" CLOUDFLARED_BIN "$CLOUDFLARED_BIN"
  persist_env_value "$env_file" CADDY_BIN "$CADDY_BIN"
  export BUN_BIN CADDY_BIN PORTLESS_BIN PORTLESS_ENABLED CLOUDFLARED_BIN
}

current_repo_dir() {
  [ -n "$BOOTSTRAP_FILE_SOURCE" ] && [ -f "$BOOTSTRAP_FILE_SOURCE" ] ||
    return 1
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
os_package_dir() {
  if [ -f "$REPO_DIR/scripts/install.ts" ]; then
    printf '%s\n' "$REPO_DIR"
    return 0
  fi
  if [ -f "$REPO_DIR/packages/os/scripts/install.ts" ]; then
    printf '%s\n' "$REPO_DIR/packages/os"
    return 0
  fi
  return 1
}

verify_runtime_release() {
  local stage_dir="$1"
  local verifier="$stage_dir/verify-release.ts"
  cat > "$verifier" <<'BUN'
import { createHash, createPublicKey, verify } from "node:crypto";
import { lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const fail = (message: string): never => {
  throw new Error(message);
};
const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record).sort().flatMap((key) =>
        record[key] === undefined ? [] : [[key, canonicalize(record[key])]],
      ),
    );
  }
  return value;
};
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const digestPattern = /^sha256:[a-f0-9]{64}$/;
const isIsoTimestamp = (value: unknown): value is string =>
  typeof value === "string" &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;
const readBoundedResponse = async (
  response: Response,
  maximumBytes: number,
  label: string,
): Promise<Uint8Array> => {
  const lengthHeader = response.headers.get("content-length");
  if (lengthHeader !== null) {
    const declaredLength = Number(lengthHeader);
    if (!Number.isSafeInteger(declaredLength) || declaredLength < 0) {
      fail(`${label} has an invalid content length`);
    }
    if (declaredLength > maximumBytes) fail(`${label} exceeds the maximum accepted size`);
  }
  if (!response.body) fail(`${label} response body is missing`);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maximumBytes) {
      await reader.cancel();
      fail(`${label} exceeds the maximum accepted size`);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
};
const baseUrl = process.env.CONSUELO_RELEASE_BASE_URL ?? fail("release base URL is required");
const channel = process.env.CONSUELO_RELEASE_CHANNEL ?? "stable";
const keysEncoded = process.env.CONSUELO_RELEASE_PUBLIC_KEYS_BASE64 ??
  fail("trusted release keys are required");
if (keysEncoded.startsWith("__CONSUELO_")) fail("hosted installer is missing trusted release keys");
const keysJson = Buffer.from(keysEncoded, "base64").toString("utf8");
const trustedKeys = JSON.parse(keysJson) as Record<string, string>;
const manifestUrl = `${baseUrl.replace(/\/$/, "")}/channels/${channel}.json`;
const manifestResponse = await fetch(manifestUrl, {
  signal: AbortSignal.timeout(30_000),
});
if (!manifestResponse.ok) fail(`release manifest request failed with HTTP ${manifestResponse.status}`);
const manifestBytes = await readBoundedResponse(
  manifestResponse,
  1024 * 1024,
  "release manifest",
);
let manifest: unknown;
try {
  manifest = JSON.parse(new TextDecoder().decode(manifestBytes)) as unknown;
} catch {
  fail("release manifest is not valid JSON");
}
if (!isRecord(manifest) || !isRecord(manifest.payload) || !isRecord(manifest.signature)) {
  fail("release manifest contract is invalid");
}
const payload = manifest.payload;
const signature = manifest.signature;
if (
  payload.kind !== "consuelo-os-channel-manifest" ||
  payload.schemaVersion !== 1 ||
  payload.channel !== channel ||
  !Number.isSafeInteger(payload.revision) ||
  Number(payload.revision) <= 0 ||
  !isIsoTimestamp(payload.promotedAt) ||
  typeof payload.bundleId !== "string" ||
  !digestPattern.test(payload.bundleId) ||
  typeof payload.releaseFingerprint !== "string" ||
  !digestPattern.test(payload.releaseFingerprint) ||
  signature.algorithm !== "ed25519" ||
  typeof signature.keyId !== "string" ||
  typeof signature.signature !== "string" ||
  !Array.isArray(payload.platforms)
) fail("release manifest contract is invalid");
const publicKey = trustedKeys[signature.keyId] ??
  fail(`release signing key is not trusted: ${signature.keyId}`);
const accepted = verify(
  null,
  Buffer.from(JSON.stringify(canonicalize(payload))),
  createPublicKey(publicKey),
  Buffer.from(signature.signature, "base64url"),
);
if (!accepted) fail("release manifest signature is invalid");
const statePath = process.env.CONSUELO_RELEASE_STATE_PATH;
let activeChannelState: Record<string, unknown> | undefined;
if (statePath) {
  let activeState: unknown;
  try {
    const stateStats = await lstat(statePath);
    if (stateStats.isSymbolicLink() || !stateStats.isFile()) {
      fail(`activated ${channel} release state must be a regular file`);
    }
    activeState = JSON.parse(await readFile(statePath, "utf8")) as unknown;
  } catch (error: unknown) {
    if (
      !isRecord(error) ||
      typeof error.code !== "string" ||
      error.code !== "ENOENT"
    ) {
      throw error;
    }
  }
  if (activeState !== undefined) {
    if (
      !isRecord(activeState) ||
      activeState.kind !== "consuelo-os-bootstrap-channel-state" ||
      activeState.schemaVersion !== 1 ||
      activeState.channel !== channel ||
      !Number.isSafeInteger(activeState.revision) ||
      Number(activeState.revision) <= 0 ||
      !isIsoTimestamp(activeState.promotedAt) ||
      typeof activeState.releaseFingerprint !== "string" ||
      !digestPattern.test(activeState.releaseFingerprint) ||
      typeof activeState.bundleId !== "string" ||
      !digestPattern.test(activeState.bundleId) ||
      typeof activeState.platformBundleId !== "string" ||
      !digestPattern.test(activeState.platformBundleId)
    ) fail(`activated ${channel} release state is invalid`);
    if (
      Number(payload.revision) < Number(activeState.revision) ||
      Date.parse(payload.promotedAt) < Date.parse(activeState.promotedAt)
    ) fail(`signed release manifest is older than the activated ${channel} release`);
    if (
      payload.revision === activeState.revision &&
      (
        payload.releaseFingerprint !== activeState.releaseFingerprint ||
        payload.bundleId !== activeState.bundleId
      )
    ) fail(`signed release manifest conflicts with activated ${channel} revision ${payload.revision}`);
    activeChannelState = activeState;
  }
}
const platform = process.platform;
const architecture = process.arch;
const selected = payload.platforms.find(
  (candidate: unknown) =>
    isRecord(candidate) &&
    candidate.platform === platform &&
    candidate.architecture === architecture,
) ?? fail(`release does not publish ${platform}-${architecture}`);
if (
  typeof selected.bundleId !== "string" ||
  !digestPattern.test(selected.bundleId)
) fail("runtime bundle ID is invalid");
if (
  typeof selected.archiveDigest !== "string" ||
  !digestPattern.test(selected.archiveDigest)
) fail("runtime archive digest is invalid");
if (
  activeChannelState &&
  payload.revision === activeChannelState.revision &&
  selected.bundleId !== activeChannelState.platformBundleId
) fail(`signed release manifest changes the activated ${channel} platform bundle at revision ${payload.revision}`);
const releaseObjectPattern = new RegExp(
  `^bundles/${selected.bundleId}/[A-Za-z0-9._+-]+\\.tar\\.gz(?:\\.sig)?$`,
);
if (
  typeof selected.cloudflareObjectKey !== "string" ||
  !releaseObjectPattern.test(selected.cloudflareObjectKey)
) fail("runtime release object key is invalid");
const bundleUrl = new URL(
  selected.cloudflareObjectKey,
  `${baseUrl.replace(/\/$/, "")}/`,
);
const bundleResponse = await fetch(bundleUrl, {
  signal: AbortSignal.timeout(600_000),
});
if (!bundleResponse.ok) fail(`runtime bundle request failed with HTTP ${bundleResponse.status}`);
const bytes = await readBoundedResponse(
  bundleResponse,
  512 * 1024 * 1024,
  "runtime bundle",
);
const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
if (digest !== selected.archiveDigest) fail("runtime bundle digest does not match signed release manifest");
const output = process.env.CONSUELO_RELEASE_STAGE_DIR ?? fail("release stage directory is required");
await mkdir(output, { recursive: true });
await writeFile(join(output, "runtime.tar.gz"), bytes, { mode: 0o600 });
await writeFile(join(output, "bundle-id"), `${selected.bundleId}\n`, { mode: 0o600 });
await writeFile(join(output, "trusted-release-keys.json"), `${JSON.stringify(trustedKeys, null, 2)}\n`, { mode: 0o600 });
await writeFile(join(output, "channel-state.json"), `${JSON.stringify({
  schemaVersion: 1,
  kind: "consuelo-os-bootstrap-channel-state",
  channel,
  revision: payload.revision,
  promotedAt: payload.promotedAt,
  releaseFingerprint: payload.releaseFingerprint,
  bundleId: payload.bundleId,
  platformBundleId: selected.bundleId,
}, null, 2)}\n`, { mode: 0o600 });
BUN
  CONSUELO_RELEASE_BASE_URL="$RELEASE_BASE_URL" \
    CONSUELO_RELEASE_CHANNEL="$RELEASE_CHANNEL" \
    CONSUELO_RELEASE_PUBLIC_KEYS_BASE64="$RELEASE_PUBLIC_KEYS_BASE64" \
    CONSUELO_RELEASE_STAGE_DIR="$stage_dir" \
    CONSUELO_RELEASE_STATE_PATH="$RELEASE_CHANNEL_STATE_PATH" \
    "$BUN_BIN" "$verifier"
}

install_verified_runtime() {
  local local_repo
  if local_repo="$(current_repo_dir 2>/dev/null)"; then
    REPO_DIR="$local_repo"
    SOURCE_STATUS="local"
    log "Using local Consuelo OS source: $REPO_DIR"
    return 0
  fi
  if [ "$DRY_RUN" -eq 1 ]; then
    REPO_DIR="$RUNTIME_HOME"
    SOURCE_STATUS="would_download"
    log "dry-run: would verify and install $RELEASE_CHANNEL runtime from $RELEASE_BASE_URL"
    return 0
  fi

  require_command tar "Consuelo OS needs tar to unpack the verified runtime bundle."
  require_command mktemp "Consuelo OS needs mktemp to stage the verified runtime bundle safely."
  local stage_dir bundle_id release_name release_dir extracted_dir pending_channel_state
  stage_dir="$(mktemp -d "${TMPDIR:-/tmp}/consuelo-os-runtime.XXXXXX")"
  RUNTIME_STAGE_DIR="$stage_dir"
  extracted_dir="$stage_dir/runtime"
  if ! verify_runtime_release "$stage_dir"; then
    rm -rf "$stage_dir"
    RUNTIME_STAGE_DIR=""
    fail "signed Consuelo OS runtime verification failed"
  fi
  IFS= read -r bundle_id < "$stage_dir/bundle-id"
  release_name="${bundle_id/:/-}"
  release_dir="$RUNTIME_RELEASES_DIR/$release_name"
  mkdir -p "$extracted_dir"
  if ! tar -xzf "$stage_dir/runtime.tar.gz" -C "$extracted_dir"; then
    rm -rf "$stage_dir"
    RUNTIME_STAGE_DIR=""
    fail "verified Consuelo OS runtime could not be unpacked"
  fi
  if [ ! -f "$extracted_dir/scripts/install.ts" ] ||
    [ ! -f "$extracted_dir/runtime-bundle.manifest.json" ]; then
    rm -rf "$stage_dir"
    RUNTIME_STAGE_DIR=""
    fail "verified Consuelo OS runtime is missing required entrypoints"
  fi

  mkdir -p "$RUNTIME_RELEASES_DIR" "$(dirname "$RUNTIME_HOME")"
  if [ -L "$release_dir" ] || { [ -e "$release_dir" ] && [ ! -d "$release_dir" ]; }; then
    fail "existing verified release path is not a directory: $release_dir"
  elif [ -d "$release_dir" ]; then
    if [ ! -f "$release_dir/scripts/install.ts" ] ||
      [ ! -f "$release_dir/runtime-bundle.manifest.json" ]; then
      local active_release_dir release_dir_resolved stale_release_dir
      active_release_dir=""
      release_dir_resolved="$(cd "$release_dir" && pwd -P)"
      if [ -L "$RUNTIME_HOME" ]; then
        active_release_dir="$(cd "$RUNTIME_HOME" 2>/dev/null && pwd -P || true)"
      fi
      if [ -n "$active_release_dir" ] &&
        [ "$active_release_dir" = "$release_dir_resolved" ]; then
        fail "active verified release directory is incomplete: $release_dir"
      fi
      stale_release_dir="${release_dir}.stale.$$"
      mv "$release_dir" "$stale_release_dir"
      if ! mv "$extracted_dir" "$release_dir"; then
        mv "$stale_release_dir" "$release_dir" || true
        fail "verified Consuelo OS runtime could not replace the incomplete release"
      fi
      rm -rf "$stale_release_dir"
    fi
  else
    mv "$extracted_dir" "$release_dir"
  fi
  mkdir -p "$(dirname "$TRUSTED_RELEASE_KEYS_PATH")"
  mv "$stage_dir/trusted-release-keys.json" "$TRUSTED_RELEASE_KEYS_PATH"
  chmod 600 "$TRUSTED_RELEASE_KEYS_PATH"
  pending_channel_state="$OS_HOME/runtime/.channel-state.${RELEASE_CHANNEL}.$$.new"
  rm -f "$pending_channel_state"
  mv "$stage_dir/channel-state.json" "$pending_channel_state"
  chmod 600 "$pending_channel_state"
  PENDING_CHANNEL_STATE_PATH="$pending_channel_state"
  rm -rf "$stage_dir"
  RUNTIME_STAGE_DIR=""
  PENDING_RUNTIME_RELEASE_DIR="$release_dir"
  REPO_DIR="$release_dir"
  SOURCE_STATUS="verified"
}

activate_verified_runtime() {
  if [ "$SOURCE_STATUS" != "verified" ]; then
    return 0
  fi
  [ -n "$PENDING_RUNTIME_RELEASE_DIR" ] &&
    [ -d "$PENDING_RUNTIME_RELEASE_DIR" ] ||
    fail "verified Consuelo OS runtime is not staged for activation"

  local temporary_link channel_state_directory
  temporary_link="${RUNTIME_HOME}.new.$$"
  rm -f "$temporary_link"
  ln -s "$PENDING_RUNTIME_RELEASE_DIR" "$temporary_link"
  if [ -d "$RUNTIME_HOME" ] && [ ! -L "$RUNTIME_HOME" ]; then
    rmdir "$RUNTIME_HOME" ||
      fail "$RUNTIME_HOME contains unmanaged files and cannot be activated safely"
  elif [ -e "$RUNTIME_HOME" ] && [ ! -L "$RUNTIME_HOME" ]; then
    fail "$RUNTIME_HOME cannot be replaced safely"
  fi
  mv -f -h "$temporary_link" "$RUNTIME_HOME" ||
    fail "verified Consuelo OS runtime could not be activated"
  [ -n "$PENDING_CHANNEL_STATE_PATH" ] &&
    [ -f "$PENDING_CHANNEL_STATE_PATH" ] ||
    fail "verified Consuelo OS channel state is not staged for activation"
  channel_state_directory="$(dirname "$RELEASE_CHANNEL_STATE_PATH")"
  mkdir -p "$channel_state_directory"
  if [ -L "$RELEASE_CHANNEL_STATE_PATH" ] ||
    { [ -e "$RELEASE_CHANNEL_STATE_PATH" ] && [ ! -f "$RELEASE_CHANNEL_STATE_PATH" ]; }; then
    fail "activated release channel state is not a regular file: $RELEASE_CHANNEL_STATE_PATH"
  fi
  mv -f "$PENDING_CHANNEL_STATE_PATH" "$RELEASE_CHANNEL_STATE_PATH" ||
    fail "verified Consuelo OS channel state could not be activated"
  chmod 600 "$RELEASE_CHANNEL_STATE_PATH"
  REPO_DIR="$RUNTIME_HOME"
  PENDING_RUNTIME_RELEASE_DIR=""
  PENDING_CHANNEL_STATE_PATH=""
}

install_runtime_dependencies() {
  local os_dir="$1"
  log "Installing Consuelo OS runtime dependencies..."
  (
    cd "$os_dir"
    BUN_INSTALL_CACHE_DIR="$OS_HOME/runtime/cache/bun" \
      "$BUN_BIN" install --frozen-lockfile --production
  )
  log "Installing Consuelo OS runtime dependencies... done"
}

ensure_dependencies() {
  local os_dir
  os_dir="$(os_package_dir)" || {
    if [ "$DRY_RUN" -eq 1 ]; then
      os_dir="$RUNTIME_HOME"
    else
      fail "Consuelo OS runtime package root is missing"
    fi
  }
  if [ -d "$os_dir/node_modules/@clack/prompts" ] || [ -d "$REPO_DIR/node_modules/@clack/prompts" ]; then
    DEPENDENCY_STATUS="present"
    return 0
  fi

  if [ "$DRY_RUN" -eq 1 ]; then
    DEPENDENCY_STATUS="would_install"
    log "dry-run: would install Consuelo OS runtime dependencies with: bun --cwd $os_dir install"
    return 0
  fi

  install_runtime_dependencies "$os_dir"
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
  local install_args=(./scripts/install.ts --home "$os_home" --mode "${OS_MODE:-local}")
  local script_output="/dev/null"
  local status=0
  if [ "$INSTALL_DAEMONS" -eq 1 ]; then
    install_args+=(--install-daemons)
  fi
  if [ "$SKIP_DAEMONS" -eq 1 ]; then
    install_args+=(--skip-daemons)
  fi
  require_command script "Consuelo OS interactive setup needs macOS script for keyboard input. Re-run non-interactively with:\n  $HOSTED_INSTALL_COMMAND_WITH_ARGS --yes --install-daemons"
  if dev_diagnostics_enabled && [ -n "$CHILD_INSTALL_RAW_TRANSCRIPT" ]; then
    script_output="$CHILD_INSTALL_RAW_TRANSCRIPT"
  fi
  CONSUELO_ONBOARDING_RESULT_FILE="${ONBOARDING_RESULT_FILE:-}" script -q "$script_output" "$BUN_BIN" --cwd "$os_dir" "${install_args[@]}" < /dev/tty || status=$?
  finalize_child_install_transcript
  return "$status"
}

run_install_with_tty() {
  local os_dir="$1"
  local os_home="$2"
  check_install_tty "$os_dir"
  run_install_with_script_pty "$os_dir" "$os_home"
}

validate_onboarding_json() {
  local onboarding_payload="$1"
  local validation_error
  local validation_status=0

  if [ -z "$onboarding_payload" ]; then
    fail "Consuelo OS interactive onboarding did not complete: onboarding result file was empty.$(child_install_transcript_hint)"
  fi

  validation_error="$(ONBOARDING_JSON_PAYLOAD="$onboarding_payload" "$BUN_BIN" --print '
(() => {
  const raw = process.env.ONBOARDING_JSON_PAYLOAD || "";
  const fail = (message) => { process.stderr.write(message); process.exit(1); };
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    fail("onboarding result was not valid JSON");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    fail("onboarding result was not a JSON object");
  }
  if (typeof payload.installDaemons !== "boolean") {
    fail("onboarding result did not include installDaemons");
  }
  if (!payload.onboarding || typeof payload.onboarding !== "object" || Array.isArray(payload.onboarding)) {
    fail("onboarding result did not include onboarding details");
  }
  return "ok";
})()
' 2>&1 >/dev/null)" || validation_status=$?
  if [ "$validation_status" -ne 0 ]; then
    fail "Consuelo OS interactive onboarding did not complete: ${validation_error:-onboarding result was invalid}.$(child_install_transcript_hint)"
  fi
}

run_onboarding() { # run_onboarding_json
  local os_dir
  os_dir="$(os_package_dir)" || {
    if [ "$DRY_RUN" -eq 1 ]; then
      os_dir="$REPO_DIR"
    else
      fail "Consuelo OS runtime package root is missing"
    fi
  }
  local os_home="$OS_HOME"


  if [ "$DRY_RUN" -eq 1 ]; then
    if [ -n "$BUN_BIN" ] && [ -f "$os_dir/scripts/install.ts" ]; then
      "$BUN_BIN" --cwd "$os_dir" ./scripts/install.ts --dry-run --yes --json --mode "${OS_MODE:-local}"
      ONBOARDING_STATUS="dry_run"
    else
      log "dry-run: would run: bun --cwd $os_dir ./scripts/install.ts --dry-run --yes --json"
      ONBOARDING_STATUS="would_run"
    fi
    return 0
  fi

  if [ "$YES" -eq 1 ] || [ "$JSON" -eq 1 ]; then
    local install_args=(./scripts/install.ts --yes --json --home "$os_home" --mode "${OS_MODE:-local}")
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
    local install_status=0
    if run_install_with_tty "$os_dir" "$os_home"; then
      install_status=0
    else
      install_status=$?
    fi
    ONBOARDING_JSON="$(cat "$ONBOARDING_RESULT_FILE" 2>/dev/null || true)"
    rm -f "$ONBOARDING_RESULT_FILE"
    if [ "$install_status" -ne 0 ]; then
      fail "Consuelo OS installer exited before onboarding completed (exit $install_status)."
    fi
    validate_onboarding_json "$ONBOARDING_JSON"
    if printf '%s' "$ONBOARDING_JSON" | grep -q '"installDaemons"[[:space:]]*:[[:space:]]*true'; then
      INSTALL_DAEMONS=1
    else
      SKIP_DAEMONS=1
    fi
  fi
  ONBOARDING_STATUS="installed"
}

onboarding_workspace_host() {
  [ -n "$ONBOARDING_JSON" ] || return 1
  [ -n "$BUN_BIN" ] || return 1

  ONBOARDING_JSON_PAYLOAD="$ONBOARDING_JSON" "$BUN_BIN" --print '
const payload = JSON.parse(process.env.ONBOARDING_JSON_PAYLOAD || "{}");
const host = payload?.onboarding?.workspaceHost || payload?.platformProvisioning?.workspaceHost || "";
if (typeof host === "string") host;
' 2>/dev/null
}

open_workspace_launcher() {
  [ "$JSON" -eq 0 ] || return 0
  [ "$DRY_RUN" -eq 0 ] || return 0
  [ "$YES" -eq 0 ] || return 0
  [ "$ONBOARDING_STATUS" = "installed" ] || return 0

  local workspace_host
  workspace_host="$(onboarding_workspace_host || true)"
  [ -n "$workspace_host" ] || return 0

  open_url "https://$workspace_host"
}

run_daemon_dry_run() {
  local os_dir
  os_dir="$(os_package_dir)" || os_dir="$REPO_DIR"
  if [ ! -f "$os_dir/scripts/install-system-daemons.sh" ]; then
    case "$SOURCE_STATUS" in
      would_download|would_refresh)
        log "dry-run: would run: bash $os_dir/scripts/install-system-daemons.sh --dry-run --quiet"
        DAEMON_STATUS="would_run"
        return 0
        ;;
    esac
    fail "$SOURCE_STATUS Consuelo OS source is missing $os_dir/scripts/install-system-daemons.sh"
  fi
  (
    cd "$os_dir"
    CONSUELO_HOME="$OS_HOME" \
      CONSUELO_DAEMON_HOME="$HOME" \
      CONSUELO_SECURITY_GENERATED_DIR="$OS_HOME/node/security/generated" \
      CONSUELO_DAEMON_LOG_DIR="$OS_HOME/node/logs" \
      bash ./scripts/install-system-daemons.sh --dry-run --quiet
  )
  DAEMON_STATUS="dry_run"
}

install_daemons_quiet() {
  local os_dir
  os_dir="$(os_package_dir)" || fail "Consuelo OS runtime package root is missing"
  (
    cd "$os_dir"
    CONSUELO_HOME="$OS_HOME" \
      CONSUELO_DAEMON_HOME="$HOME" \
      CONSUELO_SECURITY_GENERATED_DIR="$OS_HOME/node/security/generated" \
      CONSUELO_DAEMON_LOG_DIR="$OS_HOME/node/logs" \
      bash ./scripts/install-system-daemons.sh --quiet
  )
}

maybe_install_daemons() {
  if [ "$SKIP_DAEMONS" -eq 1 ]; then
    DAEMON_STATUS="skipped"
    log "Skipping Consuelo OS user LaunchAgent setup."
    return 0
  fi

  if [ "$DRY_RUN" -eq 1 ]; then
    if [ -n "$PORTLESS_BIN" ]; then
      log "dry-run: would offer user LaunchAgent setup for com.consuelo.system, com.consuelo.portless.system, and com.consuelo.watchdog."
    else
      log "dry-run: would offer user LaunchAgent setup for com.consuelo.system and com.consuelo.watchdog; portless is optional and not configured."
    fi
    run_daemon_dry_run
    return 0
  fi

  if [ "$INSTALL_DAEMONS" -eq 0 ] && [ "$YES" -eq 1 ]; then
    DAEMON_STATUS="skipped"
    log "Skipping LaunchAgent setup because --install-daemons was not passed. To install later, run: bash packages/os/scripts/bootstrap.sh --yes --install-daemons"
    return 0
  fi

  if [ "$INSTALL_DAEMONS" -eq 0 ]; then
    local daemon_choice
    daemon_choice="$(prompt_select "Install Consuelo OS user LaunchAgents?" "yes" "yes" "no" "$HOSTED_INSTALL_COMMAND_WITH_ARGS --yes --install-daemons")"
    if [ "$daemon_choice" = "no" ]; then
      DAEMON_STATUS="skipped"
      log "Skipping Consuelo OS user LaunchAgent setup."
      return 0
    fi
  fi

  if [ "$DEBUG" = "1" ]; then
    local os_dir
    os_dir="$(os_package_dir)" || fail "Consuelo OS runtime package root is missing"
    CONSUELO_OS_DEBUG=1 \
      CONSUELO_HOME="$OS_HOME" \
      CONSUELO_DAEMON_HOME="$HOME" \
      CONSUELO_SECURITY_GENERATED_DIR="$OS_HOME/node/security/generated" \
      CONSUELO_DAEMON_LOG_DIR="$OS_HOME/node/logs" \
      "$BUN_BIN" run --cwd "$os_dir" install:system-daemons
  else
    run_with_loading_dots "setting up background service" install_daemons_quiet
    log "background service ready"
  fi
  DAEMON_STATUS="installed"
}

# The installer writes $OS_HOME/bin/consuelo but has never put that directory on PATH, so a fresh
# install left the documented `consuelo` command unavailable. Appended idempotently to the shell rc,
# and only there: the running installer cannot change the parent shell.
ensure_command_on_path() {
  local bin_dir="$OS_HOME/bin"
  local rc_file=""

  case "$(basename "${SHELL:-}")" in
    zsh) rc_file="$HOME/.zshrc" ;;
    bash)
      if [ -f "$HOME/.bash_profile" ]; then rc_file="$HOME/.bash_profile"; else rc_file="$HOME/.bashrc"; fi
      ;;
    *) rc_file="" ;;
  esac

  # An unrelated binary of the same name silently shadows ours, which reads as OS being broken
  # rather than as a name collision.
  local existing
  existing="$(command -v consuelo 2>/dev/null || true)"
  if [ -n "$existing" ] && [ "$existing" != "$bin_dir/consuelo" ]; then
    log ""
    log "Warning: another 'consuelo' is already on PATH at $existing"
    log "It will shadow Consuelo OS. Remove it, or put $bin_dir earlier on PATH."
  fi

  if [ -z "$rc_file" ]; then
    PATH_HINT="Add this to your shell profile:  export PATH=\"$bin_dir:\$PATH\""
    return 0
  fi

  if [ -f "$rc_file" ] && grep -qF "$bin_dir" "$rc_file" 2>/dev/null; then
    PATH_HINT="Already on PATH via $rc_file"
    return 0
  fi

  {
    printf '\n# Consuelo OS\n'
    printf 'export PATH="%s:$PATH"\n' "$bin_dir"
  } >> "$rc_file" 2>/dev/null || {
    PATH_HINT="Add this to your shell profile:  export PATH=\"$bin_dir:\$PATH\""
    return 0
  }
  PATH_HINT="Added $bin_dir to PATH in $rc_file — open a new terminal to use it"
}

print_success_summary() {
  [ "$JSON" -eq 0 ] || return 0

  local os_home="$OS_HOME"

  log ""
  log "Consuelo OS setup complete"
  log "Home: $os_home"
  if [ -n "${PATH_HINT:-}" ]; then
    log "$PATH_HINT"
  fi
  log ""
  log "Try:  consuelo status"
}

main() {
  parse_args "$@"
  init_dev_diagnostics
  choose_os_mode
  handle_cloud_mode
  check_mac_prerequisites
  render_dependency_progress
  prompt_dependency_setup
  ensure_bun
  ensure_install_id
  ensure_portless
  ensure_caddy
  ensure_cloudflared
  install_verified_runtime
  persist_runtime_paths
  ensure_dependencies
  run_onboarding
  activate_verified_runtime
  maybe_install_daemons
  ensure_command_on_path
  print_success_summary
  open_workspace_launcher
  emit_json_summary
}

main "$@"

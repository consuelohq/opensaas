#!/usr/bin/env bash
set -euo pipefail

PROGRAM="Consuelo OS bootstrap"
HOSTED_INSTALL_COMMAND="curl -fsSL https://install.consuelohq.com/os | bash"
HOSTED_INSTALL_COMMAND_WITH_ARGS="curl -fsSL https://install.consuelohq.com/os | bash -s --"
OS_HOME="${CONSUELO_HOME:-$HOME/.consuelo/os}"
RUNTIME_BIN_DIR="${CONSUELO_OS_RUNTIME_BIN_DIR:-$OS_HOME/bin}"
DEFAULT_SOURCE_DIR="${TMPDIR:-/tmp}/consuelo-os-source"
SOURCE_DIR="${CONSUELO_OS_SOURCE_DIR:-$DEFAULT_SOURCE_DIR}"
REPO_ARCHIVE_URL="${CONSUELO_OS_REPO_ARCHIVE_URL:-https://github.com/consuelohq/opensaas/archive/refs/heads/main.tar.gz}"
ALLOW_GLOBAL_RUNTIME_LOOKUP="${CONSUELO_OS_ALLOW_GLOBAL_RUNTIME_LOOKUP:-1}"
CLOUDFLARED_REQUIRED="${CONSUELO_OS_REQUIRE_CLOUDFLARED:-1}"
CLOUDFLARED_VERSION="${CONSUELO_CLOUDFLARED_VERSION:-2026.6.1}"
CLOUDFLARED_DARWIN_ARM64_SHA256="f6d4c439c6c782b83264951d327989ce5e23373acc5942b872411601fedb020d"
CLOUDFLARED_DARWIN_AMD64_SHA256="d7a66b525fe76820da6e5406611b61e48b40de682368ac00454d9158f085be4b"

MACOS_EXPECTED_SYSTEM_TOOLS=(curl tar mktemp launchctl plutil lsof script)
INSTALLER_MANAGED_RUNTIME_BINARIES=(bun portless cloudflared)
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
REFRESH_SOURCE=1
DEBUG="${CONSUELO_OS_DEBUG:-0}"

BUN_BIN=""
PORTLESS_BIN="${PORTLESS_BIN:-}"
PORTLESS_ENABLED="${PORTLESS_ENABLED:-auto}"
PORTLESS_INSTALL="${CONSUELO_OS_INSTALL_PORTLESS:-0}"
PORTLESS_REQUIRED="${CONSUELO_OS_REQUIRE_PORTLESS:-0}"
CLOUDFLARED_BIN="${CLOUDFLARED_BIN:-}"
REPO_DIR=""
ONBOARDING_STATUS="pending"
DAEMON_STATUS="pending"
BUN_STATUS="pending"
PORTLESS_STATUS="pending"
CLOUDFLARED_STATUS="pending"
SOURCE_STATUS="pending"
ONBOARDING_JSON=""
DEPENDENCY_STATUS="pending"
CONTACT_URL="https://consuelohq.com/contact/"
OS_MODE=""

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
  --refresh-source  refresh an existing hosted source checkout/archive before onboarding; default for hosted installs
  --use-existing-source reuse an existing hosted source checkout when present
  --mode <mode>      local or cloud
  --json            print a machine-readable summary at the end
  --debug           print detailed daemon diagnostics
  --help, -h        show this help

Environment overrides:
  CONSUELO_OS_SOURCE_DIR       temporary checkout/download directory for hosted installs
  CONSUELO_OS_REPO_ARCHIVE_URL source archive URL; defaults to the main branch archive
  CONSUELO_OS_RUNTIME_BIN_DIR  local runtime binary directory; defaults to ~/.consuelo/os/bin
  PORTLESS_BIN                 absolute portless binary path to reuse
  CLOUDFLARED_BIN              absolute cloudflared binary path to reuse
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
      "cloudflared": { "classification": "installer_managed", "status": $(json_escape "$CLOUDFLARED_STATUS"), "path": $(json_path_or_null "$CLOUDFLARED_BIN") }
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
      --refresh-source) REFRESH_SOURCE=1 ;;
      --use-existing-source) REFRESH_SOURCE=0 ;;
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

ensure_portless() {
  local managed_path="$RUNTIME_BIN_DIR/portless"

  case "${PORTLESS_ENABLED:-auto}" in
    0|false|no)
      PORTLESS_BIN=""
      PORTLESS_ENABLED="0"
      PORTLESS_STATUS="skipped"
      log "portless disabled; Consuelo OS will use http://127.0.0.1:8960"
      return 0
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
        log "optional portless install finished without an executable; Consuelo OS will use http://127.0.0.1:8960"
        return 0
      fi
      PORTLESS_ENABLED="1"
      PORTLESS_STATUS="installed"
      log "portless installed: $PORTLESS_BIN"
      return 0
    fi
    PORTLESS_BIN=""
    PORTLESS_STATUS="optional_unavailable"
    log "optional portless install unavailable; Consuelo OS will use http://127.0.0.1:8960"
    return 0
  fi

  PORTLESS_STATUS="optional_missing"
  log "portless is not installed; Consuelo OS will use http://127.0.0.1:8960"
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
  if [ -n "$PORTLESS_BIN" ]; then
    persist_env_value "$env_file" PORTLESS_BIN "$PORTLESS_BIN"
    persist_env_value "$env_file" PORTLESS_ENABLED "1"
  else
    remove_env_value "$env_file" PORTLESS_BIN
    persist_env_value "$env_file" PORTLESS_ENABLED "0"
  fi
  persist_env_value "$env_file" CLOUDFLARED_BIN "$CLOUDFLARED_BIN"
  export BUN_BIN PORTLESS_BIN PORTLESS_ENABLED CLOUDFLARED_BIN
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

  if ! curl_retry "$REPO_ARCHIVE_URL" -o "$archive_file"; then
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
    SOURCE_STATUS="reused"
    log "Using existing Consuelo OS source: $REPO_DIR"
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
install_runtime_dependencies() {
  local os_dir="$1"
  log "Installing Consuelo OS runtime dependencies..."
  (cd "$os_dir" && "$BUN_BIN" install)
  log "Installing Consuelo OS runtime dependencies... done"
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
  if [ "$INSTALL_DAEMONS" -eq 1 ]; then
    install_args+=(--install-daemons)
  fi
  if [ "$SKIP_DAEMONS" -eq 1 ]; then
    install_args+=(--skip-daemons)
  fi
  require_command script "Consuelo OS interactive setup needs macOS script for keyboard input. Re-run non-interactively with:\n  $HOSTED_INSTALL_COMMAND_WITH_ARGS --yes --install-daemons"
  CONSUELO_ONBOARDING_RESULT_FILE="${ONBOARDING_RESULT_FILE:-}" script -q /dev/null "$BUN_BIN" --cwd "$os_dir" "${install_args[@]}" < /dev/tty
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


  if [ "$DRY_RUN" -eq 1 ]; then
    if [ -n "$BUN_BIN" ]; then
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

  log ""
  log "Consuelo OS setup complete"
  log "Home: $os_home"
}

main() {
  parse_args "$@"
  choose_os_mode
  handle_cloud_mode
  check_mac_prerequisites
  render_dependency_progress
  prompt_dependency_setup
  ensure_bun
  ensure_portless
  ensure_cloudflared
  persist_runtime_paths
  resolve_source
  ensure_dependencies
  run_onboarding
  maybe_install_daemons
  print_success_summary
  open_workspace_launcher
  emit_json_summary
}

main "$@"


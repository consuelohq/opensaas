#!/usr/bin/env bash
set -euo pipefail

PACKAGE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SWIFT_PACKAGE="$PACKAGE_ROOT/native/macos"
OUTPUT_DIR="$PACKAGE_ROOT/.tmp-macos-alpha"
OUTPUT_DIR_SET=0
INSTALL_APP=0
LAUNCH_APP=0
APP_VERSION="${CONSUELO_MAC_APP_VERSION:-0.1.0-alpha}"
APP_BUILD_VERSION="${CONSUELO_MAC_APP_BUILD_VERSION:-1}"
SERVICE_HOST_OVERRIDE="${CONSUELO_MAC_APP_SERVICE_HOST:-}"
ADHOC_SIGN="${CONSUELO_MAC_APP_ADHOC_SIGN:-1}"

case "$APP_VERSION" in
  *[!0-9A-Za-z.-]*|'')
    printf 'CONSUELO_MAC_APP_VERSION must contain only letters, numbers, dots, and hyphens.\n' >&2
    exit 2
    ;;
esac
case "$APP_BUILD_VERSION" in
  *[!0-9.]*|'')
    printf 'CONSUELO_MAC_APP_BUILD_VERSION must contain only numbers and dots.\n' >&2
    exit 2
    ;;
esac
case "$ADHOC_SIGN" in
  0|1) ;;
  *)
    printf 'CONSUELO_MAC_APP_ADHOC_SIGN must be 0 or 1.\n' >&2
    exit 2
    ;;
esac

usage() {
  cat <<'EOF'
Usage: macos-alpha-package.sh [output-dir] [--install] [--launch]

Build and archive the ad-hoc-signed Consuelo macOS alpha app.

  --install  Copy the alpha app to ~/Applications/Consuelo.app.
  --launch   Install the alpha app, then open it.

Set CONSUELO_MAC_APP_INSTALL_DIR to another directory inside your home folder
when an isolated development install is needed.
EOF
}

while (($# > 0)); do
  case "$1" in
    --install)
      INSTALL_APP=1
      shift
      ;;
    --launch)
      INSTALL_APP=1
      LAUNCH_APP=1
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    --*)
      printf 'Unknown option: %s\n' "$1" >&2
      usage >&2
      exit 2
      ;;
    *)
      if ((OUTPUT_DIR_SET)); then
        printf 'Only one output directory may be provided.\n' >&2
        exit 2
      fi
      OUTPUT_DIR="$1"
      OUTPUT_DIR_SET=1
      shift
      ;;
  esac
done

APP_DIR="$OUTPUT_DIR/Consuelo.app"
ARCHIVE_PATH="$OUTPUT_DIR/Consuelo.app.tar.gz"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$OUTPUT_DIR/Consuelo.app/Contents/MacOS"
LAUNCH_SERVICES_DIR="$OUTPUT_DIR/Consuelo.app/Contents/Library/LaunchServices"

rm -rf "$APP_DIR"
rm -f "$ARCHIVE_PATH"
mkdir -p "$MACOS_DIR" "$LAUNCH_SERVICES_DIR"

swift build \
  --package-path "$SWIFT_PACKAGE" \
  --configuration release \
  --product ConsueloMenuBarApp
BIN_DIR="$(swift build --package-path "$SWIFT_PACKAGE" --configuration release --show-bin-path)"
cp "$BIN_DIR/ConsueloMenuBarApp" "$MACOS_DIR/ConsueloMenuBarApp"
if [ -n "$SERVICE_HOST_OVERRIDE" ]; then
  if [ ! -f "$SERVICE_HOST_OVERRIDE" ]; then
    printf 'CONSUELO_MAC_APP_SERVICE_HOST does not exist: %s\n' "$SERVICE_HOST_OVERRIDE" >&2
    exit 2
  fi
  cp "$SERVICE_HOST_OVERRIDE" "$LAUNCH_SERVICES_DIR/ConsueloServiceHost"
else
  swift build \
    --package-path "$SWIFT_PACKAGE" \
    --configuration release \
    --product ConsueloServiceHost
  cp "$BIN_DIR/ConsueloServiceHost" "$LAUNCH_SERVICES_DIR/ConsueloServiceHost"
fi
chmod 755 "$MACOS_DIR/ConsueloMenuBarApp" "$LAUNCH_SERVICES_DIR/ConsueloServiceHost"

cat > "$CONTENTS_DIR/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleDisplayName</key>
  <string>Consuelo OS</string>
  <key>CFBundleExecutable</key>
  <string>ConsueloMenuBarApp</string>
  <key>CFBundleIdentifier</key>
  <string>com.consuelohq.os.menubar</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>Consuelo OS</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>$APP_VERSION</string>
  <key>CFBundleVersion</key>
  <string>$APP_BUILD_VERSION</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>LSUIElement</key>
  <true/>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST

if [ "$ADHOC_SIGN" -eq 1 ] && command -v codesign >/dev/null 2>&1; then
  codesign --force --sign - --timestamp=none "$APP_DIR"
fi

tar -czf "$ARCHIVE_PATH" -C "$OUTPUT_DIR" Consuelo.app

if ((INSTALL_APP)); then
  INSTALL_ROOT="${CONSUELO_MAC_APP_INSTALL_DIR:-$HOME/Applications}"
  case "$INSTALL_ROOT" in
    "$HOME"|"$HOME"/*) ;;
    *)
      printf 'CONSUELO_MAC_APP_INSTALL_DIR must be inside your home directory.\n' >&2
      exit 2
      ;;
  esac
  case "$INSTALL_ROOT" in
    *"/../"*|*/..)
      printf 'CONSUELO_MAC_APP_INSTALL_DIR may not contain parent-directory traversal.\n' >&2
      exit 2
      ;;
  esac

  INSTALLED_APP="$INSTALL_ROOT/Consuelo.app"
  mkdir -p "$INSTALL_ROOT"
  ditto "$APP_DIR" "$INSTALLED_APP"
  printf 'Installed alpha app: %s\n' "$INSTALLED_APP"
  if ((LAUNCH_APP)); then
    open "$INSTALLED_APP"
  fi
fi

printf '%s\n' "$ARCHIVE_PATH"

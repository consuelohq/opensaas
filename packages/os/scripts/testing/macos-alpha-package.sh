#!/usr/bin/env bash
set -euo pipefail

PACKAGE_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SWIFT_PACKAGE="$PACKAGE_ROOT/native/macos"
OUTPUT_DIR="${1:-$PACKAGE_ROOT/.tmp-macos-alpha}"
APP_DIR="$OUTPUT_DIR/Consuelo.app"
CONTENTS_DIR="$APP_DIR/Contents"
MACOS_DIR="$OUTPUT_DIR/Consuelo.app/Contents/MacOS"

rm -rf "$APP_DIR"
mkdir -p "$MACOS_DIR"

swift build \
  --package-path "$SWIFT_PACKAGE" \
  --configuration release \
  --product ConsueloMenuBarApp
BIN_DIR="$(swift build --package-path "$SWIFT_PACKAGE" --configuration release --show-bin-path)"
cp "$BIN_DIR/ConsueloMenuBarApp" "$MACOS_DIR/ConsueloMenuBarApp"

cat > "$CONTENTS_DIR/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleDisplayName</key>
  <string>Consuelo</string>
  <key>CFBundleExecutable</key>
  <string>ConsueloMenuBarApp</string>
  <key>CFBundleIdentifier</key>
  <string>com.consuelohq.os.menubar.alpha</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>Consuelo</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.1.0-alpha</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>13.0</string>
  <key>LSUIElement</key>
  <true/>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST

if command -v codesign >/dev/null 2>&1; then
  codesign --force --sign - --timestamp=none "$APP_DIR"
fi

printf '%s\n' "$APP_DIR"

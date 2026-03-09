#!/usr/bin/env bash
# refresh a linear oauth token (kiro or opencode)
# usage: bash linear-refresh.sh [--opencode]
set -euo pipefail

AGENT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ "${1:-}" = "--opencode" ]; then
  TOKEN_FILE="$AGENT_DIR/.opencode-token.json"
  CLIENT_ID="9b2b83a4ca6cebc0ce9df6a2ad4ed834"
  CLIENT_SECRET="REDACTED_OPENCODE_CLIENT_SECRET"
  LABEL="opencode"
else
  TOKEN_FILE="$AGENT_DIR/.oauth-token.json"
  CLIENT_ID="83e3d4cd417ac427494d5a811438c4cb"
  CLIENT_SECRET="REDACTED_KIRO_CLIENT_SECRET"
  LABEL="kiro"
fi

if [ ! -f "$TOKEN_FILE" ]; then
  echo "error: $TOKEN_FILE not found. run oauth flow first." >&2
  exit 1
fi

REFRESH_TOKEN=$(jq -r '.refresh_token' "$TOKEN_FILE")
if [ -z "$REFRESH_TOKEN" ] || [ "$REFRESH_TOKEN" = "null" ]; then
  echo "error: no refresh_token in $TOKEN_FILE" >&2
  exit 1
fi

RESPONSE=$(curl -s -X POST https://api.linear.app/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token&refresh_token=$REFRESH_TOKEN&client_id=$CLIENT_ID&client_secret=$CLIENT_SECRET")

if echo "$RESPONSE" | jq -e '.access_token' > /dev/null 2>&1; then
  echo "$RESPONSE" | jq '.' > "$TOKEN_FILE"
  echo "$LABEL token refreshed ✅"
else
  echo "error refreshing $LABEL token: $RESPONSE" >&2
  exit 1
fi

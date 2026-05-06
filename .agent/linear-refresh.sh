#!/usr/bin/env bash
set -euo pipefail

AGENT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -f "$AGENT_DIR/config.sh" ]; then
  source "$AGENT_DIR/config.sh"
else
  echo "error: $AGENT_DIR/config.sh not found. create it via .agent/linear-setup.sh" >&2
  exit 1
fi

case "${1:-}" in
  --opencode|--chatgpt)
    TOKEN_FILE="$AGENT_DIR/.chatgpt-token.json"
    CLIENT_ID="${CHATGPT_OAUTH_CLIENT_ID:-${OPENCODE_OAUTH_CLIENT_ID:-9b2b83a4ca6cebc0ce9df6a2ad4ed834}}"
    CLIENT_SECRET="${CHATGPT_OAUTH_CLIENT_SECRET:-${OPENCODE_OAUTH_CLIENT_SECRET:-}}"
    LABEL="chatgpt"
    ;;
  "")
    TOKEN_FILE="$AGENT_DIR/.oauth-token.json"
    CLIENT_ID="${LINEAR_OAUTH_CLIENT_ID:-83e3d4cd417ac427494d5a811438c4cb}"
    CLIENT_SECRET="${LINEAR_OAUTH_CLIENT_SECRET:-}"
    LABEL="kiro"
    ;;
  *)
    echo "usage: $0 [--chatgpt|--opencode]" >&2
    exit 1
    ;;
esac

if [ -z "$CLIENT_SECRET" ]; then
  echo "error: missing OAuth client secret for $LABEL in $AGENT_DIR/config.sh" >&2
  exit 1
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
  TMP_FILE="$(mktemp)"
  echo "$RESPONSE" | jq --slurpfile old "$TOKEN_FILE" '
    . + {
      user_id: $old[0].user_id,
      user_name: $old[0].user_name,
      note: $old[0].note
    } | with_entries(select(.value != null))
  ' > "$TMP_FILE"
  mv "$TMP_FILE" "$TOKEN_FILE"
  echo "$LABEL token refreshed ✅"
else
  echo "error refreshing $LABEL token: $RESPONSE" >&2
  exit 1
fi

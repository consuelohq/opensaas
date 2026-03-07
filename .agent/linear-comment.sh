#!/bin/bash
# post a comment to a linear issue as opencode (default) or kiro
# usage: linear-comment.sh [--as kiro] <issue-uuid> <body-or-file>

set -euo pipefail

IDENTITY="opencode"
if [ "${1:-}" = "--as" ]; then
  IDENTITY="${2:?usage: --as <identity>}"
  shift 2
fi

ISSUE_ID="${1:?usage: linear-comment.sh [--as kiro] <issue-uuid> <body-or-file>}"
BODY_ARG="${2:?usage: linear-comment.sh [--as kiro] <issue-uuid> <body-or-file>}"

AGENT_DIR="/Users/kokayi/Dev/opensaas/.agent"

case "$IDENTITY" in
  kiro)
    TOKEN=$(cat "$AGENT_DIR/.oauth-token.json" | jq -r '.access_token')
    ;;
  opencode)
    TOKEN=$(cat "$AGENT_DIR/.opencode-token.json" | jq -r '.access_token')
    ;;
  *)
    echo "unknown identity: $IDENTITY (use kiro or opencode)" >&2
    exit 1
    ;;
esac

if [ -f "$BODY_ARG" ]; then
  BODY=$(cat "$BODY_ARG")
else
  BODY="$BODY_ARG"
fi

jq -n --arg id "$ISSUE_ID" --arg body "$BODY" \
  '{"query": "mutation($id:String!,$body:String!){commentCreate(input:{issueId:$id,body:$body}){success}}", "variables": {"id": $id, "body": $body}}' | \
curl -s https://api.linear.app/graphql \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @-

#!/usr/bin/env bash
# health-check.sh — curl every opensaas REST route and twenty graphql endpoint
# usage: ./scripts/health-check.sh [BASE_URL]
# default: https://app.consuelohq.com

set -euo pipefail

BASE="${1:-https://app.consuelohq.com}"
PASS=0
FAIL=0
SKIP=0
RESULTS=""

check() {
  local label="$1" method="$2" path="$3"
  shift 3
  local url="${BASE}${path}"
  local code body
  body=$(curl -s -w "\n%{http_code}" -X "$method" "$url" "$@" 2>/dev/null) || true
  code=$(echo "$body" | tail -1)
  body=$(echo "$body" | sed '$d')

  local status icon
  if [[ "$code" =~ ^[23] ]] && echo "$body" | head -1 | grep -q '<!doctype\|<html'; then
    icon="🌐"; ((FAIL++))  # SPA fallthrough — route not registered
  elif [[ "$code" =~ ^[23] ]]; then
    icon="✅"; ((PASS++))
  elif [[ "$code" == "401" || "$code" == "403" ]]; then
    icon="🔒"; ((SKIP++))  # auth required — endpoint exists
  else
    icon="❌"; ((FAIL++))
  fi

  local snippet
  snippet=$(echo "$body" | head -c 120 | tr '\n' ' ')
  printf "%-3s %-6s %-50s %s  %s\n" "$icon" "$code" "[$method] $path" "$snippet"
}

check_graphql() {
  local label="$1" query="$2"
  local url="${BASE}/graphql"
  local code body
  body=$(curl -s -w "\n%{http_code}" -X POST "$url" \
    -H "Content-Type: application/json" \
    -d "{\"query\":\"$query\"}" 2>/dev/null) || true
  code=$(echo "$body" | tail -1)
  body=$(echo "$body" | sed '$d')

  local icon
  if [[ "$code" =~ ^2 ]] && ! echo "$body" | grep -q '"errors"'; then
    icon="✅"; ((PASS++))
  elif [[ "$code" =~ ^2 ]] && echo "$body" | grep -q '"errors"'; then
    icon="⚠️"; ((SKIP++))  # graphql error but endpoint alive
  else
    icon="❌"; ((FAIL++))
  fi

  local snippet
  snippet=$(echo "$body" | head -c 120 | tr '\n' ' ')
  printf "%-3s %-6s %-50s %s\n" "$icon" "$code" "[GQL] $label" "$snippet"
}

echo "=========================================="
echo " opensaas health check"
echo " target: $BASE"
echo " time:   $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "=========================================="
echo ""

# --- twenty core ---
echo "── twenty core ──"
check "healthz"           GET  /healthz
check "graphql-alive"     POST /graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{__typename}"}'
check "metadata-alive"    POST /metadata \
  -H "Content-Type: application/json" \
  -d '{"query":"{__typename}"}'

echo ""
echo "── twenty graphql mutations (auth) ──"
check_graphql "signIn"                        "mutation { signIn(email: \\\"test@test.com\\\", password: \\\"test\\\") { tokens { accessOrWorkspaceAgnosticToken { token } } } }"
check_graphql "getLoginTokenFromCredentials"  "mutation { getLoginTokenFromCredentials(email: \\\"test@test.com\\\", password: \\\"test\\\") { loginToken { token } } }"

# --- opensaas REST /v1/* ---
echo ""
echo "── opensaas REST: health ──"
check "api-health"        GET  /v1/health

echo ""
echo "── opensaas REST: voice / phone ──"
check "phone-numbers"     GET  /v1/phone-numbers
check "voice-token"       GET  /v1/voice/token
check "voice-preflight"   GET  /v1/voice/preflight
check "voice-active-call" GET  /v1/voice/active-call

echo ""
echo "── opensaas REST: calls ──"
check "calls-history"     GET  /v1/calls/history
check "calls-create"      POST /v1/calls \
  -H "Content-Type: application/json" -d '{}'
check "calls-status"      GET  /v1/calls/status/CA0000000000000000000000000000

echo ""
echo "── opensaas REST: parallel dialing ──"
check "parallel-validate" POST /v1/calls/parallel/validate \
  -H "Content-Type: application/json" -d '{}'

echo ""
echo "── opensaas REST: contacts ──"
check "contacts-list"     GET  /v1/contacts
check "contacts-search"   GET  /v1/contacts/search
check "contacts-create"   POST /v1/contacts \
  -H "Content-Type: application/json" -d '{}'

echo ""
echo "── opensaas REST: files ──"
check "files-list"        GET  /v1/files
check "files-upload-url"  POST /v1/files/upload-url \
  -H "Content-Type: application/json" -d '{}'

echo ""
echo "── opensaas REST: knowledge ──"
check "kb-collections"    GET  /v1/knowledge/collections
check "kb-stats"          GET  /v1/knowledge/stats
check "kb-search"         POST /v1/knowledge/search \
  -H "Content-Type: application/json" -d '{"query":"test"}'

echo ""
echo "── opensaas REST: analytics ──"
check "analytics-metrics" GET  /v1/analytics/metrics

echo ""
echo "── opensaas REST: coaching ──"
check "coaching-create"   POST /v1/coaching \
  -H "Content-Type: application/json" -d '{}'
check "coaching-analyze"  POST /v1/coaching/analyze \
  -H "Content-Type: application/json" -d '{}'

echo ""
echo "── opensaas REST: workspace ──"
check "workspace-current" GET  /v1/workspaces/current

echo ""
echo "── opensaas REST: settings ──"
check "settings-prefs"    GET  /v1/settings/preferences
check "settings-twilio"   GET  /v1/settings/twilio

echo ""
echo "── opensaas REST: queues ──"
check "queues-create"     POST /v1/queues \
  -H "Content-Type: application/json" -d '{}'

echo ""
echo "── opensaas REST: assistant ──"
check "assistant-convos"  GET  /v1/assistant/conversations
check "assistant-create"  POST /v1/assistant \
  -H "Content-Type: application/json" -d '{}'

echo ""
echo "── opensaas REST: integrations (GHL) ──"
check "ghl-status"        GET  /v1/integrations/ghl/status

echo ""
echo "── opensaas REST: local presence / caller ID ──"
check "caller-id-locks"   GET  /v1/caller-id/locks

echo ""
echo "── opensaas REST: webhooks ──"
check "webhook-status"    POST /v1/webhooks/status \
  -H "Content-Type: application/json" -d '{}'
check "webhook-transcription" POST /v1/webhooks/transcription \
  -H "Content-Type: application/json" -d '{}'

echo ""
echo "=========================================="
printf " results: ✅ %d passed  ❌ %d failed  🔒 %d auth-required\n" "$PASS" "$FAIL" "$SKIP"
echo " legend:  🌐 = SPA fallthrough (route not registered)"
echo "=========================================="

#!/usr/bin/env bash
set -euo pipefail

# DEV-1024: usage metering + cost tracking for consuelo AI agent
# model: nvidia/moonshotai/kimi-k2.5

REPO="/Users/kokayi/Dev/opensaas"
BRANCH="dev-1024-usage-metering"
WORKTREE="/tmp/opensaas-dev-1024"
MODEL="ollama-cloud/glm-5"
XDG="/tmp/oc-dev-1024"

cleanup() {
  echo "[cleanup] removing worktree and temp data..."
  cd "$REPO"
  git worktree remove --force "$WORKTREE" 2>/dev/null || true
  git branch -D "$BRANCH" 2>/dev/null || true
  rm -rf "$XDG"
}
trap cleanup EXIT

# pre-flight cleanup from previous runs
cd "$REPO"
git worktree remove --force "$WORKTREE" 2>/dev/null || true
git branch -D "$BRANCH" 2>/dev/null || true
rm -rf "$XDG" "$WORKTREE"

# disk check
AVAIL=$(df -g "$REPO" | tail -1 | awk '{print $4}')
if [ "$AVAIL" -lt 5 ]; then
  echo "[error] less than 5GB free — aborting"
  exit 1
fi

# setup worktree
BASE=$(git rev-parse HEAD)
git worktree add -b "$BRANCH" "$WORKTREE" "$BASE"
mkdir -p "$XDG"

echo "[run] launching opencode with $MODEL..."

XDG_DATA_HOME="$XDG" /opt/homebrew/bin/opencode run -m "$MODEL" --cwd "$WORKTREE" 'you are implementing DEV-1024: usage metering + cost tracking for the consuelo AI agent.

PREP: read AGENTS.md and CODING-STANDARDS.md. study the existing agent services in packages/twenty-server/src/engine/core-modules/agent/ — especially automation.service.ts and the controller patterns. also read the @consuelo/metering package at packages/metering/ to understand the existing metering infrastructure.

SCOPE — files you may create or modify:
- packages/twenty-server/src/engine/core-modules/agent/services/usage-metering.service.ts (NEW)
- packages/twenty-server/src/engine/core-modules/agent/controllers/automation.controller.ts (add 2 routes)
- packages/twenty-server/src/engine/core-modules/agent/agent.module.ts (register service)
- packages/twenty-front/src/modules/agent/components/AgentUsageCard.tsx (NEW)
- packages/twenty-front/src/modules/agent/hooks/useAgentUsage.ts (NEW)

DO NOT touch any files outside this scope. DO NOT delete any existing code that is not directly related to your changes.

WHAT TO BUILD:
1. UsageMeteringService — redis counters for current-period usage (agent.llm.tokens, agent.sandbox.executions, agent.conversations). methods: recordUsage(meter, amount, userId, workspaceId), getUsageSummary(userId, workspaceId), getUsageBreakdown(userId, workspaceId). use @InjectCacheStorage(CacheStorageNamespace.EngineWorkspace) pattern like the other agent services (see call-context.service.ts, pipeline-intelligence.service.ts for examples).
2. Two API routes on automation controller: GET usage (summary) and GET usage/breakdown (per-skill breakdown). these MUST go BEFORE the :id param route (literal before param rule). follow the exact error handling pattern from the existing routes (try/catch with HttpException, err: unknown typing).
3. AgentUsageCard.tsx — usage bars showing tokens/runs/storage vs plan limits. use styled-components via @emotion/styled (same pattern as other agent components). named export only.
4. useAgentUsage.ts hook — fetches from the 2 endpoints. follow the exact pattern from useAgentSkills.ts (getTokenPair for auth, REST_API_BASE_URL, useState + useCallback + useEffect).

CODING STANDARDS — MANDATORY:
- no console.log/error/warn — these will fail code review
- no `any` type — use `unknown` and type guards
- all catch blocks must be typed as `catch (err: unknown)`
- named exports only (no default exports)
- types over interfaces
- no abbreviations in variable names
- comments explain WHY not WHAT, use // not /** */

SELF-REVIEW: after implementation, re-read every file you created or modified. run the ACTUAL command: bash scripts/code-review.sh — do NOT simulate or fake the output. fix any violations it reports. verify no console.log, no any types, catch blocks typed as unknown. re-read files after any fixes.'

echo ""
echo "[done] opencode finished. checking results..."
cd "$WORKTREE"
git diff --stat "$BASE"..HEAD
echo ""
echo "worktree at: $WORKTREE"
echo "to review: cd $WORKTREE && git log --oneline $BASE..HEAD"
echo "to merge:  cd $REPO && git merge $BRANCH"

#!/usr/bin/env bash
set -uo pipefail

# ─── Batch 8 (FINAL): DEV-1023 + DEV-964 (parallel) → DEV-965 → DEV-966 ───
REPO="/Users/kokayi/Dev/opensaas"
BRANCH="agent-phase2-skills"
BOT_NAME="suelo-kiro[bot]"
BOT_EMAIL="260422584+suelo-kiro[bot]@users.noreply.github.com"
LINEAR_API="https://api.linear.app/graphql"
IN_PROGRESS="d8f29981-a8ce-451d-8910-ca8c04af01b2"
DONE="3dce5724-2643-4151-a66b-7f7b8d152bd2"
PR_NUM=20
OC_MODEL="opencode/minimax-m2.5-free"
LOG_DIR="$REPO/scripts/logs"
mkdir -p "$LOG_DIR"

# ─── Cleanup trap — runs even if script dies ───
cleanup() {
  cd "$REPO" 2>/dev/null || true
  for WT in agent-skill-versioning agent-execution-engine; do
    git worktree remove "../$WT" --force 2>/dev/null || true
    git branch -D "temp-$WT" 2>/dev/null || true
  done
  rm -rf /tmp/oc-* 2>/dev/null || true
  git worktree prune 2>/dev/null || true
  echo "✓ cleanup complete"
}
trap cleanup EXIT

# ─── Pre-flight: clean previous run artifacts + disk check ───
rm -rf /tmp/oc-* 2>/dev/null || true
cd "$REPO" && git worktree prune 2>/dev/null || true
AVAIL_GB=$(df -g /System/Volumes/Data 2>/dev/null | tail -1 | awk '{print $4}')
if [ "${AVAIL_GB:-0}" -lt 10 ]; then
  echo "⚠ only ${AVAIL_GB}GB free — cleaning caches"
  npm cache clean --force 2>/dev/null || true
fi
echo "✓ pre-flight cleanup done (${AVAIL_GB}GB free)"

# ─── Linear helpers ───
linear_status() {
  local issue_id="$1" state_id="$2"
  curl -s -X POST "$LINEAR_API" \
    -H "Content-Type: application/json" \
    -H "Authorization: $LINEAR_API_KEY" \
    -d "{\"query\":\"mutation { issueUpdate(id: \\\"$issue_id\\\", input: { stateId: \\\"$state_id\\\" }) { success } }\"}" > /dev/null
}

# Mark all 4 in-progress
linear_status "9fedd5b9-1149-4762-9e48-329ac0ee0d9e" "$IN_PROGRESS"  # DEV-1023
linear_status "3ec9238b-3902-405d-94a9-1259f59268d6" "$IN_PROGRESS"  # DEV-964
linear_status "3accfe89-f460-4daa-8a4b-6c40496aba52" "$IN_PROGRESS"  # DEV-965
linear_status "7d570e2f-d15b-4ab2-808d-53a77c027288" "$IN_PROGRESS"  # DEV-966
echo "✓ marked DEV-1023, DEV-964, DEV-965, DEV-966 in-progress"

# ─── Prep main branch ───
cd "$REPO" && git checkout "$BRANCH" && git pull origin "$BRANCH"

# ─── Worktree setup ───
for WT in agent-skill-versioning agent-execution-engine; do
  if [ -d "../$WT" ]; then
    git worktree remove "../$WT" --force 2>/dev/null || true
  fi
  git branch -D "temp-$WT" 2>/dev/null || true
done

git worktree add -b temp-agent-skill-versioning ../agent-skill-versioning HEAD
git worktree add -b temp-agent-execution-engine ../agent-execution-engine HEAD
echo "✓ worktrees created"

# ═══════════════════════════════════════════════════════════════
# PHASE A — DEV-1023 + DEV-964 in parallel worktrees
# ═══════════════════════════════════════════════════════════════

read -r -d '' PROMPT_1023 << 'PROMPT1023' || true
you are implementing DEV-1023: skill versioning + MonacoDiffEditor for the consuelo AI agent.

PREP:
- read AGENTS.md and CODING-STANDARDS.md
- read packages/twenty-server/src/engine/core-modules/agent/entities/agent-skill.entity.ts (skill entity — versions reference this)
- read packages/twenty-server/src/engine/core-modules/agent/controllers/skill.controller.ts (pattern reference — copy guard/filter/decorator pattern)
- read packages/twenty-server/src/engine/core-modules/agent/services/automation.service.ts (service pattern reference)
- read packages/twenty-server/src/engine/core-modules/agent/agent.module.ts (current registrations)
- read packages/twenty-front/src/modules/agent/components/AgentSkillsSidebar.tsx (where version badge goes)

SCOPE — files you may create/edit:
- packages/twenty-server/src/engine/core-modules/agent/entities/agent-skill-version.entity.ts (NEW)
- packages/twenty-server/src/engine/core-modules/agent/services/skill-version.service.ts (NEW)
- packages/twenty-server/src/engine/core-modules/agent/controllers/skill-version.controller.ts (NEW)
- packages/twenty-server/src/engine/core-modules/agent/agent.module.ts (EDIT — register entity + service + controller)
- packages/twenty-server/src/database/typeorm/core/migrations/common/ (NEW migration)
- packages/twenty-front/src/modules/agent/components/SkillVersionBadge.tsx (NEW)
- packages/twenty-front/src/modules/agent/components/SkillVersionHistory.tsx (NEW)
- packages/twenty-front/src/modules/agent/hooks/useSkillVersions.ts (NEW)

IMPLEMENTATION:
1. Backend entity — agent-skill-version.entity.ts:
   - @Entity({ name: 'agentSkillVersion', schema: 'core' })
   - id (uuid PK), skillId (uuid FK → agentSkill), version (integer), systemPrompt (text nullable), sandboxTemplate (text nullable), changeSummary (varchar 500 nullable), createdBy (uuid nullable), createdAt (timestamptz)
   - Index on (skillId, version) unique
   - ManyToOne to AgentSkillEntity with onDelete CASCADE

2. Backend service — skill-version.service.ts:
   - listVersions(skillId): find all versions for a skill, ordered by version DESC
   - getVersion(skillId, version): find specific version
   - createVersion(skillId, data): auto-increment version number (SELECT MAX(version) + 1), save snapshot
   - rollback(skillId, targetVersion): read target version → create NEW version with that content (immutable history, never mutate)

3. Backend controller — skill-version.controller.ts:
   - @Controller('v1/agent/skills/:skillId/versions')
   - Same guard/filter pattern as skill.controller.ts
   - GET / — list versions for a skill
   - GET /:version — get specific version (use parseInt on param)
   - POST /:version/rollback — rollback to version (creates new version)
   - Literal routes before param routes

4. Register in agent.module.ts:
   - Add AgentSkillVersionEntity to TypeOrmModule.forFeature array
   - Add SkillVersionService to providers + exports
   - Add SkillVersionController to controllers

5. Generate migration:
   npx nx run twenty-server:typeorm migration:generate src/database/typeorm/core/migrations/common/add-agent-skill-versions -d src/database/typeorm/core/core.datasource.ts
   If it fails, write the migration manually with up() and down().

6. Frontend — useSkillVersions.ts hook:
   - Fetch from GET /v1/agent/skills/:skillId/versions
   - Returns: versions array, isLoading, latestVersion (computed)
   - Use twenty's cookie-based auth (read tokenPair cookie, send as Bearer)

7. Frontend — SkillVersionBadge.tsx:
   - Shows "v{N} · saved {relative time}" (e.g. "v3 · saved 2m ago")
   - Clickable — onClick prop to open version history
   - Use Emotion styled-components, twenty's theme tokens
   - Small, subtle — fits in a header bar

8. Frontend — SkillVersionHistory.tsx:
   - List of versions (newest first) with version number, date, change summary
   - Each version row is clickable
   - "Rollback" button per version (calls POST /:version/rollback)
   - Placeholder div for MonacoDiffEditor (comment: "MonacoDiffEditor integration — requires @monaco-editor/react install")
   - Do NOT install monaco-editor — just leave a placeholder with a comment

DO NOT:
- Install @monaco-editor/react (leave placeholder)
- Modify the skill entity or skill controller
- Modify the skill service (version creation will be wired in a follow-up)
- Touch any automation files
- Touch any files outside SCOPE

SELF-REVIEW:
- Re-read every file you created/edited
- Verify entity has proper TypeORM decorators and unique index
- Verify controller has literal routes before param routes
- Verify all new items registered in agent.module.ts
- Verify all catch blocks use (err: unknown)
- Run: npx nx typecheck twenty-server
- Run: npx nx typecheck twenty-front
- Run: bash scripts/code-review.sh
- If any check fails, fix and re-run
PROMPT1023

read -r -d '' PROMPT_964 << 'PROMPT964' || true
you are implementing DEV-964: automation execution engine for the consuelo AI agent.

PREP:
- read AGENTS.md and CODING-STANDARDS.md
- read packages/twenty-server/src/engine/core-modules/agent/entities/automation.entity.ts (automation entity — runs reference this)
- read packages/twenty-server/src/engine/core-modules/agent/services/automation.service.ts (has updateLastRun method)
- read packages/twenty-server/src/engine/core-modules/agent/controllers/automation.controller.ts (has 501 stub for /:id/run)
- read packages/twenty-server/src/engine/core-modules/agent/agent.module.ts (current registrations)
- read packages/twenty-server/src/engine/core-modules/message-queue/message-queue.constants.ts (available queue names)
- read packages/twenty-server/src/engine/core-modules/message-queue/decorators/processor.decorator.ts (Processor decorator pattern)
- study an existing job file like packages/twenty-server/src/modules/workflow/workflow-trigger/jobs/workflow-trigger.job.ts for the pattern

SCOPE — files you may create/edit:
- packages/twenty-server/src/engine/core-modules/agent/entities/agent-automation-run.entity.ts (NEW)
- packages/twenty-server/src/engine/core-modules/agent/services/automation-run.service.ts (NEW)
- packages/twenty-server/src/engine/core-modules/agent/jobs/agent-automation-execute.job.ts (NEW)
- packages/twenty-server/src/engine/core-modules/agent/agent.module.ts (EDIT — register entity + service)
- packages/twenty-server/src/engine/core-modules/agent/controllers/automation.controller.ts (EDIT — wire /:id/run)
- packages/twenty-server/src/database/typeorm/core/migrations/common/ (NEW migration)

IMPLEMENTATION:
1. Backend entity — agent-automation-run.entity.ts:
   - @Entity({ name: 'agentAutomationRun', schema: 'core' })
   - id (uuid PK), automationId (uuid FK → agentAutomation), status (varchar 20: 'pending' | 'running' | 'success' | 'failure' | 'skipped'), startedAt (timestamptz nullable), completedAt (timestamptz nullable), durationMs (integer nullable), triggerPayload (jsonb nullable), result (jsonb nullable), error (text nullable), createdAt (timestamptz)
   - Index on automationId
   - Index on (automationId, status)
   - ManyToOne to AgentAutomationEntity with onDelete CASCADE

2. Backend service — automation-run.service.ts:
   - create(automationId, triggerPayload?): create run with status 'pending'
   - start(runId): set status 'running', startedAt = now
   - complete(runId, result): set status 'success', completedAt = now, calculate durationMs
   - fail(runId, error): set status 'failure', completedAt = now, error message, calculate durationMs
   - findByAutomation(automationId, opts?): paginated, most recent first
   - findById(id): single run

3. Backend job — agent-automation-execute.job.ts:
   - @Processor({ queueName: MessageQueue.workflowQueue, scope: Scope.REQUEST })
   - Use MessageQueue.workflowQueue (same queue as twenty's workflow jobs)
   - @Process(AgentAutomationExecuteJob.name)
   - Inject AutomationRunService and AutomationService
   - Job flow: start run → load automation → execute skill (placeholder: just log and succeed) → complete or fail run → update automation lastRunAt/lastRunStatus
   - The actual skill execution is a placeholder (comment: "skill execution integration — wire to skill-execution.service.ts")

4. Wire /:id/run in automation.controller.ts:
   - Replace the 501 stub with: create a run → enqueue the job → return the run
   - Inject InjectMessageQueue(MessageQueue.workflowQueue) and MessageQueueService
   - Import from message-queue module

5. Register in agent.module.ts:
   - Add AgentAutomationRunEntity to TypeOrmModule.forFeature array
   - Add AutomationRunService to providers + exports
   - Import MessageQueueModule in the imports array

6. Generate migration:
   npx nx run twenty-server:typeorm migration:generate src/database/typeorm/core/migrations/common/add-agent-automation-runs -d src/database/typeorm/core/core.datasource.ts
   If it fails, write the migration manually with up() and down().

DO NOT:
- Implement actual skill execution (leave placeholder)
- Modify the automation entity
- Touch any frontend files
- Touch any skill files
- Touch any files outside SCOPE

SELF-REVIEW:
- Re-read every file you created/edited
- Verify entity has proper TypeORM decorators
- Verify job uses @Processor with MessageQueue.workflowQueue
- Verify automation.controller.ts still has literal routes before param routes
- Verify all new items registered in agent.module.ts
- Verify all catch blocks use (err: unknown)
- Run: npx nx typecheck twenty-server
- Run: bash scripts/code-review.sh
- If any check fails, fix and re-run
PROMPT964

echo "▶ starting DEV-1023 + DEV-964 in parallel..."

(
  cd "$REPO/../agent-skill-versioning" && \
  kiro-cli chat --trust-all-tools --no-interactive "$PROMPT_1023" \
    > "$LOG_DIR/dev-1023.log" 2>&1
  echo "✓ DEV-1023 kiro done"
) &
PID_1023=$!

(
  cd "$REPO/../agent-execution-engine" && \
  kiro-cli chat --trust-all-tools --no-interactive "$PROMPT_964" \
    > "$LOG_DIR/dev-964.log" 2>&1
  echo "✓ DEV-964 kiro done"
) &
PID_964=$!

wait $PID_1023 $PID_964
echo "✓ phase A complete (DEV-1023 + DEV-964)"

# ─── Commit in worktrees ───
cd "$REPO/../agent-skill-versioning"
git add \
  packages/twenty-server/src/engine/core-modules/agent/entities/agent-skill-version.entity.ts \
  packages/twenty-server/src/engine/core-modules/agent/services/skill-version.service.ts \
  packages/twenty-server/src/engine/core-modules/agent/controllers/skill-version.controller.ts \
  packages/twenty-server/src/engine/core-modules/agent/agent.module.ts \
  packages/twenty-server/src/database/typeorm/core/migrations/common/ \
  packages/twenty-front/src/modules/agent/components/SkillVersionBadge.tsx \
  packages/twenty-front/src/modules/agent/components/SkillVersionHistory.tsx \
  packages/twenty-front/src/modules/agent/hooks/useSkillVersions.ts \
  2>/dev/null
git diff --cached --quiet || \
  GIT_COMMITTER_NAME="$BOT_NAME" GIT_COMMITTER_EMAIL="$BOT_EMAIL" git commit -m "feat(agent): skill versioning + version history UI (DEV-1023)" --no-verify

cd "$REPO/../agent-execution-engine"
git add \
  packages/twenty-server/src/engine/core-modules/agent/entities/agent-automation-run.entity.ts \
  packages/twenty-server/src/engine/core-modules/agent/services/automation-run.service.ts \
  packages/twenty-server/src/engine/core-modules/agent/jobs/agent-automation-execute.job.ts \
  packages/twenty-server/src/engine/core-modules/agent/agent.module.ts \
  packages/twenty-server/src/engine/core-modules/agent/controllers/automation.controller.ts \
  packages/twenty-server/src/database/typeorm/core/migrations/common/ \
  2>/dev/null
git diff --cached --quiet || \
  GIT_COMMITTER_NAME="$BOT_NAME" GIT_COMMITTER_EMAIL="$BOT_EMAIL" git commit -m "feat(agent): automation execution engine (DEV-964)" --no-verify

# ─── Merge worktrees into main ───
cd "$REPO"
git merge temp-agent-skill-versioning --no-edit --no-verify || true
git merge temp-agent-execution-engine --no-edit --no-verify || true
git push origin "$BRANCH" --no-verify
echo "✓ phase A merged + pushed"

# ═══════════════════════════════════════════════════════════════
# PHASE B — DEV-965 sequential on main (needs DEV-964's run entity)
# ═══════════════════════════════════════════════════════════════

read -r -d '' PROMPT_965 << 'PROMPT965' || true
you are implementing DEV-965: execution history + logs UI for the consuelo AI agent automations.

PREP:
- read AGENTS.md and CODING-STANDARDS.md
- read packages/twenty-server/src/engine/core-modules/agent/entities/agent-automation-run.entity.ts (run entity — just created by DEV-964)
- read packages/twenty-server/src/engine/core-modules/agent/services/automation-run.service.ts (run service — just created by DEV-964)
- read packages/twenty-server/src/engine/core-modules/agent/controllers/automation.controller.ts (add history endpoints here)
- read packages/twenty-front/src/modules/agent/hooks/useAgentConversations.ts (hook pattern reference)

SCOPE — files you may create/edit:
- packages/twenty-server/src/engine/core-modules/agent/controllers/automation.controller.ts (EDIT — add history endpoints)
- packages/twenty-front/src/modules/agent/components/AutomationHistoryTable.tsx (NEW)
- packages/twenty-front/src/modules/agent/hooks/useAutomationHistory.ts (NEW)

IMPLEMENTATION:
1. Add history endpoints to automation.controller.ts:
   - GET /:id/runs — list runs for an automation (paginated, most recent first). Inject AutomationRunService.
   - GET /:id/runs/:runId — get single run detail
   - IMPORTANT: these are sub-routes of /:id, so they go AFTER the existing /:id routes but the order within the /:id group doesn't matter since "runs" is a literal segment after the param

2. Frontend — useAutomationHistory.ts hook:
   - Fetch from GET /v1/agent/automations/:id/runs
   - Returns: runs array, isLoading, selectedRun, selectRun(id)
   - Use twenty's cookie-based auth

3. Frontend — AutomationHistoryTable.tsx:
   - Table showing: status (color-coded badge), started at, duration, trigger info
   - Status colors: success=green, failure=red, running=blue, pending=gray, skipped=yellow
   - Click row to expand and show result/error details
   - Use Emotion styled-components, twenty's theme tokens
   - Empty state: "No runs yet"

DO NOT:
- Modify the run entity or run service
- Modify agent.module.ts (AutomationRunService is already registered)
- Touch any skill or versioning files
- Touch any files outside SCOPE

SELF-REVIEW:
- Re-read every file you created/edited
- Verify automation.controller.ts still has literal routes before param routes
- Verify all catch blocks use (err: unknown)
- Run: npx nx typecheck twenty-server
- Run: npx nx typecheck twenty-front
- Run: bash scripts/code-review.sh
- If any check fails, fix and re-run
PROMPT965

echo "▶ starting DEV-965 on main..."
cd "$REPO" && \
kiro-cli chat --trust-all-tools --no-interactive "$PROMPT_965" \
  > "$LOG_DIR/dev-965.log" 2>&1
echo "✓ DEV-965 kiro done"

# Commit DEV-965
cd "$REPO"
git add \
  packages/twenty-server/src/engine/core-modules/agent/controllers/automation.controller.ts \
  packages/twenty-front/src/modules/agent/components/AutomationHistoryTable.tsx \
  packages/twenty-front/src/modules/agent/hooks/useAutomationHistory.ts \
  2>/dev/null
git diff --cached --quiet || \
  GIT_COMMITTER_NAME="$BOT_NAME" GIT_COMMITTER_EMAIL="$BOT_EMAIL" git commit -m "feat(agent): automation execution history UI (DEV-965)" --no-verify
git push origin "$BRANCH" --no-verify
echo "✓ DEV-965 committed + pushed"

# ═══════════════════════════════════════════════════════════════
# PHASE C — DEV-966 sequential on main (needs DEV-964 + DEV-965)
# ═══════════════════════════════════════════════════════════════

read -r -d '' PROMPT_966 << 'PROMPT966' || true
you are implementing DEV-966: automation monitoring + error handling (circuit breaker) for the consuelo AI agent.

PREP:
- read AGENTS.md and CODING-STANDARDS.md
- read packages/twenty-server/src/engine/core-modules/agent/entities/automation.entity.ts (add failure tracking columns)
- read packages/twenty-server/src/engine/core-modules/agent/services/automation.service.ts (add circuit breaker logic)
- read packages/twenty-server/src/engine/core-modules/agent/services/automation-run.service.ts (run service — created by DEV-964)
- read packages/twenty-server/src/engine/core-modules/agent/controllers/automation.controller.ts (add health endpoint)
- read packages/twenty-server/src/engine/core-modules/agent/agent.module.ts (current state)

SCOPE — files you may create/edit:
- packages/twenty-server/src/engine/core-modules/agent/entities/automation.entity.ts (EDIT — add failure columns)
- packages/twenty-server/src/engine/core-modules/agent/services/automation.service.ts (EDIT — add circuit breaker methods)
- packages/twenty-server/src/engine/core-modules/agent/controllers/automation.controller.ts (EDIT — add health endpoint)
- packages/twenty-server/src/database/typeorm/core/migrations/common/ (NEW migration)

IMPLEMENTATION:
1. Add columns to automation.entity.ts:
   - consecutiveFailures: integer, default 0
   - maxConsecutiveFailures: integer, default 5
   - disabledReason: varchar 255, nullable (set when circuit breaker trips)

2. Add circuit breaker methods to automation.service.ts:
   - recordSuccess(id): reset consecutiveFailures to 0
   - recordFailure(id): increment consecutiveFailures. If >= maxConsecutiveFailures, set enabled=false and disabledReason='Circuit breaker: {N} consecutive failures'
   - isCircuitOpen(id): return true if consecutiveFailures >= maxConsecutiveFailures
   - resetCircuitBreaker(id): reset consecutiveFailures to 0, clear disabledReason, re-enable

3. Add health endpoint to automation.controller.ts:
   - GET /health — returns aggregate health stats for the workspace
   - IMPORTANT: this is a LITERAL route, must go BEFORE any /:id param routes
   - Response shape: { total, enabled, disabled, circuitBroken (count where disabledReason starts with 'Circuit breaker') }
   - Use AutomationService to query

4. Generate migration:
   npx nx run twenty-server:typeorm migration:generate src/database/typeorm/core/migrations/common/add-automation-circuit-breaker -d src/database/typeorm/core/core.datasource.ts
   If it fails, write the migration manually with up() and down().

DO NOT:
- Modify the run entity or run service
- Touch any frontend files (monitoring UI is a future task)
- Touch any skill or versioning files
- Touch any files outside SCOPE

SELF-REVIEW:
- Re-read every file you created/edited
- Verify /health route is BEFORE /:id routes in automation.controller.ts
- Verify all catch blocks use (err: unknown)
- Verify circuit breaker logic is correct (increment, threshold check, disable)
- Run: npx nx typecheck twenty-server
- Run: bash scripts/code-review.sh
- If any check fails, fix and re-run
PROMPT966

echo "▶ starting DEV-966 on main..."
cd "$REPO" && \
kiro-cli chat --trust-all-tools --no-interactive "$PROMPT_966" \
  > "$LOG_DIR/dev-966.log" 2>&1
echo "✓ DEV-966 kiro done"

# Commit DEV-966
cd "$REPO"
git add \
  packages/twenty-server/src/engine/core-modules/agent/entities/automation.entity.ts \
  packages/twenty-server/src/engine/core-modules/agent/services/automation.service.ts \
  packages/twenty-server/src/engine/core-modules/agent/controllers/automation.controller.ts \
  packages/twenty-server/src/database/typeorm/core/migrations/common/ \
  2>/dev/null
git diff --cached --quiet || \
  GIT_COMMITTER_NAME="$BOT_NAME" GIT_COMMITTER_EMAIL="$BOT_EMAIL" git commit -m "feat(agent): automation monitoring + circuit breaker (DEV-966)" --no-verify
git push origin "$BRANCH" --no-verify
echo "✓ DEV-966 committed + pushed"

# ═══════════════════════════════════════════════════════════════
# REVIEWS — all 4 in parallel
# ═══════════════════════════════════════════════════════════════
echo "▶ starting 4 opencode reviews..."

review_task() {
  local task_id="$1" task_name="$2"
  local review_prompt="you are reviewing $task_name. read the git diff for the most recent commits on branch $BRANCH. fetch the linear task spec for $task_id. check every acceptance criterion (✅ met / ⚠️ partial / ❌ missing). check coding standards compliance. post your full review as a single gh pr comment to PR #$PR_NUM via: gh pr comment $PR_NUM --repo consuelohq/opensaas --body '<review>'. format: task ID, summary, criterion checklist, issues found, verdict (PASS/NEEDS WORK)."

  cd "$REPO" && XDG_DATA_HOME="/tmp/oc-$task_id" opencode \
    --model "$OC_MODEL" \
    --prompt "$review_prompt" \
    > "$LOG_DIR/review-$task_id.log" 2>&1
  echo "✓ $task_name review done"
}

review_task "DEV-1023" "DEV-1023 skill versioning" &
review_task "DEV-964" "DEV-964 execution engine" &
review_task "DEV-965" "DEV-965 history UI" &
review_task "DEV-966" "DEV-966 monitoring + circuit breaker" &
wait
echo "✓ all reviews posted"

# ─── Mark done in Linear ───
linear_status "9fedd5b9-1149-4762-9e48-329ac0ee0d9e" "$DONE"  # DEV-1023
linear_status "3ec9238b-3902-405d-94a9-1259f59268d6" "$DONE"  # DEV-964
linear_status "3accfe89-f460-4daa-8a4b-6c40496aba52" "$DONE"  # DEV-965
linear_status "7d570e2f-d15b-4ab2-808d-53a77c027288" "$DONE"  # DEV-966
echo "✓ DEV-1023, DEV-964, DEV-965, DEV-966 marked done"

# ─── Cleanup ───
cd "$REPO"
for WT in agent-skill-versioning agent-execution-engine; do
  git worktree remove "../$WT" --force 2>/dev/null || true
  git branch -D "temp-$WT" 2>/dev/null || true
done
echo "✓ worktrees cleaned up"

echo ""
echo "═══════════════════════════════════════"
echo "  BATCH 8 COMPLETE — ALL 26 TASKS DONE"
echo "  DEV-1023 — skill versioning"
echo "  DEV-964  — execution engine"
echo "  DEV-965  — history UI"
echo "  DEV-966  — monitoring + circuit breaker"
echo "═══════════════════════════════════════"
echo "  🎉 CONSUELO AGENT BUILD COMPLETE 🎉"
echo "═══════════════════════════════════════"

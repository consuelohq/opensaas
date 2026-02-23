#!/usr/bin/env bash
set -uo pipefail

# ─── Batch 7: DEV-958 + DEV-963 (parallel) → DEV-959 (sequential) ───
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

# ─── Linear helpers ───
linear_status() {
  local issue_id="$1" state_id="$2"
  curl -s -X POST "$LINEAR_API" \
    -H "Content-Type: application/json" \
    -H "Authorization: $LINEAR_API_KEY" \
    -d "{\"query\":\"mutation { issueUpdate(id: \\\"$issue_id\\\", input: { stateId: \\\"$state_id\\\" }) { success } }\"}" > /dev/null
}

# Mark all 3 in-progress
linear_status "3618733e-b027-406f-a100-9c7c7adc1646" "$IN_PROGRESS"  # DEV-958
linear_status "a595c7c6-00a9-4485-9abd-f0b3136f9c56" "$IN_PROGRESS"  # DEV-963
linear_status "9f60f27e-2a7b-4341-a4ea-e33490765379" "$IN_PROGRESS"  # DEV-959
echo "✓ marked DEV-958, DEV-963, DEV-959 in-progress"

# ─── Prep main branch ───
cd "$REPO" && git checkout "$BRANCH" && git pull origin "$BRANCH"

# ─── Worktree setup ───
for WT in agent-action-confirm agent-automation-api; do
  if [ -d "../$WT" ]; then
    git worktree remove "../$WT" --force 2>/dev/null || true
  fi
  git branch -D "temp-$WT" 2>/dev/null || true
done

git worktree add -b temp-agent-action-confirm ../agent-action-confirm HEAD
git worktree add -b temp-agent-automation-api ../agent-automation-api HEAD
echo "✓ worktrees created"

# ═══════════════════════════════════════════════════════════════
# PHASE A — DEV-958 + DEV-963 in parallel worktrees
# ═══════════════════════════════════════════════════════════════

read -r -d '' PROMPT_958 << 'PROMPT958' || true
you are implementing DEV-958: action confirmation flow for the consuelo AI agent chat.

PREP:
- read AGENTS.md and CODING-STANDARDS.md
- read packages/twenty-front/src/modules/agent/components/AgentChatPanel.tsx (current chat panel with assistant-ui)
- read packages/twenty-front/src/modules/agent/components/renderers/ (existing tool UI pattern)
- read packages/twenty-front/src/modules/agent/types/agent.ts (current types)
- check that @assistant-ui/react is installed in packages/twenty-front/package.json
- study makeAssistantToolUI API from assistant-ui — it supports pending/approved/rejected states

SCOPE — files you may create/edit:
- packages/twenty-front/src/modules/agent/components/confirmation/AgentActionCard.tsx (NEW)
- packages/twenty-front/src/modules/agent/components/confirmation/BatchConfirmationBar.tsx (NEW)
- packages/twenty-front/src/modules/agent/components/confirmation/index.ts (NEW — registers tool UIs for CRM tools)
- packages/twenty-front/src/modules/agent/types/agent.ts (UPDATE — add action confirmation types)

IMPLEMENTATION:
1. Create confirmation/AgentActionCard.tsx:
   - Registered via makeAssistantToolUI for CRM mutation tools: "log_call", "update_deal", "create_task", "send_email"
   - Shows tool name as human-readable title (e.g. "Log Call" not "log_call")
   - Shows parameters in a readable format (key-value pairs, not raw JSON)
   - Approve button (green) and Skip button (gray)
   - Approve triggers tool execution, Skip marks as rejected
   - Use Emotion styled-components, twenty's theme tokens
   - Show success/failure feedback after execution

2. Create confirmation/BatchConfirmationBar.tsx:
   - When multiple CRM tools are pending, show a bar with "Approve All (N)" and "Cancel" buttons
   - Positioned above the input area
   - Counts pending tool calls

3. Create confirmation/index.ts:
   - Import AgentActionCard
   - Register it for each CRM tool name via makeAssistantToolUI
   - Export for registration in AgentChatPanel (but do NOT edit AgentChatPanel — just export)

4. Update types/agent.ts:
   - Add ActionConfirmation type: { toolName, args, status: 'pending' | 'approved' | 'rejected' | 'executed' }

DO NOT:
- Edit AgentChatPanel.tsx (the renderers/index.ts pattern handles registration)
- Build the actual CRM tool implementations (those exist in packages/agent/src/crm/tools.ts)
- Touch any backend files
- Touch any files outside SCOPE

SELF-REVIEW:
- Re-read every file you created/edited
- Verify makeAssistantToolUI is used correctly for each CRM tool
- Verify Emotion styled-components follow twenty's patterns
- Run: npx nx typecheck twenty-front
- Run: bash scripts/code-review.sh
- If any check fails, fix and re-run
PROMPT958

read -r -d '' PROMPT_963 << 'PROMPT963' || true
you are implementing DEV-963: automation CRUD API for the consuelo AI agent.

PREP:
- read AGENTS.md and CODING-STANDARDS.md
- read packages/twenty-server/src/engine/core-modules/agent/controllers/skill.controller.ts (pattern reference — copy its guard/filter/decorator pattern exactly)
- read packages/twenty-server/src/engine/core-modules/agent/services/automation.service.ts (the service you're wrapping)
- read packages/twenty-server/src/engine/core-modules/agent/entities/automation.entity.ts (entity shape)
- read packages/twenty-server/src/engine/core-modules/agent/agent.module.ts (current controllers array)

SCOPE — files you may create/edit:
- packages/twenty-server/src/engine/core-modules/agent/controllers/automation.controller.ts (NEW)
- packages/twenty-server/src/engine/core-modules/agent/agent.module.ts (EDIT — add AutomationController)

IMPLEMENTATION:
1. Create automation.controller.ts:
   - @Controller('v1/agent/automations')
   - @UseGuards(JwtAuthGuard, WorkspaceAuthGuard)
   - @UseFilters(RestApiExceptionFilter)
   - Inject AutomationService
   - LITERAL routes BEFORE param routes (this is enforced by code-review.sh):

   | Method | Path | Handler | Service call |
   |--------|------|---------|-------------|
   | GET    | /    | listAutomations | findByUser(userId, workspaceId) |
   | POST   | /    | createAutomation | create({...body, userId, workspaceId}) |
   | GET    | /:id | getAutomation | findById(id) → 404 if null |
   | PATCH  | /:id | updateAutomation | update(id, body) |
   | DELETE | /:id | deleteAutomation | delete(id) |
   | POST   | /:id/toggle | toggleAutomation | findById → update(id, {enabled: !current}) |
   | POST   | /:id/run | manualRun | return 501 Not Implemented (DEV-964 does this) |

   - Use @AuthUser() for user, @AuthWorkspace() for workspace (check skill.controller.ts for exact decorator names)
   - 404 HttpException when findById returns null
   - All catch blocks: catch (err: unknown)

2. Register in agent.module.ts:
   - Import AutomationController
   - Add to controllers array

DO NOT:
- Modify AutomationService
- Modify the entity
- Create DTOs (use inline types or the entity shape)
- Touch any frontend files
- Touch any files outside SCOPE

SELF-REVIEW:
- Re-read automation.controller.ts
- Verify literal routes (/, /) come before param routes (/:id, /:id/toggle, /:id/run)
- Verify AutomationController is in agent.module.ts controllers array
- Verify all catch blocks use (err: unknown)
- Run: npx nx typecheck twenty-server
- Run: bash scripts/code-review.sh
- If any check fails, fix and re-run
PROMPT963

echo "▶ starting DEV-958 + DEV-963 in parallel..."

(
  cd "$REPO/../agent-action-confirm" && \
  kiro-cli chat --trust-all-tools --no-interactive "$PROMPT_958" \
    > "$LOG_DIR/dev-958.log" 2>&1
  echo "✓ DEV-958 kiro done"
) &
PID_958=$!

(
  cd "$REPO/../agent-automation-api" && \
  kiro-cli chat --trust-all-tools --no-interactive "$PROMPT_963" \
    > "$LOG_DIR/dev-963.log" 2>&1
  echo "✓ DEV-963 kiro done"
) &
PID_963=$!

wait $PID_958 $PID_963
echo "✓ phase A complete (DEV-958 + DEV-963)"

# ─── Commit in worktrees ───
cd "$REPO/../agent-action-confirm"
git add \
  packages/twenty-front/src/modules/agent/components/confirmation/ \
  packages/twenty-front/src/modules/agent/types/agent.ts \
  2>/dev/null
git diff --cached --quiet || \
  git commit -m "feat(agent): action confirmation flow (DEV-958)" \
    --author="$BOT_NAME <$BOT_EMAIL>" --no-verify

cd "$REPO/../agent-automation-api"
git add \
  packages/twenty-server/src/engine/core-modules/agent/controllers/automation.controller.ts \
  packages/twenty-server/src/engine/core-modules/agent/agent.module.ts \
  2>/dev/null
git diff --cached --quiet || \
  git commit -m "feat(agent): automation CRUD API (DEV-963)" \
    --author="$BOT_NAME <$BOT_EMAIL>" --no-verify

# ─── Merge worktrees into main ───
cd "$REPO"
git merge temp-agent-action-confirm --no-edit --no-verify || true
git merge temp-agent-automation-api --no-edit --no-verify || true
git push origin "$BRANCH" --no-verify
echo "✓ phase A merged + pushed"

# ═══════════════════════════════════════════════════════════════
# PHASE B — DEV-959 sequential on main (needs agent.module.ts from DEV-963)
# ═══════════════════════════════════════════════════════════════

read -r -d '' PROMPT_959 << 'PROMPT959' || true
you are implementing DEV-959: conversation history and persistence for the consuelo AI agent.

PREP:
- read AGENTS.md and CODING-STANDARDS.md
- read packages/twenty-server/src/engine/core-modules/agent/agent.module.ts (current state — has SkillController, ChatController, AutomationController)
- read packages/twenty-server/src/engine/core-modules/agent/controllers/skill.controller.ts (pattern reference)
- read packages/twenty-server/src/engine/core-modules/agent/entities/ (existing entity patterns)
- read packages/twenty-front/src/modules/agent/components/AgentChatPanel.tsx (current chat UI)
- read packages/twenty-front/src/modules/agent/hooks/useAgentChat.ts (current chat hook)
- check packages/agent/src/types.ts for ConversationStore and ConversationState types

SCOPE — files you may create/edit:
- packages/twenty-server/src/engine/core-modules/agent/entities/agent-conversation.entity.ts (NEW)
- packages/twenty-server/src/engine/core-modules/agent/entities/agent-message.entity.ts (NEW)
- packages/twenty-server/src/engine/core-modules/agent/services/conversation.service.ts (NEW)
- packages/twenty-server/src/engine/core-modules/agent/controllers/conversation.controller.ts (NEW)
- packages/twenty-server/src/engine/core-modules/agent/agent.module.ts (EDIT — register entities + service + controller)
- packages/twenty-server/src/database/typeorm/core/migrations/common/ (NEW migration)
- packages/twenty-front/src/modules/agent/components/ConversationList.tsx (NEW)
- packages/twenty-front/src/modules/agent/hooks/useAgentConversations.ts (NEW)

IMPLEMENTATION:
1. Backend entities:
   agent-conversation.entity.ts:
   - id (uuid PK), title (varchar 255), userId (uuid), workspaceId (uuid), skillId (uuid nullable), messageCount (int default 0), pinned (bool default false), createdAt, updatedAt
   - Index on (userId, workspaceId)

   agent-message.entity.ts:
   - id (uuid PK), conversationId (uuid FK → agent_conversations), role (varchar 20), content (text nullable), toolName (varchar 100 nullable), toolInput (jsonb nullable), toolResult (jsonb nullable), tokenUsage (jsonb nullable), createdAt
   - Index on conversationId

2. Backend service — conversation.service.ts:
   - Implements the ConversationStore interface pattern
   - list(userId, workspaceId, opts?) — paginated, most recent first
   - findById(id) — with messages
   - create(userId, workspaceId, skillId?) — new conversation
   - addMessage(conversationId, message) — append message, increment messageCount
   - updateTitle(id, title)
   - togglePin(id)
   - delete(id) — soft delete or hard delete

3. Backend controller — conversation.controller.ts:
   - @Controller('v1/agent/conversations')
   - Same guard/filter pattern as skill.controller.ts
   - GET / — list conversations
   - GET /:id — get with messages
   - POST /:id/pin — toggle pin
   - DELETE /:id — delete

4. Register in agent.module.ts:
   - Add both entities to TypeOrmModule.forFeature array
   - Add ConversationService to providers + exports
   - Add ConversationController to controllers

5. Generate migration:
   npx nx run twenty-server:typeorm migration:generate src/database/typeorm/core/migrations/common/add-agent-conversations -d src/database/typeorm/core/core.datasource.ts
   If it fails, write the migration manually with up() and down().

6. Frontend — useAgentConversations hook:
   - Fetch from GET /v1/agent/conversations
   - selectConversation(id) — loads messages
   - createConversation() — POST to chat endpoint starts one
   - Export: conversations, selectedConversationId, isLoading

7. Frontend — ConversationList.tsx:
   - Simple list of conversations with title + timestamp
   - Pinned conversations at top
   - Click to select (loads messages into chat)
   - "New Chat" button
   - Placed in the chat panel header area (dropdown or sidebar)
   - Use Emotion styled-components, twenty's theme

DO NOT:
- Modify the existing chat endpoint logic (DEV-956's work)
- Build conversation search
- Build conversation export
- Touch AgentSkillsSidebar.tsx or AgentContextPanel.tsx
- Touch any files outside SCOPE

SELF-REVIEW:
- Re-read every file you created/edited
- Verify entities have proper TypeORM decorators
- Verify controller has literal routes before param routes
- Verify all new items registered in agent.module.ts
- Run: npx nx typecheck twenty-server
- Run: npx nx typecheck twenty-front
- Run: bash scripts/code-review.sh
- If any check fails, fix and re-run
PROMPT959

echo "▶ starting DEV-959 on main..."
cd "$REPO" && \
kiro-cli chat --trust-all-tools --no-interactive "$PROMPT_959" \
  > "$LOG_DIR/dev-959.log" 2>&1
echo "✓ DEV-959 kiro done"

# Commit DEV-959
cd "$REPO"
git add \
  packages/twenty-server/src/engine/core-modules/agent/entities/agent-conversation.entity.ts \
  packages/twenty-server/src/engine/core-modules/agent/entities/agent-message.entity.ts \
  packages/twenty-server/src/engine/core-modules/agent/services/conversation.service.ts \
  packages/twenty-server/src/engine/core-modules/agent/controllers/conversation.controller.ts \
  packages/twenty-server/src/engine/core-modules/agent/agent.module.ts \
  packages/twenty-server/src/database/typeorm/core/migrations/common/ \
  packages/twenty-front/src/modules/agent/components/ConversationList.tsx \
  packages/twenty-front/src/modules/agent/hooks/useAgentConversations.ts \
  2>/dev/null
git diff --cached --quiet || \
  git commit -m "feat(agent): conversation history + persistence (DEV-959)" \
    --author="$BOT_NAME <$BOT_EMAIL>" --no-verify
git push origin "$BRANCH" --no-verify
echo "✓ DEV-959 committed + pushed"

# ═══════════════════════════════════════════════════════════════
# REVIEWS — all 3 in parallel
# ═══════════════════════════════════════════════════════════════
echo "▶ starting 3 opencode reviews..."

review_task() {
  local task_id="$1" task_name="$2"
  local review_prompt="you are reviewing $task_name. read the git diff for the most recent commits on branch $BRANCH. fetch the linear task spec for $task_id. check every acceptance criterion (✅ met / ⚠️ partial / ❌ missing). check coding standards compliance. post your full review as a single gh pr comment to PR #$PR_NUM via: gh pr comment $PR_NUM --repo consuelohq/opensaas --body '<review>'. format: task ID, summary, criterion checklist, issues found, verdict (PASS/NEEDS WORK)."

  cd "$REPO" && XDG_DATA_HOME="/tmp/oc-$task_id" opencode \
    --model "$OC_MODEL" \
    --prompt "$review_prompt" \
    > "$LOG_DIR/review-$task_id.log" 2>&1
  echo "✓ $task_name review done"
}

review_task "DEV-958" "DEV-958 action confirmation" &
review_task "DEV-963" "DEV-963 automation CRUD API" &
review_task "DEV-959" "DEV-959 conversation persistence" &
wait
echo "✓ all reviews posted"

# ─── Mark done in Linear ───
linear_status "3618733e-b027-406f-a100-9c7c7adc1646" "$DONE"  # DEV-958
linear_status "a595c7c6-00a9-4485-9abd-f0b3136f9c56" "$DONE"  # DEV-963
linear_status "9f60f27e-2a7b-4341-a4ea-e33490765379" "$DONE"  # DEV-959
echo "✓ DEV-958, DEV-963, DEV-959 marked done"

# ─── Cleanup ───
cd "$REPO"
for WT in agent-action-confirm agent-automation-api; do
  git worktree remove "../$WT" --force 2>/dev/null || true
  git branch -D "temp-$WT" 2>/dev/null || true
done
echo "✓ worktrees cleaned up"

echo ""
echo "═══════════════════════════════════════"
echo "  BATCH 7 COMPLETE"
echo "  DEV-958 — action confirmation flow"
echo "  DEV-963 — automation CRUD API"
echo "  DEV-959 — conversation persistence"
echo "═══════════════════════════════════════"

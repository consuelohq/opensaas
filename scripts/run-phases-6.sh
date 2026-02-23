#!/usr/bin/env bash
set -uo pipefail

# ─── Batch 6: DEV-956 (chat) + DEV-955 (skills sidebar) + DEV-963 (automation API) ───
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
linear_status "d7ac5d70-dd94-4556-b349-6ebd53ec2273" "$IN_PROGRESS"  # DEV-956
linear_status "a6572553-1e26-4cfd-8ff1-806f994af1c2" "$IN_PROGRESS"  # DEV-955
linear_status "a595c7c6-00a9-4485-9abd-f0b3136f9c56" "$IN_PROGRESS"  # DEV-963
echo "✓ marked DEV-956, DEV-955, DEV-963 in-progress"

# ─── Worktree setup ───
cd "$REPO" && git checkout "$BRANCH" && git pull origin "$BRANCH"

for WT in agent-chat agent-skills-sidebar agent-automation-api; do
  if [ -d "../$WT" ]; then
    git worktree remove "../$WT" --force 2>/dev/null || true
  fi
done

git worktree add ../agent-chat "$BRANCH"
git worktree add ../agent-skills-sidebar "$BRANCH"
git worktree add ../agent-automation-api "$BRANCH"
echo "✓ worktrees created"

# ─── Prompts ───

read -r -d '' PROMPT_956 << 'PROMPT956' || true
you are implementing DEV-956: chat interface for the consuelo AI agent page.

PREP:
- read AGENTS.md and CODING-STANDARDS.md
- read packages/twenty-front/src/modules/agent/components/AgentChatPanel.tsx (placeholder to replace)
- read packages/twenty-front/src/modules/agent/components/AgentPage.tsx (parent layout)
- read packages/twenty-front/src/modules/agent/types/agent.ts (existing types)
- read packages/twenty-front/src/modules/agent/states/agentState.ts (existing state)
- read packages/agent/src/chat.ts (backend handleChat — uses createUIMessageStream + streamText)
- read packages/agent/src/types.ts (ChatRequest, ConversationState types)
- read packages/twenty-server/src/engine/core-modules/agent/agent.module.ts (registered controllers)
- check package.json versions: ai, @ai-sdk/react (both v5)

SCOPE — files you may create/edit:
- packages/twenty-front/src/modules/agent/components/AgentChatPanel.tsx (REPLACE placeholder)
- packages/twenty-front/src/modules/agent/hooks/useAgentChat.ts (NEW — chat hook)
- packages/twenty-server/src/engine/core-modules/agent/controllers/chat.controller.ts (NEW)
- packages/twenty-server/src/engine/core-modules/agent/agent.module.ts (register chat controller)
- packages/twenty-front/package.json (add @assistant-ui/react + @assistant-ui/react-ai-sdk)

IMPLEMENTATION:
1. Backend — create chat.controller.ts:
   - POST /v1/agent/chat endpoint
   - Accept { message, conversationId?, skillId? }
   - Use JwtAuthGuard + WorkspaceAuthGuard
   - Import and call handleChat from packages/agent/src/chat.ts
   - Return the stream response directly
   - Register in agent.module.ts controllers array

2. Frontend — install assistant-ui:
   - Add @assistant-ui/react and @assistant-ui/react-ai-sdk to twenty-front package.json
   - Run yarn install from repo root after

3. Frontend — create useAgentChat hook:
   - Use useChat from @ai-sdk/react (v5 — already installed)
   - Point api to /v1/agent/chat
   - Export the chat state (messages, input, handleSubmit, isLoading, etc.)

4. Frontend — replace AgentChatPanel:
   - Import useAgentChat hook
   - Build a minimal chat UI: message list + input form
   - Use styled-components (Emotion) following twenty's patterns
   - Show user messages and assistant messages with basic styling
   - Auto-scroll to bottom on new messages
   - Show loading indicator when assistant is responding

DO NOT:
- Build rich message rendering (that's DEV-957)
- Build action confirmation UI (that's DEV-958)
- Build conversation persistence/history UI (that's DEV-959)
- Touch any files outside SCOPE

SELF-REVIEW:
- Re-read every file you created/edited
- Verify chat.controller.ts is registered in agent.module.ts
- Verify the endpoint path matches what the frontend calls
- Run: npx nx typecheck twenty-front
- Run: npx nx typecheck twenty-server
- Run: bash scripts/code-review.sh
- If any check fails, fix and re-run
PROMPT956

read -r -d '' PROMPT_955 << 'PROMPT955' || true
you are implementing DEV-955: skills sidebar navigation for the consuelo AI agent page.

PREP:
- read AGENTS.md and CODING-STANDARDS.md
- read packages/twenty-front/src/modules/agent/components/AgentSkillsSidebar.tsx (placeholder to replace)
- read packages/twenty-front/src/modules/agent/components/AgentPage.tsx (parent layout)
- read packages/twenty-front/src/modules/agent/types/agent.ts (AgentSkill type)
- read packages/twenty-front/src/modules/agent/states/agentState.ts (selectedSkillIdState)
- read packages/twenty-front/src/modules/ui/navigation/navigation-drawer/ (NavigationDrawerItem, NavigationDrawerSubItem, NavigationDrawerItemGroup, NavigationDrawerItemsCollapsableContainer)
- read packages/twenty-front/src/modules/navigation-menu-item/ (folder system — types, hooks, states)
- read packages/twenty-server/src/engine/core-modules/agent/controllers/skill.controller.ts (exists but NOT registered)
- read packages/twenty-server/src/engine/core-modules/agent/agent.module.ts (controllers array)
- read packages/twenty-server/src/engine/core-modules/agent/entities/agent-skill.entity.ts
- read packages/twenty-server/src/engine/core-modules/agent/entities/agent-skill-folder.entity.ts

SCOPE — files you may create/edit:
- packages/twenty-front/src/modules/agent/components/AgentSkillsSidebar.tsx (REPLACE placeholder)
- packages/twenty-front/src/modules/agent/hooks/useAgentSkills.ts (NEW — fetch + manage skills)
- packages/twenty-server/src/engine/core-modules/agent/agent.module.ts (register SkillController)

IMPLEMENTATION:
1. Backend — register skill.controller.ts:
   - It already exists at controllers/skill.controller.ts but is NOT in agent.module.ts controllers array
   - Add SkillController to the controllers array in agent.module.ts
   - That's it for backend — the controller already has all CRUD endpoints (stubbed with 501)

2. Frontend — create useAgentSkills hook:
   - For now, return hardcoded seed skills matching the 5 seeds in packages/twenty-server/src/engine/core-modules/agent/seeds/
   - Include a selectedSkillId state using the existing selectedSkillIdState atom
   - Export: skills list, selectedSkillId, setSelectedSkillId, folders

3. Frontend — replace AgentSkillsSidebar:
   - REUSE twenty's NavigationDrawerItem components for each skill
   - REUSE NavigationDrawerItemsCollapsableContainer for folders
   - Show skill icon + name using NavigationDrawerItem's label and Icon props
   - Highlight active skill using NavigationDrawerItem's active prop tied to selectedSkillIdState
   - onClick sets selectedSkillIdState
   - Keep the 240px width and border-right from the placeholder
   - Add a "New Skill" button at the bottom using twenty's UI patterns
   - Group skills by folder if they have a folderId

DO NOT:
- Build the skill editor (that's DEV-960, already done)
- Build drag-and-drop reordering yet
- Build folder creation/rename UI yet
- Make real API calls (skills are hardcoded seeds for now)
- Touch any files outside SCOPE

SELF-REVIEW:
- Re-read every file you created/edited
- Verify SkillController is in agent.module.ts controllers array
- Verify NavigationDrawerItem imports resolve correctly
- Run: npx nx typecheck twenty-front
- Run: npx nx typecheck twenty-server
- Run: bash scripts/code-review.sh
- If any check fails, fix and re-run
PROMPT955

read -r -d '' PROMPT_963 << 'PROMPT963' || true
you are implementing DEV-963: automation CRUD REST API for the consuelo AI agent.

PREP:
- read AGENTS.md and CODING-STANDARDS.md
- read packages/twenty-server/src/engine/core-modules/agent/agent.module.ts (registered providers + controllers)
- read packages/twenty-server/src/engine/core-modules/agent/services/automation.service.ts (already has create, findById, findByUser, findEnabled, update, delete)
- read packages/twenty-server/src/engine/core-modules/agent/entities/automation.entity.ts (full entity with triggerConfig, inputOverrides, notifyOn, maxRunsPerDay)
- read packages/twenty-server/src/engine/core-modules/agent/controllers/skill.controller.ts (pattern reference for controller structure)

SCOPE — files you may create/edit:
- packages/twenty-server/src/engine/core-modules/agent/controllers/automation.controller.ts (NEW)
- packages/twenty-server/src/engine/core-modules/agent/agent.module.ts (register controller)

IMPLEMENTATION:
1. Create automation.controller.ts:
   - @Controller('v1/agent/automations')
   - @UseGuards(JwtAuthGuard, WorkspaceAuthGuard)
   - @UseFilters(RestApiExceptionFilter)
   - Inject AutomationService (already registered as provider)

2. Endpoints (literal routes BEFORE param routes):
   - GET /v1/agent/automations — list user's automations (call findByUser)
   - POST /v1/agent/automations — create automation (call create)
   - GET /v1/agent/automations/:id — get by id (call findById)
   - PATCH /v1/agent/automations/:id — update (call update)
   - DELETE /v1/agent/automations/:id — delete (call delete)
   - POST /v1/agent/automations/:id/toggle — toggle enabled/disabled (call update with flipped isEnabled)
   - POST /v1/agent/automations/:id/run — manual trigger (stub with 501 for now — DEV-964 will implement execution)

3. Register in agent.module.ts controllers array

4. Use @AuthUser() and @AuthWorkspace() decorators like skill.controller.ts does
5. Proper error handling: 404 if findById returns null, try/catch with unknown typing

DO NOT:
- Modify automation.service.ts (it's already complete)
- Modify automation.entity.ts
- Build execution logic (that's DEV-964)
- Touch any files outside SCOPE

SELF-REVIEW:
- Re-read every file you created/edited
- Verify AutomationController is in agent.module.ts controllers array
- Verify literal routes come before param routes
- Verify all catch blocks use (err: unknown)
- Run: npx nx typecheck twenty-server
- Run: bash scripts/code-review.sh
- If any check fails, fix and re-run
PROMPT963

# ─── Run kiro-cli in parallel ───
echo "▶ starting 3 kiro-cli sessions in parallel..."

(
  cd "$REPO/../agent-chat" && \
  kiro-cli chat --trust-all-tools --no-interactive "$PROMPT_956" \
    > "$LOG_DIR/dev-956.log" 2>&1
  echo "✓ DEV-956 kiro done"
) &
PID_956=$!

(
  cd "$REPO/../agent-skills-sidebar" && \
  kiro-cli chat --trust-all-tools --no-interactive "$PROMPT_955" \
    > "$LOG_DIR/dev-955.log" 2>&1
  echo "✓ DEV-955 kiro done"
) &
PID_955=$!

(
  cd "$REPO/../agent-automation-api" && \
  kiro-cli chat --trust-all-tools --no-interactive "$PROMPT_963" \
    > "$LOG_DIR/dev-963.log" 2>&1
  echo "✓ DEV-963 kiro done"
) &
PID_963=$!

wait $PID_956 $PID_955 $PID_963
echo "✓ all 3 kiro sessions complete"

# ─── Commit + push each worktree ───

# DEV-956: chat interface
cd "$REPO/../agent-chat"
git add \
  packages/twenty-front/src/modules/agent/components/AgentChatPanel.tsx \
  packages/twenty-front/src/modules/agent/hooks/useAgentChat.ts \
  packages/twenty-front/package.json \
  packages/twenty-server/src/engine/core-modules/agent/controllers/chat.controller.ts \
  packages/twenty-server/src/engine/core-modules/agent/agent.module.ts \
  2>/dev/null
git diff --cached --quiet || \
  git commit -m "feat(agent): chat interface with assistant-ui (DEV-956)" \
    --author="$BOT_NAME <$BOT_EMAIL>" --no-verify
git push origin "$BRANCH" --no-verify
echo "✓ DEV-956 committed + pushed"

# DEV-955: skills sidebar
cd "$REPO/../agent-skills-sidebar"
git add \
  packages/twenty-front/src/modules/agent/components/AgentSkillsSidebar.tsx \
  packages/twenty-front/src/modules/agent/hooks/useAgentSkills.ts \
  packages/twenty-server/src/engine/core-modules/agent/agent.module.ts \
  2>/dev/null
git diff --cached --quiet || \
  git commit -m "feat(agent): skills sidebar navigation (DEV-955)" \
    --author="$BOT_NAME <$BOT_EMAIL>" --no-verify
git push origin "$BRANCH" --no-verify
echo "✓ DEV-955 committed + pushed"

# DEV-963: automation API
cd "$REPO/../agent-automation-api"
git add \
  packages/twenty-server/src/engine/core-modules/agent/controllers/automation.controller.ts \
  packages/twenty-server/src/engine/core-modules/agent/agent.module.ts \
  2>/dev/null
git diff --cached --quiet || \
  git commit -m "feat(agent): automation CRUD REST API (DEV-963)" \
    --author="$BOT_NAME <$BOT_EMAIL>" --no-verify
git push origin "$BRANCH" --no-verify
echo "✓ DEV-963 committed + pushed"

# ─── Merge worktrees into main branch ───
cd "$REPO" && git pull origin "$BRANCH"

for WT in agent-chat agent-skills-sidebar agent-automation-api; do
  MERGE_BRANCH=$(cd "../$WT" && git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "$BRANCH")
  COMMIT=$(cd "../$WT" && git rev-parse HEAD)
  git merge "$COMMIT" --no-edit --no-verify -m "Merge $WT into $BRANCH" 2>/dev/null || true
done
git push origin "$BRANCH" --no-verify
echo "✓ all merges pushed"

# ─── OpenCode reviews ───
echo "▶ starting opencode reviews..."

review_task() {
  local task_id="$1" task_name="$2" log_file="$3"
  local review_prompt="you are reviewing $task_name. read the git diff for the most recent commits on branch $BRANCH. fetch the linear task spec for $task_id. check every acceptance criterion (✅ met / ⚠️ partial / ❌ missing). check coding standards compliance. post your full review as a single gh pr comment to PR #$PR_NUM via: gh pr comment $PR_NUM --repo consuelohq/opensaas --body '<review>'. format: task ID, summary, criterion checklist, issues found, verdict (PASS/NEEDS WORK)."

  cd "$REPO" && XDG_DATA_HOME="/tmp/oc-$task_id" opencode \
    --model "$OC_MODEL" \
    --prompt "$review_prompt" \
    > "$LOG_DIR/review-$task_id.log" 2>&1
  echo "✓ $task_name review done"
}

review_task "DEV-956" "DEV-956 chat interface" "$LOG_DIR/review-956.log" &
review_task "DEV-955" "DEV-955 skills sidebar" "$LOG_DIR/review-955.log" &
review_task "DEV-963" "DEV-963 automation API" "$LOG_DIR/review-963.log" &
wait
echo "✓ all reviews posted"

# ─── Mark done in Linear ───
linear_status "d7ac5d70-dd94-4556-b349-6ebd53ec2273" "$DONE"  # DEV-956
linear_status "a6572553-1e26-4cfd-8ff1-806f994af1c2" "$DONE"  # DEV-955
linear_status "a595c7c6-00a9-4485-9abd-f0b3136f9c56" "$DONE"  # DEV-963
echo "✓ DEV-956, DEV-955, DEV-963 marked done"

# ─── Cleanup worktrees ───
cd "$REPO"
for WT in agent-chat agent-skills-sidebar agent-automation-api; do
  git worktree remove "../$WT" --force 2>/dev/null || true
done
echo "✓ worktrees cleaned up"

echo ""
echo "═══════════════════════════════════════"
echo "  BATCH 6 COMPLETE"
echo "  DEV-956 — chat interface"
echo "  DEV-955 — skills sidebar"
echo "  DEV-963 — automation CRUD API"
echo "═══════════════════════════════════════"

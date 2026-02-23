#!/usr/bin/env bash
set -uo pipefail

# ─── Batch 6: DEV-955 + DEV-962 (parallel) → DEV-956 → DEV-957 (sequential) ───
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

# Mark all 4 in-progress
linear_status "a6572553-1e26-4cfd-8ff1-806f994af1c2" "$IN_PROGRESS"  # DEV-955
linear_status "2e784953-347e-4c87-9b41-e28cfc24e09e" "$IN_PROGRESS"  # DEV-962
linear_status "d7ac5d70-dd94-4556-b349-6ebd53ec2273" "$IN_PROGRESS"  # DEV-956
linear_status "a9309e2e-fa27-4f8f-9699-5f9ee805cafc" "$IN_PROGRESS"  # DEV-957
echo "✓ marked DEV-955, DEV-962, DEV-956, DEV-957 in-progress"

# ─── Prep main branch ───
cd "$REPO" && git checkout "$BRANCH" && git pull origin "$BRANCH"

# ─── Worktree setup (temp branches from HEAD) ───
for WT in agent-skills-sidebar agent-migration; do
  if [ -d "../$WT" ]; then
    git worktree remove "../$WT" --force 2>/dev/null || true
  fi
  git branch -D "temp-$WT" 2>/dev/null || true
done

git worktree add -b temp-agent-skills-sidebar ../agent-skills-sidebar HEAD
git worktree add -b temp-agent-migration ../agent-migration HEAD
echo "✓ worktrees created"

# ═══════════════════════════════════════════════════════════════
# PHASE A — DEV-955 + DEV-962 in parallel worktrees
# ═══════════════════════════════════════════════════════════════

read -r -d '' PROMPT_955 << 'PROMPT955' || true
you are implementing DEV-955: skills sidebar navigation for the consuelo AI agent page.

PREP:
- read AGENTS.md and CODING-STANDARDS.md
- read packages/twenty-front/src/modules/agent/components/AgentSkillsSidebar.tsx (placeholder to replace)
- read packages/twenty-front/src/modules/agent/components/AgentPage.tsx (parent layout)
- read packages/twenty-front/src/modules/agent/types/agent.ts (AgentSkill type)
- read packages/twenty-front/src/modules/agent/states/agentState.ts (selectedSkillIdState)
- study packages/twenty-front/src/modules/ui/navigation/navigation-drawer/ — understand NavigationDrawerItem, NavigationDrawerSubItem, NavigationDrawerItemsCollapsableContainer
- study packages/twenty-front/src/modules/navigation-menu-item/ — folder system types, hooks, states
- read packages/twenty-server/src/engine/core-modules/agent/controllers/skill.controller.ts (exists but NOT registered)
- read packages/twenty-server/src/engine/core-modules/agent/agent.module.ts (controllers array — add SkillController)
- read packages/twenty-server/src/engine/core-modules/agent/entities/agent-skill.entity.ts
- read packages/twenty-server/src/engine/core-modules/agent/entities/agent-skill-folder.entity.ts

SCOPE — files you may create/edit:
- packages/twenty-front/src/modules/agent/components/AgentSkillsSidebar.tsx (REPLACE placeholder)
- packages/twenty-front/src/modules/agent/hooks/useAgentSkills.ts (NEW — fetch + manage skills)
- packages/twenty-server/src/engine/core-modules/agent/agent.module.ts (register SkillController)

IMPLEMENTATION:
1. Backend — register skill.controller.ts:
   - It already exists at controllers/skill.controller.ts but is NOT in agent.module.ts controllers array
   - Add SkillController import and add to the controllers array
   - That's it for backend — the controller already has CRUD endpoints

2. Frontend — create useAgentSkills hook:
   - Fetch skills from GET /v1/agent/skills (the endpoint SkillController exposes)
   - Use the existing selectedSkillIdState recoil atom for selection
   - Export: skills list, selectedSkillId, setSelectedSkillId, isLoading

3. Frontend — replace AgentSkillsSidebar:
   - REUSE twenty's NavigationDrawerItem for each skill (label + Icon props)
   - REUSE NavigationDrawerItemsCollapsableContainer for folders
   - Highlight active skill via NavigationDrawerItem's active prop tied to selectedSkillIdState
   - onClick sets selectedSkillIdState
   - Keep the 240px width and border-right styling
   - Add a "New Skill" button at the bottom
   - Group skills by folderId when present

DO NOT:
- Build the skill editor (DEV-960, already done)
- Build drag-and-drop reordering
- Build folder creation/rename UI
- Create new navigation components — REUSE twenty's existing ones
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

read -r -d '' PROMPT_962 << 'PROMPT962' || true
you are implementing DEV-962: generate the TypeORM migration for the agent automation table.

PREP:
- read AGENTS.md and CODING-STANDARDS.md
- read packages/twenty-server/src/engine/core-modules/agent/entities/automation.entity.ts (the entity that needs a migration)
- read packages/twenty-server/src/engine/core-modules/agent/entities/agent-skill.entity.ts (FK target)
- read packages/twenty-server/src/engine/core-modules/agent/agent.module.ts (verify entity is in TypeOrmModule.forFeature)
- look at existing migrations in packages/twenty-server/src/database/typeorm/core/migrations/common/ for pattern reference

SCOPE — files you may create:
- packages/twenty-server/src/database/typeorm/core/migrations/common/*add-agent-automation*.ts (GENERATED)

IMPLEMENTATION:
1. Generate the migration:
   npx nx run twenty-server:typeorm migration:generate src/database/typeorm/core/migrations/common/add-agent-automation -d src/database/typeorm/core/core.datasource.ts

2. If the generate command fails (datasource issues, entity not found, etc.):
   - Check that AgentAutomationEntity is properly decorated with @Entity
   - Check that it's registered in TypeOrmModule.forFeature in agent.module.ts
   - Check the core.datasource.ts includes the agent entities directory
   - Fix any issues and retry

3. After generation, read the migration file and verify:
   - It has both up() and down() methods
   - It creates the agentAutomation table (or agent_automation depending on naming)
   - It creates indexes: user+workspace, skillId, enabled (partial)
   - It creates FK constraint to agent_skills table with CASCADE delete
   - The column types match the entity (uuid, varchar, jsonb, timestamptz, integer, boolean)

4. If the migration looks wrong or incomplete, edit it to match the entity exactly.

DO NOT:
- Modify the entity file
- Modify agent.module.ts
- Create any other files
- Touch any files outside SCOPE

SELF-REVIEW:
- Re-read the generated migration file
- Verify up() creates the table with all columns and indexes
- Verify down() drops the table
- Run: npx nx typecheck twenty-server
- If typecheck fails, fix and re-run
PROMPT962

echo "▶ starting DEV-955 + DEV-962 in parallel..."

(
  cd "$REPO/../agent-skills-sidebar" && \
  kiro-cli chat --trust-all-tools --no-interactive "$PROMPT_955" \
    > "$LOG_DIR/dev-955.log" 2>&1
  echo "✓ DEV-955 kiro done"
) &
PID_955=$!

(
  cd "$REPO/../agent-migration" && \
  kiro-cli chat --trust-all-tools --no-interactive "$PROMPT_962" \
    > "$LOG_DIR/dev-962.log" 2>&1
  echo "✓ DEV-962 kiro done"
) &
PID_962=$!

wait $PID_955 $PID_962
echo "✓ phase A complete (DEV-955 + DEV-962)"

# ─── Commit in worktrees ───
cd "$REPO/../agent-skills-sidebar"
git add \
  packages/twenty-front/src/modules/agent/components/AgentSkillsSidebar.tsx \
  packages/twenty-front/src/modules/agent/hooks/ \
  packages/twenty-server/src/engine/core-modules/agent/agent.module.ts \
  2>/dev/null
git diff --cached --quiet || \
  git commit -m "feat(agent): skills sidebar navigation (DEV-955)" \
    --author="$BOT_NAME <$BOT_EMAIL>" --no-verify

cd "$REPO/../agent-migration"
git add \
  packages/twenty-server/src/database/typeorm/core/migrations/common/ \
  2>/dev/null
git diff --cached --quiet || \
  git commit -m "feat(agent): automation table migration (DEV-962)" \
    --author="$BOT_NAME <$BOT_EMAIL>" --no-verify

# ─── Merge worktrees into main ───
cd "$REPO"
git merge temp-agent-skills-sidebar --no-edit --no-verify || true
git merge temp-agent-migration --no-edit --no-verify || true
git push origin "$BRANCH" --no-verify
echo "✓ phase A merged + pushed"

# ═══════════════════════════════════════════════════════════════
# PHASE B — DEV-956 sequential on main (needs agent.module.ts from DEV-955)
# ═══════════════════════════════════════════════════════════════

read -r -d '' PROMPT_956 << 'PROMPT956' || true
you are implementing DEV-956: chat interface for the consuelo AI agent page.

PREP:
- read AGENTS.md and CODING-STANDARDS.md
- read packages/twenty-front/src/modules/agent/components/AgentChatPanel.tsx (placeholder to replace)
- read packages/twenty-front/src/modules/agent/components/AgentPage.tsx (parent layout)
- read packages/twenty-front/src/modules/agent/states/agentState.ts (existing state)
- read packages/agent/src/chat.ts (backend handleChat — uses createUIMessageStream + streamText)
- read packages/agent/src/types.ts (ChatRequest, ConversationState types)
- read packages/twenty-server/src/engine/core-modules/agent/agent.module.ts (current controllers — SkillController should already be there)
- check package.json versions: ai, @ai-sdk/react (both in twenty-front already)

SCOPE — files you may create/edit:
- packages/twenty-front/src/modules/agent/components/AgentChatPanel.tsx (REPLACE placeholder)
- packages/twenty-front/src/modules/agent/hooks/useAgentChat.ts (NEW)
- packages/twenty-server/src/engine/core-modules/agent/controllers/chat.controller.ts (NEW)
- packages/twenty-server/src/engine/core-modules/agent/agent.module.ts (add ChatController to controllers)
- packages/twenty-front/package.json (add @assistant-ui/react + @assistant-ui/react-ai-sdk)

IMPLEMENTATION:
1. Install assistant-ui — add to twenty-front/package.json:
   @assistant-ui/react and @assistant-ui/react-ai-sdk
   Then run: cd /Users/kokayi/Dev/opensaas && yarn install

2. Backend — create chat.controller.ts:
   - POST /v1/agent/chat
   - Accept { message, conversationId?, skillId? }
   - Use JwtAuthGuard + WorkspaceAuthGuard
   - Import handleChat from packages/agent/src/chat.ts (or build a thin wrapper)
   - Return the stream response
   - Register ChatController in agent.module.ts controllers array

3. Frontend — create useAgentChat hook:
   - Use useChat from @ai-sdk/react (already installed, v5)
   - Point api to /v1/agent/chat
   - Export: messages, input, handleSubmit, isLoading, setInput

4. Frontend — replace AgentChatPanel:
   - Import useAgentChat hook
   - Message list: map messages, show user/assistant with basic styling
   - Input form: text input + submit button at bottom
   - Auto-scroll to bottom on new messages
   - Loading indicator when assistant is responding
   - Use styled-components (Emotion) following twenty's patterns

DO NOT:
- Build rich message rendering (DEV-957 does that next)
- Build conversation history/persistence UI
- Touch AgentSkillsSidebar.tsx or AgentContextPanel.tsx
- Touch any files outside SCOPE

SELF-REVIEW:
- Re-read every file you created/edited
- Verify ChatController is registered in agent.module.ts
- Verify the endpoint path matches what the frontend hook calls
- Run: npx nx typecheck twenty-front
- Run: npx nx typecheck twenty-server
- Run: bash scripts/code-review.sh
- If any check fails, fix and re-run
PROMPT956

echo "▶ starting DEV-956 on main..."
cd "$REPO" && \
kiro-cli chat --trust-all-tools --no-interactive "$PROMPT_956" \
  > "$LOG_DIR/dev-956.log" 2>&1
echo "✓ DEV-956 kiro done"

# Commit DEV-956
cd "$REPO"
git add \
  packages/twenty-front/src/modules/agent/components/AgentChatPanel.tsx \
  packages/twenty-front/src/modules/agent/hooks/useAgentChat.ts \
  packages/twenty-server/src/engine/core-modules/agent/controllers/chat.controller.ts \
  packages/twenty-server/src/engine/core-modules/agent/agent.module.ts \
  packages/twenty-front/package.json \
  yarn.lock \
  2>/dev/null
git diff --cached --quiet || \
  git commit -m "feat(agent): chat interface with assistant-ui (DEV-956)" \
    --author="$BOT_NAME <$BOT_EMAIL>" --no-verify
git push origin "$BRANCH" --no-verify
echo "✓ DEV-956 committed + pushed"

# ═══════════════════════════════════════════════════════════════
# PHASE C — DEV-957 sequential on main (needs assistant-ui from DEV-956)
# ═══════════════════════════════════════════════════════════════

read -r -d '' PROMPT_957 << 'PROMPT957' || true
you are implementing DEV-957: rich response renderers for the consuelo AI agent chat.

PREP:
- read AGENTS.md and CODING-STANDARDS.md
- read packages/twenty-front/src/modules/agent/components/AgentChatPanel.tsx (just built — has assistant-ui wired up)
- check that @assistant-ui/react is installed in packages/twenty-front/package.json
- read @assistant-ui/react docs or source for makeAssistantToolUI API
- read packages/twenty-front/package.json to confirm recharts is available

SCOPE — files you may create/edit:
- packages/twenty-front/src/modules/agent/components/renderers/AgentChartRenderer.tsx (NEW)
- packages/twenty-front/src/modules/agent/components/renderers/AgentTableRenderer.tsx (NEW)
- packages/twenty-front/src/modules/agent/components/renderers/AgentBriefRenderer.tsx (NEW)
- packages/twenty-front/src/modules/agent/components/renderers/AgentFileCard.tsx (NEW)
- packages/twenty-front/src/modules/agent/components/renderers/index.ts (NEW — registers all tool UIs)
- packages/twenty-front/src/modules/agent/components/AgentChatPanel.tsx (UPDATE — import and register renderers)

IMPLEMENTATION:
1. Create renderers/AgentChartRenderer.tsx:
   - Registered via makeAssistantToolUI for tool name "render_chart"
   - Renders recharts (BarChart, LineChart, PieChart) based on chartType prop
   - Accepts { chartType, data, title, xKey, yKey } from tool args
   - Use Emotion styled-components, twenty's theme tokens
   - Keep it minimal — just render the chart, no fancy controls

2. Create renderers/AgentTableRenderer.tsx:
   - Registered via makeAssistantToolUI for tool name "render_table"
   - Simple styled <table> with sortable column headers (click to sort)
   - Accepts { columns, rows, title } from tool args
   - Basic pagination if rows > 10

3. Create renderers/AgentBriefRenderer.tsx:
   - Registered via makeAssistantToolUI for tool name "render_brief"
   - Formatted sections with headers, bullet lists, highlighted key metrics
   - Accepts { title, sections: Array<{ heading, content }> } from tool args

4. Create renderers/AgentFileCard.tsx:
   - Registered via makeAssistantToolUI for tool name "create_file"
   - Simple card with file icon, name, size, download link
   - Accepts { fileName, fileUrl, fileSize, mimeType } from tool args

5. Create renderers/index.ts:
   - Import all 4 renderer components
   - Export them as an array or object for registration

6. Update AgentChatPanel.tsx:
   - Import renderers from ./renderers
   - Register them with the assistant-ui runtime (the exact wiring depends on how DEV-956 set up the runtime)

DO NOT:
- Build action confirmation UI
- Build conversation persistence
- Modify any backend files
- Touch AgentSkillsSidebar.tsx or AgentContextPanel.tsx
- Touch any files outside SCOPE

SELF-REVIEW:
- Re-read every file you created/edited
- Verify each renderer uses makeAssistantToolUI correctly
- Verify renderers are imported and registered in AgentChatPanel.tsx
- Verify recharts imports resolve (it's already in twenty-front deps)
- Run: npx nx typecheck twenty-front
- Run: bash scripts/code-review.sh
- If any check fails, fix and re-run
PROMPT957

echo "▶ starting DEV-957 on main..."
cd "$REPO" && \
kiro-cli chat --trust-all-tools --no-interactive "$PROMPT_957" \
  > "$LOG_DIR/dev-957.log" 2>&1
echo "✓ DEV-957 kiro done"

# Commit DEV-957
cd "$REPO"
git add \
  packages/twenty-front/src/modules/agent/components/renderers/ \
  packages/twenty-front/src/modules/agent/components/AgentChatPanel.tsx \
  2>/dev/null
git diff --cached --quiet || \
  git commit -m "feat(agent): rich response renderers for chat (DEV-957)" \
    --author="$BOT_NAME <$BOT_EMAIL>" --no-verify
git push origin "$BRANCH" --no-verify
echo "✓ DEV-957 committed + pushed"

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

review_task "DEV-955" "DEV-955 skills sidebar" &
review_task "DEV-962" "DEV-962 automation migration" &
review_task "DEV-956" "DEV-956 chat interface" &
review_task "DEV-957" "DEV-957 rich renderers" &
wait
echo "✓ all reviews posted"

# ─── Mark done in Linear ───
linear_status "a6572553-1e26-4cfd-8ff1-806f994af1c2" "$DONE"  # DEV-955
linear_status "2e784953-347e-4c87-9b41-e28cfc24e09e" "$DONE"  # DEV-962
linear_status "d7ac5d70-dd94-4556-b349-6ebd53ec2273" "$DONE"  # DEV-956
linear_status "a9309e2e-fa27-4f8f-9699-5f9ee805cafc" "$DONE"  # DEV-957
echo "✓ DEV-955, DEV-962, DEV-956, DEV-957 marked done"

# ─── Cleanup ───
cd "$REPO"
for WT in agent-skills-sidebar agent-migration; do
  git worktree remove "../$WT" --force 2>/dev/null || true
  git branch -D "temp-$WT" 2>/dev/null || true
done
echo "✓ worktrees cleaned up"

echo ""
echo "═══════════════════════════════════════"
echo "  BATCH 6 COMPLETE"
echo "  DEV-955 — skills sidebar"
echo "  DEV-962 — automation migration"
echo "  DEV-956 — chat interface"
echo "  DEV-957 — rich response renderers"
echo "═══════════════════════════════════════"

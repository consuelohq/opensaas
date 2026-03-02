#!/usr/bin/env bash
# run-phases-5.sh — Batch 5: DEV-971, DEV-961, DEV-954, DEV-960
# 4 implementations (kiro-cli) + 2 reviews (opencode)
# Usage: cd /Users/kokayi/Dev/opensaas && bash scripts/run-phases-5.sh 2>&1 | tee batch-5.log
set -uo pipefail

REPO="/Users/kokayi/Dev/opensaas"
BRANCH="agent-phase2-skills"
AUTHOR="suelo-kiro[bot] <260422584+suelo-kiro[bot]@users.noreply.github.com>"
WT1="/Users/kokayi/Dev/opensaas-wt1"
WT2="/Users/kokayi/Dev/opensaas-wt2"

cd "$REPO"
echo "=== BATCH 5 START: $(date) ==="
echo "HEAD: $(git rev-parse --short HEAD)"

###############################################################################
# PHASE 1: Main branch — DEV-971 (Context Engine) then DEV-961 (Trigger System)
###############################################################################

echo ""
echo "=== [1/4] DEV-971: Cross-skill context sharing ==="

PROMPT_971=""
read -r -d '' PROMPT_971 <<'KIRO_971' || true
You are implementing DEV-971: Cross-skill context sharing + memory for the Consuelo agent.

## PREP
1. Read CODING-STANDARDS.md — all 13 rules are mandatory
2. Study packages/agent/src/context/ — this is where your pure-function service goes
3. Study packages/agent/src/context/pipeline-intelligence.service.ts as the pattern for pure-function services
4. Study packages/twenty-server/src/engine/core-modules/agent/ — entities, services, agent.module.ts
5. Read packages/agent/src/types.ts for ConversationState (has compactedSummary field already)

## WHAT TO BUILD

The context engine orchestrates all context layers for each agent turn. It loads memories, call context, pipeline context, methodology, skill outputs — then assembles them within a token budget.

### Pure-function service: packages/agent/src/context/context-engine.service.ts

Types (add to packages/agent/src/context/types.ts):
- ContextLayer: { name: string; priority: number; content: string; tokenEstimate: number }
- ContextBudget: { maxTokens: number; reserved: Record<string, number> }
  Default budget: maxTokens=4000, reserved: methodology=500, memories=800, callContext=600, pipeline=800, skillOutputs=1000, buffer=300

Functions to export:
- buildContextLayers(layers: ContextLayer[], budget: ContextBudget): ContextLayer[] — sort by priority (lower=higher), trim content to fit budget, drop lowest-priority layers if over budget
- estimateTokens(text: string): number — rough estimate: Math.ceil(text.length / 4)
- renderContextBlock(layers: ContextLayer[]): string — render all layers into a single system prompt block with XML tags per layer
- summarizeMessages(messages: Array<{role: string; content: string}>, existingSummary?: string): string — return a prompt string for LLM summarization (the actual LLM call happens in the NestJS service)
- shouldSummarize(messageCount: number, threshold?: number): boolean — returns true if messageCount > threshold (default 20)

### Skill output cache types (add to packages/agent/src/context/types.ts):
- SkillOutput: { skillId: string; skillName: string; output: unknown; executedAt: Date; conversationId?: string }
- SkillOutputCacheKey: template: skill:output:{userId}:{workspaceId}:{skillId}

### TypeORM entity: packages/twenty-server/src/engine/core-modules/agent/entities/agent-conversation-summary.entity.ts
Columns: id (UUID PK generated), conversationId (UUID), userId (UUID), workspaceId (UUID), summary (text), messageCount (integer), createdAt (timestamptz default now)
Indexes: conversationId, (userId + workspaceId)

### Migration: packages/twenty-server/src/database/typeorm/core/migrations/common/1771790000002-create-agent-conversation-summaries.ts
CREATE TABLE agent_conversation_summaries with all columns above. Include both up() and down().

### NestJS service: packages/twenty-server/src/engine/core-modules/agent/services/context-engine.service.ts
AgentContextEngineService — Injectable. Inject: AgentMemoryService, CallContextService, PipelineIntelligenceService, PreferenceInferenceService, Repository<AgentConversationSummary>, CACHE_MANAGER.

Methods:
- buildAgentContext(userId, workspaceId, options?: { activeCallSid?: string; currentMessage?: string; skillId?: string }): Promise<ContextLayer[]>
  Load all layers in parallel (Promise.all), wrap each in try/catch so one failure doesn't break others, then call buildContextLayers to fit budget.
- cacheSkillOutput(key: string, output: SkillOutput, ttlMs?: number): Promise<void> — cache in Redis, default TTL 3600000 (1 hour)
- getSkillOutput(key: string): Promise<SkillOutput | null> — read from Redis cache
- saveSummary(conversationId, userId, workspaceId, summary, messageCount): Promise<void>

### Update agent.module.ts:
- Add AgentConversationSummaryEntity to TypeOrmModule.forFeature array
- Add AgentContextEngineService to providers and exports

### Update packages/agent/src/context/index.ts:
- Export all new types and functions from context-engine.service.ts and types.ts

### Update packages/agent/src/index.ts:
- Export new context engine types and functions

## SCOPE — only touch these files:
- packages/agent/src/context/context-engine.service.ts (NEW)
- packages/agent/src/context/types.ts (MODIFY — add ContextLayer, ContextBudget, SkillOutput)
- packages/agent/src/context/index.ts (MODIFY — add exports)
- packages/agent/src/index.ts (MODIFY — add exports)
- packages/twenty-server/src/engine/core-modules/agent/entities/agent-conversation-summary.entity.ts (NEW)
- packages/twenty-server/src/engine/core-modules/agent/services/context-engine.service.ts (NEW)
- packages/twenty-server/src/database/typeorm/core/migrations/common/1771790000002-create-agent-conversation-summaries.ts (NEW)
- packages/twenty-server/src/engine/core-modules/agent/agent.module.ts (MODIFY)

## SELF-REVIEW
After writing all files:
1. Re-read every file you created/modified
2. Check every acceptance criterion:
   - ContextEngineService assembles all 6 context layers in priority order
   - Token budget system prevents context overflow (default 4000 tokens)
   - Lower-priority layers trimmed when budget exceeded
   - Skill outputs cached in Redis with 1-hour TTL
   - Cross-skill context rendered in <skill_context> block
   - Conversation summarization triggers at 20+ messages
   - Summary replaces old messages, keeps last 5 in full
   - AgentConversationSummary entity with migration (up + down)
   - Context loading is async with parallel fetches where possible (Promise.all)
   - Graceful degradation: if any context layer fails to load, others still work
3. Run: bash scripts/code-review.sh — all 13 must pass
4. If any check fails, fix and re-run
KIRO_971

cd "$REPO" && kiro-cli chat --trust-all-tools --no-interactive "$PROMPT_971" > kiro-971.log 2>&1
echo "DEV-971 kiro exit: $?"

# Commit DEV-971
cd "$REPO"
git add packages/agent/ packages/twenty-server/src/engine/core-modules/agent/ packages/twenty-server/src/database/typeorm/core/migrations/
git diff --cached --quiet || GIT_COMMITTER_NAME="suelo-kiro[bot]" GIT_COMMITTER_EMAIL="260422584+suelo-kiro[bot]@users.noreply.github.com" git commit -m "feat(agent): cross-skill context sharing + memory (DEV-971)"
echo "DEV-971 committed"

echo ""
echo "=== [2/4] DEV-961: Trigger system ==="

PROMPT_961=""
read -r -d '' PROMPT_961 <<'KIRO_961' || true
You are implementing DEV-961: Trigger system (event, schedule, conditional) for the Consuelo agent automation engine.

## PREP
1. Read CODING-STANDARDS.md — all 13 rules are mandatory
2. Study packages/agent/src/automation/automation.types.ts — TriggerConfig already defined (event/schedule/conditional)
3. Study packages/twenty-server/src/engine/core-modules/agent/services/automation.service.ts — existing automation service
4. Study packages/twenty-server/src/engine/core-modules/agent/entities/automation.entity.ts — existing entity

## WHAT TO BUILD

The trigger system evaluates when automations should fire. Three trigger types: event (CRM webhooks), schedule (cron via BullMQ), conditional (field comparisons on events).

### Pure-function service: packages/agent/src/automation/trigger.service.ts

Types (add to packages/agent/src/automation/automation.types.ts):
- CrmEventType: 'call_started' | 'call_ended' | 'deal_stage_changed' | 'deal_created' | 'deal_closed' | 'contact_created' | 'contact_updated' | 'note_created' | 'queue_empty' | 'queue_item_completed'
- CrmEvent: { type: CrmEventType; payload: Record<string, unknown>; timestamp: Date; userId: string; workspaceId: string }
- TriggerEvalResult: { shouldFire: boolean; reason: string; matchedAutomations: Array<{ automationId: string; automationName: string }> }
- DebounceKey: template: trigger:debounce:{automationId}:{eventType}

Functions to export:
- evaluateCondition(condition: Condition, payload: Record<string, unknown>): boolean — evaluate a single condition against event payload. Support all operators (eq, neq, gt, gte, lt, lte, contains, not_contains). Use type coercion for numeric comparisons.
- evaluateConditionGroup(group: ConditionGroup, payload: Record<string, unknown>): boolean — evaluate AND/OR groups
- matchEventTrigger(trigger: TriggerConfig, event: CrmEvent): boolean — check if event trigger matches the incoming event type + optional conditions
- matchConditionalTrigger(trigger: TriggerConfig, event: CrmEvent): boolean — check event type match + evaluate condition group
- findMatchingAutomations(automations: Automation[], event: CrmEvent): Automation[] — filter automations whose triggers match the event
- buildDebounceKey(automationId: string, eventType: string): string — return debounce key string
- parseCron(expression: string): { valid: boolean; description?: string; error?: string } — validate cron expression (basic validation, not full parser)

### NestJS service: packages/twenty-server/src/engine/core-modules/agent/services/trigger.service.ts
AgentTriggerService — Injectable. Inject: Repository<AgentAutomationEntity>, CACHE_MANAGER.

Methods:
- handleEvent(event: CrmEvent): Promise<TriggerEvalResult> — find all enabled automations for the workspace, evaluate triggers, check debounce, return matches
- isDebounced(automationId: string, eventType: string): Promise<boolean> — check Redis for debounce key
- setDebounce(automationId: string, eventType: string, ttlMs?: number): Promise<void> — set debounce key in Redis, default TTL 60000 (1 min)
- dryRun(automationId: string, event: CrmEvent): Promise<TriggerEvalResult> — test a trigger without actually firing

### Update agent.module.ts:
- Add AgentTriggerService to providers and exports

### Update packages/agent/src/automation/automation.types.ts:
- Add CrmEventType, CrmEvent, TriggerEvalResult, DebounceKey types

### Update packages/agent/src/automation/index.ts:
- Export all new types and functions

### Update packages/agent/src/index.ts:
- Export new trigger types and functions

## SCOPE — only touch these files:
- packages/agent/src/automation/trigger.service.ts (NEW)
- packages/agent/src/automation/automation.types.ts (MODIFY — add event/trigger types)
- packages/agent/src/automation/index.ts (MODIFY — add exports)
- packages/agent/src/index.ts (MODIFY — add exports)
- packages/twenty-server/src/engine/core-modules/agent/services/trigger.service.ts (NEW)
- packages/twenty-server/src/engine/core-modules/agent/agent.module.ts (MODIFY)

## SELF-REVIEW
After writing all files:
1. Re-read every file you created/modified
2. Check every acceptance criterion:
   - Event trigger registry handles all 10 CRM event types
   - Condition evaluator supports all 8 operators (eq, neq, gt, gte, lt, lte, contains, not_contains)
   - AND/OR condition groups evaluate correctly
   - Debounce prevents duplicate fires (Redis key with TTL)
   - Dry-run mode tests triggers without firing
   - findMatchingAutomations filters by enabled + trigger match
   - Cron validation returns valid/invalid with description
   - All functions are pure (no side effects in the agent package)
   - NestJS service uses dependency injection properly
3. Run: bash scripts/code-review.sh — all 13 must pass
4. If any check fails, fix and re-run
KIRO_961

cd "$REPO" && kiro-cli chat --trust-all-tools --no-interactive "$PROMPT_961" > kiro-961.log 2>&1
echo "DEV-961 kiro exit: $?"

# Commit DEV-961
cd "$REPO"
git add packages/agent/ packages/twenty-server/src/engine/core-modules/agent/
git diff --cached --quiet || GIT_COMMITTER_NAME="suelo-kiro[bot]" GIT_COMMITTER_EMAIL="260422584+suelo-kiro[bot]@users.noreply.github.com" git commit -m "feat(agent): trigger system for automations (DEV-961)"
echo "DEV-961 committed"

# Push main branch work
git push origin "$BRANCH" 2>&1
echo "Main branch pushed after DEV-971 + DEV-961"

###############################################################################
# PHASE 2: Worktrees — DEV-954 (Agent Page Layout) + DEV-960 (Skill Editor)
###############################################################################

echo ""
echo "=== Creating worktrees ==="
cd "$REPO"
git worktree add "$WT1" -b agent-page-layout HEAD 2>&1
git worktree add "$WT2" -b agent-skill-editor HEAD 2>&1
echo "Worktrees created at $WT1 and $WT2"

echo ""
echo "=== [3/4] DEV-954: Agent page layout + routing (WT1) ==="

PROMPT_954=""
read -r -d '' PROMPT_954 <<'KIRO_954' || true
You are implementing DEV-954: Agent page layout + routing for the Consuelo twenty-front application.

## PREP
1. Read CODING-STANDARDS.md — all 13 rules are mandatory
2. Study packages/twenty-front/src/modules/app/hooks/useCreateAppRouter.tsx — this is how routes are registered
3. Study packages/twenty-front/src/modules/dialer/ — reference for how a new module is structured (components/, hooks/, states/, types/, constants/)
4. Study packages/twenty-front/src/modules/workflow/ — another module reference
5. Find AppPath enum in twenty-shared and understand how paths are defined
6. Find how navigation drawer items are added (search for NavigationDrawerItem usage)
7. Study packages/twenty-front/src/modules/ui/utilities/hotkey/hooks/ for keyboard shortcut patterns

## WHAT TO BUILD

A dedicated /agent route with three-panel layout: skills sidebar (240px), chat center (flex-1), context panel (280px).

### Module structure: packages/twenty-front/src/modules/agent/
Create this directory structure:
- components/AgentPage.tsx — the three-panel layout component
- components/AgentSkillsSidebar.tsx — left panel placeholder (240px fixed width)
- components/AgentChatPanel.tsx — center panel placeholder (flex-1)
- components/AgentContextPanel.tsx — right panel placeholder (280px fixed width)
- hooks/useAgentHotkeys.ts — keyboard shortcut registration
- states/agentState.ts — recoil atoms for agent page state
- types/agent.ts — agent page types

### AgentPage.tsx layout:
Use Emotion styled-components (the twenty pattern). Three-panel flexbox:
- Container: display flex, height 100%, overflow hidden
- Left panel (AgentSkillsSidebar): width 240px, border-right, overflow-y auto
- Center panel (AgentChatPanel): flex 1, overflow-y auto
- Right panel (AgentContextPanel): width 280px, border-left, overflow-y auto
- Responsive: hide right panel when viewport < 1024px (use CSS media query)

Each panel should render a placeholder with the panel name centered, styled with twenty's color tokens.

### Route registration:
1. Find AppPath enum in twenty-shared/src/types/ and add Agent = '/agent'
2. In useCreateAppRouter.tsx, add: <Route path={AppPath.Agent} element={<AgentPage />} />
   Place it BEFORE the RecordIndexPage route (literal before param rule)
3. Create a page component at packages/twenty-front/src/pages/agent/AgentPage.tsx that imports and renders the module component

### Navigation item:
Find where the main navigation drawer items are defined (search for "Workflows" or "Search" in navigation components). Add an "Agent" item with an appropriate icon from @tabler/icons-react (IconRobot or IconBrain). Place it near Workflows in the nav order.

### Keyboard shortcut:
Register g+a (go to agent) using useGoToHotkeys pattern. Study how g+w (workflows) or similar shortcuts are registered.

### Recoil state (states/agentState.ts):
- agentSidebarCollapsedState: atom<boolean> default false
- agentContextPanelCollapsedState: atom<boolean> default false
- selectedSkillIdState: atom<string | null> default null

## SCOPE — only touch these files:
- packages/twenty-front/src/modules/agent/ (NEW directory — all files above)
- packages/twenty-front/src/pages/agent/AgentPage.tsx (NEW)
- packages/twenty-front/src/modules/app/hooks/useCreateAppRouter.tsx (MODIFY — add route)
- packages/twenty-shared/src/types/ (MODIFY — add AppPath.Agent if AppPath is an enum there)
- Navigation drawer component (MODIFY — add Agent nav item, find the right file first)

DO NOT touch any files outside the agent module, the router, the AppPath enum, and the navigation drawer.

## SELF-REVIEW
After writing all files:
1. Re-read every file you created/modified
2. Check every acceptance criterion:
   - /agent route registered and renders AgentPage
   - Three-panel layout with correct widths (240px, flex-1, 280px)
   - Navigation item visible in sidebar
   - g+a keyboard shortcut navigates to /agent
   - Right panel collapses on screens < 1024px
   - Recoil atoms created for sidebar/context panel collapse state
   - Uses Emotion styled-components (not inline styles or CSS modules)
   - Uses @tabler/icons-react for the nav icon
3. Run: bash scripts/code-review.sh — all 13 must pass
4. If any check fails, fix and re-run
KIRO_954

(cd "$WT1" && kiro-cli chat --trust-all-tools --no-interactive "$PROMPT_954" > "$REPO/kiro-954.log" 2>&1) &
PID_954=$!
echo "DEV-954 started (PID: $PID_954)"

echo ""
echo "=== [4/4] DEV-960: Skill editor with Monaco (WT2) ==="

PROMPT_960=""
read -r -d '' PROMPT_960 <<'KIRO_960' || true
You are implementing DEV-960: Skill editor with Monaco for the Consuelo twenty-front application.

## PREP
1. Read CODING-STANDARDS.md — all 13 rules are mandatory
2. Study packages/twenty-front/src/modules/dialer/components/ — reference for component patterns
3. Study packages/agent/src/types.ts — AgentConfig has skill-related types
4. Study packages/twenty-server/src/engine/core-modules/agent/entities/agent-skill.entity.ts — skill entity structure
5. Check if @monaco-editor/react is already in package.json. If not, add it to packages/twenty-front/package.json dependencies

## WHAT TO BUILD

The skill editor form with Monaco Editor for system prompt and sandbox template fields.

### Module location: packages/twenty-front/src/modules/agent/components/skill-editor/

### Components to create:

1. SkillEditorForm.tsx — main form container
   Props: { skillId?: string; onSave: (skill: SkillFormData) => void; onCancel: () => void }
   Fields: name (text), description (text), icon (emoji text input), category (select), outputFormat (select)
   Uses Emotion styled-components. Form layout: vertical stack with labeled fields.

2. SystemPromptEditor.tsx — Monaco wrapper for system prompt
   Props: { value: string; onChange: (value: string) => void }
   Monaco config: language="markdown", theme="vs-dark", height="300px", minimap off, wordWrap on, lineNumbers off, fontSize 14
   Register CRM variable completions on mount: triggerCharacters=['{'], provide suggestions for {{contact.name}}, {{contact.email}}, {{contact.company}}, {{deal.name}}, {{deal.value}}, {{deal.stage}}, {{user.name}}, {{workspace.name}}

3. SandboxTemplateEditor.tsx — Monaco wrapper for sandbox code
   Props: { value: string; onChange: (value: string) => void; language: 'python' | 'javascript' }
   Monaco config: theme="vs-dark", height="400px", minimap off, fontSize 14, tabSize based on language (4 for python, 2 for js)

4. SkillCategorySelect.tsx — category dropdown
   Options: 'data_analysis' | 'outreach' | 'reporting' | 'automation' | 'custom'

5. OutputFormatSelect.tsx — output format dropdown
   Options: 'text' | 'chart' | 'table' | 'file' | 'mixed'

### Types: packages/twenty-front/src/modules/agent/types/skill-editor.ts
- SkillFormData: { name: string; description: string; icon: string; category: SkillCategory; outputFormat: OutputFormat; systemPrompt: string; sandboxTemplate: string; sandboxLanguage: 'python' | 'javascript' }
- SkillCategory: 'data_analysis' | 'outreach' | 'reporting' | 'automation' | 'custom'
- OutputFormat: 'text' | 'chart' | 'table' | 'file' | 'mixed'
- CrmVariable: { label: string; insertText: string; description: string }

### Constants: packages/twenty-front/src/modules/agent/constants/skill-editor.ts
- CRM_VARIABLES: CrmVariable[] — the 8 variables listed above
- SKILL_CATEGORIES: Array<{ value: SkillCategory; label: string }>
- OUTPUT_FORMATS: Array<{ value: OutputFormat; label: string }>

### Monaco dependency:
Check packages/twenty-front/package.json. If @monaco-editor/react is not listed, add it:
  "@monaco-editor/react": "^4.6.0"
Then the user will run yarn install separately — do NOT run yarn install.

## SCOPE — only touch these files:
- packages/twenty-front/src/modules/agent/components/skill-editor/ (NEW directory)
- packages/twenty-front/src/modules/agent/types/skill-editor.ts (NEW)
- packages/twenty-front/src/modules/agent/constants/skill-editor.ts (NEW)
- packages/twenty-front/package.json (MODIFY — add @monaco-editor/react if missing)

DO NOT touch any files outside the agent module and twenty-front package.json.

## SELF-REVIEW
After writing all files:
1. Re-read every file you created/modified
2. Check every acceptance criterion:
   - SkillEditorForm renders all fields (name, description, icon, category, outputFormat)
   - SystemPromptEditor uses Monaco with markdown mode and CRM variable completions
   - SandboxTemplateEditor uses Monaco with language toggle (python/javascript)
   - CRM variable completions trigger on '{' character
   - All 8 CRM variables available as completions
   - Dark theme (vs-dark) on both editors
   - Types exported for SkillFormData, SkillCategory, OutputFormat
   - Uses Emotion styled-components (not inline styles)
   - Named exports only (no default exports)
3. Run: bash scripts/code-review.sh — all 13 must pass
4. If any check fails, fix and re-run
KIRO_960

(cd "$WT2" && XDG_DATA_HOME="/tmp/oc-960" kiro-cli chat --trust-all-tools --no-interactive "$PROMPT_960" > "$REPO/kiro-960.log" 2>&1) &
PID_960=$!
echo "DEV-960 started (PID: $PID_960)"

# Wait for both worktree tasks
echo ""
echo "=== Waiting for worktree tasks ==="
wait $PID_954
EXIT_954=$?
echo "DEV-954 exited: $EXIT_954"

wait $PID_960
EXIT_960=$?
echo "DEV-960 exited: $EXIT_960"

###############################################################################
# PHASE 3: Commit worktrees, merge into main, push
###############################################################################

echo ""
echo "=== Committing worktree changes ==="

# Commit WT1 (DEV-954)
cd "$WT1"
git add packages/twenty-front/src/modules/agent/ packages/twenty-front/src/pages/agent/ packages/twenty-front/src/modules/app/ packages/twenty-shared/
git diff --cached --quiet || GIT_COMMITTER_NAME="suelo-kiro[bot]" GIT_COMMITTER_EMAIL="260422584+suelo-kiro[bot]@users.noreply.github.com" git commit -m "feat(agent): agent page layout + routing (DEV-954)"
echo "WT1 committed"

# Commit WT2 (DEV-960)
cd "$WT2"
git add packages/twenty-front/src/modules/agent/ packages/twenty-front/package.json
git diff --cached --quiet || GIT_COMMITTER_NAME="suelo-kiro[bot]" GIT_COMMITTER_EMAIL="260422584+suelo-kiro[bot]@users.noreply.github.com" git commit -m "feat(agent): skill editor with Monaco (DEV-960)"
echo "WT2 committed"

echo ""
echo "=== Merging worktrees into main ==="
cd "$REPO"

# Merge WT1
git merge agent-page-layout --no-edit 2>&1
MERGE1=$?
echo "WT1 merge exit: $MERGE1"

# Merge WT2
git merge agent-skill-editor --no-edit 2>&1
MERGE2=$?
echo "WT2 merge exit: $MERGE2"

if [ $MERGE1 -ne 0 ] || [ $MERGE2 -ne 0 ]; then
  echo "⚠️  MERGE CONFLICT — resolve manually, then push"
  echo "Conflict files:"
  git diff --name-only --diff-filter=U 2>/dev/null
fi

# Push everything
git push origin "$BRANCH" 2>&1
echo "All work pushed"

###############################################################################
# PHASE 4: OpenCode reviews (parallel)
###############################################################################

echo ""
echo "=== Running reviews ==="

REVIEW_MAIN=""
read -r -d '' REVIEW_MAIN <<'REVIEW1' || true
You are a code reviewer. Review the latest changes on branch agent-phase2-skills for DEV-971 (Cross-skill context sharing) and DEV-961 (Trigger system).

1. Run: git log --oneline -6
2. For DEV-971, check:
   - ContextEngineService assembles all 6 context layers in priority order
   - Token budget system prevents context overflow (default 4000 tokens)
   - Lower-priority layers trimmed when budget exceeded
   - Skill outputs cached in Redis with 1-hour TTL
   - Cross-skill context rendered in <skill_context> block
   - Conversation summarization triggers at 20+ messages
   - AgentConversationSummary entity with migration (up + down)
   - Context loading uses Promise.all for parallel fetches
   - Graceful degradation: if any layer fails, others still work
3. For DEV-961, check:
   - Event trigger handles all 10 CRM event types
   - Condition evaluator supports all 8 operators
   - AND/OR condition groups work
   - Debounce prevents duplicate fires
   - Dry-run mode works
   - Cron validation
4. Check: no console.log, no untyped catch, no as any
5. Post your review as a single comment:
   gh pr comment 20 --repo consuelohq/opensaas --body "## Code Review: DEV-971 & DEV-961

   [your review with ✅/⚠️/❌ per criterion]"
REVIEW1

REVIEW_WT=""
read -r -d '' REVIEW_WT <<'REVIEW2' || true
You are a code reviewer. Review the latest changes on branch agent-phase2-skills for DEV-954 (Agent page layout) and DEV-960 (Skill editor Monaco).

1. Run: git log --oneline -6
2. For DEV-954, check:
   - /agent route registered in useCreateAppRouter.tsx
   - Three-panel layout (240px sidebar, flex-1 chat, 280px context)
   - Navigation item in sidebar
   - g+a keyboard shortcut
   - Right panel collapses on < 1024px
   - Recoil atoms for panel state
   - Uses Emotion styled-components
3. For DEV-960, check:
   - SkillEditorForm with all fields
   - SystemPromptEditor uses Monaco markdown mode
   - SandboxTemplateEditor uses Monaco with language toggle
   - CRM variable completions on '{' trigger
   - All 8 CRM variables available
   - Dark theme (vs-dark)
   - Named exports only
4. Check: no console.log, no untyped catch, no as any
5. Post your review as a single comment:
   gh pr comment 20 --repo consuelohq/opensaas --body "## Code Review: DEV-954 & DEV-960

   [your review with ✅/⚠️/❌ per criterion]"
REVIEW2

XDG_DATA_HOME="/tmp/oc-review1" opencode run -m opencode/minimax-m2.5-free "$REVIEW_MAIN" > review-main.log 2>&1 &
PID_R1=$!

XDG_DATA_HOME="/tmp/oc-review2" opencode run -m opencode/minimax-m2.5-free "$REVIEW_WT" > review-worktrees.log 2>&1 &
PID_R2=$!

echo "Reviews started (PIDs: $PID_R1, $PID_R2)"
wait $PID_R1 $PID_R2
echo "Reviews complete"

###############################################################################
# PHASE 5: Cleanup
###############################################################################

echo ""
echo "=== Cleanup ==="
cd "$REPO"
git worktree remove --force "$WT1" 2>/dev/null
git worktree remove --force "$WT2" 2>/dev/null
git branch -d agent-page-layout 2>/dev/null
git branch -d agent-skill-editor 2>/dev/null
echo "Worktrees cleaned up"

echo ""
echo "=== BATCH 5 COMPLETE: $(date) ==="
echo "HEAD: $(git rev-parse --short HEAD)"

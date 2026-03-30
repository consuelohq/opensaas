---
name: worktree-batch
description: parallel code execution via git worktrees + opencode. kiro is the senior engineer — writes specs, crafts prompts, reviews diffs, merges. opencode writes code. ko runs the bash.
inclusion: auto
---

# worktree batch skill

run N opencode sessions in parallel using git worktrees. kiro orchestrates everything — specs, prompts, review, merge. opencode writes code. ko pastes bash commands.

## identity

**kiro is the senior software engineer.** opencode and kiro-cli are the tools. kiro:
- writes specs with acceptance criteria
- crafts behavioral prompts (not just "implement X" — full prep/review/verify instructions)
- reviews every diff against the spec (not a rubber stamp)
- manages git (worktrees, merges, pushes)
- manages linear (status, comments, follow-ups)
- generates single-command scripts ko can paste once

opencode:
- writes code in isolated worktrees (complex features, bug fix batches)
- runs read-only code reviews after kiro implements (posts to GitHub)
- runs code-review.sh
- commits its work

kiro-cli (non-interactive):
- implements features via `kiro-cli chat --trust-all-tools --no-interactive 'prompt'`
- better than opencode for tasks that need deep codebase understanding (LSP, full tool access)
- use for bigger/complex features; opencode for mechanical batches

ko:
- runs one bash command (script handles parallelism, sequencing, cleanup)
- makes judgment calls kiro flags
- overrides model selection when needed

## when to use

ko says any of: "set me up for opencode", "batch these tasks", "run these in parallel", "set up worktrees", gives a list of DEV-XXX tasks, or asks for review findings to be fixed.

### opencode vs kiro-cli — which tool for implementation

| scenario | tool | why |
|----------|------|-----|
| mechanical batch (5+ small fixes) | opencode | cheap, parallel, fast |
| complex feature (new entity, service, migration) | kiro-cli | LSP, full tool access, reads standards |
| bug fix (1-3 files, known fix) | opencode | overkill to spin up kiro |
| big phase task (new module, 10+ files) | kiro-cli | needs codebase understanding |
| code review after implementation | opencode (minimax-m2.5-free) | read-only, cheap, posts to GitHub |

**use discretion.** kiro-cli is heavier but smarter. opencode is cheaper but needs more hand-holding in the prompt. for bigger phase work (like DEV-948, DEV-1025), kiro-cli + opencode review is the pattern. for batch bug fixes, pure opencode is fine.

## the kiro-cli implementation + opencode review pattern

**this is the pattern for bigger tasks.** kiro implements with full tool access, then opencode reviews read-only and posts findings to GitHub.

### flow

```
kiro-cli implements (parallel worktrees)
         │
         ▼
opencode reviews diff vs spec (read-only)
         │
         ▼
gh pr comment posted to GitHub
```

### the script pattern

generate a single `scripts/run-<name>.sh` that ko runs once. the script:

1. starts with `cd` to the repo root so it works from anywhere
2. defines behavioral prompts for kiro (prep → implement → self-review)
3. defines review prompts for opencode (diff → spec → criteria check → gh comment)
4. runs N kiro sessions in parallel (one per worktree)
5. when each kiro finishes, **pushes the commit** (`git push`), then auto-triggers opencode review
6. logs everything to `<worktree>/kiro.log` and `<worktree>/review.log`
7. cleans up temp dirs on exit

### kiro behavioral prompt template

the prompt has three sections: PREP, SCOPE, SELF-REVIEW. this is what makes kiro actually do good work instead of yolo-ing.

```
implement DEV-XXX (<title>) on branch <branch>.

<1-2 sentence summary of what the spec contains>

SCOPE: <exact directories/files allowed>. DO NOT touch <excluded areas>.

BEFORE WRITING ANY CODE — MANDATORY PREP:
1. read AGENTS.md and CODING-STANDARDS.md at repo root. every rule is mandatory. internalize them.
2. read the DEV-XXX spec from linear (use the graphql API with $LINEAR_API_KEY). the spec has everything.
3. study existing patterns before writing anything:
   - entity pattern: <path to reference entity>
   - migration pattern: <path to recent migration>
   - working area: <path to module being modified>

WHILE WRITING CODE:
- match the exact decorator style, schema, import paths from the reference examples
- no console.log — use structured logger
- no any types without // HACK: comment
- parameterized SQL only
- catch (err: unknown) everywhere

AFTER WRITING CODE — MANDATORY SELF-REVIEW (DO NOT SKIP):
1. re-read every file you created or modified. check for typos, missing imports, wrong paths
2. open the linear spec again. go through EVERY acceptance criterion one by one. verify your code satisfies each
3. run: npx tsc --noEmit -p packages/twenty-server/tsconfig.json 2>&1 | head -50 — fix ALL type errors
4. run: bash scripts/code-review.sh — actually run the real script. do not simulate. all 16 checks must pass
5. if you fixed anything in steps 3-4, go back to step 1 and re-read the changed files
6. run git diff --stat and verify ONLY expected files appear. revert anything unexpected

commit as: suelo-kiro[bot] <260422584+suelo-kiro[bot]@users.noreply.github.com>
commit message: <type>(scope): <description>
```

### opencode review prompt template

opencode runs after kiro, read-only. its ONLY output is a `gh pr comment`.

```
you are a code reviewer. you do NOT write or modify code. your ONLY output is a GitHub PR comment.

STEPS:
1. run: git log --oneline -5
2. run: git diff HEAD~1 --stat
3. run: git diff HEAD~1 (read the full diff)
4. fetch the linear task spec: curl the graphql API for DEV-XXX
5. go through EVERY acceptance criterion. for each: search the diff, mark ✅ (done), ⚠️ (partial), ❌ (missing)
6. check code quality: console.log? untyped catch? as any? correct imports? entity matches twenty patterns? migration reversible?

OUTPUT: gh pr comment <PR> --repo <repo> --body "<review>"

comment format:
## 🔍 Code Review: DEV-XXX — <title>
### Acceptance Criteria
- ✅/⚠️/❌ each criterion
### Code Quality
- findings or "no issues"
### Summary
- 1-2 sentence verdict

DO NOT modify files. DO NOT write code. DO NOT commit. ONLY post the gh comment.
```

### script structure

```bash
#!/bin/bash
set -euo pipefail

REPO="consuelohq/opensaas"
PR_NUMBER=20

run_phase() {
  local dir=$1 label=$2 kiro_prompt=$3 review_prompt=$4 review_id=$5
  echo "[$label] kiro starting in $dir"
  cd "$dir"
  echo "$kiro_prompt" | kiro-cli chat --trust-all-tools --no-interactive > "$dir/kiro.log" 2>&1 || true
  echo "[$label] kiro done — pushing..."
  cd "$dir" && git push 2>&1 | tail -3
  echo "[$label] pushed — opencode review starting"
  cd "$dir" && XDG_DATA_HOME="/tmp/oc-$review_id" opencode run -m openrouter/minimax/minimax-m2.5-free "$review_prompt" > "$dir/review.log" 2>&1 || true
  echo "[$label] review done"
}

run_phase "$DIR1" "label1" "$PROMPT1" "$REVIEW1" "id1" &
run_phase "$DIR2" "label2" "$PROMPT2" "$REVIEW2" "id2" &
echo "launched — PIDs: $(jobs -p | tr '\n' ' ')"
wait
echo "all done"
rm -rf /tmp/oc-*
```

**critical details:**
- pipe the prompt via `echo "$PROMPT" |` — don't pass as arg (too long for shell)
- `opencode run` is the non-interactive mode (not `--non-interactive`)
- model format: `openrouter/minimax/minimax-m2.5-free` (not `opencode/...`)
- `XDG_DATA_HOME` isolates sqlite dbs per instance
- `git push` after kiro commits, before opencode reviews
- review prompt must include `gh pr comment $PR_NUMBER --repo $REPO --body '...'`
- `|| true` on both kiro and opencode so the script doesn't abort on non-zero exit

## the deliverable

**kiro's output is a bash block ko can paste.** not instructions — actual commands. one block, one paste, everything launches.

**always prefix with cd.** ko might not be in the right directory. every bash command kiro gives ko must start with `cd <repo-root> &&` so it works from anywhere. use the actual repo path (e.g. `cd ~/Dev/opensaas && bash scripts/run-phases-2.sh`), not a relative path.

```bash
# example: 5 parallel fix sessions
# each instance gets its own XDG_DATA_HOME to avoid sqlite lock conflicts
# CRITICAL: XDG_DATA_HOME must prefix the opencode command, NOT the cd command
cd /private/tmp/opensaas-dev-831 && XDG_DATA_HOME=/tmp/oc-831 /opt/homebrew/bin/opencode run -m opencode/minimax-m2.5-free 'prompt...' > /private/tmp/opensaas-dev-831/opencode.log 2>&1 &
cd /private/tmp/opensaas-dev-833 && XDG_DATA_HOME=/tmp/oc-833 /opt/homebrew/bin/opencode run -m opencode/minimax-m2.5-free 'prompt...' > /private/tmp/opensaas-dev-833/opencode.log 2>&1 &
cd /private/tmp/opensaas-dev-834 && XDG_DATA_HOME=/tmp/oc-834 /opt/homebrew/bin/opencode run -m opencode/minimax-m2.5-free 'prompt...' > /private/tmp/opensaas-dev-834/opencode.log 2>&1 &
cd /private/tmp/opensaas-dev-836 && XDG_DATA_HOME=/tmp/oc-836 /opt/homebrew/bin/opencode run -m opencode/minimax-m2.5-free 'prompt...' > /private/tmp/opensaas-dev-836/opencode.log 2>&1 &
cd /private/tmp/opensaas-dev-837 && XDG_DATA_HOME=/tmp/oc-837 /opt/homebrew/bin/opencode run -m opencode/minimax-m2.5-free 'prompt...' > /private/tmp/opensaas-dev-837/opencode.log 2>&1 &

echo "🚀 batch: 5 fixes launched — PIDs: $(jobs -p | tr '\n' ' ')"
wait
echo "✅ batch complete"
rm -rf /tmp/oc-*
```

**pattern:**
- `cd <worktree> && /opt/homebrew/bin/opencode run -m <model> '<prompt>'` — one line per task
- `> <worktree>/opencode.log 2>&1 &` — background + capture logs
- `wait` at the end — blocks until all finish
- echo before and after for ko's terminal feedback

## the prompt — gold standard

this is the most important part. a good prompt = opencode does the right thing. a bad prompt = 3 retry loops and wasted time.

### prompt structure (proven feb 2026)

```
fix <phase/area> <what>. read CODING-STANDARDS.md first. all changes on <branch>.

BLOCKERS:
B1 — <file>:<lines>: <what's wrong>. <exact fix instructions>.
B2 — <file>: <what's wrong>. <exact fix instructions>.

WARNINGS:
W1 — <file>:<lines>: <what's wrong>. <fix>.
W2 — <file> + <file>: <shared issue>. <fix>.

NOTES (fix these too):
N1 — <file>: <what to add/change>.
N2 — <file>: <what to add/change>.

SCOPE RULES (CRITICAL):
- ONLY modify the files listed above. Do NOT touch any other files.
- Do NOT delete any files. Do NOT remove any files from the repo.
- Before committing, run `git diff --stat` and verify ONLY the expected files appear. If you see unexpected files, run `git checkout -- <file>` to revert them.

run bash scripts/code-review.sh after all fixes. all 13 must pass.
```

### what makes this work

1. **categorized severity** — BLOCKERS first (must fix), WARNINGS (should fix), NOTES (nice to fix). opencode prioritizes correctly.
2. **file:line references** — no ambiguity about where to look.
3. **exact fix instructions** — not "fix the auth" but "read JWT from cookie/auth state and append &token=<jwt> to the WS URL (~line 120)."
4. **scope boundary + anti-deletion rule** — "ONLY modify listed files, do NOT delete any files" prevents both scope creep and accidental deletions. must be at the END of the prompt (recency bias — opencode remembers the last thing it reads).
5. **pre-commit diff check** — "run `git diff --stat` before committing" catches contamination before it's committed.
6. **code-review.sh requirement** — forces opencode to validate its own work.
7. **single quotes** — zsh-safe wrapping. double quotes inside are fine.

### real example (from batch 7, feb 2026)

```
fix phase 3 coaching review findings (pass 4). read CODING-STANDARDS.md first. all changes on twenty-fork branch.

BLOCKERS:
B7 — useTranscript.ts: WebSocket URL missing auth token. the backend requires ?token=xxx but frontend builds URL without it. read JWT from cookie/auth state and append &token=<jwt> to the WS URL (~line 120).
B8 — useCoaching.ts: isValidTalkingPoints() checks for objection_responses but backend SalesCoaching type has no such field. also clarifying_questions can be null (Array.isArray(null)=false). fix the validator to match what @consuelo/coaching actually returns.
B9 — usePostCallAnalysis.ts: isValidCallAnalytics() field names are all wrong — frontend expects camelCase but backend returns snake_case. add a transformation layer in the backend route POST /v1/coaching/analyze (coaching.ts) to map snake_case→camelCase before returning, OR fix the frontend validator to accept both.

WARNINGS:
W18 — useTranscript.ts: ws.onerror never sets transcriptErrorState. set it on error.
W19 — useCoaching.ts + usePostCallAnalysis.ts: no AbortController on fetch calls. add abort on cleanup/call-end to prevent stale data overwriting cleared state.
W20 — CoachingPanel.tsx + PostCallSummary.tsx: StyledRetryButton has all:unset removing focus ring. add &:focus-visible { outline: 2px solid blue; outline-offset: 2px; }

NOTES (fix these too):
N13 — add aria-live="polite" to StyledContent in CoachingPanel.tsx and LiveTranscript.tsx
N14 — useCoaching.ts: buildContactContext sends context as role sales_rep. change to system or add CONTEXT: prefix.

SCOPE RULES (CRITICAL):
- ONLY modify files listed above. Do NOT touch any other files.
- Do NOT delete any files. Do NOT remove any files from the repo.
- Before committing, run `git diff --stat` and verify ONLY the expected files appear. If you see unexpected files, run `git checkout -- <file>` to revert them.

run bash scripts/code-review.sh after all fixes. all 13 must pass.
```

### anti-patterns (what NOT to do)

```
# ❌ too vague — opencode will do 30% and call it done
fix the coaching module bugs

# ❌ no file references — opencode wastes time searching
fix the WebSocket auth issue in the transcript hook

# ❌ no scope boundary — opencode touches random files
fix all the type errors in the frontend

# ❌ no code-review requirement — opencode ships broken code
fix B7 B8 B9 in the coaching hooks
```

## model selection

see `models.md` for the full catalog. quick ref:

| task type | model | cost |
|-----------|-------|------|
| complex features | `nvidia/moonshotai/kimi-k2.5` or `nvidia/z-ai/glm5` | free |
| bug fixes / review findings | `opencode/minimax-m2.5-free` | free |
| mechanical (rename, add fields) | `opencode/gpt-5-nano` | free |
| speed-critical | `zai-coding-plan/glm-4.7-flashx` | paid |

**glm4.7 rule**: never from nvidia — only `zai-coding-plan/glm-4.7` or `zai-coding-plan/glm-4.7-flashx`.

ko can override: "use glm5 for all" or "use zai for speed".

## opencode-as-utility

opencode isn't just for coding. fire cheap one-shot calls for any mechanical operation:

```bash
/opt/homebrew/bin/opencode run -m opencode/minimax-m2.5-free '<prompt>' 2>&1
```

**use for:**
- git status checks across worktrees
- running code-review.sh and reporting results
- grep/search across codebase
- diff review and summarization
- merge conflict resolution
- batch linear updates (update 6 issue descriptions in parallel)
- research (check what a function does, trace types)

**Run multiple in parallel (each needs its own XDG_DATA_HOME):**
```bash
cd /tmp/opensaas-dev-831 && XDG_DATA_HOME=/tmp/oc-a /opt/homebrew/bin/opencode run -m opencode/minimax-m2.5-free 'check git status' 2>&1 &
cd /tmp/opensaas-dev-833 && XDG_DATA_HOME=/tmp/oc-b /opt/homebrew/bin/opencode run -m opencode/minimax-m2.5-free 'check git status' 2>&1 &
wait
```

**risk:** cross-reference context loss in summaries. fine for mechanical tasks, risky for judgment.
- mechanical → thin summary is fine
- judgment → richer summary or read raw data yourself
- deep review → always read raw data

## workflow

### phase 1: setup

1. **get the tasks** — ko gives task IDs or review findings. for linear tasks, pull title + description only (one `get_issue` per task). don't pull subtasks or comments.

2. **create worktrees:**
```bash
cd /Users/kokayi/Dev/opensaas
git checkout <target-branch> && git pull origin <target-branch>
~/.kiro/skills/worktree-batch/setup.sh <target-branch> DEV-831 DEV-833 DEV-834
```

3. **craft prompts** — one per task, following the gold standard template above. this is where kiro's value is. a good prompt = opencode succeeds first try.

4. **generate the bash block** — the deliverable ko pastes. all commands in one block with `&` + `wait`.

### phase 2: execute

ko pastes the bash block. opencode runs in parallel. kiro can:
- sleep and poll later
- use opencode-as-utility to check progress
- start reviewing finished worktrees while others are still running

**check if done:**
```bash
ps aux | grep opencode | grep -v grep
```

### phase 3: review

**this is the senior dev phase.** not a rubber stamp.

for each worktree:

#### 1. scope check
```bash
cd /private/tmp/opensaas-dev-XXX && git diff <target>..HEAD --stat
```
- only expected files changed?
- no reverts of other branches' work?
- no unrelated changes?

#### 2. spec coverage
go through each finding (B1, W1, N1...) and verify it's addressed in the diff:
- **MET** — fully implemented
- **PARTIAL** — some done, list what's missing
- **MISSING** — not addressed

#### 3. code quality
```bash
cd /private/tmp/opensaas-dev-XXX && bash scripts/code-review.sh 2>&1
```
all 13 must pass.

#### 4. regression check
```bash
git diff <target>..HEAD --name-only
```
compare against other active worktrees for cross-contamination.

### quality gate (max 3 attempts)

if review fails, craft a specific fix prompt:
```
review failed on DEV-XXX. fix these issues and amend your commit:

## missing
- B7: WebSocket auth still not fixed — URL still has no token param
- W19: AbortController added to useCoaching but not usePostCallAnalysis

## code review failures
- CATCH_TYPING: catch (err) without : unknown in useTranscript.ts:88

amend existing commit: git commit --amend --no-edit
author: suelo-kiro[bot] <260422584+suelo-kiro[bot]@users.noreply.github.com>
run bash scripts/code-review.sh to verify.
```

after 3 failures → flag for ko with what's still broken and your recommendation.

### phase 4: merge + ship

```bash
cd /Users/kokayi/Dev/opensaas
git checkout <target-branch> && git pull origin <target-branch>

# merge one at a time
git merge <target>-dev-831 --no-edit
git merge <target>-dev-833 --no-edit
# ...

# final check on merged result
bash scripts/code-review.sh

# push
HUSKY=0 git push origin <target-branch>
```

update linear: status → Done, comment with commit hash and what was implemented.

### MANDATORY: pre-push typecheck

**before EVERY push to main**, typecheck ALL packages that have changes — not just the files you touched. other agents may have left broken code in the working tree or committed syntax errors.

```bash
# typecheck every opensaas package that has modifications (staged or unstaged)
cd /Users/kokayi/Dev/opensaas
for pkg in api coaching contacts dialer logger metering; do
  if git diff --name-only HEAD | grep -q "packages/$pkg/" || git diff --name-only --cached | grep -q "packages/$pkg/"; then
    echo "typechecking $pkg..."
    npx tsc --noEmit -p packages/$pkg/tsconfig.json 2>&1 || { echo "❌ $pkg FAILED"; exit 1; }
  fi
done
echo "✅ all typechecks passed"
```

**why this exists:** parallel opencode agents can introduce syntax errors (missing parens, unclosed brackets) that only surface during railway's docker build. catching them locally before push saves a 10-minute build cycle. this was learned the hard way — a cli batch dropped two closing parens in voice.ts and it took 4 failed railway builds to catch it.

### cleanup
```bash
~/.kiro/skills/worktree-batch/cleanup.sh DEV-831 DEV-833 DEV-834
```

### phase 5: scenario validation

**this runs AFTER cleanup.** if a scenario fails, we start over — new worktree, new session, fresh prompt. no patching on top of broken code.

#### two-layer testing model

**layer 1 — opencode's own tests (gameable):**
opencode should run playwright/postman/jest as part of its coding work. include this in the prompt:
```
after all fixes, run the relevant tests:
- `npx jest path/to/test.test.ts --config=packages/PROJECT/jest.config.mjs`
- any playwright e2e tests for the affected area
all tests must pass before committing.
```
this is the first gate. it catches obvious breakage but can be gamed — opencode might write code that passes tests but doesn't actually work for users.

**layer 2 — holdout scenarios (ungameable):**
scenarios live in the **Scenarios** project in linear (`https://linear.app/consuelo/project/scenarios-f858a38309cb`). opencode never sees them. they're linked to feature tasks via "related to" but opencode only reads the feature task description.

#### scenario format (linear issue)

each scenario is a linear issue in the Scenarios project:

```markdown
## scenario: user creates a contact and dials them

**validates:** DEV-XXX
**app:** https://consuelo.up.railway.app

## steps
1. open the app
2. click "continue with email", use prefilled test credentials
3. navigate to contacts via sidebar
4. click "new contact", fill in name + phone number
5. verify contact appears in the list
6. click the phone icon on the contact row
7. verify dialer sidebar opens with correct number pre-filled

## satisfaction criteria
- contact is persisted and visible after creation
- dialer opens with the right number
- no graphql errors, no 500s, no blank screens
- full flow completes in under 30 seconds
```

#### running scenarios

after deploy to railway + cleanup:

1. **pull the scenario** — read the linked scenario issue from the Scenarios project
2. **spawn opencode with agent-browser** to execute against prod:
```bash
/opt/homebrew/bin/opencode run -m opencode/minimax-m2.5-free 'execute this scenario against the deployed app using agent-browser.

APP: https://consuelo.up.railway.app

STEPS:
1. agent-browser open https://consuelo.up.railway.app
2. agent-browser snapshot -i
3. [click "continue with email"]
4. [use prefilled credentials]
...

FOR EACH STEP:
- run agent-browser snapshot -i BEFORE and AFTER
- take agent-browser screenshot step-N.png
- report exactly what you see in the accessibility tree
- if something fails or looks wrong, report it and continue

WHEN DONE: report a summary of each step (what happened, what you saw) and whether the flow completed successfully.' 2>&1
```
3. **kiro judges** — read opencode's report. evaluate against satisfaction criteria:
   - did each step complete?
   - did the final state match expectations?
   - any errors, blank screens, missing elements?
   - confidence: high/medium/low

#### on failure — start over

if the scenario fails:
1. worktrees are already cleaned up (phase 5 is after cleanup)
2. create a NEW worktree from the target branch
3. craft a NEW prompt that includes:
   - the original feature spec
   - what the scenario tested (without revealing the exact scenario — just the failure)
   - what went wrong: "the contact creation flow breaks at step 5 — contact doesn't appear in the list after creation"
4. send opencode back with fresh context
5. re-run the full cycle: code → tests → code-review → merge → deploy → cleanup → scenario validation

**max 3 attempts.** after 3 scenario failures, flag for ko with full details.

**important:** don't tell opencode the exact scenario steps in the fix prompt. describe the *failure* ("contacts don't persist after creation") not the *test* ("step 5 of the scenario failed"). this preserves the holdout — opencode fixes the actual bug, not the test.

#### creating scenarios

when kiro specs a new feature task:
1. create the feature task in linear (as normal)
2. create a matching scenario in the Scenarios project
3. link them via "related to"
4. the scenario should test the user-facing behavior, not implementation details

not every task needs a scenario — use them for:
- new user-facing features (UI flows, API endpoints users hit)
- critical paths (auth, billing, data creation)
- anything that's been broken before

skip scenarios for:
- pure refactors (no behavior change)
- internal tooling changes
- documentation updates

## specs in linear

when kiro writes specs for future sessions, they go into linear task descriptions. a fresh kiro session should be able to:
1. read the linear task
2. see the spec + bash command
3. create worktrees and run it

**linear task format:**
```markdown
## findings

BLOCKERS:
B1 — ...

WARNINGS:
W1 — ...

NOTES:
N1 — ...

## bash command

\`\`\`bash
cd /private/tmp/opensaas-dev-XXX && /opt/homebrew/bin/opencode run -m opencode/minimax-m2.5-free '...' > /private/tmp/opensaas-dev-XXX/opencode.log 2>&1 &
\`\`\`

## acceptance criteria
1. B1 fixed — <specific check>
2. W1 fixed — <specific check>
3. code-review.sh 13/13
4. no files outside scope modified
```

## edge cases

### opencode didn't commit
happens more than expected. check after completion:
```bash
cd /private/tmp/opensaas-dev-XXX && git status --short && git log --oneline -3
```
if work is done but uncommitted, commit manually:
```bash
git add <specific-files>
HUSKY=0 git commit -m "type(scope): description (DEV-XXX)" --author="suelo-kiro[bot] <260422584+suelo-kiro[bot]@users.noreply.github.com>"
```

### opencode simulated code-review.sh
opencode sometimes does manual greps instead of running the actual script. the prompt must say:
```
run `bash scripts/code-review.sh` — run the ACTUAL script, do not simulate it
```

### merge conflicts between worktrees
use opencode-as-utility:
```bash
opencode run -m opencode/minimax-m2.5-free 'resolve merge conflicts in <files>. branch-A added <X>, branch-B added <Y>. keep BOTH changes.'
```

### tasks that depend on each other
run the dependency first, merge it, then create the dependent worktree from updated target.

### max concurrent opencode instances — no limit with XDG_DATA_HOME
opencode uses a single sqlite db at `~/.local/share/opencode/opencode.db`. concurrent instances fight over the lock and crash. **fix: set a unique `XDG_DATA_HOME` per instance** so each gets its own db. with this, there's no hard limit — tested with 5+ concurrent sessions.

**CRITICAL: MCP auth tokens live in `~/.local/share/opencode/mcp-auth.json`.** when you isolate `XDG_DATA_HOME`, opencode loses access to MCP servers (linear, etc.). **you MUST symlink `mcp-auth.json` into each isolated data dir** before launching:

```bash
# setup: symlink mcp-auth into each isolated dir
for id in 831 833 834; do
  mkdir -p /tmp/oc-$id/opencode
  ln -sf ~/.local/share/opencode/mcp-auth.json /tmp/oc-$id/opencode/mcp-auth.json
done
```

without this symlink, opencode can investigate code but cannot update linear issues or use any MCP tools.

```bash
# ❌ crashes — shared sqlite db
cd /tmp/wt-a && opencode run ... &
cd /tmp/wt-b && opencode run ... &  # "database is locked"

# ❌ also crashes — env var scoped to cd, not opencode
XDG_DATA_HOME=/tmp/oc-a cd /tmp/wt-a && opencode run ... &

# ❌ no MCP access — missing mcp-auth.json symlink
cd /tmp/wt-a && XDG_DATA_HOME=/tmp/oc-a opencode run ... &  # "no linear MCP"

# ✅ works — isolated db + mcp-auth symlink
mkdir -p /tmp/oc-a/opencode && ln -sf ~/.local/share/opencode/mcp-auth.json /tmp/oc-a/opencode/mcp-auth.json
cd /tmp/wt-a && XDG_DATA_HOME=/tmp/oc-a opencode run ... &
```

the temp dbs are throwaway — opencode recreates them on each run. **important:** each instance also caches ~180MB of model snapshots, so 5 parallel sessions = ~900MB. always clean up after batches:

```bash
wait
echo "✅ batch complete"
rm -rf /tmp/oc-*  # free ~180MB per session
```

## context budget

- setup: ~3% (reading specs + generating prompts)
- review: ~2-4% per task
- merge: ~2%
- total 5-task batch (happy path): ~15%
- total 5-task batch (all need fixes): ~25%

if over 30%, you're doing opencode's job. stop and reprompt.

## lessons learned

### batch 5 (feb 2026) — settings atoms
- opencode converted 5/23 atoms. **fix: explicit enumeration in specs.**
- opencode reverted another branch's file. **fix: scope boundary in prompts.**
- opencode didn't commit. **fix: always check git status after.**

### batch 6 (feb 2026) — code review fixes
- themed batches (sentry, security, frontend, shared) across 4 worktrees → all passed 13/13.
- opencode-as-utility proven: 6 cheap calls for checks/research/conflict resolution.
- opencode simulated code-review.sh → caught and fixed.

### batch 7 (feb 2026) — phase review findings
- 5 parallel worktrees (coaching, backend, frontend, analytics, files/kb).
- categorized prompts (BLOCKERS/WARNINGS/NOTES) → opencode prioritized correctly.
- exact file:line references → zero ambiguity, first-try success rate way up.
- scope boundaries ("DO NOT touch files outside X") → no cross-contamination.

### batch 8+9 (feb 2026) — QA bug fixes (DEV-894–904)
- opencode modified server files (graphql-config.service.ts, metadata.module-factory.ts) when tasked with frontend-only fixes. **fix: cherry-pick only the correct files during merge.**
- opencode deleted Dockerfile.worker (created by another AI) in ALL 4 parallel sessions — it saw an "irrelevant" file and removed it. **fix: add explicit "DO NOT delete ANY files" to every prompt.**
- "DO NOT touch files outside X" is not enough — opencode interprets "touch" as "modify" but still deletes. must say both: "do NOT modify" AND "do NOT delete."
- **pre-commit diff check** added to prompt template: "run `git diff --stat` before committing and verify only expected files appear." this catches contamination before it's committed instead of during review.
- **recency bias matters** — scope rules at the END of the prompt are more effective than at the beginning. opencode remembers the last thing it reads.
- cherry-pick merge strategy is the last line of defense: `git checkout <branch> -- <specific-file>` instead of `git merge <branch>`. always works, zero contamination risk.

### kiro-cli + opencode review (feb 2026) — phase 2+5 parallel
- **kiro-cli for implementation, opencode for review** is the new pattern for bigger tasks. kiro has LSP + full tool access so it actually understands the codebase. opencode is cheap and perfect for read-only review.
- **behavioral prompts matter more than spec embedding.** don't paste the full spec into the prompt — it's in linear, kiro can read it. instead, tell kiro HOW to work: read standards first, study existing patterns, mandatory self-review loop, actually run code-review.sh (not simulate).
- **the three-section prompt** (PREP → SCOPE → SELF-REVIEW) is the kiro equivalent of the BLOCKERS/WARNINGS/NOTES pattern for opencode. structure the behavior, not just the task.
- **one bash command, one paste.** ko should never have to paste into two terminals. generate a script that handles parallelism, sequencing (kiro → opencode), logging, and cleanup.
- **opencode review is read-only.** it reads the diff, fetches the linear spec, checks every acceptance criterion, and posts a `gh pr comment`. zero code changes. this is the safety net.
- **discretion on when to use this pattern.** big phase tasks (new entities, services, migrations) → kiro + review. mechanical batches (5 small fixes) → pure opencode. ko and kiro both use judgment here.


## MANDATORY CLEANUP — NEVER SKIP

**this exists because of repeated failures.** every other day ko's machine grinds to a halt because we leave garbage behind. opencode caches, stale worktrees, temp branches — they accumulate and eat disk space until the machine is unusable. this is unacceptable.

### every batch script MUST include:

1. **cleanup trap at the top** — runs even if the script dies mid-execution:
   ```bash
   cleanup() {
     cd "$REPO"
     for WT in <worktree-names>; do
       git worktree remove "../$WT" --force 2>/dev/null || true
       git branch -D "temp-$WT" 2>/dev/null || true
     done
     rm -rf /tmp/oc-* 2>/dev/null || true
   }
   trap cleanup EXIT
   ```

2. **pre-flight cleanup** — nuke leftovers from previous runs BEFORE starting:
   ```bash
   # clean stale worktrees
   git worktree prune
   # clean old opencode caches
   rm -rf /tmp/oc-* 2>/dev/null || true
   ```

3. **post-review cleanup** — after reviews finish, explicitly clean opencode caches:
   ```bash
   rm -rf /tmp/oc-* 2>/dev/null || true
   ```

### disk space check before starting:
```bash
AVAIL_GB=$(df -g /System/Volumes/Data | tail -1 | awk '{print $4}')
if [ "$AVAIL_GB" -lt 10 ]; then
  echo "⚠ only ${AVAIL_GB}GB free — cleaning caches first"
  rm -rf /tmp/oc-* 2>/dev/null || true
  npm cache clean --force 2>/dev/null || true
  git worktree prune 2>/dev/null || true
fi
```

### what accumulates and must be cleaned:
| artifact | location | size each | created by |
|----------|----------|-----------|------------|
| opencode sqlite dbs | `/tmp/oc-*` | 180-290MB | every opencode instance |
| git worktrees | `../worktree-name/` | 200-400MB | parallel task execution |
| temp branches | `temp-*` | negligible | worktree creation |
| kiro logs | `scripts/logs/` | 1-5MB | batch scripts |


## OPENCODE REVIEWS HANG — ALWAYS USE TIMEOUT

**this exists because opencode review processes hang after posting.** they finish the actual work (posting the gh pr comment) in 2-5 minutes, then the process sits there forever. ko has waited 30+ minutes multiple times thinking reviews are still running when they're done. this is unacceptable UX.

### the fix: timeout + confirmation

every opencode review call MUST be wrapped in a timeout:

```bash
review_task() {
  local task_id="$1" task_name="$2" repo="$3" pr_num="$4"
  
  # 10 min timeout — reviews take 2-5 min max. if still running, it's hung.
  timeout 600 opencode \
    --model "$OC_MODEL" \
    --prompt "..." \
    > "$LOG_DIR/review-$task_id.log" 2>&1 || true
  
  # confirm the review actually posted
  if gh pr view "$pr_num" --repo "$repo" --json comments \
    --jq "[.comments[].body | select(test(\"$task_id\"))] | length" | grep -q '[1-9]'; then
    echo "✓ $task_name review confirmed posted"
  else
    echo "⚠ $task_name review may not have posted — check logs"
  fi
}
```

### why this happens
opencode's process doesn't exit cleanly after completing prompt-mode tasks. the model connection or some internal cleanup hangs. the actual work is done — the gh pr comment is posted — but the process never terminates. `timeout` kills it after 10 minutes regardless.

### never do this
```bash
# ❌ no timeout — will hang forever
opencode --model "$OC_MODEL" --prompt "review..." &
wait  # waits forever
```

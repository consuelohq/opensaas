# senior engineer handoff — opensaas quality pass

you are the senior engineer on the opensaas project. you plan, review, merge, and ship. you don't write code directly — you spawn kiro-cli haiku sessions in the background to do the work, then review the output.

## philosophy

**slow, correct, token-efficient.** haiku is cheap. we'd rather wait for a correct result than burn tokens retrying. if you spawn a background task, use your judgment on when to check back — small tasks finish fast, big ones take longer. you can sleep, keep working on something else, or just come back to the output file when you're ready.

## your role

1. **planner** — decide what work to do next, create worktrees if needed we may be using /Users/kokayi/Dev/opensaas/.agent/run-tasks.sh which has its own worktree. worktrees take up alot of space but are useful when done correctly, compose prompts
2. **reviewer** — verify output against linear specs, run code-review.sh (13/13 must pass)
3. **merger** — merge worktree branches to `main`, resolve conflicts, push to origin
4. **linear updater** — mark tasks in-progress/done, close completed work
5. **quality gatekeeper** — nothing ships without passing all checks

## how to execute — kiro-cli haiku background pattern

the pattern: create git worktrees for isolation, spawn kiro-cli haiku in each one, review output, merge back.

### the background spawn pattern

```bash
# spawn kiro-cli haiku in background, output to temp file
TASK_ID="831"
WORK_DIR="/tmp/opensaas-task-$TASK_ID"
OUTPUT="/tmp/kiro-task-$TASK_ID.log"

echo 'your prompt here' | nohup kiro-cli chat \
  --no-interactive \
  --model haiku \
  --trust-all-tools \
  --cwd "$WORK_DIR" \
  > "$OUTPUT" 2>&1 &

echo "pid: $! → log: $OUTPUT"
```

to check on it later:
```bash
# option 1: keep working, check the output file when you're ready
cat "$OUTPUT"

# option 2: sleep if you want to wait (use your judgment on how long)
sleep 120 && cat "$OUTPUT"

# option 3: wait on the pid directly
wait $PID && cat "$OUTPUT"
```

### step 1: create worktrees

```bash
cd /Users/kokayi/Dev/opensaas
git checkout main && git pull origin main

# one worktree per task
git worktree add /tmp/opensaas-task-831 main
git worktree add /tmp/opensaas-task-833 main
git worktree add /tmp/opensaas-task-835 main
```

### step 2: spawn haiku sessions

for each task, compose a prompt and spawn it:

```bash
TASK_ID="831"
WORK_DIR="/tmp/opensaas-task-$TASK_ID"
OUTPUT="/tmp/kiro-task-$TASK_ID.log"

echo '
you are reviewing phase 3 (coaching panel) code on the main branch.

LINEAR TASK: DEV-831
UPDATE LINEAR: set DEV-831 to "In Progress" at start, "In Review" when done.

SCOPE: [paste the file list from the linear issue]

WHAT TO CHECK:
1. all 13 coding standards from CODING-STANDARDS.md
2. type safety — no any, proper error typing
3. API shape mismatches between frontend hooks and backend routes
4. missing error handling, missing sentry tracking
5. state management — proper use of createState, not raw atom()
6. accessibility — aria labels, keyboard nav
7. security — auth checks, input validation, SQL parameterization

OUTPUT: post your findings as a comment on DEV-831 in linear. format as:
## 🔴 critical
## 🟠 major
## 🟡 minor
## ✅ verified

do NOT write code fixes. report only.
' | nohup kiro-cli chat \
  --no-interactive \
  --model haiku \
  --trust-all-tools \
  --cwd "$WORK_DIR" \
  > "$OUTPUT" 2>&1 &

echo "task $TASK_ID → pid $! → $OUTPUT"
```

run 2-3 in parallel max. haiku is cheap but we want each one to have resources.

### step 3: wait and review

```bash
# check outputs when ready — small tasks finish in a minute, big ones take longer
# sleep if you want to wait, or just come back to these files later

# check outputs
for id in 831 833 835; do
  echo "=== TASK $id ==="
  tail -30 "/tmp/kiro-task-$id.log"
  echo
done
```

after reviewing:
- if findings need fixes → compose fix prompts, spawn more haiku sessions
- if no critical findings → close the review task as done

### step 4: merge fix branches

```bash
cd /Users/kokayi/Dev/opensaas
git checkout main && git pull origin main
git merge <branch> --no-edit
HUSKY=0 git push origin main
```

### step 5: code review check

```bash
bash scripts/code-review.sh
# all 13 must pass
```

### step 6: cleanup

```bash
# remove worktrees
for id in 831 833 835; do
  git worktree remove "/tmp/opensaas-task-$id" 2>/dev/null
  rm -f "/tmp/kiro-task-$id.log"
done
```

## git rules

- commit as: `suelo-kiro[bot] <260422584+suelo-kiro[bot]@users.noreply.github.com>`
- commit format: `type(scope): description`
- push to main with `HUSKY=0` to bypass hooks when needed
- never force push shared branches
- never `git add .` — always specific files

## linear integration

- use codemode for all linear api work (graphql via code mode, not mcp)
- update status: "In Progress" when starting, "In Review" when committing, "Done" when merged
- team: development (29f5c661-da6c-4bfb-bd48-815a006ccaac)

## coding standards (13 checks)

run `bash scripts/code-review.sh` — all must pass:
LOGGING, SENTRY, PHONE_NORM, SQL_PARAM, ERROR_HANDLING, TYPE_SAFETY, SECRETS, TODO_FIXME, IMPORT_SAFETY, ROUTE_ORDER, CATCH_TYPING, OPTIONAL_IMPORT, STUB_HANDLER

read `CODING-STANDARDS.md` and `AGENTS.md` at repo root for full details.

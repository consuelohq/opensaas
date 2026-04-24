# workspace scripts

agent toolkit for the opensaas monorepo. all commands run from repo root via `bun run`.

every script supports `--help` and `--json`.

---

## task workflow — start, push, promote, clean up

the full lifecycle of a coding task: create a branch → work → push → promote to stream → clean up.

```bash
# create a task branch + worktree + PR targeting the stream
bun run task:start -- --area dialer --title "queue runner"
# creates: branch task/dialer/queue-runner, worktree at /tmp/opensaas-worktrees/task-dialer-queue-runner
# creates: PR task/dialer/queue-runner → stream/dialer
# symlinks node_modules from main worktree so tests/lint work

# push changes to remote via github api (no local git push needed)
bun run task:push -- --message "fix(dialer): queue runner handoff" --changed
# reads changed files from the worktree, creates blobs → tree → commit → updates ref
# ko stays as author, suelo-kiro[bot] as committer

# merge task→stream, then create or refresh the stream→main review PR
bun run task:pr
# squash-merges the task PR into the stream branch
# creates (or updates) the review PR: stream/dialer → main
# marks the review PR as ready-for-review by default (--draft to keep as draft)

# show both PR links for the current task
bun run task:prs
# output: task pr #172 https://github.com/consuelohq/opensaas/pull/172
#         review pr #173 https://github.com/consuelohq/opensaas/pull/173

# merge a specific PR (used by ship workflow)
bun run task:merge -- --pr 173
bun run task:merge -- --pr 173 --wait    # merge + wait for railway deploy

# verify the task PR was merged, remove worktree, delete local branch
bun run task:finish

# preview what would be cleaned up
bun run task:cleanup -- --preview

# remove merged task branches and worktrees older than 3 days
bun run task:cleanup -- --merged --stale-days 3
```

---

## stream management

streams are long-lived branches per area (dialer, workspace-agents, analytics, etc.) that collect task PRs before going to main.

```bash
# list all stream branches with status (ahead/behind main, open PRs)
bun run stream:list

# sync stream/dialer with latest main (fast-forward merge)
bun run stream:sync -- --area dialer

# show stream context — recent PRs, merge status, divergence
bun run stream:context -- --area dialer
```

---

## fs — safe file operations

wraps `bat` (read) and `rg` (search). provides stdin-based write and line-range patch. no heredocs, no quoting bugs.

```bash
# read a file with line numbers (bat-powered, syntax highlighted)
bun run fs -- read packages/dialer/src/services/queue.ts

# read specific line range
bun run fs -- read packages/dialer/src/services/queue.ts --from 120 --to 180

# read multiple files in one call
bun run fs -- read src/a.ts --from 1 --to 50 src/b.ts --from 100 --to 150

# plain output (no decoration) or json
bun run fs -- read src/foo.ts --from 1 --to 20 --plain
bun run fs -- read src/foo.ts --from 1 --to 20 --json

# search files (wraps rg, excludes node_modules/.git/dist by default)
bun run fs -- search "startBackendQueueSession" packages/twenty-front/src
bun run fs -- search "startBackendQueueSession" packages/twenty-front/src --context 4

# search + immediately read bounded ranges around matches
bun run fs -- search "startBackendQueueSession" packages/twenty-front/src --then-read

# filenames only
bun run fs -- search "normalizePhone" packages/ --files

# write a file from stdin (no heredocs needed)
cat /tmp/new-service.ts | bun run fs -- write packages/dialer/src/services/new.ts

# overwrite existing file
cat /tmp/fixed.ts | bun run fs -- write packages/dialer/src/services/queue.ts --force

# append to a file
echo "// TODO: DEV-1500" | bun run fs -- write src/foo.ts --append

# write with inline content
bun run fs -- write src/constants.ts --content "export const VERSION = '1.0.0';" --mkdirs

# patch a line range (replace lines 20-35 with stdin content)
cat /tmp/replacement.ts | bun run fs -- patch src/foo.ts --from 20 --to 35

# preview a patch without applying
cat /tmp/replacement.ts | bun run fs -- patch src/foo.ts --from 20 --to 35 --dry-run

# patch with inline content
bun run fs -- patch src/foo.ts --from 42 --to 42 --content "const x = newValue;"
```

---

## context — search and save project memories

backed by supabase. stores decisions, workpads, investigation notes, patterns.

```bash
# search memory content
bun run context -- search dialer

# search within a category
bun run context -- search queue --category workpad

# search by title
bun run context -- find "queue handoff"

# read full content of result #1 from a search
bun run context -- get 1 dialer

# list recent workpads
bun run context -- list workpad

# list recent memories (more results)
bun run context -- list --limit 20

# save a file as memory
bun run context -- save "dialer notes" ./notes.md

# save from stdin
echo "decided to use conference-based transfers" | bun run context -- save "transfer decision" --text

# list available categories
bun run context -- categories
```

---

## tmp — exact temp file handling

write exact content to temp files. no trimming, no reformatting. best for handoffs between agents and long content that shouldn't go through shell quoting.

```bash
# write content to notes.md
bun run tmp -- write notes "# my notes here"

# write from stdin (best for long content)
cat draft.md | bun run tmp -- write review --stdin

# read a temp file
bun run tmp -- read notes

# print full path (for passing to other tools)
bun run tmp -- path notes

# save temp file to supabase memories
bun run tmp -- save handoffs "dialer queue investigation"

# list temp files with size and age
bun run tmp -- list

# remove all temp files
bun run tmp -- clean
```

---

## browser — test and interact with web pages

wraps agent-browser with ko's authenticated profile. already logged into consuelo, railway, github, etc.

```bash
# open consuelo CRM (internal, for testing)
bun run browser -- consuelo

# open production
bun run browser -- app

# open any url (waits for load, snapshots, screenshots)
bun run browser -- open https://example.com

# show ko the browser window
bun run browser -- consuelo --headed

# snapshot current page (accessibility tree with element refs)
bun run browser -- snap

# interact with elements by ref (@e1, @e2, etc.)
bun run browser -- click @e5
bun run browser -- fill @e3 "search query"
bun run browser -- hover @e2
bun run browser -- select @e4 "option-value"
bun run browser -- check @e6

# take screenshot
bun run browser -- screenshot after-login
bun run browser -- screenshot --full          # full page

# wait for conditions
bun run browser -- wait --text "Welcome"      # wait for text
bun run browser -- wait --load networkidle    # wait for network idle
bun run browser -- wait 3000                  # wait 3 seconds

# find elements by semantic locator (no snapshot needed)
bun run browser -- find role button click --name "Submit"
bun run browser -- find label "Email" fill "test@test.com"

# tabs
bun run browser -- tab                        # list tabs
bun run browser -- tab new https://github.com # new tab
bun run browser -- tab t2                     # switch to tab

# inspect page state
bun run browser -- console                    # js console messages
bun run browser -- errors                     # page errors
bun run browser -- cookies                    # list cookies
bun run browser -- network requests           # API calls (static assets filtered)

# run javascript
bun run browser -- eval "document.title"

# batch multiple commands
bun run browser -- batch "open https://example.com" "wait --load networkidle" "screenshot"

# login if session expired
bun run browser -- login consuelo

# close the browser
bun run browser -- close
```

---

## railway — deploy observability

```bash
# default view — status + recent logs + http logs + network summary
bun run railway:logs

# just status and deploy info
bun run railway:logs -- --status

# errors only
bun run railway:logs -- --errors

# filter logs
bun run railway:logs -- --filter "twilio OR queue"

# build logs
bun run railway:logs -- --build

# network flow logs (TCP/UDP connections)
bun run railway:logs -- --network

# check if an env var is set (shows set/missing, not the value)
bun run railway:logs -- --env TWILIO_ACCOUNT_SID
```

---

## wait — sleep or wait for deploy

```bash
# timed sleep (default 5 minutes)
bun run wait -- 5m
bun run wait -- 30          # 30 seconds
bun run wait -- 2m          # 2 minutes

# wait for a deploy matching local HEAD
bun run wait -- --deploy

# wait for a specific commit to deploy
bun run wait -- --deploy abc123
```

---

## review — code review checks

runs all 16 mandatory checks from CODING-STANDARDS.md against changed files.

```bash
# run review on changed files
bun run review

# auto-fix eslint issues
bun run review -- --fix

# check all files (not just changed)
bun run review -- --all

# json output
bun run review -- --json
```

---

## website:deploy — deploy consuelo website

```bash
# build and deploy to cloudflare pages
bun run website:deploy

# preview deploy (non-production url)
bun run website:deploy -- --preview

# build only, don't deploy
bun run website:deploy -- --build-only
```

---

## script file paths

```
packages/workspace/scripts/
├── task-start.js        # task:start
├── task-push.js         # task:push
├── task-pr.js           # task:pr
├── task-prs.js          # task:prs
├── task-merge.js        # task:merge
├── task-finish.js       # task:finish
├── task-cleanup.js      # task:cleanup
├── stream-list.js       # stream:list
├── stream-sync.js       # stream:sync
├── stream-context.js    # stream:context
├── fs.js                # fs (read/search/write/patch)
├── context.js           # context
├── tmp.js               # tmp
├── browser.js           # browser
├── railway-logs.js      # railway:logs
├── wait.js              # wait
├── review.js            # review
├── website-deploy.js    # website:deploy
└── lib/
    ├── git.js           # git operations (execFileSync, no shell)
    ├── github.js        # github api (PRs, blobs, trees, commits)
    ├── paths.js         # repo paths, worktree root, git root
    ├── task-meta.js     # .task/current.json + .task/tasks/ read/write
    └── validation.js    # branch naming, commit format validation
```
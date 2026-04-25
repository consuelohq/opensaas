# workspace scripts

the following scripts are available via `bun run <name>`. use the script name as the command and pass arguments after `--`.

all scripts run from the repo root: `/Users/kokayi/Dev/opensaas`. worktrees do not have `package.json` — running `bun run <anything>` from inside a worktree fails with `Script not found`.

**why:** worktrees are lightweight git checkouts that share `node_modules` via symlink from repo root. they have source files but no installed deps — that's why all scripts must run from repo root.

every script supports `--help` and `--json`.

---

## foundation

these three rules apply to every script, every task, every session. read them first.

### rule 0 — where to run

always run scripts from `/Users/kokayi/Dev/opensaas` (the repo root). never cd into a worktree and run `bun run`. worktrees are created by `task:start` and accessed through `task:fs` and `task:exec`.

```
bad: cd /private/tmp/opensaas-worktrees/task-dialer-queue && bun run fs -- read src/foo.ts
 → error: Script not found "fs"

good: bun run task:fs -- --area dialer read src/foo.ts
 → reads from the dialer worktree without leaving repo root
```

### rule 1 — response contract

when answering questions or reporting results, use this format:

- **tl;dr** → one-line answer or status
- **evidence** → what you checked (file paths, command output, error messages)
- **action** → what to do next (or "nothing — done")

do not answer architecture questions from memory. search memory, read files, then answer with citations and paths.

---

## the task lifecycle

every change — even tiny ones — follows this flow. no exceptions.

```
 1. bun run stream:context -- --area <area>              # understand the stream state
 2. bun run stream:sync -- --area <area>                 # sync stream with latest main
 3. bun run task:start -- --area <area> --title "x"      # create task branch + worktree + PR
 4. (make changes via task:fs and task:exec)
 5. bun run verify                                       # run review + db guards, write stamp
 6. bun run task:push -- --message "type(scope): x" --changed  # push via github api
 7. bun run task:pr                                      # merge task→stream, create stream→main PR
 8. bun run task:prs                                     # show both PR links (human review)
 9. bun run task:merge -- --pr <N> --wait                # merge + wait for deploy
10. bun run railway:logs -- --status                     # check deploy health + logs
11. bun run browser -- consuelo                          # verify UI in production
12. bun run task:finish                                  # remove worktree, delete branch
13. bun run tmp -- save handoffs "description"           # save context for next agent
```

the verify → push dependency:
```
verify ✓ → writes .task/verify.json stamp → task:push reads stamp → push succeeds
no verify → no stamp → task:push rejects (unless --no-verify)
```

always use this flow even if the change seems tiny. when in doubt, start from the stream, isolate the task, push early, clean up after merge.

---

## things to remember

**stale .task/current.json is the #1 cause of script failures.** if `task:pr`, `task:finish`, `task:push`, or `task:prs` give wrong results, the metadata is stale. fix it:

```
bun run task:init -- --area <area> --branch <branch> --pr <N>
```

do NOT create a whole new worktree just to fix metadata. `task:init` rewrites `.task/current.json` for an existing worktree without creating branches or PRs.

**never cd into a worktree.** all `bun run` commands fail from inside worktrees (no `package.json`). use `task:fs` and `task:exec` from repo root.

**when resolving stream conflicts,** stop and ask ko unless it's metadata files (`.task/current.json`, `.task/workpad.md`).

**after any write or patch, verify immediately:**
```
bun run fs -- read <file> --from <range> --plain
node --check <touched-js-file>
git status --porcelain -uall -- . ':!node_modules'
```

**railway logs are truth.** don't guess about production — run `bun run railway:logs -- --errors` or `--filter "keyword"`.

**SCRIPTS.md is part of the fix.** if you add or change a script, update SCRIPTS.md in the same commit.

---

## when things go wrong

recovery patterns for common failures. don't panic — diagnose first.

| symptom | fix |
|---------|-----|
| stale metadata — scripts reference wrong branch/PR | `bun run task:init -- --area <area> --branch <branch> --pr <N>` |
| worktree exists but task is done | `bun run task:finish` or `bun run task:cleanup -- --merged` |
| pushed but forgot to verify | run `bun run verify`, then push again (stamp updates) |
| stream conflict on merge | stop and ask ko (unless metadata files) |
| "Script not found" | you're in a worktree. run `cd /Users/kokayi/Dev/opensaas` first |
| task:start fails — worktree already exists | check if old task is needed: `bun run task:fs -- --area <area> read .task/current.json`. if not, `bun run task:finish` or `bun run task:cleanup -- --preview` first |
| task:push rejects — no verify stamp | run `bun run verify` first. or `--no-verify` to bypass (visible and logged) |
| review fails on a file you didn't touch | fix it anyway. there is no "not mine" — if it's on the branch and broken, it's yours |

---

## before you push — scan for slop

before pushing, scan your diff for AI-generated slop. remove it before it hits the PR.

check for:
- extra comments that a human wouldn't add or that are inconsistent with the rest of the file
- defensive try/catch blocks that are abnormal for that area of the codebase
- casts to `any` to get around type issues instead of fixing the types
- inconsistent style with the rest of the file
- unnecessary emoji in code comments
- verbose variable names that don't match the codebase conventions

```
bun run task:exec -- --area <area> git diff   # review your changes
```

if you see slop, fix it before pushing. a clean diff is a fast review.

---

## after you finish — extract learnings

after finishing a task, ask: "did i discover anything non-obvious?" if yes, write it to the nearest AGENTS.md:

- **project-wide** → root `AGENTS.md`
- **package-specific** → `packages/foo/AGENTS.md`
- **feature-specific** → `src/auth/AGENTS.md`

**what counts:** hidden file relationships, misleading error messages, API quirks, files that must change together, non-obvious env vars, debugging breakthroughs, build/test commands not in README.

**what doesn't count:** obvious docs, standard framework behavior, verbose explanations, session-specific details.

keep entries to 1–3 lines per insight. future agents read these automatically when they touch files in that directory.

---

## scripts reference

every script below follows this format: purpose → usage → helpers → failure modes.

---

### fs — safe file operations

wraps bat (read), rg (search), eza/fd (list), xh (http), trash (delete). no heredocs, no quoting bugs. operates on the repo root by default. for worktree files, use `task:fs` instead.

**read**
```
bun run fs -- read src/foo.ts                          # full file, syntax highlighted, line numbers
bun run fs -- read src/foo.ts --from 120 --to 180      # specific line range
bun run fs -- read src/a.ts --from 1 --to 50 src/b.ts  # multiple files
bun run fs -- read src/foo.ts --plain                   # no decoration (best for piping)
bun run fs -- read src/foo.ts --json                    # structured json (automation-safe)
```

**search**
```
bun run fs -- search "pattern" packages/               # search files (excludes node_modules/.git/dist)
bun run fs -- search "pattern" src/ --context 4        # with context lines
bun run fs -- search "pattern" src/ --then-read        # search + read bounded ranges
bun run fs -- search "pattern" packages/ --files       # filenames only
bun run fs -- search "pattern" packages/ --json        # structured json
bun run fs -- search "pattern" packages/ --max-results 5  # cap matches
```

**list**
```
bun run fs -- list packages/workspace/scripts/         # directory listing
bun run fs -- list packages/workspace/ --tree          # tree view
bun run fs -- list packages/workspace/ --tree --depth 2  # tree with max depth
bun run fs -- list packages/ --dirs --depth 1          # directories only
bun run fs -- list packages/ --find "*.test.ts"        # find files by glob
bun run fs -- list packages/ --find "queue" --type f   # find by name fragment
```

**write**
```
bun run fs -- write src/new.ts --content "export const x = 1;"  # create new file
bun run fs -- write src/new.ts --content "..." --mkdirs          # create parent dirs
bun run fs -- write src/existing.ts --content "..." --force      # overwrite existing
bun run fs -- write src/foo.ts --append "\nconsole.log('added');"  # append to file
```

**patch**
```
bun run fs -- patch src/foo.ts --from 10 --to 15 --content "new lines here"  # replace line range
```

**http**
```
bun run fs -- http get https://api.github.com          # GET request (wraps xh)
bun run fs -- http post https://api.example.com key=val  # POST json
```

**trash**
```
bun run fs -- trash old-file.ts                        # move to trash (not permanent delete)
bun run fs -- trash old-dir/                           # directory
bun run fs -- trash a.ts b.ts c.ts                     # multiple files
```

**fs failure modes**
```
bad: bun run fs -- write src/foo.ts --content "..."
 → error: file exists. use --force to overwrite
 (always read the file first, then decide: --force to overwrite, or patch for targeted edits)

bad: bun run fs -- patch src/foo.ts --from 10 --to 20 --content "..."
 → replaced wrong lines because you didn't read the range first
 (always: read --from N --to M → verify → then patch the same range)

bad: bun run fs -- write src/deep/nested/new.ts --content "..."
 → error: directory does not exist
 (use --mkdirs to create parent directories)

bad: cd /private/tmp/opensaas-worktrees/task-dialer && bun run fs -- read src/foo.ts
 → error: Script not found "fs"
 (use task:fs from repo root instead)

bad: bun run fs -- write src/foo.ts --append "new line"
 → appended without a leading newline, content jammed onto the last line
 (write --append is exact — include \n yourself)
```

**tips**
- prefer `bun run fs` over raw bat/rg/eza/fd for all repo work
- before `write --force` or `patch`, always read the target first
- `write` does NOT create parent dirs by default — use `--mkdirs`
- `write --append` is exact — include `\n` yourself
- `patch --from N --to N` replaces line N. always read the range first
- `read --json` and `search --json` are automation-safe. `--then-read --json` is NOT structured yet
- write and patch log touched files to `.task/workpad.md`
- after any write or patch, immediately verify: read the changed range, `node --check`, `git status`

---

### task:fs — file operations inside the task worktree

proxies all arguments to `bun run fs` with cwd set to the task worktree. paths resolve relative to the worktree root. this is how you read and write files in a task — not by cd-ing into the worktree.

```
bun run task:fs -- --area dialer read packages/dialer/src/queue.ts
bun run task:fs -- --area dialer read packages/dialer/src/queue.ts --from 1 --to 80 --plain
bun run task:fs -- --area dialer search "TODO" packages/ --files
bun run task:fs -- --area dialer list packages/ --tree --depth 2
bun run task:fs -- --area dialer write src/new.ts --content "export const x = 1;"
bun run task:fs -- --area dialer patch src/foo.ts --from 10 --to 15 --content "new code"
```

**common task:fs patterns**
```
bun run task:fs -- --area dialer read .task/workpad.md          # acceptance criteria, progress
bun run task:fs -- --area dialer read .task/current.json        # task metadata
bun run task:fs -- --area dialer list .task/                    # task directory
bun run task:fs -- --area dialer search "transferCall" packages/dialer/src/
bun run task:fs -- --area dialer write .task/workpad.md --append "\n- [x] fixed the thing"
```

**task:fs failure modes**
```
bad: bun run task:fs -- read .task/current.json
 → error: multiple active tasks found (workspace-agents, dialer). use --area <name>
 (always pass --area when multiple tasks exist)

bad: cd /private/tmp/opensaas-worktrees/task-dialer && bun run task:fs -- read src/foo.ts
 → error: Script not found "task:fs"
 (run from repo root, not from inside the worktree)

bad: cat /private/tmp/opensaas-worktrees/task-dialer/packages/dialer/src/queue.ts
 → works but bypasses the script system. never read raw worktree paths.
 (use: bun run task:fs -- --area dialer read packages/dialer/src/queue.ts)
```

---

### task:exec — run commands inside the task worktree

runs any command with cwd set to the task worktree. use for git, prettier, jest, nx, or anything that needs to run "inside" the worktree.

```
bun run task:exec -- --area dialer git diff
bun run task:exec -- --area dialer git status --short
bun run task:exec -- --area dialer yarn jest --runInBand packages/dialer/src/queue.test.ts
bun run task:exec -- --area dialer yarn prettier --write packages/twenty-front/src/foo.ts
bun run task:exec -- --area dialer npx nx typecheck twenty-front
bun run task:exec -- --area dialer bun run review
bun run task:exec -- --area dialer git diff --check
```

**task:exec failure modes**
```
bad: bun run task:exec -- git status
 → error: multiple active tasks found (workspace-agents, dialer). use --area <name>
 (always pass --area when multiple tasks exist)

bad: cd /private/tmp/opensaas-worktrees/task-dialer && git diff
 → works but you left the repo root. now bun run <anything> will fail.
 (use: bun run task:exec -- --area dialer git diff)
```

---

### review — code review checks

runs all 16 mandatory checks from CODING-STANDARDS.md against changed files. includes eslint, typecheck, and test suite.

```
bun run review                        # review changed files (main vs origin/main)
bun run review -- --mine              # scope to active task worktree only
bun run review -- --fix               # auto-fix eslint issues
bun run review -- --all               # check all files, not just changed
bun run review -- --base stream/dialer  # compare against specific ref
bun run review -- --json              # json output
bun run review -- --quiet             # only show failures
bun run review -- --no-tests          # skip test suite
bun run review -- --strict            # enable strictPropertyInitialization
```

**review failure modes**
```
bad: bun run review (from repo root, no task)
 → reviews main vs origin/main. shows 0 changed files if main is up to date.
 (use --mine to scope to the active task worktree, or --base to compare against a specific ref)

bad: review fails on a file you didn't touch
 → this is expected. the branch must be healthy when you leave it. fix it.
 (there is no "not mine" — if it's on the branch and broken, it's yours)
```

---

### verify — full task safety gate

runs `bun run review` + db/migration/graphql guardrails. writes `.task/verify.json` stamp on success. `task:push` requires this stamp by default.

```
bun run verify                        # full verify (review + db guards + stamp)
bun run verify -- --no-review         # skip review, only run db guardrails
bun run verify -- --no-db             # skip db guardrails
bun run verify -- --db-warn-only      # report db issues as warnings
bun run verify -- --no-stamp          # don't write verify.json
bun run verify -- --json              # structured json output
bun run verify -- --base stream/dialer  # compare against specific ref
```

**verify failure modes**
```
bad: verify fails on a package with no typecheck target
 → this is the harness being stricter, not broken code. the package was never typechecked.
 (check if the package has a project.json with a typecheck target. if not, that's a gap to fix)

bad: bun run task:push -- --message "fix: thing" --changed
 → error: no matching verify stamp
 (run bun run verify first. or use --no-verify to bypass — but this is visible and logged)
```

---

### task:push — push changes to remote via github api

reads changed files from the task worktree and pushes them as a commit to the task branch via github api. never touches the local git state.

```
bun run task:push -- --message "fix(dialer): normalize phone numbers" --changed
bun run task:push -- --message "feat(dialer): add queue runner" --files packages/dialer/src/queue.ts packages/dialer/src/runner.ts
bun run task:push -- --message "fix: thing" --changed --no-verify  # bypass verify stamp (visible)
bun run task:push -- --json
```

**task:push failure modes**
```
bad: bun run task:push -- --changed
 → error: missing required --message
 (commit message is always required, in conventional format: type(scope): description)

bad: bun run task:push -- --message "fix: thing" --changed
 → error: no matching verify stamp
 (run bun run verify first)
```

---

### task:start — create task branch + worktree + PR

creates a new task branch, git worktree, and draft PR. the worktree is created in `/private/tmp/opensaas-worktrees/`.

```
bun run task:start -- --area dialer --title "normalize phone numbers"
bun run task:start -- --area dialer --title "queue runner" --start-from stream  # branch from stream
bun run task:start -- --area dialer --title "fix" --body-file /tmp/pr-body.md  # PR body from file
bun run task:start -- --json
```

**task:start failure modes**
```
bad: bun run task:start
 → error: missing required --area
 (--area and --title are both required)

bad: bun run task:start -- --area dialer --title "fix thing"
 → error: worktree already exists at /private/tmp/opensaas-worktrees/task-dialer-fix-thing
 (check if the old task is still needed: bun run task:fs -- --area dialer read .task/current.json
  if not needed: bun run task:finish or bun run task:cleanup -- --preview first)
```

---

### task:pr — merge task→stream, create stream→main PR

default behavior: (1) ensure task PR exists for task/* → stream/, (2) merge that task PR into the stream branch, (3) create or refresh the review PR for stream/ → main.

```
bun run task:pr                       # full flow: task→stream merge + stream→main PR
bun run task:pr -- --task-only        # only create/refresh the task→stream PR, don't merge
bun run task:pr -- --draft            # create stream→main PR as draft
bun run task:pr -- --ready            # convert existing draft to ready
bun run task:pr -- --body-template area  # generate area-context body template
bun run task:pr -- --json
```

**task:pr failure modes**
```
bad: bun run task:pr (with stale .task/current.json)
 → error: .task/current.json belongs to branch X, but current branch is main
 (fix the metadata: bun run task:init -- --area <area> --branch <branch> --pr <N>)
```

---

### task:prs — show PR links for current task

shows both the task PR (task/* → stream/) and the review PR (stream/ → main).

```
bun run task:prs                      # show PR links from .task/current.json
bun run task:prs -- --json
```

---

### task:merge — merge a PR

```
bun run task:merge -- --pr 173        # merge PR #173
bun run task:merge -- --pr 173 --wait  # merge + wait for railway deploy
bun run task:merge -- --pr 173 --squash  # squash merge
bun run task:merge -- --json
```

---

### task:finish — verify merge, remove worktree, delete branch

```
bun run task:finish                   # finish current task
bun run task:finish -- --json
```

**task:finish failure modes**
```
bad: bun run task:finish (with stale .task/current.json)
 → runs against stale metadata. may report "finished" for an old task.
 (fix the metadata first: bun run task:init -- --area <area> --branch <branch> --pr <N>)
```

---

### task:init — fix stale or missing .task/current.json

writes a fresh `.task/current.json` for an existing worktree. does NOT create branches or worktrees — use `task:start` for that. use this when metadata is stale, wrong, or missing.

```
bun run task:init -- --area dialer --branch task/dialer/fix-thing --pr 173
bun run task:init -- --area dialer --branch task/dialer/fix-thing --pr 173 --worktree /private/tmp/opensaas-worktrees/task-dialer-fix-thing
bun run task:init -- --json
```

auto-detects the worktree path from `git worktree list` if `--worktree` is not passed.

---

### task:cleanup — remove stale worktrees and branches

```
bun run task:cleanup -- --preview     # preview what would be removed
bun run task:cleanup -- --merged      # remove branches already merged
bun run task:cleanup -- --stale-days 7  # remove worktrees older than 7 days
bun run task:cleanup -- --force       # force removal
bun run task:cleanup -- --keep task/dialer/queue  # keep a specific branch
```

---

### stream:list — list all stream branches

```
bun run stream:list                   # show all streams with status, divergence, warnings
```

---

### stream:sync — sync stream with latest main

```
bun run stream:sync -- --area dialer  # sync stream/dialer with main
bun run stream:sync -- --area workspace-agents
bun run stream:sync -- --json
```

**stream:sync failure modes**
```
bad: bun run stream:sync
 → error: missing required --area
 (--area is always required for stream commands)
```

---

### stream:context — show stream context

shows recent PRs, divergence from main, and current state of a stream.

```
bun run stream:context -- --area dialer
bun run stream:context -- --json
```

---

### pr-review — fetch all review comments from a PR

pulls inline comments, issue comments, and reviews from qodo, coderabbit, codex, ko, and humans. writes a structured file to `.task/reviews/<pr>.md` with file attention map, action items, and task loop reminder.

```
bun run pr-review -- 173              # fetch reviews for PR #173
bun run pr-review                     # auto-detect PR from .task/current.json
bun run pr-review -- 173 --stdout     # print to stdout instead of file
bun run pr-review -- 173 --json
```

**pr-review helpers — full review-fix flow**
```
bun run pr-review -- <pr>             # 1. fetch reviews
bun run gh -- diff <pr>               # 2. see what changed
bun run gh -- files <pr>              # 3. list changed files
bun run gh -- read <path> --ref <branch>  # 4. read specific file from PR branch
bun run gh -- checks <pr>             # 5. check CI status
# 6. fix the issues via task:fs
bun run task:push -- --message "fix(scope): address review" --changed  # 7. push fixes
```

---

### gh — common github commands

wraps `gh` CLI with repo defaults (consuelohq/opensaas) and structured output. all commands auto-detect PR from `.task/current.json` when no PR number given.

```
bun run gh -- prs                     # list open PRs
bun run gh -- prs --mine              # list ko's PRs
bun run gh -- prs --bot               # list bot PRs
bun run gh -- checks <pr>             # CI check status
bun run gh -- diff <pr>               # file list + stats
bun run gh -- diff <pr> --full        # full diff
bun run gh -- files <pr>              # list changed files
bun run gh -- view <pr>               # PR details
bun run gh -- reviews <pr>            # who approved/requested changes
bun run gh -- comment <pr> "looks good"  # post a comment
bun run gh -- read src/foo.ts --ref stream/dialer  # read file from branch (no checkout)
bun run gh -- blame src/foo.ts        # blame URL
bun run gh -- branches                # list remote branches
bun run gh -- branches --stream       # stream/* branches only
bun run gh -- branches --task         # task/* branches only
```

---

### context — search and save project memories

search and save context from supabase memories. use this to find past decisions, architecture notes, and investigation results.

```
bun run context -- search dialer      # search memories by content
bun run context -- search queue --category workpad  # filter by category
bun run context -- find "queue handoff"  # search by title
bun run context -- list workpad       # list recent workpad memories
bun run context -- list --limit 5     # list recent memories
bun run context -- save "dialer arch" ./notes.md  # save file as memory
bun run context -- categories         # list available categories
```

**context failure modes**
```
bad: answering "what did we decide about X?" from memory alone
 → search first: bun run context -- search "X"
 (never answer architecture or decision questions without checking context first)
```

---

### browser — test and interact with web pages

opens agent-browser with ko's authenticated profile. use for production verification after deploys.

```
bun run browser -- consuelo           # open consuelo CRM (internal)
bun run browser -- app                # open app.consuelohq.com
bun run browser -- url https://example.com  # open any URL
bun run browser -- screenshot /tmp/out.png  # take screenshot
bun run browser -- snapshot           # get accessibility tree
```

---

### railway — deploy observability

USE THIS OFTEN. this is how you get truth about what's happening in production. don't guess — read the logs.

```
bun run railway:logs                  # deploy logs + http traffic in one place
bun run railway:logs -- --errors      # errors only — deploy errors + http 4xx/5xx
bun run railway:logs -- --filter "voice"  # search across deploy, http, & network
bun run railway:logs -- --filter "twilio OR queue"
bun run railway:logs -- --filter "@level:error"
bun run railway:logs -- --network     # network logs
bun run railway:logs -- --lines 50    # control how many lines
bun run railway:logs -- --build       # build logs — did docker build succeed?
bun run railway:logs -- --raw         # no formatting, no noise filtering
bun run railway:logs -- --json        # for piping to other tools
bun run railway:logs -- --env TWILIO_ACCOUNT_SID  # check if env var is set
bun run railway:logs -- --status      # quick health check — is service up? what commit?
bun run railway:logs -- --service twenty-worker --errors  # different service
```

**railway failure modes**
```
bad: "i think the deploy is broken" (guessing without checking)
 → run: bun run railway:logs -- --errors
 (always check logs before claiming something is broken)

bad: railway logs --service opensaas (raw CLI)
 → use: bun run railway:logs
 (the script adds noise filtering, formatting, and http log merging)
```

---

### wait — sleep or wait for deploy

```
bun run wait -- 300                   # sleep 300 seconds (5 min)
bun run wait -- --deploy              # wait for railway deploy to complete
bun run wait -- --pr 173              # wait for PR checks to pass
```

---

### tmp — exact temp file handling

writes exact content to temp files in opensaas-handoffs/. no trimming, no reformatting.

```
bun run tmp -- write notes "# my notes here"  # write content to notes.md
cat draft.md | bun run tmp -- write review --stdin  # write from stdin
bun run tmp -- read notes             # read a temp file
bun run tmp -- path notes             # print full path
bun run tmp -- list                   # list temp files
bun run tmp -- save notes "dialer queue investigation"  # save to supabase memories
bun run tmp -- clean                  # remove all temp files
bun run tmp -- checklist deploy-fix "check logs" "fix error" "push" "verify"  # create checklist
```

---

### server — manage the workspace MCP server

```
bun run server -- status              # check if running, show tools + pid
bun run server -- restart             # stop + start
bun run server -- stop
bun run server -- start
bun run server -- logs                # tail /tmp/workspace.log
```

---

### website:deploy — deploy consuelo website

```
bun run website:deploy                # build and deploy to cloudflare pages
bun run website:deploy -- --preview   # preview deploy (non-production url)
bun run website:deploy -- --build-only  # build only, don't deploy
```

---

## python edit patterns

use python for multi-file or multi-block edits. do not use huge `python3 -c "..."` commands. do not base64-encode scripts unless there is no other option. prefer a quoted heredoc or write a temp script, then run it.

always: make the python script fail loudly if the expected text is not found. always reread changed ranges after the script runs. always run `node --check` for touched .js scripts. always run `git status --porcelain -uall -- . ':!node_modules'` after large edits.

**safe pattern — single edit**
```bash
python3 <<'PY'
from pathlib import Path
path = Path("packages/workspace/scripts/task-push.js")
text = path.read_text()
old = """const oldThing = true;
const anotherOldThing = false;
"""
new = """const oldThing = true;
const anotherOldThing = true;
"""
if old not in text:
    raise SystemExit(f"expected block not found in {path}")
path.write_text(text.replace(old, new))
PY
bun run fs -- read packages/workspace/scripts/task-push.js --from 80 --to 120 --plain
node --check packages/workspace/scripts/task-push.js
git status --porcelain -uall -- . ':!node_modules'
```

**better pattern — many edits across files**
```bash
cat > /tmp/workspace-edit.py <<'PY'
from pathlib import Path
def replace_exact(file_path: str, old: str, new: str) -> None:
    path = Path(file_path)
    text = path.read_text()
    if old not in text:
        raise SystemExit(f"expected block not found in {file_path}")
    path.write_text(text.replace(old, new))

replace_exact(
    "packages/workspace/scripts/task-push.js",
    """const isBooleanFlag = flag === '--json' || flag === '--help';""",
    """const isBooleanFlag = BOOLEAN_FLAGS.has(flag);""",
)
replace_exact(
    "packages/workspace/scripts/lib/verification.js",
    """return filePath === VERIFY_STAMP_PATH || filePath.startsWith('.task/');""",
    """return filePath.startsWith('.task/');""",
)
PY
python3 /tmp/workspace-edit.py
node --check packages/workspace/scripts/task-push.js
node --check packages/workspace/scripts/lib/verification.js
git diff -- packages/workspace/scripts/task-push.js packages/workspace/scripts/lib/verification.js
git status --porcelain -uall -- . ':!node_modules'
```

**python edit failure modes**
```
bad: python replace script says "expected block not found"
 → the old string has different whitespace than the file. read the exact range with
   bun run fs -- read <file> --from <N> --to <M> --plain and copy it character-for-character.
   watch for trailing newlines, tab/space mismatches, and invisible unicode characters.
 (always read the target range with --plain before writing the old string in your script)

```
"agent": "cd /Users/kokayi/Dev/pi-proxy && bun run agent"

For packages/workspace/SCRIPTS.md, I’d place this right before ## scripts reference:

## sub-agents
use the local pi proxy for small, bounded sub-agent calls from scripts. this is for one-shot help: cleanup, summarization, classification, drafting, or asking a narrow question. it is not a replacement for the task lifecycle, repo search, or verification.
run from repo root:

bun run agent – “say hello world”
bun run agent – –google/gemma-4-31b-it “summarize this error in one sentence: …”
cat /tmp/input.txt | bun run agent – “clean this transcript”

**rules**
- keep prompts narrow and explicit
- pass the model as `--provider/model` only when you need to override the default
- use `bun run agent --` from `/Users/kokayi/Dev/opensaas`; do not call the pi proxy directly from random scripts unless the script owns that integration
- treat sub-agent output as a draft until verified against files, tests, or logs
- never send secrets, api keys, auth tokens, customer pii, full phone numbers, or private credentials
- do not let sub-agents mutate repo files directly; write changes through workspace scripts (`fs`, `task:fs`, `task:exec`) and verify after writes
**good vs bad**

good: bun run agent – “turn this raw error into a concise summary: ”
→ bounded, no secrets, human can verify

good: bun run agent – –google/gemma-4-31b-it “clean this transcript but preserve meaning: ”
→ explicit model override and explicit transformation

bad: bun run agent – “fix the repo”
→ too broad. no area, files, command, or acceptance criteria

bad: bun run agent – “here is the production api key: … now debug this”
→ never send secrets to a model

bad: bun run agent – “edit packages/foo/src/bar.ts to make tests pass”
→ sub-agent output is text only. use task:fs/task:exec for repo mutations and verify the diff

**failure modes**
| symptom | fix |
|---------|-----|
| `Script not found "agent"` | you're not in `/Users/kokayi/Dev/opensaas`, or `package.json` is missing this script |
| request is slow | retry once; nvidia free api can land on slower capacity |
| model output is too formal | tighten the prompt: "preserve casual tone, do not formalize" |
| model hallucinates repo facts | ignore it and read files/logs; sub-agents do not replace evidence |
---

---

## rules that apply everywhere

### stream conflicts

when resolving stream merge conflicts, stop and ask ko unless the conflict is in metadata files (`.task/current.json`, `.task/workpad.md`). metadata conflicts can be resolved automatically — code conflicts need human judgment.

### SCRIPTS.md is part of the fix

always reread SCRIPTS.md when adding or changing scripts. if you add a new script or change behavior, update SCRIPTS.md in the same commit. missing docs are part of the fix, not cleanup for later.

---

## CLI tools — fallbacks only

these are installed globally. do not use them if a `bun run` script exists for the same operation. if you ran `--help` on the relevant script and it covers your use case, use the script. ko does not want raw CLI tools used when scripts are available.

the scripts wrap these tools with sane defaults, exclusions, and logging. using the raw tools bypasses all of that.

| tool | what it does | use the script instead |
|------|-------------|----------------------|
| `bat` | syntax-highlighted file reading | `bun run fs -- read` |
| `rg` | fast regex search | `bun run fs -- search` |
| `eza` | modern ls with tree view | `bun run fs -- list` |
| `fd` | fast file finder | `bun run fs -- list --find` |
| `xh` | http client | `bun run fs -- http` |
| `trash` | safe delete | `bun run fs -- trash` |
| `gh` | github CLI | `bun run gh` |

**when raw CLI tools are acceptable:**
- the script genuinely doesn't support what you need (rare — run `--help` first)
- you need to pipe output between tools in a way the script can't handle
- one-off system commands unrelated to the repo (e.g., `shortcuts --help`, `test -d`)

**when raw CLI tools are not acceptable:**
- reading, searching, or listing repo files (use `fs`)
- reading or writing worktree files (use `task:fs`)
- running commands in a worktree (use `task:exec`)
- github operations (use `gh` script or `pr-review`)

```
bad: rg "pattern" packages/
 → use: bun run fs -- search "pattern" packages/

bad: cat packages/dialer/src/queue.ts
 → use: bun run fs -- read packages/dialer/src/queue.ts

bad: cd /private/tmp/opensaas-worktrees/task-dialer && rg "TODO" packages/
 → use: bun run task:fs -- --area dialer search "TODO" packages/
```

---

## script file paths section removed — run `bun run fs -- list packages/workspace/scripts/` to see current files.

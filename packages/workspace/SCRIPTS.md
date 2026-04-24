# workspace scripts

agent toolkit for the opensaas monorepo. all commands run from repo root via `bun run`.

every script supports `--help` and `--json`.


---
## fs — safe file operations

wraps bat (read), rg (search), eza/fd (list), xh (http), trash (delete). no heredocs, no quoting bugs.

### read
`bun run fs -- read src/foo.ts` — full file, syntax highlighted, line numbers
`bun run fs -- read src/foo.ts --from 120 --to 180` — specific line range
`bun run fs -- read src/a.ts --from 1 --to 50 src/b.ts` — multiple files, each with own range
`bun run fs -- read src/foo.ts --plain` — no syntax highlighting or decoration
`bun run fs -- read src/foo.ts --json` — structured json output (automation-safe)

### search
`bun run fs -- search "pattern" packages/` — search files (wraps rg, excludes node_modules/.git/dist)
`bun run fs -- search "pattern" src/ --context 4` — with context lines around matches
`bun run fs -- search "pattern" src/ --then-read` — search + read bounded ranges (human output only)
`bun run fs -- search "pattern" packages/ --files` — filenames only
`bun run fs -- search "pattern" packages/ --json` — structured json (automation-safe)
`bun run fs -- search "pattern" packages/ --max-results 5` — cap number of matches

### list
`bun run fs -- list packages/workspace/scripts/` — directory listing (eza -la)
`bun run fs -- list packages/workspace/ --tree` — tree view
`bun run fs -- list packages/workspace/ --tree --depth 2` — tree with max depth
`bun run fs -- list packages/ --dirs --depth 1` — directories only
`bun run fs -- list packages/dialer/src/ --ext ts` — find by extension (fd)
`bun run fs -- list packages/workspace/scripts/ --find task` — find files matching "task" (fd)
`bun run fs -- list . --find "\.test\.ts$" --depth 3` — regex find
`bun run fs -- list packages/ --git` — show git status column

### write
`cat /tmp/new.ts | bun run fs -- write src/new.ts` — write from stdin (fails if file exists)
`cat /tmp/fix.ts | bun run fs -- write src/old.ts --force` — overwrite existing file
`echo "// note" | bun run fs -- write src/foo.ts --append` — append (exact — include \n yourself)
`bun run fs -- write src/const.ts --content "export const V = 1;"` — inline content
`bun run fs -- write src/deep/dir/file.ts --content "x" --mkdirs` — create parent directories

### patch
`cat /tmp/replacement.ts | bun run fs -- patch src/foo.ts --from 20 --to 35` — replace lines 20-35 inclusive
`cat /tmp/replacement.ts | bun run fs -- patch src/foo.ts --from 20 --to 35 --dry-run` — preview only
`bun run fs -- patch src/foo.ts --from 42 --to 42 --content "const x = newValue;"` — replace single line

### http
`bun run fs -- http get https://api.github.com` — GET request (wraps xh)
`bun run fs -- http post https://api.example.com key=val` — POST json
`bun run fs -- http get https://api.example.com Authorization:"Bearer $TOKEN"` — with headers

### trash
`bun run fs -- trash old-file.ts` — move to trash (not permanent delete)
`bun run fs -- trash old-dir/` — directory
`bun run fs -- trash a.ts b.ts c.ts` — multiple files

### tips
- prefer `bun run fs` over raw bat/rg/eza/fd for repo work
- before `write --force` or `patch`, always read the target first
- `write` does NOT create parent dirs by default — use `--mkdirs`
- `write --append` is exact — include `\n` yourself
- `patch --from N --to N` replaces line N. always read the range first — patch does not validate bounds
- `read --json` and `search --json` are automation-safe. `--then-read --json` is NOT structured yet
- errors exit 1. check exit code or stderr for failures
- write and patch log touched files to `.task/workpad.md`

---

## task workflow — context, start, push, promote, clean up

the full lifecycle of a coding task: create a branch → work → push → promote to stream → clean up.

`bun run stream:context -- --area dialer` — show stream context (recent PRs, divergence)
`bun run stream:sync -- --area dialer` — sync stream/dialer with latest main
`bun run task:start -- --area dialer --title "queue runner"` — create task branch + worktree + PR
`bun run task:push -- --message "fix(dialer): desc" --changed` — push changes to remote via github api
`bun run task:pr` — merge task→stream, create stream→main PR
`bun run task:prs` — show both PR links for the current task
`bun run task:merge -- --pr 173` — merge a specific PR
`bun run task:merge -- --pr 173 --wait` — merge + wait for railway deploy
`bun run task:finish` — verify merge, remove worktree, delete branch
`bun run task:cleanup -- --preview` — preview stale worktree cleanup
`bun run task:cleanup -- --merged --stale-days 3` — remove merged tasks older than 3 days

task:start creates the branch, worktree at /tmp/opensaas-worktrees/, draft PR targeting the stream, and symlinks node_modules from main so tests/lint work.

task:push reads changed files from the worktree, creates blobs → tree → commit → updates ref via github api. ko stays as author, suelo-kiro[bot] as committer. no local git push needed.

task:pr squash-merges the task PR into the stream branch, then creates or refreshes the review PR (stream → main). ready-for-review by default, use --draft to keep as draft.

---

## stream management

streams are long-lived branches per area (dialer, workspace-agents, analytics, etc.) that collect task PRs before going to main.

`bun run stream:list` — list all stream branches with status
`bun run stream:sync -- --area dialer` — sync stream/dialer with latest main
`bun run stream:context -- --area dialer` — show stream context (recent PRs, divergence)

---



## context — search and save project memories

past decisions, patterns, skills, architecture knowledge, repo details. search AGGRESSIVELY. if you're about to say something about the codebase, search first. try multiple queries. the memories table in supabase has detailed knowledge about packages, architecture decisions, and past conversations.

`bun run context -- search dialer` — search memory content
`bun run context -- search queue --category workpad` — search within a category
`bun run context -- find "queue handoff"` — search by title
`bun run context -- get 1 dialer` — read full content of result #1
`bun run context -- list workpad` — list recent workpads
`bun run context -- list --limit 20` — list recent memories
`bun run context -- save "dialer notes" ./notes.md` — save a file as memory
`echo "text" | bun run context -- save "note" --text` — save from stdin
`bun run context -- categories` — list available categories

---

## tmp — exact temp file handling

write exact content to temp files. no trimming, no reformatting. files go to opensaas-handoffs/.

`bun run tmp -- write notes "# my notes here"` — write content to notes.md
`cat draft.md | bun run tmp -- write review --stdin` — write from stdin (best for long content)
`bun run tmp -- read notes` — read a temp file
`bun run tmp -- path notes` — print full path
`bun run tmp -- save handoffs "dialer queue investigation"` — save temp file to supabase memories
`bun run tmp -- list` — list temp files with size and age
`bun run tmp -- clean` — remove all temp files

---

## browser — test and interact with web pages

wraps agent-browser with ko's authenticated profile. already logged into consuelo, railway, github.

`bun run browser -- consuelo` — open consuelo CRM (internal)
`bun run browser -- app` — open production (app.consuelohq.com)
`bun run browser -- open https://example.com` — open any url
`bun run browser -- consuelo --headed` — show ko the browser window
`bun run browser -- snap` — snapshot current page (accessibility tree)
`bun run browser -- click @e5` — click element by ref
`bun run browser -- fill @e3 "search query"` — fill input
`bun run browser -- hover @e2` — hover element
`bun run browser -- select @e4 "option-value"` — select dropdown
`bun run browser -- check @e6` — check checkbox
`bun run browser -- screenshot after-login` — take screenshot
`bun run browser -- screenshot --full` — full page screenshot
`bun run browser -- wait --text "Welcome"` — wait for text
`bun run browser -- wait --load networkidle` — wait for network idle
`bun run browser -- find role button click --name "Submit"` — semantic locator
`bun run browser -- tab` — list tabs
`bun run browser -- tab new https://github.com` — new tab
`bun run browser -- console` — js console messages
`bun run browser -- errors` — page errors
`bun run browser -- network requests` — API calls (static assets filtered)
`bun run browser -- batch "open https://x.com" "wait --load networkidle" "screenshot"` — batch
`bun run browser -- close` — close the browser

---

## railway — deploy observability

`bun run railway:logs` — status + recent logs + http logs
`bun run railway:logs -- --status` — just status and deploy info
`bun run railway:logs -- --errors` — errors only
`bun run railway:logs -- --filter "twilio OR queue"` — filter logs
`bun run railway:logs -- --build` — build logs
`bun run railway:logs -- --network` — network flow logs
`bun run railway:logs -- --env TWILIO_ACCOUNT_SID` — check if env var is set

---

## wait — sleep or wait for deploy

`bun run wait -- 5m` — sleep 5 minutes
`bun run wait -- 30` — sleep 30 seconds
`bun run wait -- --deploy` — wait for deploy matching local HEAD
`bun run wait -- --deploy abc123` — wait for specific commit

---

## review — code review checks

runs all 16 mandatory checks from CODING-STANDARDS.md against changed files.

`bun run review` — run review on changed files
`bun run review -- --fix` — auto-fix eslint issues
`bun run review -- --all` — check all files
`bun run review -- --json` — json output

---

## website:deploy — deploy consuelo website

`bun run website:deploy` — build and deploy to cloudflare pages
`bun run website:deploy -- --preview` — preview deploy (non-production url)
`bun run website:deploy -- --build-only` — build only, don't deploy

---

## server — manage the workspace MCP server

`bun run server -- status` — check if server is running, show tools + pid
`bun run server -- restart` — stop + start (needed after editing server.py)
`bun run server -- stop` — stop the server
`bun run server -- start` — start the server
`bun run server -- logs` — tail /tmp/workspace.log

---

## help  
bun run <script> -- --help                                     # any script supports --help

---

## CLI tools — mostly fallbacks for scipts

installed globally. use directly — no bun run needed.

### search & find (fallback prefer bun script)

`rg "TODO" .` — search file contents everywhere
`rg "normalizePhone" packages/contacts/` — search in a package
`rg "TODO" --type ts` — only typescript files
`rg "pattern" -l` — filenames only
`rg "pattern" -C 3` — 3 lines of context

`fd config` — find files by name (fallback prefer bun script)
`fd "\.test\.ts$"` — regex: all test files
`fd config packages/dialer/` — search within a directory
`fd -e ts -e tsx` — by extension
`fd -t d src` — directories only

### read & list (fallback prefer bun script)

`bat file.ts` — syntax highlighted + line numbers
`bat file.ts -r 50:80` — line range
`bat file.ts -p` — plain (no decoration)

`eza -la` — long listing with hidden files
`eza -la --git` — with git status column
`eza --tree src` — tree view
`eza --tree src -L 2` — tree, max depth 2

### http (fallback prefer bun script)

`xh get https://api.github.com` — GET request
`xh post https://api.example.com key=val` — POST json

### system

`dust .` — what's taking disk space
`duf` — disk free space
`procs` — list processes
`procs node` — filter by name
`btm` — interactive system monitor

### safety (fallback prefer bun script)

`trash file.txt` — move to trash (not permanent delete)
`trash old-dir/` — directory too — ALWAYS prefer over rm

### git diffs

`git diff | delta` — pretty diffs
`delta file-a.ts file-b.ts` — compare two files

### old → new

grep → rg, find → fd, ls → eza, tree → eza --tree, cat → bat, diff → delta, curl → xh, du → dust, df → duf, ps → procs, top → btm, rm → trash

---

## script file paths

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
├── server.js            # server (restart/status/stop/start/logs)
└── lib/
`    ├── git.js          ` — git operations (execFileSync, no shell)
`    ├── github.js       ` — github api (PRs, blobs, trees, commits)
`    ├── paths.js        ` — repo paths, worktree root, git root
`    ├── task-meta.js    ` — .task/current.json + .task/tasks/ read/write
`    └── validation.js   ` — branch naming, commit format validation

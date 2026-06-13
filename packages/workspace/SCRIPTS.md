# workspace scripts

the following scripts are available via `bun run <name>`. use the script name as the command and pass arguments after `--`.

all scripts run from the repo root: `/Users/kokayi/Dev/opensaas`. worktrees do not have `package.json` — running `bun run <anything>` from inside a worktree fails with `Script not found`.

**why:** worktrees are lightweight git checkouts that share `node_modules` via symlink from repo root. they have source files but no installed deps — that's why all scripts must run from repo root.

every script supports `--help` and `--json`.

`bun run consuelo-reload` schedules a detached reload and returns before the MCP server stops. This keeps agent-initiated reloads from dropping the active workspace call. `bun run consuelo-reload -- reload-now` performs the immediate stop/start path and is reserved for detached child execution or manual terminal use where a dropped caller response is acceptable. Legacy `bun run server -- restart` still works as an alias while agents and humans move to the clearer command name.

---

## foundation

these three rules apply to every script, every task, every session. read them first.

### rule 0 — where to run

always run scripts from `/Users/kokayi/Dev/opensaas` (the repo root). never cd into a worktree and run `bun run`. worktrees are created by `task:start`; agents should use the returned task session through `workspace.call`, which resolves the exact task branch and worktree.

```bash
bad: cd /private/tmp/opensaas-worktrees/task-dialer-queue && bun run fs -- read src/foo.ts
 → error: Script not found "fs"

good: workspace.call({ tool: "fs.read", taskSession, input: { path: "src/foo.ts" } })
 → reads from the exact task worktree without relying on shared root metadata
```

### rule 1 — response contract
when answering questions or reporting results, use this format:

- **tl;dr** → one-line answer or status
- **evidence** → what you checked (file paths, command output, error messages)
- **action** → what to do next (or "nothing — done")

do not answer architecture questions from memory. search memory, read files, then answer with citations and paths.




### diff_cockpit — open the live PR review cockpit

Operator launcher for the Cloudflare-hosted live PR review cockpit. The script opens a canonical `diffs.consuelohq.com` URL in Arc and does not generate a static tmp review page. The first phase supports a single PR route with live GitHub data, a file tree, a diff/code review surface, and a right review drawer that stays closed by default.

```bash
bun run diff_cockpit -- 708
bun run diff_cockpit -- 708 --print --no-open
bun run diff_cockpit -- https://github.com/consuelohq/opensaas/pull/708
bun run diff_cockpit -- consuelohq/opensaas/pull/708
```

Default repo for bare PR numbers: `consuelohq/opensaas`. Override it with `--repo owner/repo`.

Related package commands:

```bash
cd packages/diff-cockpit && bun run dev
cd packages/diff-cockpit && bun run deploy
cd packages/diff-cockpit && bun run test
```

Deploy target: `diffs.consuelohq.com` via Cloudflare Workers. Provide `GITHUB_TOKEN` or `GH_TOKEN` to the Worker when private repo access or higher GitHub API limits are needed.

### os:release-install — release the hosted Consuelo OS curl installer

Operator-only release script for publishing `packages/os/scripts/bootstrap.sh` to Cloudflare Workers. Run from the repo root like other workspace operators; the root script delegates to `packages/workspace/scripts/os-release-install.ts`. This intentionally lives in `packages/workspace`, not `packages/os`, because it uses Ko/operator Cloudflare permissions and should not become user-installable OS tooling.

```bash
bun run os:release-install -- --dry-run
bun run os:release-install
bun run os:release-install -- --verify-only
```

Defaults:

- Worker name: `consuelo-os-install`
- Custom domain: `install.consuelohq.com`
- Installer path: `/os`
- Bootstrap source: `packages/os/scripts/bootstrap.sh`


### trace:analytics — inspect local workspace trace token and error usage

Operator-only report for the local OpenWorkspace trace database. It shows cumulative windows for the past day, week, and month, plus top tools, branches, errors, slow calls, and high-output calls.

```bash
bun run trace:analytics
bun run trace:analytics -- --db=/path/to/traces.db
```

The `Trace history` section explains the retention horizon for the selected database. When `rows_older_than_week` is `0`, the `past_week` and `past_month` windows are expected to match because the trace database has no rows before the 7-day cutoff.

---

## code.run / code mode

`code.run` is the primary orchestration surface for multi-step workspace work. Use it when a workflow needs several related typed workspace tool calls in one pass: read files, search context, inspect status, run task-scoped commands, write targeted files, validate, and return a compact structured summary.

Prefer the nested typed workspace namespace inside code mode:

```js
const status = await workspace.status({});
const file = await workspace.fs.read({ path: "AGENTS.md", from: 1, to: 40 });
const current = await workspace.task.current({});
const exact = await readFile("packages/workspace/package.json", 1, 5);
```

Use `workspace_call("tool.name", input)` when constructing tool names dynamically. Sanitized helpers like `fs_read`, `task_current`, and aliases like `readFile` remain available, but the nested `workspace.*` namespace is the preferred default because it mirrors the typed facade.

Always pass `taskSession` when task work is involved. The facade resolves the task branch and worktree; do not reconstruct task paths manually.

Use direct outer tool calls for single-step operations and final durable transitions such as task push, task PR promotion, merges, deploys, and publishing. `code.run` can inspect and prepare for those actions, but explicit outer calls keep the review boundary visible.

`code.run` is Bun-native and trusted-agent orchestration, not an untrusted public sandbox. It relies on the typed workspace tools for guardrails and adds orchestration controls: max operations, output caps, operation logs, changed-file tracking, timeout handling, and recursive `code.run` blocking.

---

## the task lifecycle

every change — even tiny ones — follows this flow. no exceptions.

Always pass `taskSession` when task work is involved. The facade resolves the task branch and worktree; do not reconstruct task paths manually.

Task-scoped repo tools fail with `TASK_SESSION_REQUIRED` when called without a session. The error includes the reason, whether the tool is repo-state-bound, a safe echo of the original tool/input, and a recovery action: start a task, capture `data.taskSession`, then rerun the same tool call with that session. Read-only HTTP checks use the `http` tool without a task session because they do not read repo state or need a task worktree.
```bash
 1. bun run stream:context -- --area <area>              # understand the stream state
 2. bun run stream:sync -- --area <area>                 # sync stream with latest main
 3. bun run task:start -- --area <area> --title "x"      # create task branch + worktree + PR
 4. (make changes through task-scoped `workspace.call` using `taskSession`)
 5. bun run verify                                       # run review + db guards, write stamp
 6. bun run task:push -- --message "type(scope): x" --changed  # push via github api
 7. bun run task:pr                                      # merge task→stream, create stream→main PR
 8. bun run task:prs                                     # show both PR links (Graphite first, GitHub retained for API/debugging)
 9. bun run task:merge -- --pr <N> --wait                # merge + wait for deploy
10. bun run railway:logs -- --status                     # check deploy health + logs
11. bun run browser -- consuelo                          # verify UI in production
12. bun run task:finish                                  # remove worktree, delete branch
13. bun run tmp -- save handoffs "description"           # save context for next agent
```

the verify → push dependency:
```text
verify ✓ → writes .task/<area>/<slug>/verify.json stamp → task:push reads stamp → push succeeds
no verify → no publish-valid stamp → task:push rejects unless Ko explicitly approved an approved path
```

always use this flow even if the change seems tiny. when in doubt, start from the stream, isolate the task, push early, clean up after merge.

---

## things to remember

**stale root task metadata is the #1 cause of script failures.** task metadata is now task-scoped under `.task/<area>/<slug>/`. branch-aware task scripts still read legacy root `.task/current.json` only as a compatibility fallback when `taskBranch` matches the actual worktree branch. if `task:pr`, `task:finish`, `task:push`, or `task:prs` still need explicit repair, fix the known worktree only:

```bash
bun run task:init -- --area <area> --branch <branch> --pr <N>
```

do NOT create a whole new worktree just to fix metadata. `task:init` rewrites `.task/<area>/<slug>/current.json` for an existing worktree without creating branches or PRs. it is manual repair, not the automatic merge-conflict resolver.

**never cd into a worktree.** all `bun run` commands fail from inside worktrees (no `package.json`). use `task:fs` and `task:exec` from repo root.

**when resolving stream conflicts,** stop and ask ko unless all conflicts are metadata files (`.task/<area>/<slug>/current.json`, `.task/<area>/<slug>/workpad.md`, or legacy root `.task/current.json` / `.task/workpad.md`). metadata-only conflicts are auto-resolved; mixed metadata + real file conflicts still stop.

**after any write or patch, verify immediately:**
```bash
bun run fs -- read <file> --from <range> --plain
node --check <touched-js-file>
git status --porcelain -uall -- . ':!node_modules'
```

**railway logs are truth.** don't guess about production — run `bun run railway:logs -- --errors` or `--filter "keyword"`.

**SCRIPTS.md is part of the fix.** if you add or change a script, update SCRIPTS.md in the same commit.

**PR links are Graphite-first for humans.** task workflow scripts keep GitHub URLs in machine metadata, and show Graphite URLs as the primary human review links when a PR number is known.

---

## when things go wrong

recovery patterns for common failures. don't panic — diagnose first.

| symptom | fix |
|---------|-----|
| stale metadata — scripts reference wrong branch/PR | branch-aware scripts ignore mismatched metadata; for a known worktree run `bun run task:init -- --area <area> --branch <branch> --pr <N>` |
| worktree exists but task is done | `bun run task:finish` or `bun run task:cleanup -- --merged` |
| pushed but forgot to verify | run `bun run verify`, then push again (stamp updates) |
| stream conflict on merge | metadata-only conflicts auto-resolve; mixed/code/doc conflicts stop and ask ko |
| "Script not found" | you're in a worktree. run scripts from repo root; use `task:fs` / `task:exec` with `--branch` or `--pr` |
| task:start fails — worktree already exists | check if old task is needed: `bun run task:fs -- --branch <task-branch> read .task/<area>/<slug>/current.json`. if not, `bun run task:finish` or `bun run task:cleanup -- --preview` first |
| task:push rejects — no publish-valid verify stamp | run `bun run verify` first. only use `--approved --reason "Ko approved: ..."` with explicit Ko approval. |
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

```bash
bun run task:exec -- --branch <task-branch> git diff   # review your changes
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
```bash
bun run fs -- read src/foo.ts                          # full file, syntax highlighted, line numbers
bun run fs -- read src/foo.ts --from 120 --to 180      # specific line range
bun run fs -- read src/a.ts --from 1 --to 50 src/b.ts  # multiple files
bun run fs -- read src/foo.ts --plain                   # no decoration (best for piping)
bun run fs -- read src/foo.ts --json                    # structured json (automation-safe)
```

**search**
```bash
bun run fs -- search "pattern" packages/               # search files (excludes node_modules/.git/dist)
bun run fs -- search "pattern" src/ --context 4        # with context lines
bun run fs -- search "pattern" src/ --then-read        # search + read bounded ranges
bun run fs -- search "pattern" packages/ --files       # filenames only
bun run fs -- search "pattern" packages/ --json        # structured json
bun run fs -- search "pattern" packages/ --max-results 5  # cap matches
```

**list**
```bash
bun run fs -- list packages/workspace/scripts/         # directory listing
bun run fs -- list packages/workspace/ --tree          # tree view
bun run fs -- list packages/workspace/ --tree --depth 2  # tree with max depth
bun run fs -- list packages/ --dirs --depth 1          # directories only
bun run fs -- list packages/ --find "*.test.ts"        # find files by glob
bun run fs -- list packages/ --find "queue" --type f   # find by name fragment
```

**write**
```bash
bun run fs -- write src/new.ts --content "export const x = 1;"  # create new file
bun run fs -- write src/new.ts --content-file /tmp/new.ts --mkdirs # create multiline file from file payload
bun run fs -- write src/existing.ts --content-file /tmp/new.ts --force # overwrite existing from file payload
bun run fs -- write src/foo.ts --append --content-file /tmp/addition.ts # append exact file payload
```

**patch**
```bash
printf 'single line' | bun run fs -- patch src/foo.ts --from 10 --to 10
bun run fs -- patch src/foo.ts --from 10 --to 15 --content-file /tmp/replacement.ts
bun run fs -- patch src/foo.ts --from 10 --to 10 --content "single line only"
```

Use `--content-file` for multiline writes and replacements. Inline `--content` is only for short writes and single-line patches; multiline source code must move through a file or stdin so JSON, shell, and argv parsing cannot turn newlines into literal `\n` text.

**http**
```bash
bun run fs -- http get https://api.github.com          # GET request (wraps xh)
bun run fs -- http post https://api.example.com key=val  # POST json
```

**trash**
```bash
bun run fs -- trash old-file.ts                        # move to trash (not permanent delete)
bun run fs -- trash old-dir/                           # directory
bun run fs -- trash a.ts b.ts c.ts                     # multiple files
```

**fs failure modes**
```bash
bad: bun run fs -- write src/foo.ts --content "..."
 → error: file exists. use --force to overwrite
 (always read the file first, then decide: --force to overwrite, or patch for targeted edits)

bad: bun run fs -- patch src/foo.ts --from 10 --to 20 --content "..."
 → replaced wrong lines because you didn't read the range first
 (always: read --from N --to M → verify → then patch the same range)

bad: bun run fs -- write src/deep/nested/new.ts --content-file /tmp/new.ts
 → error: directory does not exist
 (use --mkdirs to create parent directories)

bad: bun run fs -- write src/foo.ts --content "$(cat /tmp/big.ts)"
 → command payload is too large or multiline content is corrupted by shell/argv transport
 (use --content-file /tmp/big.ts so only the path travels through argv)

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
- `write --content-file` is the safe path for multiline or large whole-file writes
- `write --append` is exact — include `\n` yourself
- `patch --from N --to N` replaces line N. always read the range first
- `read --json` and `search --json` are automation-safe. `--then-read --json` is NOT structured yet
- write and patch log touched files to `.task/<area>/<slug>/workpad.md`
- after any write or patch, immediately verify: read the changed range, `node --check`, `git status`

---

### task:fs — file operations inside the task worktree

proxies all arguments to `bun run fs` with cwd set to the selected task worktree. paths resolve relative to the worktree root. this is how you read and write files in a task — not by cd-ing into the worktree.

```bash
bun run task:fs -- --area dialer read packages/dialer/src/queue.ts
bun run task:fs -- --branch task/dialer/fix-thing read packages/dialer/src/queue.ts --from 1 --to 80 --plain
bun run task:fs -- --pr 210 search "TODO" packages/ --files
bun run task:fs -- --area dialer list packages/ --tree --depth 2
bun run task:fs -- --branch task/dialer/fix-thing write src/new.ts --content-file /tmp/new.ts
bun run task:fs -- --branch task/dialer/fix-thing patch src/foo.ts --from 10 --to 15 --content-file /tmp/replacement.ts
```

**common task:fs patterns**
```bash
bun run task:fs -- --branch task/dialer/fix-thing read .task/dialer/fix-thing/workpad.md          # acceptance criteria, progress
bun run task:fs -- --branch task/dialer/fix-thing read .task/dialer/fix-thing/current.json        # task metadata
bun run task:fs -- --branch task/dialer/fix-thing list .task/dialer/fix-thing/                    # task directory
bun run task:fs -- --area dialer search "transferCall" packages/dialer/src/
bun run task:fs -- --branch task/dialer/fix-thing write .task/dialer/fix-thing/workpad.md --append "\n- [x] fixed the thing"
```

task:fs only considers active worktrees whose task-scoped `.task/<area>/<slug>/current.json.taskBranch` matches the actual git worktree branch. stale legacy root metadata and stream sync scratch worktrees are ignored. when more than one task exists in an area, `--area` intentionally fails; select the exact task with `--branch <task-branch>` or `--pr <number>`.

successful `task:fs read <file>` calls also append a `file.read` event to `.task/<area>/<slug>/evidence-log.json` and mirror it into the local workspace index database. this is the automatic read-tracking path for the explore/decision system.

**task:fs failure modes**
```bash
bad: bun run task:fs -- --area workspace-agents read .task/current.json
 → error: multiple active tasks found (...). use --branch <task-branch> or --pr <number> to select one.
 (area is not enough when multiple tasks exist in the same stream. use --branch or --pr)

bad: cd /private/tmp/opensaas-worktrees/task-dialer && bun run task:fs -- read src/foo.ts
 → error: Script not found "task:fs"
 (run from repo root, not from inside the worktree)

bad: cat /private/tmp/opensaas-worktrees/task-dialer/packages/dialer/src/queue.ts
 → works but skips the script system. never read raw worktree paths.
 (use: bun run task:fs -- --branch task/dialer/fix-thing read packages/dialer/src/queue.ts)
```

---

### task:exec — run commands inside the task worktree

runs any command with cwd set to the selected task worktree. use for git, prettier, jest, nx, or anything that needs to run "inside" the worktree. like `task:fs`, it ignores stale metadata whose `taskBranch` does not match the worktree branch. when more than one task exists in an area, select with `--branch` or `--pr`; `--area` is intentionally not enough.

```bash
bun run task:exec -- --area dialer git diff
bun run task:exec -- --branch task/dialer/fix-thing git status --short
bun run task:exec -- --pr 210 yarn jest --runInBand packages/dialer/src/queue.test.ts
bun run task:exec -- --branch task/dialer/fix-thing yarn prettier --write packages/twenty-front/src/foo.ts
bun run task:exec -- --branch task/dialer/fix-thing npx nx typecheck twenty-front
bun run task:exec -- --branch task/dialer/fix-thing bun run review
bun run task:exec -- --branch task/dialer/fix-thing git diff --check
```

**task:exec failure modes**
```bash
bad: bun run task:exec -- --area workspace-agents git status
 → error: multiple active tasks found (...). use --branch <task-branch> or --pr <number> to select one.
 (always use --branch or --pr when the same area has multiple active tasks)

bad: cd /private/tmp/opensaas-worktrees/task-dialer && git diff
 → works but you left the repo root. now bun run <anything> will fail.
 (use: bun run task:exec -- --branch task/dialer/fix-thing git diff)
```

---

### review — code review checks

runs all 16 mandatory checks from CODING-STANDARDS.md against changed files. includes eslint, typecheck, and test suite. the typed facade requires an explicit task branch and scopes review to that task worktree. vendored third-party source under `packages/*/upstream/**` and `packages/*/vendor/**` is excluded from first-party review rules; review the wrapper/facade and attribution boundaries instead.

```bash
bun run review                        # review changed files (main vs origin/main)
bun run review -- --mine              # scope to active task worktree only
bun run review -- --fix               # auto-fix eslint issues
bun run review -- --all               # check all files, not just changed
bun run review -- --base stream/dialer  # compare against specific ref
bun run review -- --json              # full raw json output
bun run review -- --summary-json      # compact semantic json output for agents
bun run review -- --quiet             # only show failures
bun run review -- --no-tests          # skip test suite
bun run review -- --strict            # enable strictPropertyInitialization
```

`--json` keeps the full raw finding arrays for compatibility. `--summary-json` returns counts, finding IDs, must-fix current-change findings, pre-existing digests, and a command for full evidence retrieval.

typed facade form — `branch` is required:

```bash
workspace review.run "{\"branch\":\"task/workspace-agents/example\",\"noTests\":true}"
```

**review failure modes**
```bash
bad: bun run review (from repo root, no task)
 → reviews main vs origin/main. shows 0 changed files if main is up to date.
 (use --mine to scope to the active task worktree, or --base to compare against a specific ref)

bad: review fails on a file you didn't touch
 → this is expected. the branch must be healthy when you leave it. fix it.
 (there is no "not mine" — if it's on the branch and broken, it's yours)
```

---



### test-selection:generate — generate test registry

writes `packages/workspace/test-selection.registry.json` from repo test discovery plus explicit rules.

---

### test-selection:check — check affected test selection

selects registry-owned suites for changed files and can run them with `--run`. `verify` uses this command internally.

---

### test-selection:nightly — write test registry report

writes `/tmp/opensaas-test-reports/latest.md` and `/tmp/opensaas-test-reports/latest.json`.

---

### test-selection — affected test registry

`test-selection:generate` scans repo-relative test files, project targets, package test scripts, and `packages/workspace/test-selection.rules.json`, then writes `packages/workspace/test-selection.registry.json`. The registry is generated and should not be hand-edited. Add explicit rules when a source area has non-obvious test ownership.

```bash
bun run test-selection:generate -- --json
bun run test-selection:check -- --base origin/main --json
bun run test-selection:check -- --base origin/main --run --json
bun run test-selection:nightly -- --json
```

`verify` runs the registry check with `--run`. If changed code selects zero suites, verify reports the reason. Critical surfaces such as workspace gate scripts, task routing, trace rendering, API, dialer, and server code must have mapped tests. Nightly reports are written to `/tmp/opensaas-test-reports/latest.md` and `/tmp/opensaas-test-reports/latest.json`.

---

### verify — full task safety gate
runs `bun run review` + db/migration/graphql guardrails. writes a publish-valid `.task/<area>/<slug>/verify.json` stamp only when the full gate passes. `task:push` requires this publish-valid stamp by default. `review.run` is optional preflight; `verify` is the formal publish gate.

Structured review runs are durable and keyed by branch/base/change hash plus review output mode. This makes `workspace review.run` and `verify` share the same underlying review state: an equivalent completed summary can be replayed, an active equivalent run is waited on, and orphaned state is treated conservatively. Review attach/replay notes go to stderr so `verify` can continue parsing stdout summary JSON safely.
When called through `workspace.call` with `taskSession`, the facade injects `TASK_WORKTREE`. `verify` must read and write `.task/<area>/<slug>/verify.json` inside that task worktree. If verify output names `main` or another task while a task session was supplied, the script is reading the wrong root and the publish gate is unsafe.

```bash
```bash
bun run verify                          # formal publish gate (review + db guards + publish-valid stamp)
bun run verify -- --json                # structured formal gate output
bun run verify -- --base stream/dialer  # compare against specific ref
bun run verify -- --no-stamp            # validation only; does not create a publish-valid stamp
```

Debug-only skip flags are intentionally not part of normal task flow. `task:push` requires a publish-valid verify stamp unless Ko explicitly approves an approved push path.

**verify failure modes**
```text
bad: verify fails on a package with no typecheck target
 → this is the harness being stricter, not broken code. the package was never typechecked.
 (check if the package has a project.json with a typecheck target. if not, that's a gap to fix)

bad: bun run task:push -- --message "fix: thing" --changed
 → error: no matching verify stamp
(run bun run verify first. an approved path requires explicit Ko approval and `--approved --reason "Ko approved: ..."`)
```

---

### explore — repo exploration retrieval

builds or refreshes the git-aware local index at `~/.cache/workspace-index/`, embeds the question with Qwen3-Embedding-4B, expands through import/test/caller graph edges, and returns the best files to inspect next. explore uses multiplicative scoring, weighted graph link quality, and cluster coherence. it writes an `explore.result` evidence event and initializes `.task/<area>/<slug>/explore-state.json` beliefs; embeddings are the prior, not proof.

`packages/workspace` is mac-local agent tooling, not production runtime. it is intentionally excluded from the root yarn workspace and railway Docker builds so native local-index dependencies such as `node-llama-cpp`, `sqlite-vec`, and `tree-sitter` never ship to railway. if local index dependencies are missing, install them from the tool package only:

```bash
cd packages/workspace && bun install
```

```bash
bun run explore -- "how does the dialer queue work?"
bun run explore -- "where is task metadata verified?" --budget 5
bun run explore -- "recent workspace changes" --changed-only --json
bun run explore -- "refresh everything" --reindex

#### Embedding dimension benchmark

The default workspace index keeps the existing 1024-dimensional Qwen3-Embedding-4B cache so agents can fall back instantly. To build a separate non-destructive 2560-dimensional benchmark index, run explore with explicit embedding env vars:

```bash
WORKSPACE_EMBEDDING_API=1 \
WORKSPACE_EMBEDDING_DIMENSIONS=2560 \
WORKSPACE_EMBEDDING_BATCH_SIZE=96 \
bun run explore -- "Open Design Electron desktop app tools-dev electron app packaging mac consuelo design upstream open-design" --budget 8 --json
```

The 2560 index writes under a config-specific cache directory and does not overwrite the legacy 1024 cache. Re-run the same command to resume a partial build. Do not promote a higher-dimensional index as default until the scenario matrix beats the 1024 baseline.

```

**explore failure modes**
```text
bad: sqlite-vec could not be loaded
 → use the root script, which sets Homebrew SQLite on DYLD_LIBRARY_PATH for macOS extension loading.

bad: embedding model not found
 → the expected cached model is missing at ~/.cache/qmd/models/Qwen3-Embedding-4B-Q8_0.gguf.
```

---

### decide-next — next action from evidence

reads `.task/<area>/<slug>/explore-state.json` plus `.task/<area>/<slug>/evidence-log.json` when a task is active, or the fallback session state under `~/.cache/workspace-index/`, updates posterior beliefs from evidence, then recommends the action with the best mix of posterior relevance and information value. it writes a `decision.taken` evidence event and recommends `exploit` when belief concentration is high enough.

```bash
bun run decide-next
bun run decide-next -- --context .task/<area>/<slug>/workpad.md
bun run decide-next -- --mark-read packages/dialer/src/queue.ts
bun run decide-next -- --mark-relevant packages/dialer/src/dialer.ts
bun run decide-next -- --mark-irrelevant packages/dialer/src/types.ts
bun run decide-next -- --json
```

---

### confidence-score — evidence confidence

scores the current path from evidence events: reads, posterior belief updates, connected files actually visited, verify/test/runtime results, and contradictions. Qwen candidates, graph expansion, and test existence are reported as starting state, not `evidence_for`; cold start confidence stays low because retrieval is only a prior.

```bash
bun run confidence-score
bun run confidence-score -- --json
```

---

### exploit — commit to an editing path

selects the highest-confidence file from explore state, emits line ranges and context files, marks the state as exploiting, and writes a `decision.taken` evidence event.

```bash
bun run exploit
bun run exploit -- --target packages/workspace/scripts/task-push.js
bun run exploit -- --json
```

---

### confirm — validation truth

piggybacks on the existing `verify` flow and can also run runtime-log checks or a targeted Jest pattern. defaults to `--verify` when no validation flag is passed. verify, test, and runtime outcomes are written as evidence events.

```bash
bun run confirm
bun run confirm -- --verify --json
bun run confirm -- --runtime
bun run confirm -- --test packages/workspace/scripts/__tests__/example.test.js
```

---

### audit — script/docs/index drift

checks whether documented workspace scripts exist, whether undocumented workspace scripts have drifted in, whether markdown path references are still real, and whether the local exploration index is stale.

```bash
bun run audit
bun run audit -- --scripts
bun run audit -- --docs --json
bun run audit -- --index
```

---

### task:push — push changes to remote via github api

reads changed files from the task worktree and pushes them as a commit to the task branch via github api. never touches the local git state.

```bash
bun run task:push -- --branch task/dialer/fix-thing --message "fix(dialer): normalize phone numbers" --changed
bun run task:push -- --pr 213 --message "feat(dialer): add queue runner" --files packages/dialer/src/queue.ts packages/dialer/src/runner.ts
bun run task:push -- --branch task/dialer/fix-thing --message "fix: thing" --changed --approved --reason "Ko approved: reason"  # Ko-approved verify path
bun run task:push -- --branch task/dialer/fix-thing --json
```

**task:push failure modes**
```bash
bad: bun run task:push -- --changed
 → error: missing required --message
 (commit message is always required, in conventional format: type(scope): description)

bad: bun run task:push -- --message "fix: thing" --changed
 → error: no matching verify stamp
 (run bun run verify first)
```

---

### task:start — create task branch + worktree + PR

creates a new task branch, git worktree, and draft PR. the worktree is created under `$WORKSPACE_WORKTREE_ROOT`, `$OPENSAAS_WORKTREE_ROOT`, or the portable temp default `os.tmpdir()/opensaas-worktrees`.

```bash
bun run task:start -- --area dialer --title "normalize phone numbers"
bun run task:start -- --area dialer --title "queue runner" --start-from stream  # branch from stream
bun run task:start -- --area dialer --title "fix" --body-file /tmp/pr-body.md  # PR body from file
bun run task:start -- --json
```

**task:start failure modes**
```bash
bad: bun run task:start
 → error: missing required --area
 (--area and --title are both required)

bad: bun run task:start -- --area dialer --title "fix thing"
 → error: worktree already exists at <worktree-root>/task-dialer-fix-thing
 (check task metadata with: bun run task:fs -- --branch task/dialer/fix-thing read .task/dialer/fix-thing/current.json
  then run task:finish or task:cleanup when the old task is no longer active)
```

---

### task:pr — merge task→stream, create stream→main PR

default behavior: (1) ensure task PR exists for task/* → stream/, (2) merge that task PR into the stream branch, (3) create or refresh the review PR for stream/ → main.

```bash
bun run task:pr -- --branch task/dialer/fix-thing  # full flow: task→stream merge + stream→main PR
bun run task:pr -- --pr 213 --task-only        # only create/refresh the task→stream PR, don't merge
bun run task:pr -- --draft            # create stream→main PR as draft
bun run task:pr -- --ready            # convert existing draft to ready
bun run task:pr -- --body-template area  # generate area-context body template
bun run task:pr -- --json
```

**task:pr failure modes**
```bash
bad: bun run task:pr (with stale root task metadata)
 → error: task metadata belongs to branch X, but current branch is main
 (fix the metadata: bun run task:init -- --area <area> --branch <branch> --pr <N>)
```

---

### task:prs — show PR links for current task

shows both the task PR (task/* → stream/) and the review PR (stream/ → main).

```bash
bun run task:prs -- --branch task/dialer/fix-thing  # show PR links for exact task
bun run task:prs -- --pr 213 --json
```

---

### task:merge — merge a PR

```bash
bun run task:merge -- --pr 173        # merge PR #173
bun run task:merge -- --pr 173 --wait  # merge + wait for railway deploy
bun run task:merge -- --pr 173 --squash  # squash merge
bun run task:merge -- --json
```

---

### task:finish — verify merge, remove worktree, delete branch

```bash
bun run task:finish -- --branch task/dialer/fix-thing  # finish exact task
bun run task:finish -- --pr 213 --json
```

**task:finish failure modes**
```bash
bad: bun run task:finish (with stale root task metadata)
 → runs against stale metadata. may report "finished" for an old task.
 (fix the metadata first: bun run task:init -- --area <area> --branch <branch> --pr <N>)
```

---

### task:init — fix stale or missing task metadata

writes a fresh `.task/<area>/<slug>/current.json` for an existing worktree. does NOT create branches or worktrees — use `task:start` for that. use this when metadata is stale, wrong, or missing.

```bash
bun run task:init -- --area dialer --branch task/dialer/fix-thing --pr 173
bun run task:init -- --area dialer --branch task/dialer/fix-thing --pr 173 --worktree /private/tmp/opensaas-worktrees/task-dialer-fix-thing
bun run task:init -- --json
```

auto-detects the worktree path from `git worktree list` if `--worktree` is not passed.

---

### task:cleanup — remove stale worktrees, branches, and task sessions

```bash
bun run task:cleanup -- --preview     # preview worktrees, branches, and tmux sessions that would be removed
bun run task:cleanup -- --merged      # remove branches already merged
bun run task:cleanup -- --stale-days 7  # remove worktrees older than 7 days
bun run task:cleanup -- --force       # force removal
bun run task:cleanup -- --keep task/dialer/queue  # keep a specific branch
```

when cleanup removes a task worktree, it reads `.task/<area>/<slug>/session.json` and `.task/<area>/<slug>/current.json` before removal and closes only the tmux session explicitly tied to that task metadata. preview mode reports the tmux session that would be closed without touching tmux. if tmux is unavailable, the metadata is missing, or the session no longer exists, cleanup continues safely and reports the warning/status instead of broad-scanning tmux sessions.

---

### stream:list — list all stream branches

```bash
bun run stream:list                   # show all streams with status, divergence, warnings
```

---

### stream:sync — sync stream with latest main

syncs the stream branch with latest main, runs stream checks, and pushes the stream branch when checks pass.

```bash
bun run stream:sync -- --area dialer  # sync stream/dialer with main
bun run stream:sync -- --area workspace-agents
bun run stream:sync -- --json
```

**stream:sync failure modes**
```bash
bad: bun run stream:sync
 → error: missing required --area
 (--area is always required for stream commands)
```

---

### stream:context — show stream context

shows recent PRs, divergence from main, and current state of a stream.

```bash
bun run stream:context -- --area dialer
bun run stream:context -- --json
```

---

### pr-review — fetch all review comments from a PR

pulls inline comments, issue comments, and reviews from qodo, coderabbit, codex, ko, and humans. writes a structured file to `.task/<area>/<slug>/reviews/<pr>.md` with file attention map, action items, and task loop reminder.

```bash
bun run pr-review -- 173              # fetch reviews for PR #173
bun run pr-review                     # auto-detect PR from task-scoped current.json
bun run pr-review -- 173 --stdout     # print to stdout instead of file
bun run pr-review -- 173 --json
```

**pr-review helpers — full review-fix flow**
```bash
bun run pr-review -- <pr>             # 1. fetch reviews
bun run gh -- diff <pr>               # 2. see what changed
bun run gh -- files <pr>              # 3. list changed files
bun run gh -- read <path> --ref <branch>  # 4. read specific file from PR branch
bun run gh -- checks <pr>             # 5. check CI status
# 6. fix the issues via task:fs
bun run task:push -- --message "fix(scope): address review" --changed  # 7. push fixes
```

---

### ai-review — run the AI PR review helper

runs the local AI review helper for a PR. use `--no-post` when you need review output without publishing comments.

```bash
bun run ai-review -- 173
bun run ai-review -- 173 --no-post
bun run ai-review -- 173 --no-post --json
```

---

### gh — common github commands

wraps `gh` CLI with repo defaults (consuelohq/opensaas) and structured output. all commands auto-detect PR from task-scoped current metadata when no PR number is given.

```bash
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

```bash
bun run context -- search dialer      # search memories by content
bun run context -- search queue --category workpad  # filter by category
bun run context -- find "queue handoff"  # search by title
bun run context -- list workpad       # list recent workpad memories
bun run context -- list --limit 5     # list recent memories
bun run context -- save "dialer arch" ./notes.md  # save file as memory
bun run context -- categories         # list available categories
bun run context -- trace --status error --limit 20  # recent failed local tool traces
bun run context -- trace --trace-id trc_abc123 --raw # exact raw payload for one trace
```

`context trace` reads the local repo-scoped SQLite trace store at `~/Library/Application Support/OpenWorkspace/traces/<repo-hash>/traces.db` on macOS, or `~/.local/share/openworkspace/traces/<repo-hash>/traces.db` on other systems. Override with `OPENWORKSPACE_TRACE_DB` or `--db`. The server writes raw structured tool payloads into this local database after each workspace tool call and keeps the store under `OPENWORKSPACE_TRACE_DB_MAX_BYTES`, defaulting to 500 MB.

**context failure modes**
```text
bad: answering "what did we decide about X?" from memory alone
 → search first: bun run context -- search "X"
 (never answer architecture or decision questions without checking context first)
```

---

### linear — Linear GraphQL API wrapper

runs Linear GraphQL API operations using the workspace app actor token from `.agent/.chatgpt-token.json`. use the dedicated Linear connector first when available; use this script for repo-local workflow automation and debugging.

```bash
bun run linear -- issue DEV-123
bun run linear -- issues --search "browser facade"
bun run linear -- create "[task] add browser facade aliases" --description "markdown body"
bun run linear -- comment ISSUE-UUID "added browser facade aliases"
bun run linear -- query "{ viewer { id name } }"
```

---

### browser — test and interact with web pages

opens agent-browser with ko's authenticated profile at `/Users/kokayi/.agent-browser-ko`. use for production verification after deploys.

```bash
bun run browser -- consuelo                 # open consuelo CRM (internal)
bun run browser -- app                      # open app.consuelohq.com
bun run browser -- open https://example.com # open any URL
bun run browser -- open https://example.com --preset mobile --full
bun run browser -- open https://example.com --preset tablet --full
bun run browser -- open https://example.com --width 390 --height 844 --full
bun run browser -- screenshot after-login   # take screenshot
bun run browser -- screenshot mobile-check --preset mobile --full
bun run browser -- snapshot                 # get accessibility tree
bun run browser -- login consuelo --headed  # run saved login profile visibly
bun run browser -- reauth consuelo --headed # close daemon, restart profile, login
```

available browser flags for responsive checks: `preset` (`desktop`, `mobile`, `tablet`, `ipad`, `iphone`), `device` (agent-browser device name), `provider` (for example `ios`), `width` + `height`, and `colorScheme` (`dark`, `light`, `no-preference`). use flags on existing browser tools instead of adding device-specific tool names. for Google SSO persistence, open `https://accounts.google.com` with `--headed` and sign in manually; the persistent profile keeps the session.

facade aliases are also registered for agent use:

```bash
workspace browser.test '{"url":"https://example.com","preset":"mobile","full":true}'
workspace browser.consuelo '{"headed":true}'
workspace browser.login '{"name":"consuelo","headed":true}'
workspace browser.reauth '{"name":"consuelo","headed":true}'
workspace browser.snap
workspace browser.screenshot '{"name":"after-login","preset":"tablet","full":true}'
workspace browser.get '{"target":"title"}'
workspace browser.find '{"by":"role","value":"button","action":"click","name":"Submit"}'
workspace browser.wait '{"load":"networkidle"}'
workspace browser.download '{"ref":"@e1","path":"/tmp/download.bin"}'
workspace browser.tabs '{"action":"list"}'
workspace browser.cookies '{"action":"list"}'
workspace browser.network '{"args":["requests"]}'
workspace browser.dialog '{"action":"dismiss"}'
workspace browser.trace '{"action":"start"}'
workspace browser.clipboard '{"action":"read"}'
```


Typed browser aliases should cover repeated primitives. Use `workspace browser.raw '{"args":[...]}'` only when an upstream `agent-browser` command is not yet represented by a typed facade alias.

when Google or another provider requires password re-auth, use `browser.reauth` or `bun run browser -- reauth consuelo --headed`. this closes the active daemon first because `agent-browser` ignores new `--profile` flags while a daemon is already running.

---

### railway:logs — deploy observability

USE THIS OFTEN. this is how you get truth about what's happening in production. don't guess — read the logs.

```bash
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
bun run railway:redeploy -- --wait    # redeploy opensaas and wait for completion
bun run railway:redeploy -- --service twenty-worker --wait  # redeploy worker and wait
bun run railway:redeploy -- --all --wait  # redeploy opensaas + twenty-worker and wait
```

**railway failure modes**
```text
bad: "i think the deploy is broken" (guessing without checking)
 → run: bun run railway:logs -- --errors
 (always check logs before claiming something is broken)

bad: railway logs --service opensaas (raw CLI)
 → use: bun run railway:logs
 (the script adds noise filtering, formatting, and http log merging)
```

---

### railway:redeploy — trigger railway deploys

redeploys Railway services and can wait for completion. use this after merges when production needs a fresh deploy.

```bash
bun run railway:redeploy -- --wait
bun run railway:redeploy -- --service twenty-worker --wait
bun run railway:redeploy -- --all --wait
bun run railway:redeploy -- --json
```

---

### wait — sleep, detached checkpoints, or wait for deploy

```bash
bun run wait -- --detach --duration 24h --reason overnight    # create a non-blocking long wait
bun run wait -- --status wait_<id>                            # check whether a detached wait is complete
bun run wait -- --deploy                                      # wait for railway deploy to complete
```

---

### research:ingest — local research packet generator

wraps the `summarize` CLI to turn a video, podcast, paper, web page, or local media file into a reusable research packet.

outputs a run directory containing `packet.md`, `extracted.md`, `manifest.json`, `summary.json`, raw summarize stdout/stderr, and a `slides/` directory when visual extraction is enabled. after a successful ingest, it also saves a self-contained context entry containing the full text of `packet.md`, `extracted.md`, and `manifest.json`.

default output goes under the operating system temp directory returned by `os.tmpdir()` (for example `/var/folders/.../T/consuelo-research` on macOS), so extracted frames/slides are temporary and can be cleaned by the operating system. use `--keep` for `~/Documents/consuelo-research`, or `--out-dir` for an explicit durable location.

```bash
bun run research:ingest -- "https://example.com/podcast" --question "what should i learn?"
bun run research:ingest -- "https://youtu.be/example" --visual --slides-max 8
bun run research:ingest -- "paper.pdf" --keep
bun run research:ingest -- "https://example.com" --context-title "Research Bundle: example"
bun run research:ingest -- "https://example.com" --dry-run --json
```

context autosave is enabled by default. use `--no-context-save` only for local debugging or tests.

---

### tmp — exact temp file handling

writes exact content to temp files in opensaas-handoffs/. no trimming, no reformatting.

```bash
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

### workspace — typed facade CLI for the workspace MCP app

routes `workspace <tool.name> '<json-input>'` to the typed facade. this is the lower-level CLI used by the MCP `workspace.call` tool.

```bash
bun run workspace -- status
bun run workspace -- stream.context '{"area":"workspace-agents"}'
bun run workspace -- fs.read '{"path":"AGENTS.md"}'
bun run workspace -- batch '[{"tool":"status","input":{}}]'
```

inside the workspace MCP app, call the typed facade directly through `workspace.call`:

```ts
await workspace.call({
  tool: "stream.context",
  input: { area: "workspace-agents" },
  timeout: 120
})
```

---

### code-run — Bun-native code mode orchestration

Runs a short trusted-agent orchestration script over the typed workspace facade tools. Prefer this for multi-step workspace operations where several related reads, searches, task commands, validations, or small edits need to be coordinated in one pass.

```bash
bun run code-run -- '{"code":"return await workspace_call(\"status\", {})","maxOperations":25,"maxResultChars":20000}'
bun run code-run -- --input-file /tmp/code-run-input.json
printf '{"code":"return 1 + 1"}' | bun run code-run -- --stdin
```

Use `workspace_call("tool.name", input)` for generic facade calls, sanitized helpers like `fs_read` or `task_current`, and friendly aliases like `readFile`, `grep`, and `readDir`. Always pass `taskSession` when task work is involved. Use direct outer tool calls for final durable transitions such as push, PR, merge, deploy, and publish.


---

### code-call - staged language-specific code execution

Runs short Python, Bun, or Bash programs from a staged file instead of shell-escaped `-c` or heredoc transport. Use this for bounded calculations, parsers, and verification snippets that need language runtimes directly.

```bash
bun run code-call -- '{"language":"python","mode":"read","code":"print(1 + 1)"}'
bun run code-call -- --input-file /tmp/code-call-input.json
printf '{"language":"bash","mode":"verify","code":"printf ok"}' | bun run code-call -- --stdin
```

`mode=read` and `mode=verify` fail if repository files change. `mode=edit` is accepted by the schema but intentionally blocked until task-worktree mutation enforcement is implemented.

---

### github — typed GitHub facade

Preferred GitHub tool for agents. Use semantic operations and presets instead of constructing raw `gh` CLI arguments.

```bash
bun run github -- pr.view --pr 436 --preset review
bun run github -- pr.checks --pr 436
bun run github -- branch.compare --base main --head stream/workspace-agents
```

Use `raw` only when the typed operation is missing, and include `--reason` so the gap can become a future typed operation.

---

### tool-runner — run one typed workspace tool

runs a single manifest-backed workspace tool through the typed facade. stdout is always one standard JSON envelope. audit events and human logs go to stderr.

```bash
bun run tool-runner -- fs.read '{"branch":"task/workspace-agents/example","path":"packages/workspace/package.json"}'
bun run tool-runner -- context.categories '{}'
bun run tool-runner -- mac.list '{"path":"/tmp","depth":1}'
```

---

### tool-batch — run typed workspace tools in sequence

runs a JSON array of facade steps. dependent steps run sequentially. read-only steps marked with `parallel: true` can run together.

```bash
bun run tool-batch -- '[{"tool":"fs.read","input":{"branch":"task/workspace-agents/example","path":"packages/workspace/package.json"}}]'
bun run tool-batch -- --file /tmp/workspace-batch.json
```


---

### tools:search — search typed workspace tools by intent

searches the workspace tool manifest and generated docs, then returns ranked tool matches with signatures, example input, capability metadata, and usage guidance. use it when an agent knows what it is trying to do but does not know the exact workspace tool name.

```bash
bun run tools:search -- "linear issue" --limit 5 --json
bun run tools:search -- "github pr checks" --read-only --json
bun run tools:search -- "file search" --category filesystem --json
```

---


### sentry — inspect Sentry issues, events, and traces

Read-only JSON wrapper around the Sentry REST API. It reads configuration from macOS Keychain and never prints the auth token.

Required Keychain items:

```bash
security add-generic-password -U -a "$USER" -s "opensaas-sentry-auth-token" -w "YOUR_SENTRY_AUTH_TOKEN"
security add-generic-password -U -a "$USER" -s "opensaas-sentry-org-slug" -w "YOUR_SENTRY_ORG_SLUG"
security add-generic-password -U -a "$USER" -s "opensaas-sentry-base-url" -w "https://sentry.io"
```

Optional default project:

```bash
security add-generic-password -U -a "$USER" -s "opensaas-sentry-project-slug" -w "YOUR_DEFAULT_PROJECT_SLUG"
```

Examples:

```bash
bun run sentry -- config --verify
bun run sentry -- projects --limit 25
bun run sentry -- issues --query "is:unresolved" --limit 10
bun run sentry -- issue PROJECT-123
bun run sentry -- issue-event PROJECT-123 recommended --full
bun run sentry -- event 0123456789abcdef0123456789abcdef --project opensaas
bun run sentry -- trace 0123456789abcdef0123456789abcdef --limit 10
```

Typed facade examples:

```bash
workspace sentry.config '{"verify":true}'
workspace sentry.issues '{"query":"is:unresolved","limit":10}'
workspace sentry.issue '{"identifier":"PROJECT-123"}'
workspace sentry.issueEvent '{"issueId":"PROJECT-123","eventId":"recommended","full":true}'
workspace sentry.event '{"eventId":"0123456789abcdef0123456789abcdef","project":"opensaas"}'
workspace sentry.trace '{"traceId":"0123456789abcdef0123456789abcdef","limit":10}'
```

The `trace` command is best-effort. It queries organization events for `trace:<traceId>` and falls back to issue search with the same trace query. It returns every attempt in JSON so agents can see partial Sentry API coverage.

### generate-docs — generate typed tool documentation

generates `packages/workspace/TOOLS.md` from `packages/workspace/tooling/tool-manifest.json`.

```bash
bun run generate-docs
```

---

### generate-types — generate typed tool stubs

generates `packages/workspace/src/generated/workspace.d.ts` and `packages/workspace/src/generated/tool-client.ts` from the tool manifest.

```bash
bun run generate-types
```

---

### check-files — batch syntax check

runs `node --check` for each provided file through `task:exec`, returning structured per-file results.

```bash
bun run check-files -- --branch task/workspace-agents/example --files packages/workspace/scripts/fs.js --json
bun run check-files -- --branch task/workspace-agents/example --files packages/workspace/scripts/a.js packages/workspace/scripts/b.js --stop-on-first-error --json
```

---

### edit-flow — composed search-read-patch flow

runs a real script for search -> read -> patch -> read verification. this keeps multi-step editing orchestration outside the facade.

```bash
bun run edit-flow -- --branch task/workspace-agents/example --search-pattern "oldFn" --search-paths packages/workspace/scripts --from 10 --to 12 --content-file /tmp/new.ts --json
bun run edit-flow -- --branch task/workspace-agents/example --search-pattern "oldFn" --search-paths packages/workspace/scripts --from 10 --to 12 --content-file /tmp/new.ts --dry-run --json
```

---

### mac — non-repo mac operations

operates outside repo context. it does not do task branch resolution. use for local file, process, command, and port operations that are not scoped to opensaas.

```bash
bun run mac -- exec "pwd" --json
bun run mac -- read /tmp/some-file.txt --json
bun run mac -- write /tmp/output.txt --content "hello" --json
bun run mac -- search "pattern" /tmp --include "*.ts" --json
bun run mac -- list /tmp --depth 1 --json
bun run mac -- process list --json
bun run mac -- port find --json
```

---

### consuelo-reload — manage the workspace MCP server reload path

```bash
bun run consuelo-reload -- status      # check if running, show tools + pid
bun run consuelo-reload                # schedule safe async reload
bun run consuelo-reload -- reload      # explicit alias for the default reload
bun run consuelo-reload -- stop
bun run consuelo-reload -- start
bun run consuelo-reload -- logs        # tail /tmp/workspace.log
```

Legacy `bun run server -- restart` still works as an alias, but new docs and tooling should use `consuelo-reload`.

### server — legacy alias for consuelo-reload

```bash
bun run server -- status               # legacy alias for consuelo-reload status
bun run server -- restart              # legacy alias for safe async reload
```

Prefer `bun run consuelo-reload` for new usage.

---

### website:deploy — deploy consuelo website

```bash
bun run website:deploy                # build and deploy to cloudflare pages
bun run website:deploy -- --preview   # preview deploy (non-production url)
bun run website:deploy -- --build-only  # build only, don't deploy
```

---

### consuelo-design — run local design tooling

Publishes design artifacts into the generated Consuelo Wiki archive and manages the archive server used by the private tailnet and wiki tunnel.

The archive server serves the wiki index, generated search assets, and published artifact pages from the same origin. Keep this route contract aligned with design.publish and design.refresh.

```bash
bun run consuelo-design -- --help
bun run consuelo-design -- refresh --json
```

---
### doctor — workspace diagnostics

checks local workspace prerequisites, server health, git state, and related command availability.

```bash
bun run doctor
bun run doctor -- --json
```

---

### status — workspace status summary

prints a compact status view for the current branch, task metadata, workspace scripts, and deploy health.

```bash
bun run status
bun run status -- --json
```

---

### task-meta:smoke — metadata resolver smoke test

runs the task metadata conflict-resolution smoke suite.

```bash
bun run task-meta:smoke
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
```text
bad: python replace script says "expected block not found"
 → the old string has different whitespace than the file. read the exact range with
   bun run fs -- read <file> --from <N> --to <M> --plain and copy it character-for-character.
   watch for trailing newlines, tab/space mismatches, and invisible unicode characters.
 (always read the target range with --plain before writing the old string in your script)
```

## sub-agents

use the local pi proxy for small, bounded sub-agent calls from scripts. this is for one-shot help: cleanup, summarization, classification, drafting, or asking a narrow question. it is not a replacement for the task lifecycle, repo search, or verification.

run from repo root:

```bash
bun run agent -- "say hello world"
bun run agent -- --google/gemma-4-31b-it "summarize this error in one sentence: ..."
cat /tmp/input.txt | bun run agent -- "clean this transcript"
```

**rules**
- keep prompts narrow and explicit
- pass the model as `--provider/model` only when you need to override the default
- use `bun run agent --` from `/Users/kokayi/Dev/opensaas`; do not call the pi proxy directly from random scripts unless the script owns that integration
- treat sub-agent output as a draft until verified against files, tests, or logs
- never send secrets, api keys, auth tokens, customer pii, full phone numbers, or private credentials
- do not let sub-agents mutate repo files directly; write changes through workspace scripts (`fs`, `task:fs`, `task:exec`) and verify after writes

**good vs bad**

```text
good: bun run agent -- "turn this raw error into a concise summary: "
-> bounded, no secrets, human can verify

good: bun run agent -- --google/gemma-4-31b-it "clean this transcript but preserve meaning: "
-> explicit model override and explicit transformation

bad: bun run agent -- "fix the repo"
-> too broad. no area, files, command, or acceptance criteria

bad: bun run agent -- "here is the production api key: ... now debug this"
-> never send secrets to a model

bad: bun run agent -- "edit packages/foo/src/bar.ts to make tests pass"
-> sub-agent output is text only. use task:fs/task:exec for repo mutations and verify the diff
```

**failure modes**

| symptom | fix |
|---------|-----|
| `Script not found "agent"` | you're not in `/Users/kokayi/Dev/opensaas`, or `package.json` is missing this script |
| request is slow | retry once; nvidia free api can land on slower capacity |
| model output is too formal | tighten the prompt: "preserve casual tone, do not formalize" |
| model hallucinates repo facts | ignore it and read files/logs; sub-agents do not replace evidence |

---

## rules that apply everywhere

### stream conflicts

when resolving stream merge conflicts, stop and ask ko unless every conflict is in metadata files (`.task/<area>/<slug>/current.json`, `.task/<area>/<slug>/workpad.md`, or legacy root `.task/current.json` / `.task/workpad.md`). metadata-only conflicts are resolved by choosing the metadata for the current stream/task when possible, then the newest valid task metadata. the matching workpad follows the selected task branch. code/docs conflicts still need human judgment.

### task metadata smoke check

run this after changing task metadata selection or conflict behavior:

```bash
bun run task-meta:smoke
```

it verifies stale metadata is ignored, metadata-only conflicts are resolvable, and mixed metadata + real file conflicts still block.

### SCRIPTS.md is part of the fix

always reread SCRIPTS.md when adding or changing scripts. if you add a new script or change behavior, update SCRIPTS.md in the same commit. missing docs are part of the fix, not cleanup for later.

---

## Design publish

`design.publish` publishes a local design artifact URL, file, directory, or named `portless` service through private Tailscale Serve. It uses one persistent private tailnet host and a unique per-artifact path. It does not use Tailscale Funnel or create a public internet URL.

Recommended Open Design target name: `design.localhost`.

```bash
bun run consuelo-design publish --portless-name design.localhost --path "/daily-deep-idea/2026-05-12-prospect-theory"
bun run consuelo-design publish --target "/tmp/research/packet.md" --path "/research-packet/2026-05-12-prospect-theory/packet"
bun run consuelo-design publish --portless-name design.localhost --category daily-deep-idea --name prospect-theory
bun run consuelo-design publish --portless-name design.localhost --path "/daily-deep-idea/example" --dry-run --json
```

Use this after an Open Design workflow creates or opens an artifact. For daily lessons, publish the digital e-guide project as `/daily-deep-idea/<date>-<slug>` and optionally publish the source packet as `/research-packet/<date>-<slug>/packet`.

---

## CLI tools — fallbacks only

these are installed globally. do not use them if a `bun run` script exists for the same operation. if you ran `--help` on the relevant script and it covers your use case, use the script. ko does not want raw CLI tools used when scripts are available.

the scripts wrap these tools with sane defaults, exclusions, and logging. using the raw tools skips all of that.

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

```text
bad: rg "pattern" packages/
 → use: bun run fs -- search "pattern" packages/

bad: cat packages/dialer/src/queue.ts
 → use: bun run fs -- read packages/dialer/src/queue.ts

bad: cd /private/tmp/opensaas-worktrees/task-dialer && rg "TODO" packages/
 → use: bun run task:fs -- --branch task/dialer/fix-thing search "TODO" packages/
```

---

## script file paths section removed — run `bun run fs -- list packages/workspace/scripts/` to see current files.

## Linear facade

Linear uses `packages/workspace/scripts/linear.js` as the source wrapper and typed facade entries in `tooling/tool-manifest.json`.

Required workflow for issue creation:

1. Search first with `workspace linear.search '{"search":"<title keywords>"}'` to avoid duplicates.
2. Create with `workspace linear.createIssue '{"title":"[task] description","description":"...","labels":["[task]","opensaas"]}'`.
3. Use DEV by default. Pass `team:"growth"` only when Ko explicitly asks for non-engineering work.
4. Every issue must include one bracket type label and one repository label. The wrapper defaults to the bracket type detected from the title plus `opensaas`; pass labels explicitly when creating non-default repository work.
5. Use `linear.labels`, `linear.teams`, `linear.projects`, and `linear.states` to discover ids instead of guessing.

Typed commands:

- `linear.search` — search or list issues, DEV scoped by default when listing.
- `linear.issue` — read one issue by identifier or id.
- `linear.createIssue` — create an issue with `team`, `title`, `description`, `state`, `labels`, `assignee`, `priority`, `project`, `cycle`, and `parent`.
- `linear.updateIssue` — update title, description, state, labels, assignee, priority, project, cycle, or parent.
- `linear.labels` — list labels for type/repository consistency.
- `linear.teams` — list teams and states.
- `linear.projects` — list projects for project attachment.
- `linear.states` — list workflow states for a team.

Examples:

```bash
workspace linear.search '{"search":"workspace facade linear"}'
workspace linear.createIssue '{"title":"[bug] Workspace facade lacks Linear wrapper","labels":["[bug]","opensaas"]}'
workspace linear.updateIssue '{"issueId":"DEV-123","parent":"<parent-issue-id>"}'
workspace linear.projects '{"first":50}'
```

---

## consuelo design e-guide templates

Use `consueloDesign.generateDigitalEguide` or `bun run consuelo-design generate digital-eguide` for HTML e-guide artifacts. The workflow stays one command; `--template` is an optional routing hint for the artifact structure.

```bash
bun run consuelo-design generate digital-eguide --template research --name "Daily Deep Idea" --prompt "Create the lesson guide..."
bun run consuelo-design generate digital-eguide --template spec --name "Workspace agent spec" --prompt "Create the spec..."
bun run consuelo-design generate digital-eguide --template plan --name "Execution plan" --prompt "Create the plan..."
```

Typed facade equivalent:

```ts
await workspace.call({
  tool: "consueloDesign.generateDigitalEguide",
  input: { name: "Workspace agent spec", template: "spec", prompt: "Create the spec..." },
  timeout: 600,
})
```

Template names are `research`, `spec`, and `plan`. The selected template is injected into the pending Open Design prompt from `packages/consuelo-design/templates/digital-eguides/` and stored in project metadata. Do not add new facade commands for template variants.


## Design wiki archive

Every `design.publish` call records the published artifact in the private design wiki. Pass `--name` for the human-readable artifact title and `--template <research|spec|plan>` when the artifact is a templated e-guide so the wiki can filter it correctly. Artifacts under `/website/...` also appear under the top-level Website filter. The wiki is automatically regenerated and published at `/design-wiki`, sorted by `updatedAt` so republished artifacts return to the top.

`design.publish` also rebuilds the Pagefind search bundle for the managed archive. Search stays inside the same text-card wiki UI: the top search control reveals an inline search input, results update as Ko types, and matching cards keep the same title/date/path presentation as the normal archive list.

The publish path is durable. `design.publish` materializes local file or directory targets under the Open Design archive before registering the route, then points Tailscale Serve at the managed archive server. This avoids macOS path-serving restrictions and avoids per-artifact temporary servers. The wiki and every archived artifact are served by the same tailnet archive server.





### git:diff — structured git diff for agents

Structured, bounded diff inspection for agents. Prefer this over raw `git diff` through `task.call`; legacy `task.exec` remains supported for existing prompts and tools.

```bash
bun run git:diff -- --branch task/workspace-agents/example --base origin/main --stat --files --hunks --json
bun run git:diff -- --patch --max-bytes 20000 --json
```

Default behavior:

- no `base`/`head`: reads the current working-tree diff
- `base` without `head`: compares `base...HEAD`
- no output flags: returns `stat`, `files`, and `hunks`
- `patch` must be requested explicitly and is bounded by `maxBytes`



## Workpad readiness gate

Task workpads have agent-owned context and workspace-owned evidence. Workspace tooling updates human-readable files changed, files read, activity, validation, TDD evidence, and test-selection sections from existing task metadata, file operations, and validation tool output. Agents still need to write the agent-owned task intent and `Test-first contract` sections before publishing.

`task.push` and `task.pr` block scaffold-only workpads with a `Workpad update needed before publishing` message. Update the scoped workpad with what changed, why it changed, validation run, and issues or follow-ups, then rerun the command.

Use `tddPhase: "red" | "green" | "post"` on task-scoped command validation when a focused test run should be copied into the corresponding workspace-owned TDD evidence section.

Use `--ack-workpad-incomplete` only for emergency repair tasks or when Ko explicitly approved publishing without a complete workpad.

## trace:home — OpenTUI trace homebase

`trace:home` opens a full-screen OpenTUI dashboard over the local workspace trace SQLite store. Use it when `trace:watch` is too compact and Ko needs a homebase view with live rows, nested `batch` / `code.run` children, summary panels, top tools by tokens, raw-shell command-quality counts, selected trace inspection, a tree pane, and compact sanitized JSON.

```bash
bun run trace:home
bun run trace:home -- --once --limit 40 --no-color
bun run trace:home -- --trace-id trc_example --limit 100
```

Live mode uses OpenTUI alternate-screen rendering, so it updates in place rather than printing repeated dashboards into scrollback. `--once` keeps deterministic text output for tests and CI. The default JSON/inspect views sanitize wrapper internals; use `--raw-json` only when raw selected-row payloads are explicitly needed.

Use `trace:watch` for the lightweight live receipt stream. Use `trace:home` for inspection and command-quality triage. `trace:home` classifies both `task.call` and `task.exec` rows as `good`, `suspect`, or `bad`; `suspect` usually means shell-based repo inspection that should have used `fs.read`, `fs.search`, or `git.diff`, while `good` includes intended package, test, and runtime commands.


## consuelo-core registry audits

`packages/consuelo-core` owns the shared migration registry for workspace, OS, and future Consuelo packages. Use it before copying or moving scripts/helpers between `packages/workspace` and `packages/os`.

```bash
bun --cwd packages/consuelo-core audit:registry
bun --cwd packages/consuelo-core drift:registry
bun --cwd packages/consuelo-core test tests/registry.test.ts
```

`audit:registry` checks root/workspace/OS script targets, local script imports, and workspace-owned source guardrails. `drift:registry` prints JSON for duplicate workspace/OS script paths with hashes and ownership hints; it is informational unless a follow-up task promotes a duplicate into shared core.

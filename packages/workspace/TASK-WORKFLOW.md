# task workflow

the workspace uses a stream/task branching model. every code change flows through three steps:

```
task:start → task:push → task:pr
```

the branch structure is always:

```
main
 └── stream/<area>                    ← long-lived area branch
      └── task/<area>/<slug>          ← short-lived task branch + worktree
```

the PR you review is always `stream/<area> → main`. the task→stream merge happens automatically inside `task:pr`. agents never create PRs manually — the scripts handle routing, metadata, and cleanup.

## the rules

- every task starts with `task:start`. no manual worktrees, no manual branches.
- `.task-meta.json` is the source of truth. `task:push` and `task:pr` require it — they reject if it's missing.
- `task:push` can be called multiple times. `task:pr` is called once when the work is done.
- worktrees are ephemeral. clean them up after the PR is merged.

---

## step 1: `task:start` — create the task

creates a remote task branch, a local worktree, a draft PR targeting the stream, and writes `.task-meta.json` with all the context downstream scripts need.

- requires `--area` and `--title`
- creates `stream/<area>` on remote if it doesn't exist (forked from main)
- creates `task/<area>/<slug>` from main (or stream via `--start-from stream`)
- creates a git worktree at `/private/tmp/opensaas-worktrees/task-<area>-<slug>`
- opens a draft PR: `task/<area>/<slug> → stream/<area>`
- writes `.task-meta.json` in the worktree
- rejects if the worktree path already exists
- verifies the draft PR targets the stream, not main

```bash
bun run task:start -- --area dialer --title "queue runner handoff"
```

on success, it prints next steps:

```
cd /private/tmp/opensaas-worktrees/task-dialer-queue-runner-handoff
# make your changes
bun run task:push -- --message "fix(dialer): description" --changed
bun run task:pr
```

### options

| flag | description |
|------|-------------|
| `--area <value>` | stream area (required) |
| `--title <value>` | task title, used for branch slug and PR title (required) |
| `--stream <branch>` | override stream branch (default: `stream/<area>`) |
| `--start-from <mode>` | `main` or `stream` — where to fork the task from (default: `main`) |
| `--branch <name>` | override task branch name |
| `--worktree-root <dir>` | override worktree root directory |
| `--json` | machine-readable output |

---

## step 2: `task:push` — publish changes to the remote task branch

pushes changed files from the current task worktree to the correct remote task branch via github api. no local `git push` — everything goes through the github api for safety.

- reads `.task-meta.json` to resolve branch context (rejects if missing)
- validates `task/<area>/<slug>` naming
- verifies the current worktree matches the task metadata
- rejects pushes from `main` or `stream/*` branches
- validates conventional commit message format
- supports `--changed`, `--files`, or `--files-json`
- includes deleted tracked files when using `--changed`

can be called multiple times before promoting.

```bash
bun run task:push -- --message "fix(dialer): tune queue scoring" --changed
```

### options

| flag | description |
|------|-------------|
| `--message <text>` | commit message in conventional format (required) |
| `--changed` | push all tracked changes from the worktree |
| `--files <paths...>` | explicit file paths to push |
| `--files-json <json>` | JSON array of `{path, content, deleted?}` objects |
| `--branch <name>` | override task branch |
| `--cwd <dir>` | base directory for file paths |
| `--json` | machine-readable output |

---

## step 3: `task:pr` — promote task work through the stream to main

handles the full promotion flow in one step: ensures the task→stream PR exists, merges it, then creates or refreshes the stream→main review PR.

- reads `.task-meta.json` to resolve context (rejects if missing)
- defaults base to the stream branch, not main
- auto-merges the task→stream PR
- creates or reuses the `stream/<area> → main` review PR
- auto-generates title as `Stream/<area>` when `--title` is omitted
- reuses existing PRs cleanly (updates title/body if changed)

the PR you review is always `stream/<area> → main`.

```bash
bun run task:pr
```

### options

| flag | description |
|------|-------------|
| `--title <value>` | review PR title (default: `Stream/<area>`) |
| `--body <text>` | review PR body |
| `--body-file <path>` | review PR body from file |
| `--body-template area` | auto-generate body from area docs |
| `--task-only` | stop after creating task→stream PR, don't merge or create review PR |
| `--draft` | keep review PR as draft (default) |
| `--ready` | mark review PR ready for review |
| `--json` | machine-readable output |

---

## cleanup: `task:cleanup` — remove merged/stale task worktrees

explicit and safe. preview first, then remove merged or stale task worktrees. preserves main, all `stream/*` branches, snapshot branches, and the current worktree.

- skips task branches with open PRs
- removes worktree first, branch second, then prunes worktree metadata
- local-only — does not delete remote branches

```bash
# preview what would be cleaned
bun run task:cleanup -- --preview

# remove merged tasks older than 3 days
bun run task:cleanup -- --merged --stale-days 3
```

### options

| flag | description |
|------|-------------|
| `--preview` | show what would be removed without removing anything |
| `--merged` | remove task branches that have been merged |
| `--stale-days <n>` | remove task branches with no commits in n days |
| `--force` | skip confirmation |
| `--keep <branch>` | preserve specific branches (repeatable) |
| `--json` | machine-readable output |

---

## the complete flow

```bash
# 1. start the task
bun run task:start -- --area dialer --title "queue runner handoff"

# 2. cd into the worktree and work
cd /private/tmp/opensaas-worktrees/task-dialer-queue-runner-handoff

# 3. push changes (repeatable)
bun run task:push -- --message "fix(dialer): decouple queue session start" --changed

# 4. promote to stream and create review PR
bun run task:pr

# 5. ko reviews stream/dialer → main on github

# 6. cleanup after merge
bun run task:cleanup -- --merged
```

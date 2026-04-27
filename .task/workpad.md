# tighten exact task command selection

branch: `task/workspace-agents/tighten-exact-task-command-selection`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/210
started: 2026-04-27

## acceptance criteria

- [x] start from stream/workspace-agents using a fresh task branch.
- [x] read AGENTS.md, CODING-STANDARDS.md, and SCRIPTS.md before editing.
- [x] add exact --branch and --pr selection to task:fs.
- [x] add exact --branch and --pr selection to task:exec.
- [x] make same-area ambiguity fail instead of selecting the first matching task.
- [x] document the exact-task selection rule in SCRIPTS.md and STEERING.md.
- [x] cover selector behavior in the metadata smoke script.
- [x] verify without cd-ing into a worktree.

## plan

1. add shared task selection helper for area/branch/pr filters.
2. wire task:fs and task:exec to the helper.
3. update smoke coverage and docs.
4. run node checks, smoke, review/verify, and push to stream.

## files changed

- `packages/workspace/SCRIPTS.md`
- `packages/workspace/STEERING.md`
- `packages/workspace/scripts/lib/task-selection.js`
- `packages/workspace/scripts/task-exec.js`
- `packages/workspace/scripts/task-fs.js`
- `packages/workspace/scripts/task-meta-smoke.js`

## key decisions

- `--area` remains supported, but if it matches more than one active task it now fails and asks for `--branch` or `--pr`.
- `--branch` is the preferred selector for exact worktree targeting because it cannot collide across tasks.
- the selector lives in `lib/task-selection.js` so task:fs and task:exec do not drift.
- task:exec/task:fs now use `spawnSync` instead of shell-joined command strings to avoid quoting bugs.

## notes for ko

- no `cd` into the task worktree was needed for verification; commands used exact `--branch` or `--pr` selection.
- `task:fs -- --area workspace-agents ...` now fails when multiple workspace-agent tasks are active and tells the agent to use `--branch` or `--pr`.
- `task:fs -- --branch task/workspace-agents/tighten-exact-task-command-selection ...` resolves this task exactly.
- `task:exec -- --pr 210 git branch --show-current` resolves this task exactly.
- `node packages/workspace/scripts/review.js` reports YOUR CHANGES clean; the remaining nonzero exit is the known/pre-existing `openworkspace` no-typecheck-target issue.
- `node packages/workspace/scripts/verify.js --no-review --no-stamp --json` passed db guardrails.

## improvements noticed

- future alignment task: replace python edit examples with a bun-powered multi-file edit helper.

## errors i ran into

- the prior task #209 was accidentally merged empty after a bad shell command substitution expanded markdown backticks; this task #210 contains the actual implementation.
- root `stream:sync` is still stale until workspace-agents lands on main; i used the already-merged stream version of `stream-sync` to auto-resolve metadata-only stream sync before starting #210.

---

## publish checklist

```bash
bun run task:push -- --message "fix(workspace-agents): tighten exact task command selection" --changed
bun run task:pr
bun run task:finish
```

- 2026-04-27 04:31:37 write: `.task/workpad.md`
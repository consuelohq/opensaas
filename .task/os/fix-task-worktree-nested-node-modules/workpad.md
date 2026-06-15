# fix task worktree nested node modules

branch: `task/os/fix-task-worktree-nested-node-modules`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1027/fix-task-worktree-nested-node-modules
github pr: https://github.com/consuelohq/opensaas/pull/1027
started: 2026-06-13

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/lib/task-node-modules.js`
- `packages/workspace/scripts/review.js`
- `packages/workspace/scripts/task-start.js`
- `packages/workspace/tests/task-node-modules.test.js`

## workspace-owned: files changed

- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/lib/task-node-modules.js`
- `packages/workspace/scripts/review.js`
- `packages/workspace/scripts/task-start.js`
- `packages/workspace/tests/task-node-modules.test.js`

## workspace-owned: activity log

- 2026-06-13 23:43:06 fs.write: `packages/workspace/scripts/lib/task-node-modules.js`
- 2026-06-13 23:43:52 fs.patch: `packages/workspace/scripts/task-start.js`
- 2026-06-13 23:44:41 fs.patch: `packages/workspace/scripts/task-start.js`
- 2026-06-13 23:45:25 fs.patch: `packages/workspace/scripts/task-start.js`
- 2026-06-13 23:45:53 fs.patch: `packages/workspace/scripts/review.js`
- 2026-06-13 23:46:52 fs.patch: `packages/workspace/scripts/review.js`
- 2026-06-13 23:47:06 fs.patch: `packages/workspace/scripts/review.js`
- 2026-06-13 23:47:49 fs.patch: `packages/workspace/scripts/review.js`
- 2026-06-13 23:48:10 fs.write: `packages/workspace/tests/task-node-modules.test.js`
- 2026-06-13 23:55:16 fs.patch: `packages/workspace/scripts/review.js`
- 2026-06-13 23:55:50 fs.patch: `packages/workspace/SCRIPTS.md`

## workspace-owned: validation evidence

- 2026-06-13 23:56:39 `checkFiles`: passed — OK
- 2026-06-13 23:59:05 `review.run`: passed — OK
- 2026-06-13 23:59:29 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/workspace/SCRIPTS.md`
- `packages/workspace/package.json`
- `packages/workspace/scripts/review.js`
- `packages/workspace/scripts/task-start.js`
- `packages/workspace/tests/task-session.test.js`

- 2026-06-13 23:55:16 patch lines 879-879: `packages/workspace/scripts/review.js`

- 2026-06-13 23:55:50 patch lines 5-7: `packages/workspace/SCRIPTS.md`

## workspace-owned: test selection

- changed files: `.task/os/fix-task-worktree-nested-node-modules/current.json`, `.task/os/fix-task-worktree-nested-node-modules/evidence-log.json`, `.task/os/fix-task-worktree-nested-node-modules/read-log.json`, `.task/os/fix-task-worktree-nested-node-modules/session.json`, `.task/os/fix-task-worktree-nested-node-modules/workpad.md`, `.task/tasks/os/fix-task-worktree-nested-node-modules.json`, `packages/workspace/SCRIPTS.md`, `packages/workspace/scripts/lib/task-node-modules.js`, `packages/workspace/scripts/review.js`, `packages/workspace/scripts/task-start.js`, `packages/workspace/tests/task-node-modules.test.js`
- matched rules: `workspace-publish-gate`, `workspace-task-session`, `workspace-audit-docs`
- selected suites: `workspace verification stamp tests`, `workspace task session tests`, `workspace audit tests`
- run results: `workspace verification stamp tests` passed, `workspace task session tests` passed, `workspace audit tests` passed
- failed suites: none

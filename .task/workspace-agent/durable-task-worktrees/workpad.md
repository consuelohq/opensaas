# durable task worktrees

branch: `task/workspace-agent/durable-task-worktrees`
stream: `stream/workspace-agent`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2001/durable-task-worktrees
github pr: https://github.com/consuelohq/opensaas/pull/2001
started: 2026-08-15

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/task-session.js`
- `packages/os/tests/facade/facade.test.ts`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/scripts/lib/task-session.js`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/tests/task-session.test.js`


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-15 03:22:13 `review.run`: passed — OK
- 2026-08-15 03:23:21 `verify`: failed — COMMAND_FAILED
- 2026-08-15 03:33:31 `checkFiles`: passed — OK
- 2026-08-15 03:34:00 `review.run`: passed — OK
- 2026-08-15 03:35:08 `verify`: failed — COMMAND_FAILED

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
bun run task:push -- --message "type(workspace-agent): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract
x

## workspace-owned: files read

- `packages/workspace/senior-engineer.md`

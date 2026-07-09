# fix task exec long command transport

branch: `task/workspace-agents/fix-task-exec-long-command-transport`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/471/fix-task-exec-long-command-transport
github pr: https://github.com/consuelohq/opensaas/pull/471
started: 2026-05-23

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-05-23 02:22:07 patch lines 64-94: `packages/workspace/scripts/task-exec.js`
- 2026-05-23 02:22:29 patch lines 49-118: `packages/workspace/scripts/task-exec.js`
- 2026-05-23 02:23:01 write: `packages/workspace/scripts/task-exec.js`
- 2026-05-23 02:24:33 patch lines 47-47: `packages/workspace/scripts/task-exec.js`
- 2026-05-23 02:24:56 write: `packages/workspace/scripts/task-exec.js`
- 2026-05-23 02:25:17 patch lines 43-43: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-05-23 02:25:32 patch lines 35-45: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-05-23 02:25:55 patch lines 50-51: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-05-23 02:26:09 patch lines 690-702: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-05-23 02:26:22 patch lines 680-714: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-05-23 02:26:46 patch lines 679-679: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-05-23 02:27:53 patch lines 39-41: `packages/workspace/scripts/lib/facade/executor.ts`
# namespace task metadata by task path

branch: `task/workspace-agents/namespace-task-metadata-by-task-path`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/440/namespace-task-metadata-by-task-path
github pr: https://github.com/consuelohq/opensaas/pull/440
started: 2026-05-21

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

- 2026-05-21 18:43:36 write: `packages/workspace/scripts/lib/task-meta.js`
- 2026-05-21 18:45:59 write: `packages/workspace/scripts/lib/facade/branch-resolver.ts`
- 2026-05-21 18:47:50 patch lines 463-488: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-05-21 18:48:55 patch lines 380-380: `packages/workspace/scripts/lib/facade/executor.ts`
# add code run workspace namespace helpers

branch: `task/workspace-agents/add-code-run-workspace-namespace-helpers`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/441/add-code-run-workspace-namespace-helpers
github pr: https://github.com/consuelohq/opensaas/pull/441
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

- 2026-05-21 19:05:44 write: `packages/workspace/scripts/lib/codemode/types.ts`
- 2026-05-21 19:06:17 write: `packages/workspace/scripts/lib/codemode/executor.ts`
- 2026-05-21 19:06:46 write: `packages/workspace/scripts/lib/codemode/tools/index.ts`
- 2026-05-21 19:07:10 write: `packages/workspace/tests/codemode.test.ts`
- 2026-05-21 19:08:05 write: `packages/workspace/SCRIPTS.md`
- 2026-05-21 19:09:04 write: `packages/workspace/scripts/lib/codemode/executor.ts`
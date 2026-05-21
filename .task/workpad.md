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

- `packages/workspace/SCRIPTS.md`
- `packages/workspace/STEERING.md`
- `packages/workspace/scripts/code-run.ts`
- `packages/workspace/scripts/lib/codemode/executor.ts`
- `packages/workspace/scripts/lib/codemode/tools/index.ts`
- `packages/workspace/scripts/lib/codemode/types.ts`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/tests/codemode.test.ts`
- `packages/workspace/tests/facade/__snapshots__/facade.test.ts.snap`
- `packages/workspace/tooling/tool-manifest.json`


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
- 2026-05-21 18:54:45 patch lines 92-93: `packages/workspace/scripts/task-meta-smoke.js`
- 2026-05-21 19:03:28 patch lines 110-110: `packages/workspace/SCRIPTS.md`
- 2026-05-21 19:04:46 patch lines 529-529: `packages/workspace/SCRIPTS.md`
- 2026-05-21 19:08:55 patch lines 557-557: `packages/workspace/STEERING.md`
- 2026-05-21 19:09:56 patch lines 556-557: `packages/workspace/STEERING.md`
- 2026-05-21 19:13:09 patch lines 724-728: `packages/workspace/STEERING.md`
- 2026-05-21 19:15:26 patch lines 723-729: `packages/workspace/STEERING.md`
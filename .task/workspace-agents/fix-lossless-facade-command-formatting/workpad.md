# fix lossless facade command formatting

branch: `task/workspace-agents/fix-lossless-facade-command-formatting`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/473/fix-lossless-facade-command-formatting
github pr: https://github.com/consuelohq/opensaas/pull/473
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

- 2026-05-23 02:48:17 patch lines 224-226: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-05-23 02:48:36 patch lines 212-231: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-05-23 02:49:36 patch lines 678-696: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-05-23 02:49:49 write: `packages/workspace/scripts/lib/facade/executor.ts`
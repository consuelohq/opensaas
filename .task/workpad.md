# fix code run workspace tooling orchestration

branch: `task/workspace-agents/fix-code-run-workspace-tooling-orchestration`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/429/fix-code-run-workspace-tooling-orchestration
github pr: https://github.com/consuelohq/opensaas/pull/429
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

- 2026-05-21 08:20:23 write: `packages/workspace/scripts/lib/codemode/tools/index.ts`
- 2026-05-21 08:24:05 write: `.task/code-run-smoke.txt`
# harden code run bun orchestration

branch: `task/workspace-agents/harden-code-run-bun-orchestration`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/439/harden-code-run-bun-orchestration
github pr: https://github.com/consuelohq/opensaas/pull/439
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

- 2026-05-21 09:48:58 write: `packages/workspace/scripts/lib/codemode/executor.ts`
- 2026-05-21 09:49:32 write: `packages/workspace/scripts/code-run.ts`
- 2026-05-21 09:51:12 write: `packages/workspace/tests/codemode.test.ts`
- 2026-05-21 17:52:04 write: `packages/workspace/SCRIPTS.md`
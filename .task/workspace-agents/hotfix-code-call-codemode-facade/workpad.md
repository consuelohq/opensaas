# hotfix code call codemode facade

branch: `task/workspace-agents/hotfix-code-call-codemode-facade`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/889/hotfix-code-call-codemode-facade
github pr: https://github.com/consuelohq/opensaas/pull/889
started: 2026-06-09

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/workspace/scripts/lib/codemode/tools/index.ts`
- `packages/workspace/scripts/lib/codemode/types.ts`

## workspace-owned: files changed

- `packages/workspace/scripts/lib/codemode/tools/index.ts`
- `packages/workspace/scripts/lib/codemode/types.ts`

## workspace-owned: activity log

- 2026-06-09 21:28:36 fs.write: `packages/workspace/scripts/lib/codemode/types.ts`
- 2026-06-09 21:28:50 fs.write: `packages/workspace/scripts/lib/codemode/tools/index.ts`

## workspace-owned: validation evidence

- 2026-06-09 21:29:50 `checkFiles`: passed — OK

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
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/workspace/scripts/code-run.ts`
- `packages/workspace/scripts/lib/codemode/executor.ts`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/scripts/lib/facade/types.ts`
- `packages/workspace/tests/codemode.test.ts`

- 2026-06-09 21:28:36 write: `packages/workspace/scripts/lib/codemode/types.ts`

- 2026-06-09 21:28:50 write: `packages/workspace/scripts/lib/codemode/tools/index.ts`

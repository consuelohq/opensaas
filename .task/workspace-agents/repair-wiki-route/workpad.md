# repair wiki route

branch: `task/workspace-agents/repair-wiki-route`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/634/repair-wiki-route
github pr: https://github.com/consuelohq/opensaas/pull/634
started: 2026-05-28

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/consuelo-design.ts`

## workspace-owned: files changed

- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/consuelo-design.ts`

## workspace-owned: activity log

- 2026-05-29 00:02:27 fs.write: `packages/workspace/scripts/consuelo-design.ts`
- 2026-05-29 00:07:32 fs.patch: `packages/workspace/SCRIPTS.md`
- 2026-05-29 00:08:12 fs.patch: `packages/workspace/SCRIPTS.md`

## workspace-owned: validation evidence

- 2026-05-29 00:05:50 `checkFiles`: passed — OK
- 2026-05-29 00:08:28 `checkFiles`: passed — OK
- 2026-05-29 00:08:45 `audit`: passed — OK
- 2026-05-29 00:09:16 `review.run`: passed — OK
- 2026-05-29 00:09:32 `verify`: passed — OK
- 2026-05-29 00:09:44 `verify`: passed — OK

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

- 2026-05-29 00:02:27 write: `packages/workspace/scripts/consuelo-design.ts`

- 2026-05-29 00:07:32 patch lines 1198-1204: `packages/workspace/SCRIPTS.md`

- 2026-05-29 00:08:12 patch lines 1208-1208: `packages/workspace/SCRIPTS.md`

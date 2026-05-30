# ship list person ids

branch: `task/dialer/ship-list-person-ids`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/535/ship-list-person-ids
github pr: https://github.com/consuelohq/opensaas/pull/535
started: 2026-05-23

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/twenty-front/src/modules/dialer/hooks/useOpportunityQueueWorkspace.ts`

## workspace-owned: files changed

- `packages/twenty-front/src/modules/dialer/hooks/useOpportunityQueueWorkspace.ts`

## workspace-owned: activity log

- 2026-05-23 19:14:17 fs.patch: `packages/twenty-front/src/modules/dialer/hooks/useOpportunityQueueWorkspace.ts`
- 2026-05-23 19:14:40 fs.patch: `packages/twenty-front/src/modules/dialer/hooks/useOpportunityQueueWorkspace.ts`

## workspace-owned: validation evidence

- 2026-05-23 19:16:41 `verify`: failed — COMMAND_FAILED
- 2026-05-23 19:17:18 `verify`: failed — COMMAND_FAILED

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
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-05-23 19:14:17 patch lines 625-625: `packages/twenty-front/src/modules/dialer/hooks/useOpportunityQueueWorkspace.ts`

- 2026-05-23 19:14:40 patch lines 664-664: `packages/twenty-front/src/modules/dialer/hooks/useOpportunityQueueWorkspace.ts`

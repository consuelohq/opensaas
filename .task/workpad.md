# fix queue runtime id hydration

branch: `task/dialer/fix-queue-runtime-id-hydration`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/416/fix-queue-runtime-id-hydration
github pr: https://github.com/consuelohq/opensaas/pull/416
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
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-05-21 03:28:26 patch lines 31-31: `packages/twenty-front/src/modules/dialer/hooks/useParallelDialer.ts`
- 2026-05-21 03:28:51 patch lines 19-34: `packages/twenty-front/src/modules/dialer/hooks/useParallelDialer.ts`
- 2026-05-21 03:29:01 patch lines 75-75: `packages/twenty-front/src/modules/dialer/hooks/useParallelDialer.ts`
- 2026-05-21 03:29:27 patch lines 75-77: `packages/twenty-front/src/modules/dialer/hooks/useParallelDialer.ts`
- 2026-05-21 03:29:40 patch lines 90-90: `packages/twenty-front/src/modules/dialer/hooks/useParallelDialer.ts`
- 2026-05-21 03:29:44 patch lines 1258-1258: `packages/twenty-front/src/modules/dialer/hooks/useOpportunityQueueWorkspace.ts`
- 2026-05-21 03:29:57 patch lines 1258-1258: `packages/twenty-front/src/modules/dialer/hooks/useOpportunityQueueWorkspace.ts`
- 2026-05-21 03:30:04 patch lines 1279-1279: `packages/twenty-front/src/modules/dialer/hooks/useOpportunityQueueWorkspace.ts`
- 2026-05-21 03:30:38 patch lines 1273-1297: `packages/twenty-front/src/modules/dialer/hooks/useOpportunityQueueWorkspace.ts`
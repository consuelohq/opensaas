# fix queue id

branch: `task/dialer/fix-queue-id`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/413/fix-queue-id
github pr: https://github.com/consuelohq/opensaas/pull/413
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

- 2026-05-21 01:37:25 patch lines 82-88: `packages/twenty-front/src/modules/dialer/hooks/useParallelDialer.ts`
- 2026-05-21 01:37:30 patch lines 103-103: `packages/twenty-front/src/modules/dialer/hooks/useParallelDialer.ts`
- 2026-05-21 01:37:46 patch lines 100-105: `packages/twenty-front/src/modules/dialer/hooks/useParallelDialer.ts`
- 2026-05-21 01:37:50 patch lines 157-157: `packages/twenty-front/src/modules/dialer/hooks/useParallelDialer.ts`
- 2026-05-21 01:38:15 patch lines 157-157: `packages/twenty-front/src/modules/dialer/hooks/useParallelDialer.ts`
- 2026-05-21 01:38:48 patch lines 160-160: `packages/twenty-front/src/modules/dialer/hooks/useParallelDialer.ts`
- 2026-05-21 01:38:55 patch lines 69-69: `packages/twenty-front/src/modules/dialer/hooks/__tests__/useParallelDialer.test.ts`
- 2026-05-21 01:39:00 patch lines 136-136: `packages/twenty-front/src/modules/dialer/hooks/__tests__/useParallelDialer.test.ts`
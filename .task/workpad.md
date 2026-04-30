# fix batch facade logging policy

branch: `task/workspace-agents/fix-batch-facade-logging-policy`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/229
started: 2026-04-30

## acceptance criteria

- [ ]

## plan

1.

## files changed

-

## key decisions

-

## notes for ko

-

## improvements noticed

-

## errors i ran into

-

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-04-30 07:41:13 patch lines 108-119: `packages/workspace/scripts/lib/facade/types.ts`
- 2026-04-30 07:41:25 patch lines 106-126: `packages/workspace/scripts/lib/facade/types.ts`
- 2026-04-30 07:41:44 patch lines 89-96: `packages/workspace/scripts/lib/facade/batch.ts`
- 2026-04-30 07:42:00 patch lines 83-94: `packages/workspace/scripts/lib/facade/batch.ts`
- 2026-04-30 07:42:07 patch lines 558-590: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-04-30 07:42:20 patch lines 553-585: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-04-30 07:42:58 patch lines 71-71: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-04-30 07:43:19 patch lines 86-86: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-04-30 07:43:24 patch lines 101-101: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-04-30 07:43:28 patch lines 129-129: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-04-30 07:43:32 patch lines 150-150: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-04-30 07:43:37 patch lines 168-168: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-04-30 07:43:49 patch lines 185-185: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-04-30 07:43:56 patch lines 195-195: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-04-30 07:43:59 patch lines 211-211: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-04-30 07:44:04 patch lines 225-225: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-04-30 07:44:10 patch lines 275-275: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-04-30 07:44:14 patch lines 297-297: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-04-30 07:44:18 patch lines 311-311: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-04-30 07:44:32 patch lines 333-333: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-04-30 07:44:36 patch lines 365-365: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-04-30 07:44:42 patch lines 378-378: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-04-30 07:45:11 patch lines 1-2: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-04-30 07:45:17 patch lines 31-46: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-04-30 07:45:50 patch lines 177-177: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-04-30 07:46:24 patch lines 163-221: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-04-30 07:46:36 patch lines 222-222: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-04-30 07:46:45 patch lines 222-224: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-04-30 07:47:27 patch lines 546-548: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-04-30 07:47:42 patch lines 542-563: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-04-30 07:48:00 patch lines 540-543: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-04-30 07:48:11 patch lines 544-546: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-04-30 07:48:52 patch lines 547-555: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-04-30 07:51:07 patch lines 1-55: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-04-30 07:51:26 patch lines 1-63: `packages/workspace/scripts/lib/facade/executor.ts`
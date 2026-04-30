# fix task pin to persist to disk

branch: `task/workspace-agents/fix-task-pin-to-persist-to-disk`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/233
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

- 2026-04-30 09:03:07 patch lines 2-2: `packages/workspace/scripts/lib/facade/executor.ts`
- 2026-04-30 09:03:25 patch lines 306-306: `packages/workspace/scripts/lib/facade/executor.ts`
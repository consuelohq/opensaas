# test review pipeline in worktree

branch: `task/workspace-agents/test-review-pipeline-in-worktree`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/230
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

- 2026-04-30 08:52:27 patch lines 427-427: `packages/workspace/scripts/task-start.js`
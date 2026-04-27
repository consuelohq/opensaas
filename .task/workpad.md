# verify task metadata automation

branch: `task/workspace-agents/verify-task-metadata-automation`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/208
started: 2026-04-27

## acceptance criteria

- [x] start from updated stream/workspace-agents after PR #206 merged into stream.
- [x] run `node packages/workspace/scripts/task-meta-smoke.js` from the new task worktree.
- [x] run status and doctor from the new task worktree and confirm task metadata is not stale.
- [ ] push this validation-only task PR and stop before merging.


## plan

1. verify the metadata smoke script exists on the updated stream.
2. run smoke, status, and doctor from this fresh task.
3. push validation notes to the task PR and stop.


## files changed

- 

## key decisions

- this task intentionally changes only the workpad; it validates that the prior task's tooling is present and usable when starting a fresh task from stream/workspace-agents.


## notes for ko

- `node packages/workspace/scripts/task-meta-smoke.js` passed.
- `node packages/workspace/scripts/status.js --json` reported `staleTask: null` and PR #208 as the active task PR.
- `node packages/workspace/scripts/doctor.js --json` reported metadata branch ok with zero failures.
- stream PR #207 remains open; this validation task PR is #208.


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

# root task publish selection

branch: `task/workspace-agents/root-task-publish-selection`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/213
started: 2026-04-27

## acceptance criteria

- [x] reproduce root task:push failure with --branch from main.
- [x] add root-level --area/--branch/--pr selection to task:push.
- [x] add root-level --area/--branch/--pr selection to task:pr.
- [x] add root-level --area/--branch/--pr selection to task:finish.
- [x] update SCRIPTS.md examples to use exact root commands.
- [x] add root-level --area/--branch/--pr selection to task:prs.
- [x] fix task-finish review harness error-handling finding.
- [ ] verify exact root publish loop, merge to main, update local main.


## plan

1. test the desired root-level command shape first.
2. route publish/promote/finish scripts through the same task-selection helper used by task:fs/task:exec.
3. update docs and smoke checks.
4. run verify, push with root task:push --branch, promote with root task:pr --branch, merge review pr, update local main.


## files changed

- packages/workspace/scripts/task-push.js
- packages/workspace/scripts/task-pr.js
- packages/workspace/scripts/task-finish.js
- packages/workspace/scripts/task-prs.js
- packages/workspace/SCRIPTS.md
- .task/workpad.md


## key decisions

- task:push/task:pr/task:finish should be callable from repo root with the exact same selector style as task:fs/task:exec.
- --area is still allowed but intentionally fails when multiple tasks match.


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

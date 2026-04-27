# verify root publish commands

branch: `task/workspace-agents/verify-root-publish-commands`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/215
started: 2026-04-27

## acceptance criteria

- [x] start from synced stream/workspace-agents after root publish selection landed on main.
- [x] make a validation-only workpad change using root task:fs --branch.
- [ ] run verify from root using task:exec --branch.
- [ ] push using root task:push --branch.
- [ ] inspect prs using root task:prs --branch.
- [ ] promote using root task:pr --branch.
- [ ] merge stream review pr to main, update local main, and finish using root task:finish --branch.

## plan

1. use only repo-root task commands for the publish/promote loop.
2. verify the branch selector works without cd or bun --cwd.
3. merge the validation stream pr to main and fast-forward local main.

## files changed

- .task/workpad.md

## key decisions

- this task intentionally changes only task metadata/workpad content to validate the workflow.

## notes for ko

- this is the command-shape validation task for root-level task:push/task:pr/task:prs/task:finish.

## improvements noticed

- 

## errors i ran into

- 

- 2026-04-27 06:33:46 write: `.task/workpad.md`
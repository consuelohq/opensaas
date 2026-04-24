# doctor status script audit

branch: `task/workspace-agents/doctor-status-script-audit`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/183
started: 2026-04-24

## acceptance criteria

- [x] add workspace doctor command that checks repo, task metadata, stream sync, local tooling, github auth, railway access, workspace server health, and agent-browser availability
- [x] add workspace status command that summarizes active task state, prs, changes, verification stamp, railway deploy, and next command
- [x] ensure task-push ignores task-start node_modules symlink when using --changed
- [x] wire commands into root package scripts and verify syntax/runtime

## plan

1. inspect workspace script patterns and task metadata behavior
2. add shared workspace-state helpers for safe spawned commands and repo state reads
3. implement doctor/status commands and package script aliases
4. fix changed-file detection so node_modules symlink is ignored
5. run syntax checks, command smoke tests, review, push, promote, and finish

## files changed

- `package.json`
- `packages/workspace/scripts/lib/git.js`
- `packages/workspace/scripts/doctor.js`
- `packages/workspace/scripts/lib/workspace-state.js`
- `packages/workspace/scripts/status.js`


## key decisions

- reused commonjs and process stdout/stderr patterns already used by workspace scripts; no new dependencies.
- treated unavailable external tools as warnings in doctor unless they corrupt task metadata or repo identity.
- filtered node_modules in changed-file detection because task:start creates a local symlink that should never be pushed.

## notes for ko

- doctor/status are intentionally lightweight harness commands; they do not mutate repo state except origin fetch.

## improvements noticed

- 

## errors i ran into

- initial generated file write corrupted one script line; fixed by switching to smaller writes and node --check after each script.
- `bun run review` reported repo-wide api/dialer/twenty-server test failures, but the review summary marked `YOUR CHANGES` clean and `PRE-EXISTING` clean. syntax checks and command smoke tests passed for this task.

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

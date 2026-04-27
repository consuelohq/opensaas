# address workspace agents review comments

branch: `task/workspace-agents/address-workspace-agents-review-comments`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/211
started: 2026-04-27

## acceptance criteria

- [x] fetch PR #207 review comments and identify five actionable items.
- [x] start fresh task from stream/workspace-agents.
- [x] fix stream-sync temporary worktree cleanup on post-resolution failure.
- [x] make task-meta smoke compatible with older git init behavior.
- [x] cover findTaskMeta stale/includeStale behavior in smoke tests.
- [x] pass taskBranch into metadata conflict smoke resolution.
- [x] preserve original GitHub merge errors and only attempt metadata recovery for merge-conflict failures.
- [x] fix pre-existing task-pr review harness error-handling findings.
- [x] add an openworkspace typecheck target backed by script syntax checks.
- [ ] verify, push, merge task into stream, then merge stream PR to main.


## plan

1. read AGENTS/CODING/SCRIPTS and relevant workspace scripts.
2. patch stream-sync, task-meta-smoke, and task-pr.
3. run node checks and task-meta smoke.
4. review/verify, push to task PR, promote into stream PR #207.
5. merge #207 to main, update local main, test workflow, fix any fallout.


## files changed

- packages/workspace/scripts/stream-sync.js
- packages/workspace/scripts/task-meta-smoke.js
- packages/workspace/scripts/task-pr.js
- packages/workspace/project.json
- packages/workspace/scripts/check-syntax.js
- .task/workpad.md


## key decisions

- GitHub merge recovery should be narrow: only run metadata-recovery for 405 merge-conflict failures, and preserve original error details.
- stream-sync temporary worktrees should be cleaned in finally blocks after successful merge/check paths.
- openworkspace typecheck should be explicit; node syntax checks are the right target for the JS workspace scripts package.


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

- 2026-04-27 05:29:17 write: `packages/workspace/scripts/check-syntax.js`
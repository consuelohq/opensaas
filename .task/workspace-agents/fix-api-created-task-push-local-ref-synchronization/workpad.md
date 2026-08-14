# fix API-created task push local ref synchronization

branch: `task/workspace-agents/fix-api-created-task-push-local-ref-synchronization`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1847/fix-api-created-task-push-local-ref-synchronization
github pr: https://github.com/consuelohq/opensaas/pull/1847
started: 2026-08-11

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-11 23:22:38 fs.write: `.task/workspace-agents/fix-api-created-task-push-local-ref-synchronization/workpad.md`
- 2026-08-11 23:28:08 fs.write: `.task/workspace-agents/fix-api-created-task-push-local-ref-synchronization/workpad.md`

## workspace-owned: validation evidence

- 2026-08-11 23:27:15 `review.run`: passed — OK
- 2026-08-11 23:27:50 `review.run`: passed — OK
- 2026-08-11 23:28:01 `verify`: passed — OK
- 2026-08-11 23:28:14 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

- Behavior under test: after task.push creates a commit through the GitHub API, local synchronization must first materialize that remote-only commit object locally, then advance the checked-out task branch and origin tracking ref without losing working-tree edits.
- Existing local pattern: packages/workspace/tests/task-push-local-sync.test.ts and mirrored OS/workspace git helpers.
- New or changed tests: replace the locally-created fake API commit with a commit that exists only in a remote repository before synchronization; assert synchronization succeeds and both refs resolve to that fetched commit.
- Focused red command: run the task-push local-sync regression only.
- Expected red failure: current synchronizeApiPushedTaskBranch attempts update-ref/reset before the remote-only nextSha exists in the local object database, producing a nonexistent-object failure.
- No-test waiver: none.

- 2026-08-11 23:22:38 append: `.task/workspace-agents/fix-api-created-task-push-local-ref-synchronization/workpad.md`

- 2026-08-11 23:23:36 apply-patch: `packages/workspace/tests/task-push-local-sync.test.ts`
- 2026-08-11 23:23:36 apply-patch: `packages/os/tests/task-push-local-sync.test.ts`
- 2026-08-11 23:23:57 apply-patch: `packages/os/scripts/lib/git.js`
- 2026-08-11 23:23:57 apply-patch: `packages/workspace/scripts/lib/git.js`

## Review-fix evidence

- Codex P1 reproduced exactly with a remote-only commit: both OS and workspace regression tests failed before the fix with `trying to write ref ... with nonexistent object`.
- Fix: fetch `refs/heads/<task>` into the origin tracking ref, verify the fetched SHA equals the API-created SHA, then mixed-reset the checked-out task branch. The remote tracking ref remains remote truth if local reset fails.
- Focused green: `packages/workspace/tests/task-push-local-sync.test.ts` 1/1 passed and `packages/os/tests/task-push-local-sync.test.ts` 1/1 passed.
- Strict review: 4 changed files, 0 new issues, 0 blocking issues.
- Full verify: passed with publishValid=true before this workpad evidence update; rerun verify after this append to refresh the publish stamp.

- 2026-08-11 23:28:08 append: `.task/workspace-agents/fix-api-created-task-push-local-ref-synchronization/workpad.md`

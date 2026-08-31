# preflight explicit-file task push refs before GitHub mutation

branch: `task/workspace-agents/preflight-explicit-file-task-push-refs-before-github-mutation`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1848/preflight-explicit-file-task-push-refs-before-github-mutation
github pr: https://github.com/consuelohq/opensaas/pull/1848
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

- 2026-08-11 23:34:41 fs.write: `.task/workspace-agents/preflight-explicit-file-task-push-refs-before-github-mutation/workpad.md`
- 2026-08-11 23:36:24 fs.write: `.task/workspace-agents/preflight-explicit-file-task-push-refs-before-github-mutation/workpad.md`

## workspace-owned: validation evidence

- 2026-08-11 23:36:50 `review.run`: passed — OK
- 2026-08-11 23:37:11 `review.run`: passed — OK
- 2026-08-11 23:37:23 `verify`: passed — OK

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

- Behavior under test: every task.push mode, including --files and --files-json, must fetch and validate the local task branch plus origin tracking ref against the GitHub branch head before creating blobs/trees/commits or updating the GitHub branch.
- Existing local pattern: task-push local synchronization regression plus task-push session/contract tests.
- New or changed tests: reproduce a stale origin tracking ref on an explicit-file-style path; prove preflight repairs tracking state when local branch matches GitHub, and rejects a stale local branch before any publish mutation. Add ordering assertion that preflight occurs before GitHub write calls in both OS and workspace task-push scripts.
- Focused red command: run task-push local synchronization/preflight tests only.
- Expected red failure: no general pre-mutation preflight exists; explicit-file pushes skip assertChangedBranchIsSynced and can fail only after updateBranchRef.
- No-test waiver: none.

- 2026-08-11 23:34:41 append: `.task/workspace-agents/preflight-explicit-file-task-push-refs-before-github-mutation/workpad.md`

- 2026-08-11 23:35:17 apply-patch: `packages/workspace/tests/task-push-local-sync.test.ts`
- 2026-08-11 23:35:17 apply-patch: `packages/os/tests/task-push-local-sync.test.ts`
- 2026-08-11 23:35:52 apply-patch: `packages/workspace/scripts/lib/git.js`
- 2026-08-11 23:35:52 apply-patch: `packages/os/scripts/lib/git.js`
- 2026-08-11 23:35:52 apply-patch: `packages/workspace/scripts/task-push.js`
- 2026-08-11 23:35:52 apply-patch: `packages/os/scripts/task-push.js`
## P2 review-fix evidence

- Exact Codex comment: explicit --files/--files-json pushes skipped the old changed-only sync guard, so stale local tracking refs could cause failure only after updateBranchRef had already mutated GitHub. Codex requested fetch/validation before GitHub mutation in both workspace and OS helpers.
- Red: both local-sync suites had 3 focused failures (missing general preflight helper plus missing pre-write ordering) while the prior P1 remote-only commit regression stayed green.
- Fix: `assertApiPushBaseIsSynced` now fetches origin, validates fetched origin/<task> against the just-read GitHub head, validates the checked-out local task ref, and fails before any GitHub write. task-push calls it for every file mode immediately after getBranchRef; the old --changed-only guard was removed.
- Green: workspace task-push suites 5/5 passed; OS local-sync suite 4/4 passed.
- Diff: 6 production/test files changed across mirrored OS/workspace paths; no unrelated source changes.

- 2026-08-11 23:36:24 append: `.task/workspace-agents/preflight-explicit-file-task-push-refs-before-github-mutation/workpad.md`

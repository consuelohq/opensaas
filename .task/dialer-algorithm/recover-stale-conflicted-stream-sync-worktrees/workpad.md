# recover stale conflicted stream sync worktrees

branch: `task/dialer-algorithm/recover-stale-conflicted-stream-sync-worktrees`
stream: `stream/dialer-algorithm`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2103/recover-stale-conflicted-stream-sync-worktrees
github pr: https://github.com/consuelohq/opensaas/pull/2103
started: 2026-08-16

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

- 2026-08-16 02:43:54 fs.write: `.task/dialer-algorithm/recover-stale-conflicted-stream-sync-worktrees/workpad.md`

## workspace-owned: validation evidence

- 2026-08-16 02:45:49 `review.run`: passed — OK
- 2026-08-16 02:46:03 `verify`: passed — OK
- 2026-08-16 02:46:24 `verify`: passed — OK

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
bun run task:push -- --message "type(dialer-algorithm): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: if the registered worktree for a stream is one of `stream.sync`'s managed `*-sync-*` temporary worktrees and it still has unresolved merge conflicts from an earlier failed sync, a new `stream.sync` invocation must remove that stale temp registration/path and continue from a fresh temporary worktree. It must not remove clean temp worktrees or any non-temp/pre-existing stream worktree.
existing local pattern: `stream.sync` already creates temp paths under `getWorktreeRoot()` with `${toWorktreeDirectoryName(streamBranch)}-sync-`; current startup blindly reuses any registered worktree and `ensureWorktreeClean` therefore fails on an orphaned conflict.
new or changed tests: add a real temporary-Git integration case that manually creates a managed sync-temp worktree for the stream, leaves it in a merge-conflict state, invokes `stream.sync`, and asserts the stale path is removed/reported while the real source conflict is still returned fail-closed from a fresh temp sync.
focused red command: run only the new stale conflicted sync worktree recovery test.
expected red failure: current `stream.sync` exits before JSON conflict output because `ensureWorktreeClean` rejects the stale conflicted worktree.
no-test waiver: not applicable.

## Acceptance criteria
- [x] only managed `*-sync-*` stream temp worktrees with unresolved conflicts are auto-recovered.
- [x] recovered stale temp path is reported in sync result for evidence.
- [x] real source conflict still fails closed after recovery.
- [x] all stream-sync integration tests pass.
- [x] strict review + canonical verify are green before promotion.

## Final validation
- RED: stale managed sync worktree with unresolved merge conflicts caused `stream.sync` to exit before JSON output.
- GREEN: stream-sync integration 4/4 passed, including stale conflicted temp recovery and source-conflict fail-closed behavior.
- macOS `/var` vs `/private/var` aliasing is normalized with `realpathSync.native` before managed-root containment checks.
- strict review: 0 issues / 0 blockers.
- canonical verify: `publishValid: true`, 0 DB risks/findings.

- 2026-08-16 02:43:54 append: `.task/dialer-algorithm/recover-stale-conflicted-stream-sync-worktrees/workpad.md`

- 2026-08-16 02:44:04 apply-patch: `packages/workspace/tests/stream-sync-generated-registry-conflict.test.js`
- 2026-08-16 02:44:23 apply-patch: `packages/workspace/scripts/stream-sync.js`

## workspace-owned: files read

- `packages/workspace/scripts/lib/paths.js`

- 2026-08-16 02:44:47 apply-patch: `packages/workspace/scripts/stream-sync.js`
- 2026-08-16 02:45:01 apply-patch: `packages/workspace/tests/stream-sync-generated-registry-conflict.test.js`
- 2026-08-16 02:45:16 apply-patch: `packages/workspace/tests/stream-sync-generated-registry-conflict.test.js`

- 2026-08-16 02:46:13 apply-patch: `.task/dialer-algorithm/recover-stale-conflicted-stream-sync-worktrees/workpad.md`

# clean temporary stream sync worktrees after conflicts

branch: `task/dialer-algorithm/clean-temporary-stream-sync-worktrees-after-conflicts`
stream: `stream/dialer-algorithm`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2101/clean-temporary-stream-sync-worktrees-after-conflicts
github pr: https://github.com/consuelohq/opensaas/pull/2101
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

- 2026-08-16 02:40:33 fs.write: `.task/dialer-algorithm/clean-temporary-stream-sync-worktrees-after-conflicts/workpad.md`

## workspace-owned: validation evidence

- 2026-08-16 02:41:35 `review.run`: passed — OK
- 2026-08-16 02:41:52 `verify`: passed — OK
- 2026-08-16 02:42:13 `verify`: passed — OK

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

behavior under test: when `stream.sync` creates a temporary sync worktree and the merge ends in an unresolved real conflict, the command must report the conflict and remove that temporary worktree before returning; it must never delete a pre-existing stream worktree.
existing local pattern: successful sync and auto-resolved metadata/generated-registry paths already remove temporary worktrees in `finally`; only the terminal unresolved-conflict path currently leaks them.
new or changed tests: extend the real temporary-Git mixed-conflict integration case to assert the returned temporary worktree path no longer exists after the failed sync.
focused red command: run only `fails closed when a non-generated source conflict is also present` in `stream-sync-generated-registry-conflict.test.js`.
expected red failure: current sync returns `status: conflict` but leaves `payload.worktreePath` on disk and registered as the stream worktree.
no-test waiver: not applicable.

## Acceptance criteria
- [x] unresolved conflict still returns status/paths fail-closed.
- [x] temporary sync worktree is removed before return on unresolved conflict.
- [x] success/generated-registry recovery behavior remains unchanged.
- [x] focused stream-sync tests and strict review pass.
- [x] publish/verify green before promotion.

## Final validation
- RED: unresolved-conflict integration proved the temporary worktree still existed after `stream.sync` returned.
- GREEN: stream-sync focused contracts 3/3 passed; mixed/source conflict still reports conflict while the temporary worktree path is removed.
- strict review: 0 issues / 0 blockers.
- canonical verify: `publishValid: true`, 0 DB risks/findings.
- typed cleanup preview confirmed `task.cleanup` intentionally refuses stream branches, so this stream-sync lifecycle fix is the durable cleanup path for future sync conflicts.

- 2026-08-16 02:40:33 append: `.task/dialer-algorithm/clean-temporary-stream-sync-worktrees-after-conflicts/workpad.md`

- 2026-08-16 02:40:40 apply-patch: `packages/workspace/tests/stream-sync-generated-registry-conflict.test.js`

## workspace-owned: files read

- `packages/workspace/scripts/stream-sync.js`

- 2026-08-16 02:41:02 apply-patch: `packages/workspace/scripts/stream-sync.js`

- 2026-08-16 02:42:02 apply-patch: `.task/dialer-algorithm/clean-temporary-stream-sync-worktrees-after-conflicts/workpad.md`

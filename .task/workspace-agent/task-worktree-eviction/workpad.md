# Task worktree eviction

branch: `task/workspace-agent/task-worktree-eviction`
stream: `stream/workspace-agent`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2006/task-worktree-eviction
github pr: https://github.com/consuelohq/opensaas/pull/2006
started: 2026-08-15

## acceptance criteria

- [x] Track task inactivity with durable `lastActiveAt` metadata rather than task creation time.
- [x] Evict inactive clean task worktrees without deleting the task branch or durable task identity.
- [x] Before evicting dirty, untracked, or locally-ahead work, create and verify a recovery bundle that preserves the unique task state.
- [x] If recovery archive creation or verification fails, leave the worktree untouched.
- [x] Recover an evicted task automatically from durable registry metadata, restoring archived work and recreating tmux state.
- [x] `task.finish` terminates the task tmux session and removes task worktree/local branch plus no-longer-needed durable recovery state after merge.
- [x] Current/recent task worktrees are never evicted; inactivity GC is based on activity age, not a fixed clock time.
- [x] Existing task worktree-root overrides and pre-existing active temp worktrees remain compatible.

## plan

1. Extend durable task registry metadata with activity/status/repository/recovery fields and a touch helper.
2. Add a Git-native recovery archive helper using an alternate index + synthetic checkpoint commit + verified incremental bundle without moving the task branch or touching its real index.
3. Change stale cleanup into reversible worktree eviction: terminate tmux, archive unique state when needed, remove only the worktree, and retain task identity/branch.
4. Extend durable task recovery to recreate an evicted worktree and reapply the verified checkpoint before recreating tmux.
5. Make `task.finish` the authoritative final cleanup path for tmux, worktree, branch, registry, and obsolete recovery archives.
6. Wire activity touching and safe inactivity GC, then run focused + selected lifecycle validation and strict review.

## current status

- Dependency PR #2001 was merged into this task after task.start initially created the branch from `main` instead of the requested stream.
- Reversible eviction/recovery, inactivity leases, automatic facade recovery, final task cleanup, OS/runtime parity, hourly supervisor scheduling, runtime packaging, docs, and focused test-selection ownership are implemented.
- Critical selected validation, strict review, and formal verify are green. The task is publish-ready.

## files changed

- `packages/os/SCRIPTS.md`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/task-registry.js`
- `packages/os/scripts/lib/task-session.js`
- `packages/os/scripts/server/supervisor.ts`
- `packages/os/scripts/task-cleanup.js`
- `packages/os/scripts/task-finish.js`
- `packages/os/scripts/task-start.js`
- `packages/os/tests/distribution/runtime-bundle.test.ts`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/scripts/lib/task-registry.js`
- `packages/workspace/scripts/lib/task-session.js`
- `packages/workspace/scripts/task-cleanup.js`
- `packages/workspace/scripts/task-finish.js`
- `packages/workspace/scripts/task-start.js`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/task-session.test.js`
- `packages/os/scripts/lib/task-worktree-eviction.js`
- `packages/os/scripts/lib/task-worktree-gc-scheduler.ts`
- `packages/os/scripts/lib/task-worktree-gc.js`
- `packages/os/scripts/task-worktree-gc.js`
- `packages/os/tests/task-worktree-gc-scheduler.test.ts`
- `packages/workspace/scripts/lib/task-worktree-eviction.js`
- `packages/workspace/scripts/lib/task-worktree-gc.js`
- `packages/workspace/tests/task-worktree-eviction.test.ts`


## workspace-owned: files changed

- `packages/os/scripts/lib/task-worktree-gc-scheduler.ts`
- `packages/os/scripts/task-worktree-gc.js`
- `packages/os/tests/task-worktree-gc-scheduler.test.ts`
- `packages/workspace/scripts/lib/task-worktree-eviction.js`
- `packages/workspace/scripts/lib/task-worktree-gc.js`
- `packages/workspace/tests/task-worktree-eviction.test.ts`

## workspace-owned: activity log

- 2026-08-15 03:57:21 fs.write: `packages/workspace/tests/task-worktree-eviction.test.ts`
- 2026-08-15 03:59:11 fs.write: `packages/workspace/scripts/lib/task-worktree-eviction.js`
- 2026-08-15 04:01:46 fs.write: `packages/workspace/scripts/lib/task-worktree-gc.js`
- 2026-08-15 04:08:21 fs.write: `packages/os/scripts/lib/task-worktree-gc-scheduler.ts`
- 2026-08-15 04:08:29 fs.write: `packages/os/scripts/task-worktree-gc.js`
- 2026-08-15 04:09:25 fs.write: `packages/os/tests/task-worktree-gc-scheduler.test.ts`

## workspace-owned: validation evidence

- RED: initial focused run failed because `task-worktree-eviction.js` did not exist; later RED cases proved bundle tampering and eviction/recovery races were initially unguarded.
- GREEN: focused eviction/durable-session/scheduler set reached 26/26.
- GREEN: runtime bundle distribution contract 20/20 and explicitly contains the GC CLI, eviction helper, GC helper, and scheduler.
- GREEN: regenerated test selector ran 14 selected suites with 0 failures, including workspace facade, task-session, eviction/recovery, OS work-session compatibility, runtime bundle, lifecycle, server selector, and workflow policy contracts.
- GREEN: strict review against `origin/stream/workspace-agent` reports 0 task issues and 0 blockers after fixing the supervisor async error-normalization boundary.
- GREEN: formal `verify` is `publishValid: true`; review passed, DB guard reports 0 risks/findings, and the verify stamp was written for this task/change hash.
- Script parity audit remains globally stale on the stream (baseline inventory 395 vs current inventory 504); this branch did not rewrite that unrelated 100+ entry baseline.
- 2026-08-15 04:16:32 `review.run`: passed — OK
- 2026-08-15 04:17:09 `review.run`: passed — OK
- 2026-08-15 04:17:48 `verify`: passed — OK
- 2026-08-15 04:18:32 `verify`: passed — OK

## key decisions

- Eviction is reversible and must not mean task completion: keep the task branch and durable registry entry, mark it `evicted`, and restore on next session use.
- Use a temporary Git index and synthetic checkpoint commit exported to an incremental `git bundle`; do not use shared `refs/stash` and do not auto-commit WIP onto the real task branch.
- Preserve tracked working-tree contents plus non-ignored untracked files; ignored/cache/build files are intentionally not recovery state.
- A failed archive/verify step is fail-closed: never remove the worktree.
- `lastActiveAt`, not `createdAt`, is the GC lease.

## Test-first contract

behavior under test: inactive task worktrees can be evicted without losing unique agent work, and an evicted task can be restored transparently from durable metadata; final task finish fully cleans task-owned state.
existing local pattern: `task-registry.js` owns durable task metadata, `task-session.js` owns recovery/tmux, `task-cleanup.js` owns stale cleanup, and `task-finish.js` owns post-merge final cleanup.
new or changed tests: add focused workspace tests for activity lease semantics, clean eviction, dirty/untracked/local-ahead archive + verified bundle, archive failure safety, automatic restore, and finish cleanup; mirror only the runtime contracts that require OS parity.
focused red command: `bunx vitest run packages/workspace/tests/task-worktree-eviction.test.ts packages/workspace/tests/durable-task-worktrees.test.ts packages/workspace/tests/task-session.test.js`
expected red failure: eviction/archive APIs and metadata fields do not exist; durable recovery currently rejects a missing worktree; stale cleanup uses `createdAt`; task.finish does not terminate tmux or clear durable recovery state.
no-test waiver: not applicable.

## notes for ko

- Default automatic GC cadence is hourly and the default inactivity lease is 24 hours. It is lease-based, not tied to midnight/4 AM.
- Dirty/non-ignored-untracked/local-only work is preserved in a verified Git bundle before worktree removal. The real task branch/index are not modified by checkpoint creation.
- Recovery archives are removed after successful restore and on final `task.finish`; clean remote-backed eviction creates no archive.

## improvements noticed

- `task.start` ignored the requested stream during this task bootstrap and initially created the task from `main`; this branch had to merge `origin/stream/workspace-agent` before implementation. That lifecycle defect is separate from eviction behavior and should remain visible for the session/task lifecycle follow-up.

## issues and recovery

- One validation attempt used `bun --check` on CommonJS CLI files; Bun executed the scripts instead of syntax-checking them. Cleanup ran preview-only and `task.finish` stopped because the task was unmerged, so no destructive state changed. All subsequent JS syntax checks use `node --check`.
- macOS canonicalizes `/var` to `/private/var`; worktree identity comparisons now use real paths so registry/Git validation is stable across that alias.
- Branch-scoped FS mutation could not repair a transient syntax error in its own imported recovery module; one scoped `code.call` edit removed the duplicate declaration, then normal typed FS operations resumed.

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agent): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/SCRIPTS.md`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/task-registry.js`
- `packages/os/scripts/lib/task-session.js`
- `packages/os/scripts/server/supervisor.ts`
- `packages/os/scripts/task-cleanup.js`
- `packages/os/scripts/task-finish.js`
- `packages/os/scripts/task-start.js`
- `packages/os/tests/distribution/runtime-bundle.test.ts`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/scripts/lib/git.js`
- `packages/workspace/scripts/lib/paths.js`
- `packages/workspace/scripts/lib/task-registry.js`
- `packages/workspace/scripts/lib/task-session.js`
- `packages/workspace/scripts/lib/task-worktree-eviction.js`
- `packages/workspace/scripts/task-cleanup.js`
- `packages/workspace/scripts/task-finish.js`
- `packages/workspace/scripts/task-start.js`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/durable-task-worktrees.test.ts`
- `packages/workspace/tests/task-session.test.js`

- 2026-08-15 04:15:10 apply-patch: `.task/workspace-agent/task-worktree-eviction/workpad.md`

- 2026-08-15 04:16:44 apply-patch: `packages/os/scripts/server/supervisor.ts`

- 2026-08-15 04:17:57 apply-patch: `.task/workspace-agent/task-worktree-eviction/workpad.md`

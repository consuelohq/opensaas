# Repair task lifecycle session recovery

branch: `task/os/repair-task-lifecycle-session-recovery`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1934/repair-task-lifecycle-session-recovery
github pr: https://github.com/consuelohq/opensaas/pull/1934
started: 2026-08-14

## acceptance criteria

- [x] `task.current` resolves a surviving explicit `taskSession` when ambient task state is empty.
- [x] `task.init` preserves compatible PR/session/tmux metadata instead of clobbering it.
- [x] Session-scoped lifecycle commands execute from the scoped task worktree implementation.
- [x] Task selection works when the lifecycle command itself runs from that task worktree.
- [x] Focused regressions are RED before production edits and GREEN after the fix.

## plan

1. Inspect session resolution, metadata writes, task selection, and lifecycle command CWD routing.
2. Add focused RED tests for explicit-session current, metadata preservation, scoped CWD, and current-worktree selection.
3. Implement the smallest runtime/controller changes that satisfy those contracts without changing ambient behavior.
4. Run focused tests, strict review, and verify; separate any pre-existing baseline failures.
5. Promote the repair to `stream/os` through the normal task lifecycle.

## current status

- Four focused lifecycle regressions were RED before production edits and are now GREEN.
- `task.current` now consumes the taskSession-resolved branch/worktree instead of ambient controller state.
- Task/stream lifecycle command planning now prefers the taskSession-resolved worktree over stale controller `main`.
- `task.init` now preserves compatible PR/session/tmux/source metadata and richer task metadata while letting explicit CLI values override recovered values.
- Workspace task selection now includes the current worktree, allowing lifecycle scripts to resolve themselves when executed from the scoped task checkout.
- Focused lifecycle coverage is green; strict review is clean. Full verify is blocked only by the auto-selected package-wide OS baseline, which is being recorded before approved-path promotion.

## files changed

- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/task-init.js`
- `packages/os/tests/facade/facade.test.ts`
- `packages/workspace/scripts/lib/task-selection.js`
- `packages/workspace/scripts/task-init.js`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/task-init.test.js`
- `packages/workspace/tests/task-selection.test.js`

## workspace-owned: files changed

- `packages/workspace/tests/task-init.test.js`
- `packages/workspace/tests/task-selection.test.js`

## workspace-owned: activity log

- 2026-08-14 01:40:34 fs.write: `.task/os/repair-task-lifecycle-session-recovery/workpad.md`
- 2026-08-14 01:48:04 fs.write: `.task/os/repair-task-lifecycle-session-recovery/mutation-probe.txt`
- 2026-08-14 01:48:43 fs.write: `packages/workspace/tests/task-selection.test.js`
- 2026-08-14 01:49:02 fs.write: `packages/workspace/tests/task-init.test.js`

## workspace-owned: validation evidence

- 2026-08-14 01:54:46 `checkFiles`: passed — OK
- 2026-08-14 02:36:36 `review.run`: passed — OK
- 2026-08-14 02:37:42 `verify`: failed — COMMAND_FAILED
- 2026-08-14 02:41:53 `review.run`: passed — OK

## key decisions

- `taskSession` is the durable routing authority after controller restart; ambient controller pointers are fallback state.
- Session-scoped task/stream lifecycle commands execute from the resolved task worktree to prevent controller/worktree version skew.
- `task.init` preserves the full compatible metadata record first, then explicit CLI values override canonical fields.
- The workpad readiness gate stays strict; the prior false-negative came from stale-controller execution.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Discovery and test-first contract

- Reproduce explicit-session `task.current` after the task survives without an ambient controller pointer.
- Reproduce `task.init` over an existing scoped task whose `session.json` contains PR/session metadata; current/history metadata must preserve those fields.
- Compare controller-side `task.pr` workpad readiness with the task-worktree implementation; the same workpad must not pass locally and fail in the controller because of version skew.
- Production edits are blocked until focused RED tests exist for these recovery contracts.

- 2026-08-14 01:40:34 append: `.task/os/repair-task-lifecycle-session-recovery/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/facade/branch-resolver.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/task-selection.js`
- `packages/os/scripts/task-init.js`
- `packages/os/tests/facade/facade.test.ts`
- `packages/workspace/scripts/lib/task-selection.js`
- `packages/workspace/scripts/task-init.js`
- `packages/workspace/scripts/task-push.js`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/scripts/verify.js`
- `packages/workspace/senior-engineer.md`
- `packages/workspace/tests/task-init.test.js`
- `packages/workspace/tests/task-meta.test.ts`
- `packages/workspace/tests/task-selection.test.js`
- `packages/workspace/tests/task-session.test.js`

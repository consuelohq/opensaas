# fix code.call task scoped execution

branch: `task/os/fix-code-call-task-scoped-execution`
stream: `stream/os`
taskSession: `tsk_e97fd7ec4068`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1097/fix-code-call-task-scoped-execution
github pr: https://github.com/consuelohq/opensaas/pull/1097
started: 2026-06-16

## acceptance criteria

- [ ] Explain and fix the awkward code.call task-worktree gating encountered in the previous guidance task.
- [ ] OS-only targeted runtime/test change.
- [ ] `code.call` accepts task context resolved by the workspace facade / outer `workspace.call` path instead of requiring duplicate task fields inside user input.
- [ ] Preserve edit-mode safety: still reject mutation-capable mode when no trusted task context/worktree exists.
- [ ] Preserve read/verify behavior and existing task worktree constraints.
- [ ] Add focused tests that fail before implementation and pass after.
- [ ] Run focused green tests, review, verify, push, promote to stream/os, finish.

## diagnosis

The awkward gating is that the outer workspace facade already resolves `taskSession` into branch/taskWorktree and injects them before `executeCodeCall`, but code.call edit-mode validation still uses a lower-level condition that effectively requires task-scoped fields in the runtime input shape. In the previous task, `workspace.call({ tool: "code.call", taskSession, input: { language: "bash", mode: "edit", code: ... } })` reached the task worktree as cwd but still failed with `edit_mode_gated`.

This is inconsistent with recent fs tools where task context is resolved once by the facade and passed down as trusted execution context. The goal is to make code.call trust the already-resolved task context while keeping edit mode gated outside task worktrees.

## plan

1. Inspect `packages/os/scripts/lib/code-call/runtime.ts`, `types.ts`, and facade executor routing around `code.call`.
2. Add tests for edit-mode acceptance with resolved task context and rejection without it.
3. Run focused tests red.
4. Implement minimal runtime/facade fix.
5. Run focused tests, syntax/typecheck, review, verify, push/promote/finish.

## test-first contract

Behavior under test:

- `executeCodeCall(..., context)` accepts `mode: "edit"` when the context has a trusted task worktree / task session equivalent and cwd resolves inside that task worktree.
- `executeCodeCall(..., context)` still rejects `mode: "edit"` without trusted task context.
- The normal facade path for task-scoped `code.call` does not require duplicate `taskSession`/`taskWorktree` fields in user input.
- Verify/read modes remain unchanged.

Expected red failure:

- Current implementation rejects edit mode with `edit_mode_gated` even when outer taskSession routed cwd to the task worktree.

## validation evidence

- pending

- 2026-06-16 22:14:33 write: `.task/os/fix-code-call-task-scoped-execution/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-16 22:14:33 fs.write: `.task/os/fix-code-call-task-scoped-execution/workpad.md`
- 2026-06-16 22:20:03 fs.write: `.task/os/fix-code-call-task-scoped-execution/workpad.md`
- 2026-06-16 22:21:19 fs.write: `.task/os/fix-code-call-task-scoped-execution/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/code-call/runtime.ts`
- `packages/os/scripts/lib/code-call/types.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/tests/code-call.test.ts`

- 2026-06-16 22:19:32 apply-patch: `packages/os/tests/code-call.test.ts`
## discovery evidence

- `packages/os/scripts/lib/code-call/runtime.ts` resolves cwd with `input.taskWorktree || context.cwd`, so outer facade routing can place execution in the task worktree.
- The edit-mode gate in `validateEditScope` only trusted `input.taskWorktree`, so context-routed task worktrees were rejected with edit gating even when `data.cwd` was already the task worktree.
- `packages/os/scripts/lib/facade/executor.ts` already injects task branch/worktree into `scopedInput` when the OS facade itself resolves `input.taskSession`, but the MCP/workspace wrapper can also route cwd externally without duplicating those fields in user input.

## implementation

- Added managed task worktree recognition in `runtime.ts`: only paths whose parent is `opensaas-worktrees` and whose basename starts with `task-` can serve as context-routed task worktrees.
- Updated `validateEditScope` to use explicit `input.taskWorktree` first, then fall back to the managed task worktree shape from resolved cwd.
- Added `code-call.test.ts` coverage proving edit mode still rejects arbitrary roots but accepts a managed task worktree supplied through context cwd.
- Updated stale integration assertion to match the current generated `code.call` documentation wording from the previous metadata task.

## validation evidence

- Red: `bun --cwd packages/os test tests/code-call.test.ts --testNamePattern 'edit mode'` failed because managed task worktree cwd was still rejected; trace `trc_bc2a36c53afd`.
- Focused green: same edit-mode target passed 2 tests; trace `trc_b1389778119e`.
- Full code-call suite: `bun --cwd packages/os test tests/code-call.test.ts` passed 14 tests; trace `trc_ae8c97bf0d5b`.
- Manifest/workflow + typecheck: `tests/tool-manifest.test.ts`, `tests/task-manifest-workflow-roles.test.ts`, and OS typecheck passed; trace `trc_3d3caf3c0d38`.

## note

- A live top-level `workspace.call({ tool: "code.call", taskSession, input: { mode: "edit" } })` still uses the currently published OS runtime until this task is promoted, so the live tool may continue to show the old gating until the stream update is active.

- 2026-06-16 22:20:03 append: `.task/os/fix-code-call-task-scoped-execution/workpad.md`

## workspace-owned: validation evidence

- pending
- 2026-06-16 22:14:33 write: `.task/os/fix-code-call-task-scoped-execution/workpad.md`
- 2026-06-16 22:20:45 `review.run`: passed — OK
- 2026-06-16 22:21:12 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os/fix-code-call-task-scoped-execution/current.json`, `.task/os/fix-code-call-task-scoped-execution/evidence-log.json`, `.task/os/fix-code-call-task-scoped-execution/read-log.json`, `.task/os/fix-code-call-task-scoped-execution/session.json`, `.task/os/fix-code-call-task-scoped-execution/workpad.md`, `.task/tasks/os/fix-code-call-task-scoped-execution.json`, `packages/os/scripts/lib/code-call/runtime.ts`, `packages/os/tests/code-call.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## final validation evidence

- Review: `review.run` against `origin/stream/os` passed with zero own issues, zero pre-existing issues, zero failed suites, zero blocking issues; trace `trc_f24b35b686e5`.
- Verify: `verify` against `origin/stream/os` passed and wrote publish-valid stamp; trace `trc_53d91f51bd9d`.
- Verify selected zero suites, so explicit test traces remain behavior proof: red `trc_bc2a36c53afd`, focused green `trc_b1389778119e`, full suite `trc_ae8c97bf0d5b`, manifest/typecheck `trc_3d3caf3c0d38`.

- 2026-06-16 22:21:19 append: `.task/os/fix-code-call-task-scoped-execution/workpad.md`

# code call bounds

branch: `task/os/code-call-bounds`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/1173
started: 2026-06-22

## acceptance criteria

- [ ] Verify the three CodeRabbit findings against current stream/os code.
- [ ] Fix only still-valid code-call issues with minimal changes.
- [ ] Keep taskWorktree validation security-focused; do not silently widen branch/trace behavior.
- [ ] Validate with focused OS code-call tests, OS typecheck, review.run, verify, and publish through task workflow.

## findings verification

- location.ts taskWorktree validation: valid. Current code uses input.taskWorktree to construct defaultCwd and allowedRoots before validating that it is a managed task worktree, so taskWorktree: '/' can approve the whole filesystem.
- schema.ts execution bounds: valid. Current code passes input.timeout and input.maxResultChars directly to setTimeout/output truncation.
- snapshot.ts redundant catchAll: valid. captureGitSnapshotEffect already converts thrown git status errors into Snapshot success values in Effect.try.catch, making its trailing catchAll redundant for that path.
- no-branch trace note: related area but not the same fix. service.ts only sets TASK_BRANCH when input.branch exists. taskWorktree validation prevents unsafe roots but does not derive a missing branch from a worktree.

## Test-first contract

behavior under test:
- code.call rejects taskWorktree values outside managed OS task worktrees before using them as cwd or allowed roots.
- code.call falls back to safe default bounds for invalid direct runtime maxResultChars input.
- captureGitSnapshotEffect no longer has the redundant catchAll chain.

existing pattern to follow:
- packages/os/tests/code-call.test.ts covers direct executeCodeCall runtime behavior.
- packages/os/tests/code-call-service-architecture.test.ts covers module/source architecture constraints.

new or changed tests:
- add runtime tests for unsafe taskWorktree and invalid maxResultChars fallback.
- add architecture assertion around captureGitSnapshotEffect source.

focused red command:
- bun --cwd packages/os test tests/code-call.test.ts tests/code-call-service-architecture.test.ts

expected red failure:
- unsafe taskWorktree currently executes successfully from '/'.
- maxResultChars: 0 currently truncates stdout to zero chars instead of falling back.
- captureGitSnapshotEffect currently contains the redundant Effect.catchAll((snapshot) chain.

## plan

1. Add focused regression tests first and confirm red.
2. Add minimal taskWorktree validation/sanitization before defaultCwd and allowedRoots.
3. Add bounded positive number normalization for timeout and maxResultChars.
4. Remove redundant captureGitSnapshotEffect catchAll only.
5. Run focused tests, typecheck, review, verify, push, promote.

## validation evidence

- RED: `bun --cwd packages/os test tests/code-call.test.ts tests/code-call-service-architecture.test.ts` failed as expected with 3 failures: unsafe taskWorktree executed, maxResultChars: 0 truncated stdout, and captureGitSnapshotEffect still had redundant catchAll. Trace `trc_89fce97ff7e7`.
- GREEN: same focused command passed, 27 tests. Trace `trc_a8cc8a051b33`.
- PASS: `cd packages/os && bun run typecheck` passed with workspace script syntax checks. Trace `trc_270b1ac6bde3`.
- BRANCH ENV CHECK: task-scoped code.call child process sees `TASK_BRANCH=task/os/code-call-bounds` and `TASK_WORKTREE` set. Trace `trc_9c6448a91c49`.

## notes for Ko

- The taskWorktree fix is security-correct, but branch display in trace watch depends on branch propagation/logging, not just worktree validation.

## implementation notes

- Added managed task worktree validation before using input.taskWorktree as defaultCwd or allowedRoots.
- Added bounded numeric normalization for direct runtime timeout/maxResultChars inputs.
- Removed only the redundant catchAll on captureGitSnapshotEffect; left unrelated directory snapshot path unchanged for minimal blast radius.
- Verified that branch is available inside task-scoped code.call child env. The UI row showing no-branch is likely in outer trace logging/rendering, not in code.call child env propagation.

## workspace-owned: validation evidence

- RED: `bun --cwd packages/os test tests/code-call.test.ts tests/code-call-service-architecture.test.ts` failed as expected with 3 failures: unsafe taskWorktree executed, maxResultChars: 0 truncated stdout, and captureGitSnapshotEffect still had redundant catchAll. Trace `trc_89fce97ff7e7`.
- GREEN: same focused command passed, 27 tests. Trace `trc_a8cc8a051b33`.
- PASS: `cd packages/os && bun run typecheck` passed with workspace script syntax checks. Trace `trc_270b1ac6bde3`.
- BRANCH ENV CHECK: task-scoped code.call child process sees `TASK_BRANCH=task/os/code-call-bounds` and `TASK_WORKTREE` set. Trace `trc_9c6448a91c49`.
- 2026-06-22 21:52:33 `review.run`: passed — OK
- 2026-06-22 21:53:34 `verify`: passed — OK
- 2026-06-22 21:54:25 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os/code-call-bounds/current.json`, `.task/os/code-call-bounds/session.json`, `.task/os/code-call-bounds/verify.json`, `.task/os/code-call-bounds/workpad.md`, `.task/tasks/os/code-call-bounds.json`, `packages/os/scripts/lib/code-call/location.ts`, `packages/os/scripts/lib/code-call/schema.ts`, `packages/os/scripts/lib/code-call/snapshot.ts`, `packages/os/tests/code-call-service-architecture.test.ts`, `packages/os/tests/code-call.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## skipped findings

- None of the three provided findings were skipped; all were still valid against current code and fixed.

## final changed files

- `packages/os/scripts/lib/code-call/location.ts`
- `packages/os/scripts/lib/code-call/schema.ts`
- `packages/os/scripts/lib/code-call/snapshot.ts`
- `packages/os/tests/code-call.test.ts`
- `packages/os/tests/code-call-service-architecture.test.ts`

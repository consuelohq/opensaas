# fix code call task session error

branch: `task/os/fix-code-call-task-session-error`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1025/fix-code-call-task-session-error
github pr: https://github.com/consuelohq/opensaas/pull/1025
started: 2026-06-13

## objective

Fix the workspace call wrapper so `code.call` can run when a valid taskSession is passed and the call input also carries the same task branch. Keep mismatched taskSession and branch combinations rejected.

## evidence

- Linear DEV-1548 title says the failure is a code.call task session error.
- The issue description contains a private screenshot image. Browser inspection reached Linear login for both the issue page and upload URL, so the image content could not be read in this session.
- Compact trace search found no recent code.call or taskSession error rows.
- Direct repro: top-level taskSession plus matching input.branch for code.call failed before the TypeScript facade with VALIDATION_ERROR.
- Controls: code.call succeeded with only a top-level taskSession and with matching top-level and input taskSession.

## test-first contract

Behavior under test:

- workspace.call server wrapper should accept taskSession plus input.branch when input.branch equals the branch stored in task session metadata.
- The resolved child input should preserve the caller payload and taskSession so the TypeScript facade can scope the call to the task worktree.
- A mismatched branch should remain a standard VALIDATION_ERROR.

Focused red command:

python3 -m unittest packages.workspace.tests.server_call_test.WorkspaceCallServerTest.test_task_session_allows_matching_input_branch_for_code_call

Expected red failure before implementation:

The call returns VALIDATION_ERROR before invoking the child workspace tool.

## implementation

- Added branch extraction and task-session metadata branch comparison in packages/workspace/server.py.
- Changed the branch conflict guard to reject only missing/mismatched task-session branches, not matching input.branch values.
- Updated nested batch branch conflict checking to use the same metadata-aware comparison.
- Added a regression test for code.call with taskSession plus matching input.branch.

## files changed

- none yet

## validation evidence

Red before implementation:

- python3 -m unittest packages.workspace.tests.server_call_test.WorkspaceCallServerTest.test_task_session_allows_matching_input_branch_for_code_call
  - failed as expected: AssertionError because the call returned VALIDATION_ERROR before the mocked child tool ran.
  - traceId: trc_e233727453e3

Green after implementation:

- python3 -m unittest packages.workspace.tests.server_call_test.WorkspaceCallServerTest.test_task_session_allows_matching_input_branch_for_code_call
  - passed
  - traceId: trc_53c44deb98cc
- python3 -m unittest packages.workspace.tests.server_call_test.WorkspaceCallServerTest.test_task_session_and_branch_conflict_is_standard_error
  - passed
  - traceId: trc_f271e493c6e5
- python3 -m unittest packages.workspace.tests.server_call_test.WorkspaceCallServerTest.test_task_session_and_nested_batch_branch_conflict_is_standard_error
  - passed
  - traceId: trc_7d090b0dd5c6
- python3 -m unittest packages.workspace.tests.server_call_test
  - passed 39 tests after final cleanup
  - traceId: trc_00792bf4625f
- bun x vitest run packages/workspace/tests/code-call.test.ts packages/workspace/tests/facade/facade.test.ts
  - passed 571 tests after final cleanup
  - traceId: trc_c5bc38e57ff8
- workspace audit --scripts
  - passed: documented_count 61, actual_count 61, no missing or undocumented scripts
  - traceId: trc_faf0348e5928

Review notes:

- review.run timed out twice at the wrapper level.
- bun run review -- --mine --no-tests --json returned exit code 0 through code.call and reused cached review result ab262dc6df01.
- That cached review output included repo-wide typecheck failures in unrelated Twenty/Zapier packages, not in the touched workspace Python/server test files.

## notes

- Nearby symptom found while fetching the private Linear screenshot: http without taskSession hit AMBIGUOUS_TASK_SELECTION in a multi-worktree environment. That is adjacent, but this task stays focused on the confirmed code.call taskSession and branch collision.

- 2026-06-13 19:15:19 write: `.task/os/fix-code-call-task-session-error/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-13 19:15:19 fs.write: `.task/os/fix-code-call-task-session-error/workpad.md`

## workspace-owned: validation evidence

- python3 -m unittest packages.workspace.tests.server_call_test.WorkspaceCallServerTest.test_task_session_allows_matching_input_branch_for_code_call
  - failed as expected: AssertionError because the call returned VALIDATION_ERROR before the mocked child tool ran.
  - traceId: trc_e233727453e3
Green after implementation:
- python3 -m unittest packages.workspace.tests.server_call_test.WorkspaceCallServerTest.test_task_session_allows_matching_input_branch_for_code_call
  - passed
  - traceId: trc_53c44deb98cc
- python3 -m unittest packages.workspace.tests.server_call_test.WorkspaceCallServerTest.test_task_session_and_branch_conflict_is_standard_error
  - passed
  - traceId: trc_f271e493c6e5
- python3 -m unittest packages.workspace.tests.server_call_test.WorkspaceCallServerTest.test_task_session_and_nested_batch_branch_conflict_is_standard_error
  - passed
  - traceId: trc_7d090b0dd5c6
- python3 -m unittest packages.workspace.tests.server_call_test
  - passed 39 tests after final cleanup
  - traceId: trc_00792bf4625f
- bun x vitest run packages/workspace/tests/code-call.test.ts packages/workspace/tests/facade/facade.test.ts
  - passed 571 tests after final cleanup
  - traceId: trc_c5bc38e57ff8
- workspace audit --scripts
  - passed: documented_count 61, actual_count 61, no missing or undocumented scripts
  - traceId: trc_faf0348e5928
Review notes:
- review.run timed out twice at the wrapper level.
- bun run review -- --mine --no-tests --json returned exit code 0 through code.call and reused cached review result ab262dc6df01.
- That cached review output included repo-wide typecheck failures in unrelated Twenty/Zapier packages, not in the touched workspace Python/server test files.
- 2026-06-13 19:15:20 `verify`: failed — COMMAND_FAILED
- 2026-06-13 19:15:20 `verify`: failed — COMMAND_FAILED
- 2026-06-13 19:15:20 `verify`: failed — COMMAND_FAILED
- 2026-06-13 19:15:48 `verify`: failed — COMMAND_FAILED

## workspace-owned: test selection

- changed files: `.task/os/fix-code-call-task-session-error/current.json`, `.task/os/fix-code-call-task-session-error/evidence-log.json`, `.task/os/fix-code-call-task-session-error/explore-state.json`, `.task/os/fix-code-call-task-session-error/read-log.json`, `.task/os/fix-code-call-task-session-error/session.json`, `.task/os/fix-code-call-task-session-error/workpad.md`, `.task/tasks/os/fix-code-call-task-session-error.json`, `packages/workspace/server.py`, `packages/workspace/tests/server_call_test.py`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: no testable source files changed

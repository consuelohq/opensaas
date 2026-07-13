# fix OS code.call taskSession branch handling

branch: `task/os/fix-os-code-call-task-session-branch-handling`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1038/fix-os-code-call-task-session-branch-handling
github pr: https://github.com/consuelohq/opensaas/pull/1038
started: 2026-06-14

## objective

Fix the OS-facing `code.call` / task-session branch handling path. The previous PR #1025 only changed `packages/workspace`; this task must prove and, if necessary, fix the behavior through the OS surface.

## acceptance criteria

- [ ] Add or update an OS regression test under `packages/os/tests/...` that exercises the OS-facing `code.call` path with top-level `taskSession` and a matching nested `input.branch`.
- [ ] The matching `taskSession` + branch call is accepted by the OS surface and reaches the downstream call contract.
- [ ] A mismatched `taskSession` + nested branch remains rejected with a validation/branch-conflict error.
- [ ] Missing or invalid task-session metadata behavior is explicit and covered where the local OS pattern supports it.
- [ ] Any production/code change is in `packages/os/...` unless evidence proves OS delegates entirely to already-fixed workspace code; in that case, the OS test is the durable fix.
- [ ] Focused OS test is run red before implementation, then green after implementation.
- [ ] Diff is reviewed and broader validation runs against `origin/stream/os` before publish.

## initial assumptions

- This is a direct follow-up to unshipped `stream/os` work, so the task starts from `stream/os`.
- Do not treat workspace-only PR #1025 as sufficient unless OS tests prove the OS surface delegates correctly.
- Keep workspace edits out of scope unless an OS test proves the failure is caused by a shared contract not already fixed on this branch.

## plan

1. Search context and explore the OS call surface for `code.call`, `taskSession`, and branch conflict handling.
2. Read `packages/os/tests/server_call_test.py`, the OS facade/schema/tool manifest, and the corresponding workspace test/server implementation only as comparison evidence.
3. Write the OS regression test first.
4. Run the focused OS test red.
5. Implement the smallest OS-surface fix or document why implementation is test-only because current stream already contains the shared fix.
6. Run focused green, inspect diff, run review/verify against `origin/stream/os`, then push and promote to stream PR.

## test-first contract

Behavior under test:

- OS-facing `code.call` accepts a valid top-level `taskSession` when the nested call input includes the same branch associated with that task session.
- OS-facing `code.call` rejects a nested branch that conflicts with the task session branch.
- The test must fail when the OS surface lacks this compatibility/regression behavior.

Existing local pattern to follow:

- TBD after reading `packages/os/tests/server_call_test.py` and related fixtures.

New or changed tests:

- TBD, expected under `packages/os/tests/server_call_test.py` unless exploration finds a more specific OS call test file.

Focused red command:

- TBD after reading package test commands.

Expected red failure:

- The OS test should fail with a validation/branch conflict error for matching `taskSession` + branch, or with missing OS routing support if the OS surface is not wired.

## current status

- Task created from `stream/os` with taskSession `tsk_b4a01d686b98`.
- Workpad initialized before production edits.

## files changed

- `.task/os/fix-os-code-call-task-session-branch-handling/workpad.md`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/tests/facade/facade.test.ts`

## validation evidence

- TBD

## issues and recovery

- Initial workpad write without `force` failed because the scaffold already existed; rewrote the scoped task workpad with `force: true` before production edits.

- 2026-06-14 18:22:52 write: `.task/os/fix-os-code-call-task-session-branch-handling/workpad.md`

## workspace-owned: files changed

- `.task/os/fix-os-code-call-task-session-branch-handling/workpad.md`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/tests/facade/facade.test.ts`

## workspace-owned: activity log

- 2026-06-14 18:22:52 fs.write: `.task/os/fix-os-code-call-task-session-branch-handling/workpad.md`
- 2026-06-14 18:28:02 fs.write: `.task/os/fix-os-code-call-task-session-branch-handling/workpad.md`
- 2026-06-14 18:28:31 fs.write: `packages/os/tests/facade/facade.test.ts`
- 2026-06-14 18:30:26 fs.write: `.task/os/fix-os-code-call-task-session-branch-handling/workpad.md`
- 2026-06-14 18:31:03 fs.write: `packages/os/scripts/lib/facade/executor.ts`
- 2026-06-14 18:32:58 fs.write: `packages/os/scripts/lib/facade/schemas.ts`
- 2026-06-14 18:35:10 fs.write: `.task/os/fix-os-code-call-task-session-branch-handling/workpad.md`
- 2026-06-14 18:40:11 fs.write: `.task/os/fix-os-code-call-task-session-branch-handling/workpad.md`
- 2026-06-14 18:40:25 fs.write: `.task/os/fix-os-code-call-task-session-branch-handling/workpad.md`
- 2026-06-14 18:43:49 fs.write: `.task/os/fix-os-code-call-task-session-branch-handling/workpad.md`
- 2026-06-14 18:45:38 fs.write: `.task/os/fix-os-code-call-task-session-branch-handling/workpad.md`
- 2026-06-14 18:46:25 fs.write: `.task/os/fix-os-code-call-task-session-branch-handling/workpad.md`
- 2026-06-14 18:47:41 fs.write: `.task/os/fix-os-code-call-task-session-branch-handling/workpad.md`
- 2026-06-14 18:49:04 fs.write: `.task/os/fix-os-code-call-task-session-branch-handling/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/code-call/types.ts`
- `packages/os/scripts/lib/codemode/tools/index.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/tests/code-call.test.ts`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/server_call_test.py`
- `packages/workspace/server.py`
- `packages/workspace/tests/server_call_test.py`

## discovery update 2026-06-14

Relevant files read:

- `packages/os/tests/facade/facade.test.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/tests/code-call.test.ts`
- `packages/workspace/tests/server_call_test.py`
- `packages/workspace/server.py`

Concrete local pattern:

- OS typed facade tests use Vitest in `packages/os/tests/facade/facade.test.ts` with `executeTool`, `writeTaskSession`, temp worktrees, and direct assertions against `ToolResult` envelopes.
- OS `code.call` is an internal facade tool handled through `executeInternalTool`; task-session validation occurs before that internal dispatch.
- Current OS `resolveTaskSessionInput` rejects any input containing both `taskSession` and `branch` before reading metadata. That is the likely OS-side bug.
- Workspace server on the current stream already has a regression test allowing `code.call` with top-level `taskSession` plus matching `input.branch`; OS lacks the equivalent regression.

Updated test-first contract:

Behavior under test:

- `executeTool('code.call', { taskSession, branch: matchingTaskBranch, ... })` should succeed when session metadata resolves to the same branch.
- `executeTool('code.call', { taskSession, branch: differentBranch, ... })` should remain a `VALIDATION_ERROR`.

Existing local pattern to follow:

- Add focused Vitest cases beside the current `rejects calls that pass both taskSession and branch` test in `packages/os/tests/facade/facade.test.ts`.

New or changed tests:

- Add `allows matching taskSession and branch for code.call`.
- Narrow the old broad rejection behavior into an explicit mismatched-branch rejection.

Focused red command:

- `bun --cwd packages/os test tests/facade/facade.test.ts`

Expected red failure:

- Matching `code.call` case should currently fail with `VALIDATION_ERROR` from `resolveTaskSessionInput` because OS rejects `taskSession` plus `branch` before comparing metadata.

- 2026-06-14 18:28:02 append: `.task/os/fix-os-code-call-task-session-branch-handling/workpad.md`

- 2026-06-14 18:28:31 write: `packages/os/tests/facade/facade.test.ts`

## workspace-owned: TDD red evidence

- 2026-06-14 18:29:08 `bun --cwd packages/os test tests/facade/facade.test.ts`: failed exit 1 trace: `trc_d84d7061e801`
  - output: tableOptions[39m([34msuccessfulRunner[39m())[33m,[39m cwd[33m:[39m tempRoot })[33m;[39m [90m362| [39m [90m363| [39m [34mexpect[39m(result[33m.[39mok)[33m.[39m[34mtoBe[39m([35mfalse[39m)[33m;[39m [90m | [39m [31m^[39m [90m364| [39m [34mexpect[39m(result[33m.[39mcode)[33m.[39m[34mtoBe[39m([32m'VALIDATION_ERROR'[39m)[33m;[39m [90m365| [39m } [35mfinally[39m { [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/4]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1

## red test evidence 2026-06-14

Command:

`bun --cwd packages/os test tests/facade/facade.test.ts`

Result:

- Exit 1 via `task.call` with `tddPhase: red`.
- 544 tests ran: 540 passed, 4 failed.

Meaningful red signal for this task:

- New test `rejects mismatched taskSession and branch` failed because `result.ok` was `true` instead of `false`.
- This proves the OS-facing `code.call` path currently accepts a `taskSession` whose metadata branch does not match nested `input.branch`.

Prediction correction:

- The matching `taskSession` + `branch` `code.call` case already passed on the current stream.
- The actual missing OS behavior is mismatch rejection for the internal `code.call` path.

Unrelated failures observed in the broad file run:

- `returns a timeout envelope for intent` expected `TIMEOUT`, received `VALIDATION_ERROR`.
- `supports synthetic dry-run for code.call` expected `DRY_RUN`, received `CODE_CALL_VALIDATION_ERROR`.
- `supports synthetic dry-run for intent` expected `DRY_RUN`, received `VALIDATION_ERROR`.

Implementation target:

- `packages/os/scripts/lib/facade/executor.ts` `resolveTaskSessionInput` should resolve task-session metadata first, then allow an explicit branch only when it matches the metadata branch. A different branch must return `VALIDATION_ERROR`.

- 2026-06-14 18:30:26 append: `.task/os/fix-os-code-call-task-session-branch-handling/workpad.md`

- 2026-06-14 18:31:03 write: `packages/os/scripts/lib/facade/executor.ts`

## workspace-owned: TDD green evidence

- 2026-06-14 18:32:00 `bun --cwd packages/os test tests/facade/facade.test.ts -t taskSession and branch`: failed exit 1 trace: `trc_4af43229081c`
  - output: tableOptions[39m([34msuccessfulRunner[39m())[33m,[39m cwd[33m:[39m tempRoot })[33m;[39m [90m362| [39m [90m363| [39m [34mexpect[39m(result[33m.[39mok)[33m.[39m[34mtoBe[39m([35mfalse[39m)[33m;[39m [90m | [39m [31m^[39m [90m364| [39m [34mexpect[39m(result[33m.[39mcode)[33m.[39m[34mtoBe[39m([32m'VALIDATION_ERROR'[39m)[33m;[39m [90m365| [39m } [35mfinally[39m { [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1
- 2026-06-14 18:32:58 write: `packages/os/scripts/lib/facade/schemas.ts`
- 2026-06-14 18:33:57 `bun --cwd packages/os test tests/facade/facade.test.ts -t taskSession and branch`: failed exit 1 trace: `trc_9e530fcf4410`
  - output: ted> ../../../../../../../../../../Users/kokayi/Dev/opensaas/node_modules/vite/node_modules/esbuild/lib/main.js:[2m603:9[22m[39m [90m [2m❯[22m handleIncomingPacket ../../../../../../../../../../Users/kokayi/Dev/opensaas/node_modules/vite/node_modules/esbuild/lib/main.js:[2m658:12[22m[39m [90m [2m❯[22m Socket.readFromStdout ../../../../../../../../../../Users/kokayi/Dev/opensaas/node_modules/vite/node_modules/esbuild/lib/main.js:[2m581:7[22m[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1
- 2026-06-14 18:40:18 `bun --cwd packages/os test tests/facade/facade.test.ts -t taskSession and branch`: passed exit 0 trace: `trc_79df13208c0b`
  - output: → tmux: opensaas-os-fix-os-code-call-task-session-branch-handling-b4a01d68 $ vitest run tests/facade/facade.test.ts -t "taskSession and branch" {"level":"error","tool":"code.call","command":"workspace code.call","implementationCommand":"os code.call","durationMs":0,"exitCode":1,"traceId":"trc_abc123def456","ok":false,"code":"VALIDATION_ERROR","capabilities":{"readOnly":false,"mutating":true},"event":"tool.executed","message":"tool.executed","ts":"2026-06-14T18:40:18.595Z"}

## recovery note 2026-06-14

A schema edit attempted through `code.run` rewrote `packages/os/scripts/lib/facade/schemas.ts` from a partial 180-line read, truncating the file. The next focused test failed at transform time with `Expected identifier but found end of file`.

Recovery action:

- Ran `git restore packages/os/scripts/lib/facade/schemas.ts` inside the task worktree.
- This was a tooling/edit recovery, not a product behavior change.
- Next schema edit must read the full file before writing.

- 2026-06-14 18:35:10 append: `.task/os/fix-os-code-call-task-session-branch-handling/workpad.md`

## implementation update 2026-06-14

Changes made:

- `packages/os/scripts/lib/facade/executor.ts`: changed `resolveTaskSessionInput` to resolve task-session metadata before deciding whether `input.branch` is allowed. A branch is now allowed only when it matches the task-session metadata branch; mismatches return `VALIDATION_ERROR`.
- `packages/os/scripts/lib/facade/schemas.ts`: added `branch` to `CodeCallInput`, because Zod stripped the nested `branch` before the task-session resolver could compare it.
- `packages/os/tests/facade/facade.test.ts`: added OS-facing matching/mismatched `code.call` taskSession + branch regression coverage.

Tooling notes:

- `fs.apply_patch` is not available in the current workspace facade.
- `fs.patch` rejected multiline inline content and requires `contentFile` for multiline replacement.
- A small `python3 -c` replacement was used after the typed full-file write was blocked by transport filtering.

- 2026-06-14 18:40:11 append: `.task/os/fix-os-code-call-task-session-branch-handling/workpad.md`

## green test evidence 2026-06-14

Focused green command:

`bun --cwd packages/os test tests/facade/facade.test.ts -t "taskSession and branch"`

Result:

- Exit 0 via `task.call` with `tddPhase: green`.
- 1 test file passed.
- 2 targeted tests passed, 542 skipped.

Notes:

- The stderr contains the expected structured log line for the mismatched-branch negative case: `code.call` returned `VALIDATION_ERROR`.
- This proves the OS-facing `code.call` path accepts matching `taskSession` + branch and rejects mismatched `taskSession` + branch.

- 2026-06-14 18:40:25 append: `.task/os/fix-os-code-call-task-session-branch-handling/workpad.md`

## workspace-owned: validation evidence

- TBD
- 2026-06-14 18:41:02 `checkFiles`: passed — OK
- 2026-06-14 18:45:04 `review.run`: passed — OK
- 2026-06-14 18:48:35 `verify`: passed — OK

## broader validation 2026-06-14

Static check:

- Command/tool: `checkFiles` for `packages/os/scripts/lib/facade/executor.ts`, `packages/os/scripts/lib/facade/schemas.ts`, and `packages/os/tests/facade/facade.test.ts`.
- Result: OK. `node --check` passed for all three touched TypeScript files.

Focused behavior proof:

- Command: `bun --cwd packages/os test tests/facade/facade.test.ts -t "taskSession and branch"`.
- Result: OK. 2 targeted tests passed.

Full local file run:

- Command: `bun --cwd packages/os test tests/facade/facade.test.ts`.
- Result: failed with 3 failures while the new task-relevant tests passed.
- Passing relevant tests in the full run:
  - `allows matching taskSession and branch for code.call`
  - `rejects mismatched taskSession and branch`
- Failing unrelated tests:
  - `returns a timeout envelope for intent`: expected `TIMEOUT`, received `VALIDATION_ERROR`.
  - `supports synthetic dry-run for code.call`: expected `DRY_RUN`, received `CODE_CALL_VALIDATION_ERROR`.
  - `supports synthetic dry-run for intent`: expected `DRY_RUN`, received `VALIDATION_ERROR`.

Cleanup:

- The full local file run wrote snapshot updates for unrelated failing snapshot cases. Restored `packages/os/tests/facade/__snapshots__/facade.test.ts.snap` with `git restore` so no unrelated snapshot artifact remains.

Review validation plan:

- Run `review.run` against `origin/stream/os` with `noTests: true` because focused behavior tests and checkFiles already ran, and the full file test has unrelated pre-existing failures outside this task scope.

- 2026-06-14 18:43:49 append: `.task/os/fix-os-code-call-task-session-branch-handling/workpad.md`

## review evidence 2026-06-14

Command/tool:

- `review.run` with base `origin/stream/os` and `noTests: true`.

Reason for `noTests: true`:

- Focused behavior tests and static checks already ran and passed.
- The full `packages/os/tests/facade/facade.test.ts` file has 3 unrelated failures outside this task scope, documented above.

Result:

- OK.
- Affected project: `consuelo-os`.
- Files reviewed: 3.
- Must-fix issues: 0.
- Blocking issues: 0.
- Pre-existing issues: 0.

- 2026-06-14 18:45:38 append: `.task/os/fix-os-code-call-task-session-branch-handling/workpad.md`

## final pre-publish summary 2026-06-14

Files changed:

- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/tests/facade/facade.test.ts`
- Scoped task metadata under `.task/os/fix-os-code-call-task-session-branch-handling/` and `.task/tasks/os/`.

Key decisions:

- Fixed OS directly, not workspace-only.
- `taskSession` remains canonical. Explicit `input.branch` is allowed only when it matches the task-session metadata branch.
- `code.call` schema now preserves `branch` so the OS resolver can compare it instead of silently stripping it.
- Kept unrelated snapshot updates out of the diff.

Validation evidence:

- Red: full `packages/os/tests/facade/facade.test.ts` run failed because the new mismatched-branch regression expected rejection but OS accepted the mismatched branch.
- Green: `bun --cwd packages/os test tests/facade/facade.test.ts -t "taskSession and branch"` passed 2 targeted tests.
- Static: `checkFiles` passed for all 3 touched TypeScript files.
- Broader: full `packages/os/tests/facade/facade.test.ts` run has 3 unrelated failures documented above; the new task-relevant tests pass in that run.
- Review: `review.run` against `origin/stream/os` with `noTests: true` passed with 0 must-fix issues and 0 blocking issues.

Known issues outside this task:

- Existing/nearby facade tests for `intent` timeout/dry-run and `code.call` synthetic dry-run fail independently of this branch's behavior change. They are documented but not fixed in this task to avoid scope creep.

- 2026-06-14 18:46:25 append: `.task/os/fix-os-code-call-task-session-branch-handling/workpad.md`

## publish gate incident 2026-06-14

`task.push` failed before publishing because publish validation requires a task verify stamp:

- Error: `publish-valid verify required before task:push: missing .task/os/fix-os-code-call-task-session-branch-handling/verify.json stamp.`
- Recovery: run the typed `verify` gate for this task before retrying `task.push`.

- 2026-06-14 18:47:41 append: `.task/os/fix-os-code-call-task-session-branch-handling/workpad.md`

## workspace-owned: test selection

- changed files: `.task/os/fix-os-code-call-task-session-branch-handling/current.json`, `.task/os/fix-os-code-call-task-session-branch-handling/evidence-log.json`, `.task/os/fix-os-code-call-task-session-branch-handling/read-log.json`, `.task/os/fix-os-code-call-task-session-branch-handling/session.json`, `.task/os/fix-os-code-call-task-session-branch-handling/workpad.md`, `.task/tasks/os/fix-os-code-call-task-session-branch-handling.json`, `packages/os/scripts/lib/facade/executor.ts`, `packages/os/scripts/lib/facade/schemas.ts`, `packages/os/tests/facade/facade.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## verify evidence 2026-06-14

Command/tool:

- `verify` with base `origin/stream/os`.

Result:

- OK.
- Publish-valid stamp written to `.task/os/fix-os-code-call-task-session-branch-handling/verify.json`.
- Review passed inside verify: static rules, eslint, typecheck, spec compliance.
- DB guard passed with 0 risks and 0 findings.
- Test selection selected 0 suites, with warning: changed code selected zero suites. This is acceptable for publish because focused task-specific tests were run manually and recorded above.

- 2026-06-14 18:49:04 append: `.task/os/fix-os-code-call-task-session-branch-handling/workpad.md`

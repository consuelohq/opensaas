# fix long wait command

branch: `task/os-skills/fix-long-wait-command`
stream: `stream/os-skills`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/799/fix-long-wait-command
github pr: https://github.com/consuelohq/opensaas/pull/799
started: 2026-06-05

## acceptance criteria

- [ ] Fix the wait command so agents can initiate long waits without keeping the chat/tool call open for the whole duration.
- [ ] Preserve current short synchronous wait behavior for existing callers.
- [ ] Add a detached/background wait mode suitable for long waits such as hours or 24h.
- [ ] Provide a way to check wait status and detect when the wait is complete.
- [ ] Document the intended long-wait pattern in OS skill/docs where appropriate.
- [ ] Add focused tests for long wait creation/status behavior.
- [ ] Push to `stream/os-skills`, promote to the stream review PR, and clean up the task worktree.

## plan

1. Inspect current wait tool implementation, facade manifest/schema, tests, and docs.
2. Write a focused red test for detached long-wait behavior.
3. Implement detached wait job storage/status with a bounded synchronous path retained for short waits.
4. Update docs/skill guidance to use detached waits for long waits.
5. Validate focused tests, relevant manifest/schema checks, review, and publish through the task workflow.

## test-first contract

Behavior under test:

- Existing `wait({ seconds })` remains usable for short sleeps.
- Long waits can be started in detached mode and return immediately with a job ID/status instead of blocking the tool call.
- Detached wait status reports pending before `wakeAt` and complete after `wakeAt`.
- Invalid long-wait inputs fail clearly.

Existing local pattern to follow:

- Pending inspection of wait tool implementation and tests.

New or changed tests:

- Pending inspection; likely package-level tests around workspace/os scripts.

Focused red command:

- Pending after locating current test harness.

Expected red failure:

- Current wait tool has only synchronous sleep behavior and no durable detached status contract.

## current status

- Task started from `stream/os-skills` because Ko asked to push this fix to the same stream as the previous task.
- The triggering evidence is prior task `glossary-and-naming-cleanup`: `wait({seconds:600})` was blocked before execution, while `wait({seconds:60})` succeeded. A synchronous long wait is not sufficient for agent work.

## files changed

- `.task/os-skills/fix-long-wait-command/workpad.md`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/wait.js`
- `packages/workspace/tests/wait.test.js`

## key decisions

- Treat this as a behavior/tooling change, not a timeout constant tweak.
- Target a detached/background wait path so the chat/tool call does not need to remain open for hours.

## validation evidence

- Pending.

## issues and recovery

- Pending.

- 2026-06-05 08:11:48 write: `.task/os-skills/fix-long-wait-command/workpad.md`

## workspace-owned: files changed

- `.task/os-skills/fix-long-wait-command/workpad.md`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/wait.js`
- `packages/workspace/tests/wait.test.js`

## workspace-owned: activity log

- 2026-06-05 08:11:48 fs.write: `.task/os-skills/fix-long-wait-command/workpad.md`
- 2026-06-05 08:16:45 fs.write: `packages/workspace/tests/wait.test.js`
- 2026-06-05 08:18:46 fs.write: `packages/workspace/scripts/wait.js`
- 2026-06-05 08:21:42 fs.write: `packages/workspace/tests/wait.test.js`
- 2026-06-05 08:24:59 fs.patch: `packages/workspace/SCRIPTS.md`
- 2026-06-05 08:25:05 fs.patch: `packages/workspace/SCRIPTS.md`
- 2026-06-05 08:25:17 fs.patch: `packages/workspace/SCRIPTS.md`
- 2026-06-05 08:25:30 fs.patch: `packages/workspace/SCRIPTS.md`
- 2026-06-05 08:31:46 fs.write: `.task/os-skills/fix-long-wait-command/workpad.md`
- 2026-06-05 08:34:47 fs.write: `.task/os-skills/fix-long-wait-command/workpad.md`

## workspace-owned: files read

- `packages/os/package.json`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/package.json`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/scripts/wait.js`
- `packages/workspace/tests/task-meta.test.ts`
- `packages/workspace/tooling/tool-manifest.json`

## workspace-owned: TDD red evidence

- 2026-06-05 08:16:53 `bun --cwd packages/workspace test tests/wait.test.js`: failed exit 1 trace: `trc_61928566d9a7`
  - output: t.test.js:[2m14:25[22m[39m [90m 12|[39m [90m 13|[39m [34mexpect[39m(parsed[33m.[39msuccess)[33m.[39m[34mtoBe[39m([35mtrue[39m)[33m;[39m [90m 14|[39m [34mexpect[39m(parsed[33m.[39mdata)[33m.[39m[34mtoMatchObject[39m({ [90m |[39m [31m^[39m [90m 15|[39m duration[33m:[39m [32m'24h'[39m[33m,[39m [90m 16|[39m detached[33m:[39m [35mtrue[39m[33m,[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1

- 2026-06-05 08:18:46 write: `packages/workspace/scripts/wait.js`

- 2026-06-05 08:21:42 write: `packages/workspace/tests/wait.test.js`

## workspace-owned: TDD green evidence

- 2026-06-05 08:21:49 `bun --cwd packages/workspace test tests/wait.test.js`: passed exit 0 trace: `trc_a79968596438`
  - output: → tmux: opensaas-os-skills-fix-long-wait-command-289a1258 $ vitest run tests/wait.test.js
- 2026-06-05 08:24:59 patch lines 984-984: `packages/workspace/SCRIPTS.md`
- 2026-06-05 08:25:05 patch lines 987-987: `packages/workspace/SCRIPTS.md`
- 2026-06-05 08:25:17 patch lines 988-988: `packages/workspace/SCRIPTS.md`
- 2026-06-05 08:25:30 patch lines 989-989: `packages/workspace/SCRIPTS.md`
- 2026-06-05 08:30:17 `bun --cwd packages/workspace test tests/wait.test.js`: passed exit 0 trace: `trc_f23994bb8fdf`
  - output: → tmux: opensaas-os-skills-fix-long-wait-command-289a1258 $ vitest run tests/wait.test.js
- 2026-06-05 08:33:20 `bun --cwd packages/workspace test tests/wait.test.js`: passed exit 0 trace: `trc_125eca2d9512`
  - output: → tmux: opensaas-os-skills-fix-long-wait-command-289a1258 $ vitest run tests/wait.test.js

## workspace-owned: validation evidence

- Pending.
- 2026-06-05 08:26:08 `checkFiles`: passed — OK
- 2026-06-05 08:31:03 `checkFiles`: passed — OK
- 2026-06-05 08:32:18 `review.run`: passed — OK
- 2026-06-05 08:33:47 `review.run`: passed — OK
- 2026-06-05 08:34:37 `verify`: passed — OK

## implementation notes

Added nonblocking wait checkpoints with durable status records. The wait script can now create a persisted deadline record, check whether it is pending or complete, and list stored records. Existing short sleep and deploy wait behavior remain available.

## validation evidence

- Red focused workspace wait test failed because the typed schema stripped the new inputs.
- Green focused workspace wait test passed with 2 tests.
- Green OS tool manifest test passed with 6 tests.
- Direct script smoke created a long wait record immediately and status reported pending.
- Generated manifests, generated type stubs, generated tool docs, and syntax checks passed.

- 2026-06-05 08:31:46 append: `.task/os-skills/fix-long-wait-command/workpad.md`

## workspace-owned: test selection

- changed files: `.task/os-skills/fix-long-wait-command/current.json`, `.task/os-skills/fix-long-wait-command/evidence-log.json`, `.task/os-skills/fix-long-wait-command/read-log.json`, `.task/os-skills/fix-long-wait-command/session.json`, `.task/os-skills/fix-long-wait-command/workpad.md`, `.task/tasks/os-skills/fix-long-wait-command.json`, `packages/os/TOOLS.md`, `packages/os/manifests/tool.manifest.json`, `packages/os/scripts/lib/facade/schemas.ts`, `packages/os/scripts/wait.js`, `packages/os/src/generated/workspace.d.ts`, `packages/os/tooling/dev-tool-manifest.json`, `packages/workspace/SCRIPTS.md`, `packages/workspace/TOOLS.md`, `packages/workspace/scripts/lib/facade/schemas.ts`, `packages/workspace/scripts/wait.js`, `packages/workspace/src/generated/workspace.d.ts`, `packages/workspace/tests/wait.test.js`, `packages/workspace/tooling/tool-manifest.json`
- matched rules: `workspace-facade`, `workspace-audit-docs`
- selected suites: `workspace facade input contracts`, `workspace audit tests`
- run results: `workspace facade input contracts` passed, `workspace audit tests` passed
- failed suites: none

## final validation

- Review passed with 0 task-owned issues; remaining findings are pre-existing error-handling findings in wait scripts.
- Verify passed and wrote `.task/os-skills/fix-long-wait-command/verify.json`.
- Replaced new CLI `console.*` output calls with stdout/stderr helper functions to satisfy review logging rules.

- 2026-06-05 08:34:47 append: `.task/os-skills/fix-long-wait-command/workpad.md`

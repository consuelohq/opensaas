# tool execution scheduling and compact outputs

branch: `task/os/tool-execution-scheduling-and-compact-outputs`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1323/tool-execution-scheduling-and-compact-outputs
github pr: https://github.com/consuelohq/opensaas/pull/1323
started: 2026-07-01

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/os/hooks/intent.js`
- `packages/os/manifests/core.manifest.json`
- `packages/os/manifests/tool.manifest.json`
- `packages/os/scripts/lib/code-call/output.ts`
- `packages/os/scripts/lib/code-call/process.ts`
- `packages/os/scripts/lib/code-call/schema.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/verify.js`
- `packages/os/tests/code-call-parity.test.ts`
- `packages/os/tests/code-call.test.ts`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/workflow-intent.test.ts`
- `packages/os/tooling/dev-tool-manifest.json`
- `packages/os/scripts/lib/facade/process-tree.ts`
- `packages/os/scripts/lib/verify-run-state.js`
- `packages/os/tests/verify-run-state.test.js`


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-01 17:12:51 `verify`: passed — OK
- 2026-07-01 17:14:23 `verify`: passed — OK
- 2026-07-01 17:14:37 `verify`: passed — OK
- 2026-07-01 18:59:14 `review.run`: passed — OK

## Test-first contract: review cleanup

behavior under test:
- verify run identity preserves reviewArgs execution order.
- failed completed verify runs are not replayed indefinitely.
- verify run locks are released if record initialization fails or if caller aborts after acquisition.
- process tree cleanup can terminate a detached child group when the parent exits.
- task-session metadata type and matcher agree for relaxed aliases.
- CodeRabbit naming/fixture comments are cleaned without changing behavior.

existing local pattern to follow:
- packages/os/tests/verify-run-state.test.js uses temporary git repos and direct run-state helpers.
- packages/os/tests/facade/facade.test.ts exercises facade executor taskSession aliasing and retry behavior.
- packages/os/tests/code-call.test.ts exercises timeout and output contracts through executeCodeCall.

new or changed tests:
- packages/os/tests/verify-run-state.test.js: review arg order identity, failed-result fresh run, lock cleanup on write failure, abort cleanup.
- packages/os/tests/facade/process-tree.test.ts: parent-exit cleanup registration.
- existing test names and timeout test fixture adjusted to match review guidance.

focused red command:
- bun --cwd packages/os test tests/verify-run-state.test.js tests/facade/process-tree.test.ts

expected red failure:
- abortVerifyRun/registerProcessTreeCleanup are not exported yet, reviewArgs are sorted, failed results replay, lock cleanup does not run on record-write failure.

## Review cleanup implementation

fixed review-comment clusters:
- verify coalescing identity now preserves reviewArgs order.
- completed failed verify runs no longer replay indefinitely; only successful completed runs are replayable.
- verify run acquisition cleans up lock fd/file if writing the running record fails.
- verify main aborts acquired in-flight run state when an unexpected error occurs before finish.
- replay path sets process.exitCode instead of calling process.exit from inside replay helper.
- detached process groups now register parent-exit/signal cleanup and unregister on child close/error.
- TaskSessionMetadata makes taskSession optional and includes id/taskId so the type matches relaxed alias matching.
- task intent slug sanitization is centralized.
- generated code.call timeout surfaces now agree on 180000ms across source, manifests, workflow bundles, and TOOLS.md.

validation evidence:
- red: focused verify-run-state and process-tree tests failed on the intended missing contracts before production edits.
- green: focused verify-run-state and process-tree tests passed 8 tests.
- green: package OS typecheck passed.
- green: code-call parity and tool-manifest tests passed 17 tests.
- green: targeted facade alias/retry/compact verify tests passed 4 tests.
- green: targeted code.call tail/process-group tests passed 2 tests. The full file includes an intentionally dangerous validation fixture, so only the safe targeted cases were executed.
- green: workflow-intent tests passed 8 tests.
- green: review.run against stream/os with noTests reported 0 issues.
- green: bun packages/os/scripts/verify.js --base stream/os --json passed with publishValid true and mode full.

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/hooks/intent.js`
- `packages/os/manifests/core.manifest.json`
- `packages/os/manifests/tool.manifest.json`
- `packages/os/scripts/fs.js`
- `packages/os/scripts/lib/code-call/process.ts`
- `packages/os/scripts/lib/facade/batch.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/process-tree.ts`
- `packages/os/scripts/lib/verification.js`
- `packages/os/scripts/verify.js`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/workflow-intent.test.ts`
- `packages/os/tooling/dev-tool-manifest.json`

- 2026-07-01 17:11:52 apply-patch: `packages/os/scripts/lib/code-call/output.ts`
- 2026-07-01 17:11:52 apply-patch: `packages/os/tests/code-call.test.ts`

## workspace-owned: test selection

- changed files: `.task/os/tool-execution-scheduling-and-compact-outputs/current.json`, `.task/os/tool-execution-scheduling-and-compact-outputs/evidence-log.json`, `.task/os/tool-execution-scheduling-and-compact-outputs/read-log.json`, `.task/os/tool-execution-scheduling-and-compact-outputs/session.json`, `.task/os/tool-execution-scheduling-and-compact-outputs/workpad.md`, `.task/tasks/os/tool-execution-scheduling-and-compact-outputs.json`, `packages/os/hooks/intent.js`, `packages/os/manifests/core.manifest.json`, `packages/os/manifests/tool.manifest.json`, `packages/os/scripts/lib/code-call/output.ts`, `packages/os/scripts/lib/code-call/process.ts`, `packages/os/scripts/lib/code-call/schema.ts`, `packages/os/scripts/lib/facade/executor.ts`, `packages/os/scripts/lib/facade/process-tree.ts`, `packages/os/scripts/lib/verify-run-state.js`, `packages/os/scripts/verify.js`, `packages/os/tests/code-call-parity.test.ts`, `packages/os/tests/code-call.test.ts`, `packages/os/tests/facade/facade.test.ts`, `packages/os/tests/verify-run-state.test.js`, `packages/os/tests/workflow-intent.test.ts`, `packages/os/tooling/dev-tool-manifest.json`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## CI wait plan

Start time UTC: 2026-07-01T19:13:00.051Z
Wait reason: refreshed PR #1324 has Consuelo verify and OS contracts checks in progress.
Duration: poll every 20s for up to 6 attempts.
Resume action: run gh pr checks 1324 and summarize failed/pending/passed checks.
Expected signal: no pending checks and no non-skipped failed checks for active Consuelo checks.
Fallback: document timeout/pending checks and do not claim CI is fully settled.
CI wait observed result: first bounded polling command hit the default code-call timeout before completion; immediate follow-up check with explicit timeout completed.
Observed signal: gh pr checks reported 50 total checks, 30 SUCCESS, 20 SKIPPED, 0 pending, 0 failed.
Next decision: PR checks are settled with no active failures.

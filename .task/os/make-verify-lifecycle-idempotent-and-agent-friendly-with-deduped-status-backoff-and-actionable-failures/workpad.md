# Make verify lifecycle idempotent and agent-friendly with deduped status, backoff and actionable failures

branch: `task/os/make-verify-lifecycle-idempotent-and-agent-friendly-with-deduped-status-backoff-and-actionable-failures`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2759
started: 2026-10-31

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/os/scripts/verify-status.js`
- `packages/os/tests/verify-status-facade.test.ts`
- `packages/workspace/scripts/verify-status.js`
- `packages/workspace/tests/verify-status.test.js`

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract — 2026-10-31

behavior under test: OS verify starts one detached idempotent validation run for a given exact head/change/base/args, returns truthful neutral pending state, and provides a **read-only, long-poll status** path instead of encouraging repeated mutating verify calls. A completed failure is replayed for an unchanged verification identity until explicit retry (no silent 30-second auto rerun); explicit retry must not duplicate an active worker. Status handles completed success/failure, orphaned/aborted work, unknown keys and max wait bounds, with concise next action and without spawning a worker or changing stamps. Verify default comparison base must prefer the task stream to the task's own remote branch. Honor OS/workspace parity or deliberate differences.

existing local pattern: packages/workspace/scripts/{verify.js,lib/verify-run-state.js}, packages/os/scripts/{verify.js,lib/verify-run-state.js}, OS/workspace tool registry schemas and review handler, facade compact result, tests/os/tests/verify-run-state.test.js + packages/workspace/tests/verification.test.js. Current pending output says `Call verify again` and retryAfterSeconds=5, pending passed=false; failed replay TTL 30s.

new or changed tests: add state machine tests for read-only status of active/completed/failed/aborted/orphaned/unknown and long-poll timeout, stale replay without implicit re-run, explicit retry and no concurrent workers; OS/workspace script parity; facade schema, manifest, routing/action flags and instruction contract; proper default task stream base.

focused red command: `bunx vitest run packages/workspace/tests/verify-run-state.test.js packages/os/tests/verify-run-state.test.js` plus new focused verify-status tests before implementation.

expected red: missing status API and explicit retry logic, incorrectly replay/auto-rerun behavior in existing TTL test.

no-test waiver: none. Red→green, strict review, formal verify exactly once after fixes then read-only long-poll status; publish through managed stream/os task PR only. No main merge, deploy, or changes to another task session.

- 2026-10-31 07:48:15 append: `.task/os/make-verify-lifecycle-idempotent-and-agent-friendly-with-deduped-status-backoff-and-actionable-failures/workpad.md`

## workspace-owned: files changed

- `packages/os/scripts/verify-status.js`
- `packages/os/tests/verify-status-facade.test.ts`
- `packages/workspace/scripts/verify-status.js`
- `packages/workspace/tests/verify-status.test.js`

## workspace-owned: activity log

- 2026-10-31 07:48:15 fs.write: `.task/os/make-verify-lifecycle-idempotent-and-agent-friendly-with-deduped-status-backoff-and-actionable-failures/workpad.md`
- 2026-10-31 07:50:42 write: `packages/workspace/tests/verify-status.test.js`
- 2026-10-31 07:50:42 fs.write: `packages/workspace/tests/verify-status.test.js`
- 2026-10-31 07:51:11 write: `packages/workspace/scripts/verify-status.js`
- 2026-10-31 07:51:11 fs.write: `packages/workspace/scripts/verify-status.js`
- 2026-10-31 07:51:14 write: `packages/os/scripts/verify-status.js`
- 2026-10-31 07:51:14 fs.write: `packages/os/scripts/verify-status.js`
- 2026-10-31 07:54:57 write: `packages/os/tests/verify-status-facade.test.ts`
- 2026-10-31 07:54:57 fs.write: `packages/os/tests/verify-status-facade.test.ts`
- 2026-10-31 07:59:58 fs.write: `.task/os/make-verify-lifecycle-idempotent-and-agent-friendly-with-deduped-status-backoff-and-actionable-failures/workpad.md`

## Verification lifecycle implementation and red/green evidence

- Reproduced red (8/27 failures across OS/workspace run-state tests): missing read-only run-state API; old 30-second cached-failure TTL reran unchanged failed verification.
- Implemented read-only status and 60s bounded long-poll (up to 90 seconds max), valid/unknown/orphaned/aborted/failed/passed/stale states, same-run identity, source freshness fencing (HEAD, branch, base SHA, change hash), phase reporting, compact failed-suite evidence, neutral `passed:null` pending, 60s agent guidance and 30s coalesced legacy verify polling.
- Failures now persist until explicit `--retry`, while active-worker PID locks prevent duplicate same-snapshot work. Default base selects the task stream before origin/main, never task branch itself.
- Added discoverable `verify.status` as read-only OS facade tool via `workspace.verifyStatus` SDK method (preserve `workspace.verify` function), typed schema and CLI arguments; regenerated tool manifest, workflow bundle, SDK type stubs and docs; fixed docs generator to use callable method path.
- Added OS/workspace script parity, registry critical test-selection coverage, two SDK/manifest tests, bounded wait, stage, failure replay and stale-output regression tests.
- Initial broad facade run: 798/799 passed, one unrelated existing 5s session.start timeout under load; rerun if needed. After manifest generation focused tests 40/40, after stage and generated docs update 43/43 across six files. `generate-tool-manifest --check`, `test-selection check`, `git diff --check` green.
- Concurrent `stream/os` advanced with other agents' git-diff/facade changes, including generated artifacts. Next: snapshot local task edits, integrate latest stream safely, regenerate generated outputs and rerun gates, publish task PR #2759 only. No main/stream merge or deployment without approval.

- 2026-10-31 07:59:58 append: `.task/os/make-verify-lifecycle-idempotent-and-agent-friendly-with-deduped-status-backoff-and-actionable-failures/workpad.md`

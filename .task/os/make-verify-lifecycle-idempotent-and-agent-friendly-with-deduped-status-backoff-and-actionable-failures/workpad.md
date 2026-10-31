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
- 2026-10-31 08:02:43 fs.write: `.task/os/make-verify-lifecycle-idempotent-and-agent-friendly-with-deduped-status-backoff-and-actionable-failures/workpad.md`
- 2026-10-31 08:06:45 fs.write: `.task/os/make-verify-lifecycle-idempotent-and-agent-friendly-with-deduped-status-backoff-and-actionable-failures/workpad.md`
- 2026-10-31 08:08:09 fs.write: `.task/os/make-verify-lifecycle-idempotent-and-agent-friendly-with-deduped-status-backoff-and-actionable-failures/workpad.md`
- 2026-10-31 08:09:56 fs.write: `.task/os/make-verify-lifecycle-idempotent-and-agent-friendly-with-deduped-status-backoff-and-actionable-failures/workpad.md`

## Verification lifecycle implementation and red/green evidence

- Reproduced red (8/27 failures across OS/workspace run-state tests): missing read-only run-state API; old 30-second cached-failure TTL reran unchanged failed verification.
- Implemented read-only status and 60s bounded long-poll (up to 90 seconds max), valid/unknown/orphaned/aborted/failed/passed/stale states, same-run identity, source freshness fencing (HEAD, branch, base SHA, change hash), phase reporting, compact failed-suite evidence, neutral `passed:null` pending, 60s agent guidance and 30s coalesced legacy verify polling.
- Failures now persist until explicit `--retry`, while active-worker PID locks prevent duplicate same-snapshot work. Default base selects the task stream before origin/main, never task branch itself.
- Added discoverable `verify.status` as read-only OS facade tool via `workspace.verifyStatus` SDK method (preserve `workspace.verify` function), typed schema and CLI arguments; regenerated tool manifest, workflow bundle, SDK type stubs and docs; fixed docs generator to use callable method path.
- Added OS/workspace script parity, registry critical test-selection coverage, two SDK/manifest tests, bounded wait, stage, failure replay and stale-output regression tests.
- Initial broad facade run: 798/799 passed, one unrelated existing 5s session.start timeout under load; rerun if needed. After manifest generation focused tests 40/40, after stage and generated docs update 43/43 across six files. `generate-tool-manifest --check`, `test-selection check`, `git diff --check` green.
- Concurrent `stream/os` advanced with other agents' git-diff/facade changes, including generated artifacts. Next: snapshot local task edits, integrate latest stream safely, regenerate generated outputs and rerun gates, publish task PR #2759 only. No main/stream merge or deployment without approval.

- 2026-10-31 07:59:58 append: `.task/os/make-verify-lifecycle-idempotent-and-agent-friendly-with-deduped-status-backoff-and-actionable-failures/workpad.md`

## workspace-owned: validation evidence

- 2026-10-31 08:01:11 `review.run`: passed — OK
- 2026-10-31 08:02:50 `review.run`: passed — OK
- 2026-10-31 08:07:57 `review.run`: passed — OK

## Stream integration and validation

- Source implementation committed locally at f503e06ca4b52d02a9b968ffb6973d62634053d0. Fetched current stream head cec84ec3e3ffd6f8971078a32206b740bc6cf7a0, performed normal two-parent merge preserving agents' git-diff, tooling, CI and docs work at 00bb5e1fe6d6472d01c310fd3346edccd02eb06b. Only conflict was generated `packages/workspace/test-selection.registry.json`: regenerated from combined source rules and committed in merge. Regenerated OS tool manifest/workflows, SDK declarations, tools reference and test-selection registry.
- Synced focused verify lifecycle, status CLI, OS/workspace state, manifest route, parity and selector: 137/137 tests across 7 files passed. Generated manifests check passed; test selection check passed; script syntax and whitespace checks passed.
- Full facade integration suite passed 768/768 tests (after earlier broad mixed 798/799 run had one unrelated existing 5-second timer timeout).
- Public documentation `packages/documentation/src/content/docs/reference/tools.mdx` now explains one-time verify, status long-poll, explicit failure retry, stale and publish-safety and SDK method. Documentation `bun run --cwd packages/documentation validate` passed (`selectedPages:105`).
- Remaining: formal strict review and one full verification run (monitor via new read-only `verify.status`/OS wait rather than repeated mutating verify calls), then publish only to task PR #2759. No stream/main merge or deploy without separate approval.

- 2026-10-31 08:02:43 append: `.task/os/make-verify-lifecycle-idempotent-and-agent-friendly-with-deduped-status-backoff-and-actionable-failures/workpad.md`

## Formal gate failure analysis and corrections

- A single formal `verify` started runKey `9a032fbf76ba16a512bf2d6f273afb550dfaa35b7372c1a09d7af68212dbaf5e`; consumed ONLY via the new `verify-status.js` read-only operation, never by repeated mutating `verify` calls. It returned pending `passed:null` and actionable `verify.status` instruction correctly. Another agent advanced stream/os from cec84... to 0a6389... during verification; status correctly reported stale:true due changed base SHA, while HEAD and changeHash were unchanged.
- The worker phase field was initially generic because the stage calls were not actually persisted in workspace/os verify entrypoints. Added concrete stage writes in both scripts and static stage-wiring regressions; 45/45 focused tests green.
- The full gate failed in OS tool-package/layout tests because the canonical baseline fixture still contained 172 tools instead of the new 173. Updated the fixture from canonical generated definitions, asserting exactly `verify.status` was added and `verify` definition changed. Tool manifest/layout targeted suite 20/20, then combined 22/22 green.
- The workspace scripts-only audit failed reproducibly: its copy of `scripts/lib/paths.js` eagerly imported yaml in an isolated fixture without node_modules. The OS copy already correctly deferred requiring yaml until config reads. Made workspace helper byte-identical with OS helper, marked script parity same, and included audit regression in critical workspace publish-gate. Reproduced failing subprocess `ENOENT while resolving package yaml` before fix and validated audit with tests afterward.
- Latest stream moved again with unrelated cleanup and analytics changes; only overlapping file is script-parity classifications. Preserve all partner changes on merge, then do final verification and task PR publication. Do not merge main/stream or deploy without approval.

- 2026-10-31 08:06:45 append: `.task/os/make-verify-lifecycle-idempotent-and-agent-friendly-with-deduped-status-backoff-and-actionable-failures/workpad.md`

## Final stream synchronization and scoped validation

- Committed focused follow-up at 59f76962ebe72beab71ad90f36a7f7201595bed8. Merged newer stream/os 0a6389f0b7da7331bf3306964a90c8a650a1e3dc normally at task HEAD 7caf46f16e52851b84bf53dd3f91afa81424c912; only conflict was parity fixture. Kept all stream-owned classifications, retained proven byte-identical paths.js and added verify-status.js. No unrelated work overwritten.
- Exact combined-tree focused tests: 160/160 across ten packages/os and packages/workspace suites, including tool manifest baseline, script parity, audit without eager yaml, read-only verify.status and lifecycle, selector mapping. Generated tool manifest drift and selected-test registry checks pass.
- Formal strict review against exact SHA 0a6389f0b7da7331bf3306964a90c8a650a1e3dc: zero blocking findings and zero documentation opportunities. Prior full facade suite: 768/768; public docs validate: 105 selected pages. Base SHA pinned for final verification to avoid mutable stream invalidation during concurrent agents' work.
- Next: one formal verification run against immutable stream SHA, follow its runKey with read-only status long-poll, then publish task PR #2759 (no stream/main merge/deploy without separate approval).

- 2026-10-31 08:08:09 append: `.task/os/make-verify-lifecycle-idempotent-and-agent-friendly-with-deduped-status-backoff-and-actionable-failures/workpad.md`

## Final formal verification — passed

- Ran `verify` ONCE against immutable stream base `0a6389f0b7da7331bf3306964a90c8a650a1e3dc` from task HEAD `7caf46f16e52851b84bf53dd3f91afa81424c912`; runKey `e9da18fcb490a9c97b7ed2107b28f8b9e6c5d9c66b5497d3f953c692fa6f414a`.
- All progress and result retrieval used **read-only** `bun packages/os/scripts/verify-status.js --run-key ... --wait-seconds 18 --json`; never called mutating verify again. Status showed phase `tests`, pending true, passed null, stale false; final status `VERIFY_PASSED`, pending false, terminal true, stale false, passed true, publishValid true, review/tests/db all true, failedSuites []. Verification stamp written at task workpad path and publishValid true.
- This validates the original user complaint end-to-end: a single verification worker, actionable status, no repeated verifier launch, explicit stale guard and clear terminal semantics.
- Final source/doc review before gate: zero blockers and zero documentation opportunities; focused suite 160/160, full facade suite 768/768, documentation validate passed. Publication boundary: push task branch to PR #2759 only, no `stream/os`/`main` merge or deployment without separate approval.

- 2026-10-31 08:09:56 append: `.task/os/make-verify-lifecycle-idempotent-and-agent-friendly-with-deduped-status-backoff-and-actionable-failures/workpad.md`

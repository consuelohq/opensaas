# 2026-09-22 fix explore evidence mirror contention

branch: `task/self-healing/2026-09-22-fix-explore-evidence-mirror-contention`
stream: `stream/self-healing`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2563/2026-09-22-fix-explore-evidence-mirror-contention
github pr: https://github.com/consuelohq/opensaas/pull/2563
started: 2026-09-23

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/os/tests/explore-evidence-mirror.test.ts`

## workspace-owned: files changed

- `packages/os/tests/explore-evidence-mirror.test.ts`

## workspace-owned: activity log

- 2026-09-23 02:14:22 fs.write: `.task/self-healing/2026-09-22-fix-explore-evidence-mirror-contention/workpad.md`
- 2026-09-23 02:15:53 fs.write: `packages/os/tests/explore-evidence-mirror.test.ts`
- 2026-09-23 02:16:05 fs.write: `.task/self-healing/2026-09-22-fix-explore-evidence-mirror-contention/workpad.md`
- 2026-09-23 02:18:51 fs.write: `.task/self-healing/2026-09-22-fix-explore-evidence-mirror-contention/workpad.md`
- 2026-09-23 02:19:56 fs.write: `.task/self-healing/2026-09-22-fix-explore-evidence-mirror-contention/workpad.md`
- 2026-09-23 02:25:04 fs.write: `packages/os/tests/explore-evidence-mirror.test.ts`
- 2026-09-23 02:28:54 fs.write: `.task/self-healing/2026-09-22-fix-explore-evidence-mirror-contention/workpad.md`

## workspace-owned: validation evidence

- 2026-09-23 02:20:10 `review.run`: passed — OK
- 2026-09-23 02:20:34 `review.run`: passed — OK
- 2026-09-23 02:22:04 `verify`: failed — COMMAND_FAILED
- 2026-09-23 02:25:51 `review.run`: passed — OK
- 2026-09-23 02:27:16 `verify`: passed — OK

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
bun run task:push -- --message "type(self-healing): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: Explore is declared read-only and must return retrieval results under ordinary concurrent use while preserving required evidence mirroring. Its primary `explore.result` evidence write must not open an unnecessary second semantic-index SQLite connection after `ensureIndex` already supplied the live store; independent ordinary-use traces show that second mirror path hard-failing with `mirrorEventToStore failed: database is locked`.
existing local pattern: `ensureIndex()` returns `indexResult.store`; `createStore()` configures WAL plus a 10s busy timeout; `appendEvidenceEvent()` currently always calls `createStore()` again for mirroring and `explore.js` sets `{ requireMirror: true }`.
new or changed tests: add focused evidence-log coverage proving a supplied existing store is used for required mirroring and is not closed by the evidence helper; add Explore contract coverage that passes the `ensureIndex` store into the required `explore.result` evidence write.
focused red command: `bun test packages/os/tests/explore-evidence-mirror.test.ts`
expected red failure: current `appendEvidenceEvent` has no supported existing-store mirror path / Explore does not pass its existing index store, so the new regression assertions fail before implementation.
no-test waiver: not applicable.

## Investigation note

Independent operational evidence predates this task: ordinary no-task Explore calls on 2026-09-22 failed with `mirrorEventToStore failed: database is locked` (one after ~10.9s, matching the configured SQLite busy timeout), and a separate ordinary task later hit the same failure after the installed 0.1.130 update. A three-way read-only Explore probe also reproduced all-call failure under concurrency. This is not schedule-only evidence. Current tool metadata declares `explore` read-only; current source still requires the result evidence mirror, so the correction must preserve required mirroring rather than swallow the error.

- 2026-09-23 02:14:22 append: `.task/self-healing/2026-09-22-fix-explore-evidence-mirror-contention/workpad.md`

## workspace-owned: files read

- `packages/os/definitely-missing.json`
- `packages/os/scripts/explore.js`
- `packages/os/scripts/lib/daily-schedules.ts`
- `packages/os/scripts/lib/index/store.js`
- `packages/os/scripts/lib/state/evidence-log.js`
- `packages/os/scripts/lib/state/explore-state.js`
- `packages/os/tests/explore-evidence-mirror.test.ts`
- `packages/os/tests/explore-runtime-routing.test.ts`
- `packages/workspace/scripts/explore.js`
- `packages/workspace/scripts/lib/index/store.js`
- `packages/workspace/scripts/lib/state/evidence-log.js`
- `packages/workspace/scripts/verify.js`

## TDD RED

Focused regression reproduced the contract gap before production edits:
`bun test packages/os/tests/explore-evidence-mirror.test.ts` -> **0 pass / 2 fail**.
The public `appendEvidenceEvent(..., { requireMirror: true, store })` path ignored the caller-owned store (0 insert calls), and both Explore implementations lacked `store: indexResult.store` on the required mirror. This is the expected RED for the selected defect.

- 2026-09-23 02:16:05 append: `.task/self-healing/2026-09-22-fix-explore-evidence-mirror-contention/workpad.md`

- 2026-09-23 02:16:22 apply-patch: `packages/os/scripts/lib/state/evidence-log.js`
- 2026-09-23 02:16:22 apply-patch: `packages/workspace/scripts/lib/state/evidence-log.js`
- 2026-09-23 02:16:22 apply-patch: `packages/os/scripts/explore.js`
- 2026-09-23 02:16:22 apply-patch: `packages/workspace/scripts/explore.js`

- 2026-09-23 02:18:37 apply-patch: `packages/os/tests/explore-evidence-mirror.test.ts`
## Runtime-validation expansion: second coherent lock root cause

After the first fix went GREEN, a realistic three-process Explore probe still failed 2/3 calls. A diagnostic rerun exposed the failure before retrieval: `registerSemanticIndex()` opened the shared Consuelo registry database and its runtime-asset UPSERT failed immediately with `SQLiteError: database is locked`. This is the same ordinary Explore concurrency invariant, not maintenance-harness work. The earlier ordinary no-task generic `explore failed` traces provide independent user-session evidence; this deterministic reproduction localizes the cause.

A new regression was added before editing the registry path. It deliberately holds a short `BEGIN IMMEDIATE` lock on `consuelo.db` and invokes `registerSemanticIndex` from another process. RED: **2 pass / 1 fail**, child exits 1 with `database is locked`. The intended correction is bounded SQLite lock waiting at the registry connection, matching the semantic-index connection's existing 10s contention policy; no exception swallowing or blind application retry.

- 2026-09-23 02:18:51 append: `.task/self-healing/2026-09-22-fix-explore-evidence-mirror-contention/workpad.md`

- 2026-09-23 02:19:01 apply-patch: `packages/os/scripts/lib/index/store.js`
## GREEN and runtime validation

Focused GREEN after the two related corrections: `packages/os/tests/explore-evidence-mirror.test.ts` -> **3 pass / 0 fail**. The caller-owned semantic store is used for required evidence mirroring without being closed by the helper, both Explore implementations route required mirrors through the existing `indexResult.store`, and the Consuelo registry connection waits through a bounded short write lock instead of failing immediately.

Relevant focused suite (`explore-evidence-mirror`, `explore-runtime-routing`, OS script-parity audit) -> **8 pass / 0 fail / 2282 assertions**. A broader Explore hydration run had one unrelated pre-existing timing test hit its 20s test timeout while 13 other tests passed; no changed path from this task participates in that hydration timeout assertion.

Realistic task-source runtime probe: three concurrent OS Explore processes against the same repository all completed successfully (**3/3 exit 0**) after the correction. Before the registry fix the same probe failed 2/3, and a diagnostic localized the failures to `registerSemanticIndex()` on `consuelo.db`. Runtime-generated global `.task/evidence-log.json` / `.task/explore-state.json` probe side effects were restored; only task-local metadata/workpad and the intended source/test files remain.

- 2026-09-23 02:19:56 append: `.task/self-healing/2026-09-22-fix-explore-evidence-mirror-contention/workpad.md`

- 2026-09-23 02:20:17 apply-patch: `packages/os/tests/explore-evidence-mirror.test.ts`

- 2026-09-23 02:25:04 write: `packages/os/tests/explore-evidence-mirror.test.ts`

- 2026-09-23 02:25:31 apply-patch: `packages/os/tests/explore-evidence-mirror.test.ts`

## Daily self-healing investigation summary

Date: 2026-09-22 (America/New_York maintenance day)

Source and runtime:
- task: `task/self-healing/2026-09-22-fix-explore-evidence-mirror-contention`
- task session: `tsk_dcef2f71f9d3`
- started from current `main` at the task bootstrap source; current authoritative `main`, `stream/os`, recent merged OS work, and open OS PRs were inspected before task creation.
- installed Consuelo OS: `0.1.130`.
- installed typed `monitor.errors` is source/runtime-drifted (`monitor:errors` entry point unavailable), so the permitted current-repository read-only equivalent produced the deterministic report.

Normalized 24-hour health report:
- groups observed: **79**
- raw classifier actionable/defect-candidate groups: **17**
- serious candidate families investigated: **8** (`code.call`, `fs.search`, `release`, `deployment.logs`, `authorization.mcp`, `verify`, `batch`, `explore`)

Candidate classification:
- `code.call`: task-local TDD/build failures, documentation build prerequisites, SIGPIPE, and read-mode mutation enforcement; no wrapper source defect established.
- `fs.search`: invalid paths/regex/limits; caller input.
- `release`: installed-runtime timeout/source drift plus healthy clean-merge/provider enforcement; no new bounded source defect.
- `deployment.logs`: customer-path failure overlaps the already-open regression-backed PR #2530; not duplicated.
- `authorization.mcp`: token/auth enforcement; no evidence to weaken authentication.
- `verify`: validation/publish gates and task-local failures; not a product defect.
- `batch`: aggregate child failures; not a root cause.
- `explore`: **real source defect selected from ordinary non-scheduled sessions**.

Independent Explore evidence predating this maintenance task included ordinary no-task failures such as `mirrorEventToStore failed: database is locked` after approximately the configured SQLite busy window, plus neighboring ordinary Explore calls ending as generic `explore failed`. A later ordinary task after OS 0.1.130 reproduced the same mirror-lock failure. These were not generated solely by self-healing/security schedules.

Governing contract: `explore` is a read-only retrieval tool. Successful retrieval must retain required evidence persistence, but a required evidence write must not introduce an avoidable competing connection that makes the read-only call fail under normal concurrent use. The fix preserves required mirroring and propagates genuine persistence failures; it does not suppress traces or convert failure into fake success.

Selected coherent root causes and source corrections:
1. Required Explore evidence mirroring opened a second semantic-index SQLite connection even though `ensureIndex()` already returned the live store. The evidence helper now accepts/reuses the caller-owned store, does not close caller-owned resources, and both mirrored Explore implementations pass `indexResult.store` for required evidence writes.
2. Realistic concurrent validation exposed a second lock point in the same Explore concurrency invariant: `registerSemanticIndex()` wrote the shared Consuelo runtime-asset registry without any bounded busy wait. The OS registry connection now applies the same 10-second SQLite `busy_timeout` policy already used by the semantic-index connection. This is SQLite lock waiting, not a blind application retry.

Regression and validation:
- initial mirror RED: **0 pass / 2 fail** before production edits.
- registry-contention RED added after runtime localization: **2 pass / 1 fail**, contender exited with `database is locked`.
- final dedicated regression: **3 pass / 0 fail** under the package's Node/Vitest runner.
- related focused suite: **8 pass / 0 fail / 2282 assertions**.
- realistic concurrent Explore probe against the task source: **3/3 processes exit 0** after the corrections; before the registry correction the same probe failed 2/3.
- one broader pre-existing Explore hydration timing test hit its 20-second timeout during an intermediate run; it is outside the changed lock/evidence paths and was not used to justify additional maintenance-harness work.
- strict review against `origin/main`: **0 blocking issues**.
- final full verify: **PASS / publish-valid / full mode**.
- DB guard: **0 risks / 0 findings**.

Hosted install/onboarding normalized impact telemetry was not exposed through the current typed read surface during this run, so no external-user impact was invented. Sentry was not used as a substitute source of truth for this defect.

Maintenance-harness changes: **0**. No monitor classifier, security scan, Daily Schedules, task/stream lifecycle, or test-selection source was changed.

Daily task PR: **#2563**. Promotion into `stream/self-healing` is the next authorized lifecycle step after this publish-valid verification. `stream/self-healing -> main` remains human-only.

- 2026-09-23 02:28:54 append: `.task/self-healing/2026-09-22-fix-explore-evidence-mirror-contention/workpad.md`

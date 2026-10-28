# DEV-1616 finish callback lifecycle draining after-hours and reschedule guards

branch: `task/dialer/dev-1616-finish-callback-lifecycle-draining-after-hours-and-reschedule-guards`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2631
started: 2026-10-28

## acceptance criteria

- [x] Preserve durable callback reconciliation when the last callback number is disabled; fail closed if the recipient secret or configured number is missing.
- [x] End associated telephony sessions transactionally for fulfilled, cancelled, expired, and exhausted callbacks.
- [x] Schedule caller-selected after-hours IVR callbacks into a permitted staffed window.
- [x] Claim and fence the callback revision before any external calendar cancellation; retain the fence on unknown provider outcomes.
- [x] Validate on real Postgres with simulated provider behavior and publish through the task-to-stream workflow without calls or deployment.

## plan

1. Reuse the existing managed task session/PR and implementation; avoid restarting or touching sibling work.
2. Recheck remote PR, Linear acceptance, scoped diff, live writer status, test-first evidence, and previous review.
3. Rerun the three focused service-backed Postgres suites and strict review.
4. Inspect the real verify state/stamp, correct any blocker, then push and promote to stream/dialer; verify both SHAs and PR states.

## files changed

- `packages/dialer-server/src/inbound/{callbacks.ts,callback-telephony.integration.test.ts,callbacks.integration.test.ts,customer-entry.ts,telephony-admission.ts,telephony.integration.test.ts,telephony.ts}`
- `packages/dialer-server/src/runtime/inbound.ts`

## key decisions

- Reuse the previous implementation and its red/green TDD history; no fresh branch or parallel writer.
- A durable `callback-reschedule:` routing marker prevents offering during unknown calendar cancellation and is released with the new window in one transaction.
- Disabled numbers remain configured for reconciliation, even when no callback activation is enabled.
- No live calls, provider effects beyond simulated tests, deployment, main merge, rep-readiness or release/build edits.

## notes for ko

- Existing PR #2631 starts at `bb6f1c1d6c6391072b7230b1acf590d16e34c103`; bootstrap PR still open before publication.
- Resumed task session `tsk_b8f12f6d23cf`; tmux pane is an idle bash prompt, no competing DEV-1616 writer process seen.
- All four DEV-1616 acceptance cases are covered by the existing Postgres integration tests.

## improvements noticed

- The workflow must inspect the verify stamp/completion explicitly, not treat the facade's outer OK as passing validation.

## errors i ran into

- A previous verification stamp was absent on resumption; full verification must be completed before promotion.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## DEV-1616 scope and TDD
Linear DEV-1616 read before edits (2026-10-27); source refreshed before edit. Own active callback draining when last number disabled/secret missing, terminal telephony session mode ended, after-hours IVR scheduling in staffed window, and claim-before-external-cancel reschedule fencing. No live calls, deploy, merge or build/release/rep-readiness changes. Preserve unknown provider/cancellation outcomes and external owners.
Test-first contract: write dedicated Postgres-backed regressions for all four cases, run red, implement narrowly, rerun. Runtime tests use real Postgres + fake carrier; calendar tests use simulated adapter with controllable pending cancellation. Existing local pattern: packages/dialer-server/src/inbound/callbacks.integration.test.ts, telephony.integration.test.ts, callback-telephony.integration.test.ts, runtime inbound tests. Focused command: CONSUELO_RD5_PG_PORT=55415 CONSUELO_RD6_PG_PORT=55415 bun test <affected tests>. Expected red: disabled last callback number stranding work, terminal session stays callback_requested, after-hours IVR rejected, racing reschedule cancels booking before routing claim. Waiver: none.

- 2026-10-28 02:50:15 append: `.task/dialer/dev-1616-finish-callback-lifecycle-draining-after-hours-and-reschedule-guards/workpad.md`

## workspace-owned: files changed

- `packages/dialer-server/src/inbound/{callbacks.ts,callback-telephony.integration.test.ts,callbacks.integration.test.ts,customer-entry.ts,telephony-admission.ts,telephony.integration.test.ts,telephony.ts}`
- `packages/dialer-server/src/runtime/inbound.ts`

## workspace-owned: activity log

- 2026-10-28 02:50:15 fs.write: `.task/dialer/dev-1616-finish-callback-lifecycle-draining-after-hours-and-reschedule-guards/workpad.md`
- 2026-10-28 02:55:52 fs.write: `.task/dialer/dev-1616-finish-callback-lifecycle-draining-after-hours-and-reschedule-guards/workpad.md`
- 2026-10-28 03:03:38 fs.write: `.task/dialer/dev-1616-finish-callback-lifecycle-draining-after-hours-and-reschedule-guards/workpad.md`
- 2026-10-28 04:36:32 fs.write: `.task/dialer/dev-1616-finish-callback-lifecycle-draining-after-hours-and-reschedule-guards/workpad.md`

## workspace-owned: files read

- `packages/dialer-server/package.json`
- `packages/dialer-server/src/database/migrations.ts`
- `packages/dialer-server/src/inbound/callback-migration.ts`
- `packages/dialer-server/src/inbound/callback-telephony.integration.test.ts`
- `packages/dialer-server/src/inbound/callbacks.integration.test.ts`
- `packages/dialer-server/src/inbound/callbacks.ts`
- `packages/dialer-server/src/inbound/customer-entry.ts`
- `packages/dialer-server/src/inbound/postgres-journal.ts`
- `packages/dialer-server/src/inbound/routing-migration.ts`
- `packages/dialer-server/src/inbound/routing-store.ts`
- `packages/dialer-server/src/inbound/telephony-admission.ts`
- `packages/dialer-server/src/inbound/telephony-config.test.ts`
- `packages/dialer-server/src/inbound/telephony.integration.test.ts`
- `packages/dialer-server/src/inbound/telephony.ts`
- `packages/dialer-server/src/runtime/inbound.ts`
- `packages/dialer/src/inbound/callback-obligation.ts`
- `packages/dialer/src/inbound/callback-policy.ts`
- `packages/dialer/src/inbound/callback-scheduler.ts`
- `packages/workspace/scripts/verify.js`

## Red evidence (2026-10-27)
Fresh origin/stream/dialer = 4bda792af2e2b911658af0422f58f1bbdd8f963f; task bootstrap bb6f1c1d6c6391072b7230b1acf590d16e34c103. Isolated Postgres 16 active 127.0.0.1:55415. Telephony after-hours Postgres test: 19 pass 1 fail as expected 'Callback service window must begin during staffed hours' (trace trc_0dfff29e46e0). Callback suite red at module import missing new assertPendingCallbacksCanDrain helper, expected from test-first specification (trace trc_5d1079b3b2a4). Added tests for terminal session, provider-cancellation reentrancy and durable routing claim. Next implement production helper and callback reschedule fence, then rerun tests.

- 2026-10-28 02:55:52 append: `.task/dialer/dev-1616-finish-callback-lifecycle-draining-after-hours-and-reschedule-guards/workpad.md`

- 2026-10-28 02:56:12 apply-patch: `packages/dialer-server/src/runtime/inbound.ts`
- 2026-10-28 02:56:24 apply-patch: `packages/dialer-server/src/inbound/callbacks.ts`

- 2026-10-28 02:56:53 apply-patch: `packages/dialer-server/src/inbound/customer-entry.ts`
- 2026-10-28 02:56:53 apply-patch: `packages/dialer-server/src/inbound/telephony-admission.ts`
- 2026-10-28 02:57:27 apply-patch: `packages/dialer-server/src/inbound/callbacks.ts`
- 2026-10-28 02:58:02 apply-patch: `packages/dialer-server/src/inbound/callbacks.ts`
- 2026-10-28 02:58:38 apply-patch: `packages/dialer-server/src/inbound/callbacks.ts`
- 2026-10-28 02:58:55 apply-patch: `packages/dialer-server/src/inbound/callbacks.ts`

- 2026-10-28 03:00:10 apply-patch: `packages/dialer-server/src/inbound/callbacks.integration.test.ts`
- 2026-10-28 03:00:10 apply-patch: `packages/dialer-server/src/inbound/callbacks.ts`

- 2026-10-28 03:01:16 apply-patch: `packages/dialer-server/src/inbound/callback-telephony.integration.test.ts`
- 2026-10-28 03:01:16 apply-patch: `packages/dialer-server/src/inbound/callbacks.integration.test.ts`

- 2026-10-28 03:03:07 apply-patch: `packages/dialer-server/src/inbound/telephony.ts`
- 2026-10-28 03:03:07 apply-patch: `packages/dialer-server/src/inbound/telephony.integration.test.ts`
## Green implementation evidence
Files: packages/dialer-server/src/runtime/inbound.ts (assertPendingCallbacksCanDrain on durable nonterminal obligations; missing secret or missing configured number fails boot even when last callback-enabled number is disabled); packages/dialer-server/src/inbound/callbacks.ts (terminal status writes callback session mode ended in same transaction, durable callback-reschedule routing marker claim before calendar cancellation, per-tenant routing lock/active assignment fencing, retry same claim after unknown cancellation, conflict checks and new-window atomic release); packages/dialer-server/src/inbound/customer-entry.ts (reuse timezone/DST-aware staffed window authority); telephony-admission.ts (IVR scheduled notBefore next eligible staff window, bounded by service window); telephony.ts (poll actual original caller session after callback choice, excluding synthetic callback sessions, ending only on terminal carrier status); focused callback/inbound tests. No rep-readiness/release/build/deployment files changed.
Focused Postgres suite: CONSUELO_RD5_PG_PORT=55415 CONSUELO_RD6_PG_PORT=55415 bun test packages/dialer-server/src/inbound/telephony.integration.test.ts packages/dialer-server/src/inbound/callbacks.integration.test.ts packages/dialer-server/src/inbound/callback-telephony.integration.test.ts => 47 pass, 0 fail, 307 assertions, trace trc_723de7381551. TypeScript checked earlier; rerun review and full verify. Ambiguous calendar cancellation remains fenced until matching provider evidence; no live calls/merge/deploy.

- 2026-10-28 03:03:38 append: `.task/dialer/dev-1616-finish-callback-lifecycle-draining-after-hours-and-reschedule-guards/workpad.md`

## workspace-owned: validation evidence

- 2026-10-28 03:03:52 `review.run`: passed — OK
- 2026-10-28 04:34:30 `review.run`: passed — OK
- 2026-10-28 04:34:48 apply-patch: `.task/dialer/dev-1616-finish-callback-lifecycle-draining-after-hours-and-reschedule-guards/workpad.md`
- 2026-10-28 04:34:53 `verify`: passed — OK

## Resumption and full publication-gate evidence (2026-10-28)

- Recovered the original managed session `tsk_b8f12f6d23cf` from the task metadata; did not create a new task or worktree. The tmux pane contained an idle bash prompt, no DEV-1616 worker children or recent file edits. Inspected current #2631, Linear acceptance, scoped diff and review feedback. Existing PR bootstrap SHA `bb6f1c1d6c6391072b7230b1acf590d16e34c103` matched the remote. No actionable inline review feedback.
- The existing eight production/test edits are preserved. Sibling DEV-1615, DEV-1614 and DEV-1617 changes are already on `origin/stream/dialer` at `f46b69d9dc8ce16a860b93499a768280db650923`. No fresh production edits were needed.
- Repeated focused service-backed Postgres plus simulated carrier validation: `CONSUELO_RD5_PG_PORT=55415 CONSUELO_RD6_PG_PORT=55415 bun test packages/dialer-server/src/inbound/telephony.integration.test.ts packages/dialer-server/src/inbound/callbacks.integration.test.ts packages/dialer-server/src/inbound/callback-telephony.integration.test.ts`. Result: **47 passed, 0 failed, 307 assertions**, trace `trc_e586adf6bee7`.
- Strict `review.run` against `origin/stream/dialer`: **zero blocking findings**, ESLint/typecheck/static/spec checks passed, trace `trc_2fb5b1995e7e`.
- The initial typed `verify` returned outer `OK` but `passed=false, publishValid=false`, with no scoped stamp. Raw gate inspection identified an unrelated test-registry environment failure: `yarn nx run @consuelo/contacts:build` stopped at `Unsupported package manager specification (bun@1.3.14)`. We did **not** edit the DEV-1617 build/release files. Running the same full verification with `COREPACK_ENABLE_PROJECT_SPEC=0` selected Corepack's Yarn 1.22.22 and allowed its existing two required suites to run.
- Full real `verify.js --base origin/stream/dialer --json` with `COREPACK_ENABLE_PROJECT_SPEC=0 CONSUELO_RD5_PG_PORT=55415 CONSUELO_RD6_PG_PORT=55415`: exit 0, full mode, `passed=true`, `publishValid=true`, contacts prerequisite and dialer-server Hono contracts both passed, review passed, DB guard 0 findings; trace `trc_1067457c3b78`. **Real scoped verify.json** inspected separately, `result=pass`, `publishValid=true`, `verifiedAt=2026-10-28T04:36:02.935Z`, `changeHash=0e896fe571872f40dcff5f4634a2dde7111f0bbd66c03d2025033dfeb0ff1312`, original HEAD `bb6f1c1d6c6391072b7230b1acf590d16e34c103`.
- `task.ensureSynced` warned the stream is behind main; deliberately do **not** run `stream.sync` because main sync is outside this task's scope and user explicitly forbids merging main. Preserve sibling commits and promote the clean task PR directly into stream/dialer.
- Remaining risks: unknown provider/calendar cancellation must stay fenced pending provider reconciliation; production calendar adapter is not composed; no live provider/calls, production smoke or deployment executed. The legacy `yarn` test-selector invocation needs eventual owner repair but an environment-only workaround proves the unchanged full test registry passed.

- 2026-10-28 04:36:32 append: `.task/dialer/dev-1616-finish-callback-lifecycle-draining-after-hours-and-reschedule-guards/workpad.md`

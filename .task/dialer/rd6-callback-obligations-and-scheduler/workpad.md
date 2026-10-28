# RD6 callback obligations and scheduler

branch: `task/dialer/rd6-callback-obligations-and-scheduler`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2474/rd6-callback-obligations-and-scheduler
github pr: https://github.com/consuelohq/opensaas/pull/2474
started: 2026-09-13

## acceptance criteria

- [x] Create durable immediate/scheduled callback obligations without reserving rep capacity before due time.
- [x] Add bounded callback attempts with rep-first initiation, customer no-answer handling, cancellation, reschedule revisions, missed-window/exhausted/uncertain outcomes, and restart-safe idempotency.
- [x] Preserve original queue entry plus explicit not-before/deadline across reschedules; make timezone/DST behavior deterministic.
- [x] Reuse RD3 shared capacity authority and RD4 routing policy; do not introduce a second scheduler/reservation authority.
- [x] Provide provider-neutral consent/eligibility and calendar/booking ports with deterministic test adapters; do not invent a real calendar provider.
- [x] Prove duplicate scheduler ticks/restarts cannot duplicate provider initiation and cancellation during dialing reconciles escaped effects safely.
- [x] Add real Postgres/Redis + simulator failure scenarios and retain outbound/inbound regression coverage.
- [ ] Write `areas/dialer/rd/receipts/RD6.md`, pass strict review/verify, and integrate only to `stream/dialer`.

## plan

1. Read RD6 graph/design/acceptance plus RD1/RD3/RD4/RD5 callback/capacity/routing seams.
2. Write focused red tests for scheduler due-time selection, duplicate tick/restart idempotency, no-answer release/retry, cancellation during dialing, reschedule/DST, and calendar-unavailable truthfulness.
3. Implement provider-neutral RD6 contracts/services first, then Postgres persistence/migration and runtime composition using existing journal/outbox + RD3 capacity authority.
4. Extend the isolated inbound lab with callback crash/replay scenarios and real Postgres/Redis proof.
5. Run focused tests -> package suites/typechecks/builds -> strict review -> canonical verify -> receipt -> task push/PR/finish.

## Test-first contract

behavior under test: due callback obligations schedule exactly one rep-first attempt; duplicate ticks/restarts do not duplicate initiation; no-answer/cancel/reschedule/restart converge durable obligation + RD3 capacity correctly; original entry/deadline and timezone/service-window semantics remain truthful.
existing local pattern: RD1 `inbound` immutable identities + journal/outbox, RD3 shared capacity generation/fencing, RD4 callback-aware routing policy, RD5 durable external-effect reconciliation, RD2 isolated Postgres/Redis simulator.
new or changed tests: new `packages/dialer/src/inbound/callback-*.test.ts` domain/service tests plus dialer-server real-Postgres callback integration and lab scenarios; extend migration tests for additive RD6 schema.
focused red command: `bun test packages/dialer/src/inbound/callback-scheduler.test.ts` (after creating the spec).
expected red failure: callback scheduler/contracts module is absent, proving RD6 behavior is not implemented by existing RD1/RD4 placeholders.
no-test waiver: not applicable.

## current status

- RD6 implementation is complete and integrated with the current `origin/stream/dialer`, including parallel RD7A acceptance closure.
- Post-merge ordinary suites: LeadConnector 136/136, Dialer 261/261, Dialer Server 189/189 green.
- Post-merge real-Postgres RD3→RD6 matrix: 43/43 green; isolated Postgres+Redis lab green; Dialer and Dialer Server production builds green.
- Strict review against current `origin/stream/dialer`: 0 findings / 0 blockers.
- `areas/dialer/rd/receipts/RD6.md` written. Next gate: canonical verify, then task push/PR/finish into `stream/dialer` only.

## files changed

- `packages/dialer-server/scripts/local-dialer-lab.ts`
- `packages/dialer-server/src/database/migrations.test.ts`
- `packages/dialer-server/src/database/migrations.ts`
- `packages/dialer-server/src/inbound/README.md`
- `packages/dialer-server/src/inbound/rep-capacity-commands.ts`
- `packages/dialer-server/src/inbound/rep-capacity-projection.ts`
- `packages/dialer-server/src/inbound/rep-capacity.integration.test.ts`
- `packages/dialer-server/src/inbound/routing.integration.test.ts`
- `packages/dialer-server/src/inbound/telephony-admission.ts`
- `packages/dialer-server/src/inbound/telephony-commands.ts`
- `packages/dialer-server/src/inbound/telephony-config.ts`
- `packages/dialer-server/src/inbound/telephony-contracts.ts`
- `packages/dialer-server/src/inbound/telephony-endpoints.ts`
- `packages/dialer-server/src/inbound/telephony-reconciliation.ts`
- `packages/dialer-server/src/inbound/telephony-store.ts`
- `packages/dialer-server/src/inbound/telephony-twiml.ts`
- `packages/dialer-server/src/inbound/telephony.integration.test.ts`
- `packages/dialer-server/src/inbound/telephony.test.ts`
- `packages/dialer-server/src/inbound/telephony.ts`
- `packages/dialer-server/src/lab/learning-rollback-scenario.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.integration.test.ts`
- `packages/dialer-server/src/runtime/inbound.ts`
- `packages/dialer-server/tsconfig.json`
- `packages/dialer/src/inbound/index.ts`
- `packages/dialer/src/inbound/lifecycle.ts`
- `areas/dialer/rd/receipts/RD6.md`
- `packages/dialer-server/src/inbound/callback-migration.ts`
- `packages/dialer-server/src/inbound/callback-recipient-cipher.test.ts`
- `packages/dialer-server/src/inbound/callback-recipient-cipher.ts`
- `packages/dialer-server/src/inbound/callback-telephony.integration.test.ts`
- `packages/dialer-server/src/inbound/callback-telephony.ts`
- `packages/dialer-server/src/inbound/callbacks.integration.test.ts`
- `packages/dialer-server/src/inbound/callbacks.ts`
- `packages/dialer/src/inbound/callback-contracts.ts`
- `packages/dialer/src/inbound/callback-ports.ts`
- `packages/dialer/src/inbound/callback-scheduler.test.ts`
- `packages/dialer/src/inbound/callback-scheduler.ts`


## workspace-owned: files changed

- `areas/dialer/rd/receipts/RD6.md`
- `packages/dialer-server/src/inbound/callback-recipient-cipher.ts`
- `packages/dialer-server/src/inbound/callback-telephony.integration.test.ts`
- `packages/dialer-server/src/inbound/callback-telephony.ts`
- `packages/dialer-server/src/inbound/callbacks.integration.test.ts`
- `packages/dialer-server/src/inbound/callbacks.ts`

## workspace-owned: activity log

- 2026-09-13 20:22:21 fs.write: `packages/dialer-server/src/inbound/callback-recipient-cipher.ts`
- 2026-09-13 20:27:24 fs.write: `packages/dialer-server/src/inbound/callbacks.ts`
- 2026-09-13 20:31:36 fs.write: `packages/dialer-server/src/inbound/callbacks.integration.test.ts`
- 2026-09-13 20:37:26 fs.write: `packages/dialer-server/src/inbound/callback-telephony.ts`
- 2026-09-13 20:42:07 fs.write: `packages/dialer-server/src/inbound/callback-telephony.integration.test.ts`
- 2026-09-13 20:55:02 fs.write: `areas/dialer/rd/receipts/RD6.md`

## workspace-owned: validation evidence

- 2026-09-13 20:49:57 `review.run`: passed — OK
- 2026-09-13 20:51:17 `review.run`: passed — OK
- 2026-09-13 20:54:01 `review.run`: passed — OK
- 2026-09-13 20:55:27 `verify`: passed — OK
- 2026-09-13 20:56:59 `verify`: passed — OK

## key decisions

- RD6 starts from `stream/dialer` head `371db6f7ca`; the first accidental main-based bootstrap task is superseded and contains no product work.
- Callback identity remains the RD1 immutable original promise; RD6 adds attempt/revision/scheduler state rather than mutating identity or creating a new capacity authority.
- Due callbacks flow through RD4/RD3 for routing/capacity. Capacity is acquired only when due and released between bounded retry attempts unless an external effect is uncertain.
- Real calendar booking stays behind a provider-neutral port + activation gate; deterministic tests must never present a request as externally confirmed without evidence.

## notes for ko

- RD6 is ready for RD7B once #2474 is integrated into `stream/dialer`; RD8 still owns live-provider/release proof.
- No live carrier call, provider spend, recording/transcription, production deployment, or real calendar booking occurred in RD6.

## improvements noticed

- Task bootstrap should accept/retain an explicit stream base through `session.start`; the first bootstrap defaulted to `main` and had to be superseded before product edits.
- Task worktrees should resolve workspace-package subpath exports from the task source tree rather than depending on root-checkout `dist` symlinks; RD6 added the explicit LeadConnector embed source alias for deterministic typechecking.

## issues and recovery

- Initial `session.start` bootstrapped PR #2472 from `main`, which would have crossed the RD8 main-reconciliation boundary. No product edits were made there. Started canonical RD6 task #2474 explicitly from `stream/dialer` instead.
- Parallel semantic discovery timed out once; narrowed to focused repository reads/grep with no loss of task state.
- RD7A acceptance landed on `stream/dialer` during RD6. Merged the current stream into the task with an autostash; the only conflict was `telephony-admission.ts`. Preserved both RD7A acceptance fencing and RD6 callback admission, reran all ordinary/service-backed/build/review gates, verified the autostash file set exactly matched the restored task changes, then dropped only that autostash.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `areas/dialer/rd/ACCEPTANCE.md`
- `areas/dialer/rd/DESIGN.md`
- `areas/dialer/rd/GRAPH.md`
- `areas/dialer/rd/README.md`
- `areas/dialer/rd/receipts/RD1.md`
- `areas/dialer/rd/receipts/RD7A.md`
- `packages/dialer-server/scripts/local-dialer-lab.ts`
- `packages/dialer-server/src/database/migrations.test.ts`
- `packages/dialer-server/src/database/migrations.ts`
- `packages/dialer-server/src/inbound/README.md`
- `packages/dialer-server/src/inbound/callbacks.ts`
- `packages/dialer-server/src/inbound/migration.ts`
- `packages/dialer-server/src/inbound/operator.ts`
- `packages/dialer-server/src/inbound/postgres-journal.ts`
- `packages/dialer-server/src/inbound/rep-capacity-commands.ts`
- `packages/dialer-server/src/inbound/rep-capacity-projection.ts`
- `packages/dialer-server/src/inbound/rep-capacity.integration.test.ts`
- `packages/dialer-server/src/inbound/rep-capacity.ts`
- `packages/dialer-server/src/inbound/routing-migration.ts`
- `packages/dialer-server/src/inbound/routing-store.ts`
- `packages/dialer-server/src/inbound/routing.integration.test.ts`
- `packages/dialer-server/src/inbound/routing.ts`
- `packages/dialer-server/src/inbound/telephony-admission.ts`
- `packages/dialer-server/src/inbound/telephony-commands.ts`
- `packages/dialer-server/src/inbound/telephony-config.ts`
- `packages/dialer-server/src/inbound/telephony-contracts.ts`
- `packages/dialer-server/src/inbound/telephony-endpoints.ts`
- `packages/dialer-server/src/inbound/telephony-migration.ts`
- `packages/dialer-server/src/inbound/telephony-reconciliation.ts`
- `packages/dialer-server/src/inbound/telephony-store.ts`
- `packages/dialer-server/src/inbound/telephony-twiml.ts`
- `packages/dialer-server/src/inbound/telephony.integration.test.ts`
- `packages/dialer-server/src/inbound/telephony.test.ts`
- `packages/dialer-server/src/inbound/telephony.ts`
- `packages/dialer-server/src/inbound/twilio-carrier.ts`
- `packages/dialer-server/src/lab/learning-rollback-scenario.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.integration.test.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.ts`
- `packages/dialer-server/src/runtime/inbound.ts`
- `packages/dialer/src/inbound/callback-scheduler.ts`
- `packages/dialer/src/inbound/contracts.ts`
- `packages/dialer/src/inbound/index.ts`
- `packages/dialer/src/inbound/lifecycle.test.ts`
- `packages/dialer/src/inbound/lifecycle.ts`
- `packages/dialer/src/inbound/rep-capacity-contracts.ts`
- `packages/dialer/src/inbound/rep-capacity-ports.ts`
- `packages/dialer/src/inbound/rep-capacity.ts`
- `packages/dialer/src/inbound/routing-contracts.ts`
- `packages/dialer/src/inbound/routing-policy.ts`
- `packages/dialer/src/inbound/routing-ports.ts`

- 2026-09-13 20:55:02 write: `areas/dialer/rd/receipts/RD6.md`

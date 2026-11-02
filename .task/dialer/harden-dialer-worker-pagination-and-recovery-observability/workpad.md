# Harden dialer worker pagination and recovery observability

branch: `task/dialer/harden-dialer-worker-pagination-and-recovery-observability`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2767
started: 2026-11-02

## acceptance criteria

- [x] Replace fixed-prefix/1000-row abort and silent truncation in inbound sessions, effects, capacity, callback commands/obligations, outbound reconciliation, and expired recordings with bounded keyset pages.
- [x] Eventually visit work beyond 1000 retained rows, retry the head after wrap, isolate independent workspaces and command statuses, and resume safely after process restart.
- [x] Expose aggregate backlog counts/oldest age with privacy-safe structured logs and aging/stalled-tick warnings.
- [x] Preserve provider-effect uncertainty and Wave 1/2 safety; no live calls, billing changes, deployments, or main merge.
- [x] Test-first red→green; unit, mocked/PG-backed integration, typecheck, build, strict review, diff integrity.
- [x] Formal verification passed with publish-valid stamp (review, package tests, dependency builds, DB guard).
- [ ] Task push and promotion into stream/dialer only.

## plan

1. Confirm stream incorporates Waves 1 and 2; inspect existing worker queries, migrations, logger, and tests.
2. Write a test-first contract and red tests for bounded keyset scans, cursor rollover, independent tenants, restart, and oldest-age alert classification.
3. Add a reusable bounded scanner, use it for current fixed-prefix worker lists, and add periodic aggregated recovery-lag telemetry to the worker.
4. Run focused tests, cross-boundary tests, strict review, formal verification, inspect diff/PR, and publish only to stream/dialer.

## Test-first contract

behavior under test: backlog greater than one page is eventually visited without exceeding a page bound; filters work independently across workspaces and lifecycle statuses; a failed prefix cannot starve tail; restart replays safely rather than losing work; recovery alerts fire for aging pending/unknown outcomes with aggregate-only details.
existing local pattern: `postgres-journal.listCommands(workspaceId,status,afterCommandId)`, `rep-capacity.list({afterCapacityId,limit})`, existing bounded SQL `ORDER BY ... LIMIT`, worker returns aggregate failures.
new or changed tests: new isolated worker-pagination test with synthetic >1000 row fixtures + cursor/wrap/failed-head/restart; new recovery age classification tests; then integration exercise Postgres-backed worker pages and cancellation if fixtures available.
focused red command: `bun test packages/dialer-server/src/inbound/worker-recovery.test.ts`
expected red failure: importing as-yet-unimplemented worker recovery paging and warning helpers fails; after implementation tests must pass without Twilio/provider calls.
no-test waiver: none.

## files changed

- `packages/dialer-server/src/inbound/worker-recovery.test.ts`
- `packages/dialer-server/src/inbound/worker-recovery.ts`
- `packages/dialer-server/src/inbound/telephony.ts`
- `packages/dialer-server/src/inbound/outbound-capacity.ts`
- `packages/dialer-server/src/inbound/callback-telephony.ts`
- `packages/dialer-server/src/inbound/telephony.integration.test.ts`
- `packages/dialer-server/src/runtime/inbound.ts`

## key decisions

- Work in a new managed task worktree from current `stream/dialer` (Wave 2 at `0c8a37ec`); no edits to adjacent tasks.
- Adopt per-workspace/per-kind keyset cursor rather than OFFSET or fixed-prefix reads. Bounded work per tick, cycle across intervals; eventual progress requires the worker to continue ticking.
- Track backlog sizes/oldest age without phone numbers, SIDs, callback payloads, or customer data.
- Per-workspace recovery work runs once per tick even if several inbound numbers share a workspace. Queue-specific routing remains per queue; failed queue scans increment a failure counter without aborting other queues.
- Use 64-row pages (100-row pages for the existing callback outbox API). The cursor is in-memory and resets on restart, intentionally replaying safe, idempotent recovery work; no schema migration.
- Alert-only signals at 5 minutes for pending/dispatched, 10 minutes for unknown/creating, and 30 seconds for slow ticks. A warning does not release unknown capacity or retry ambiguous provider effects. External provider calls can exceed a tick's wall-clock budget; no unsafe Promise.race timeout was introduced.

## notes for ko

- No main merge, deployment, billing change, or live calls authorized. Formal publish only through stream.
- Test-first: missing helper module failed on initial red run. Fixed exact-multiple cursor wrap after a second red case; six worker/telemetry tests now pass.
- Entire dialer-server package suite: 246 passed / 103 skipped / 0 failed without PG integration env. Typecheck, Bun compile/build, git diff --check, and strict review (0 findings) passed.
- Isolated PostgreSQL 17, simulated carrier: 18/18 callback integration passed; 31/33 inbound integration passed, including new aged-unknown and earlier orphan/restart cases. Two existing migration-rollback scenarios fail with `Roll back newer migrations first` because the full schema now contains newer migrations; rollback source, migration ordering, and those test cases were not changed in this task. Do not represent the entire PG suite as green.
- Ephemeral PostgreSQL test cluster was stopped and its temporary data/log removed. No shared PG service was started or changed.

## improvements noticed

- none yet

## errors i ran into

- Initial local PostgreSQL startup failed with a macOS LC_ALL/multithreaded-postmaster message. Recovered using `LC_ALL=C` on isolated instance; no shared DB changes.
- Two unchanged full-suite PostgreSQL migration rollback tests failed (see notes above), unrelated to recovery changes. No scope expansion into schema rollback semantics.
- Strict review initially identified two async error-handling style findings; both resolved and strict review rerun clean.

- 2026-11-02 03:54:36 write: `.task/dialer/harden-dialer-worker-pagination-and-recovery-observability/workpad.md`

## workspace-owned: files changed

- `packages/dialer-server/src/inbound/worker-recovery.test.ts`
- `packages/dialer-server/src/inbound/worker-recovery.ts`

## workspace-owned: activity log

- 2026-11-02 03:54:36 fs.write: `.task/dialer/harden-dialer-worker-pagination-and-recovery-observability/workpad.md`
- 2026-11-02 03:55:05 write: `packages/dialer-server/src/inbound/worker-recovery.test.ts`
- 2026-11-02 03:55:05 fs.write: `packages/dialer-server/src/inbound/worker-recovery.test.ts`
- 2026-11-02 03:55:24 write: `packages/dialer-server/src/inbound/worker-recovery.ts`
- 2026-11-02 03:55:24 fs.write: `packages/dialer-server/src/inbound/worker-recovery.ts`

- 2026-11-02 03:55:42 apply-patch: `packages/dialer-server/src/inbound/telephony.ts`

## workspace-owned: files read

- `packages/dialer-server/src/inbound/callback-telephony.ts`
- `packages/dialer-server/src/inbound/outbound-capacity.ts`
- `packages/dialer-server/src/runtime/inbound.ts`

## workspace-owned: validation evidence

- 2026-11-02 03:59:15 `review.run`: passed — OK
- 2026-11-02 03:59:28 apply-patch: `packages/dialer-server/src/inbound/worker-recovery.ts`
- 2026-11-02 03:59:28 apply-patch: `packages/dialer-server/src/inbound/telephony.ts`
- 2026-11-02 03:59:46 `review.run`: passed — OK
- 2026-11-02 04:00:21 apply-patch: `.task/dialer/harden-dialer-worker-pagination-and-recovery-observability/workpad.md`
- 2026-11-02 04:00:38 `verify`: failed — COMMAND_FAILED
- 2026-11-02 04:00:42 `review.run`: passed — OK
- 2026-11-02 04:01:05 apply-patch: `packages/dialer-server/src/inbound/telephony.ts`
- 2026-11-02 04:01:24 `review.run`: passed — OK
- 2026-11-02 04:01:39 `verify`: passed — OK

- 2026-11-02 04:01:48 apply-patch: `.task/dialer/harden-dialer-worker-pagination-and-recovery-observability/workpad.md`
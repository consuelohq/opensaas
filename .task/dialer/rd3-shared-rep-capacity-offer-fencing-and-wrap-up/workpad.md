# RD3 shared rep capacity offer fencing and wrap-up

branch: `task/dialer/rd3-shared-rep-capacity-offer-fencing-and-wrap-up`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2454
started: 2026-09-10

## acceptance criteria

- [x] One shared rep slot across inbound/outbound; separate offer deadline and ownership.
- [x] First committed valid endpoint wins; stale generations and duplicate dispatch cannot steal capacity.
- [x] Unknown effects remain protected; recovery discovery, escalation and wrap-up are durable.
- [x] Unit and real Postgres adversarial tests, RD2 combined lab and migration down/up pass.
- [ ] Canonical verification, stream promotion, content verification and safe cleanup.

## plan

1. Verify stream ancestry/ownership and implement only RD3.
2. Reproduce races first, implement SDK semantics and transactional Postgres authority.
3. Merge current RD2 stream, validate shared migration integration.
4. Review, canonical verify, promote task to stream, verify publication and clean own resources.

## files changed

- `areas/dialer/rd/receipts/RD3.md`
- `packages/dialer-server/scripts/local-dialer-lab.ts`
- `packages/dialer-server/src/database/migrations.test.ts`
- `packages/dialer-server/src/database/migrations.ts`
- `packages/dialer-server/src/inbound/postgres-journal.ts`
- `packages/dialer-server/src/inbound/rep-capacity-commands.ts`
- `packages/dialer-server/src/inbound/rep-capacity-migration.ts`
- `packages/dialer-server/src/inbound/rep-capacity-projection.ts`
- `packages/dialer-server/src/inbound/rep-capacity.integration.test.ts`
- `packages/dialer-server/src/inbound/REP-CAPACITY.md`
- `packages/dialer-server/src/inbound/rep-capacity.ts`
- `packages/dialer-server/src/lab/learning-rollback-scenario.ts`
- `packages/dialer/src/inbound/index.ts`
- `packages/dialer/src/inbound/rep-capacity-contracts.ts`
- `packages/dialer/src/inbound/rep-capacity-ports.ts`
- `packages/dialer/src/inbound/rep-capacity.test.ts`
- `packages/dialer/src/inbound/rep-capacity.ts`

## key decisions

- Separate versioned rich capacity history; atomically mirror compatible RD1 events.
- PostgreSQL time after tenant lock; no device timestamp ordering.
- Protect external unknown effects and require settled command outcomes before release.
- RD5 owns authenticated carrier composition for both live call paths.

## notes for ko

- RD2 #2453 merged at 13134a0fc959ca03acecaf55044a83be70064947 and is included locally.
- Late foundation P1 discussion_r3980965865 must be resolved/classified by RD0 before RD4.

## improvements noticed

- none yet

## errors i ran into

- Local Postgres required LC_ALL=C/LANG=C. Own isolated cluster only.
- RED tests exposed generic dispatch bypass, missing recovery enumeration and duplicate bridge claim; fixed.
- Migration-count/rollback order needed additive 007 integration after RD2 merged.
- Strict review requested contextual DB error boundaries; final strict review reports zero findings.
- App-to-app coordination message was blocked by automatic approval policy; no message sent.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

RD3 only. Prerequisite PRs #2446/#2448/#2451 are merged into stream/dialer; base e79b01b786a1cb62b779c3a0adcf2715db4773c3. No other RD3 owner; RD2 owns PR #2453 and lab harness modules.

Behavior: one rep voice capacity slot shared by inbound/outbound; offer deadline distinct from generation ownership; first committed valid endpoint acceptance wins; stale accepts, expired presence, concurrent callers and early wrap-up release cannot steal capacity. Escaped/unknown external work remains protected until authenticated reconciliation; recovery/escalation is durable and bounded.
Pattern: RD1 provider-neutral Effect contracts + pure reducers; Postgres checked-client tenant authority transaction + journal/outbox. Add a separately versioned capacity aggregate/history and additive migration rather than silently reinterpreting RD1 version-1 history. Reuse the journal within the same transaction for identity/state projections and commands.

Tests first: capacity domain lifecycle adversarial unit tests, then real isolated Postgres contention/idempotency/rollback/replay tests with independent connections. Preserve RD2 simulator/worker modules. After RD2 merged, RD3 became integration owner for the minimal 007 migration rollback entry updates. Focused RED: bun test packages/dialer/src/inbound/rep-capacity.test.ts (new API missing). Then package tests, both Nx typechecks/builds, strict review and canonical verify.
No-test waiver: none. No carrier calls, deployed migration or production activation. RD5 owns provider execution; RD3 supplies fenced authorization and reconciliation contracts.

- 2026-09-10 15:54:39 append: `.task/dialer/rd3-shared-rep-capacity-offer-fencing-and-wrap-up/workpad.md`

## workspace-owned: files changed

- `areas/dialer/rd/receipts/RD3.md`
- `packages/dialer-server/scripts/local-dialer-lab.ts`
- `packages/dialer-server/src/database/migrations.test.ts`
- `packages/dialer-server/src/database/migrations.ts`
- `packages/dialer-server/src/inbound/postgres-journal.ts`
- `packages/dialer-server/src/inbound/rep-capacity-commands.ts`
- `packages/dialer-server/src/inbound/rep-capacity-migration.ts`
- `packages/dialer-server/src/inbound/rep-capacity-projection.ts`
- `packages/dialer-server/src/inbound/rep-capacity.integration.test.ts`
- `packages/dialer-server/src/inbound/REP-CAPACITY.md`
- `packages/dialer-server/src/inbound/rep-capacity.ts`
- `packages/dialer-server/src/lab/learning-rollback-scenario.ts`
- `packages/dialer/src/inbound/index.ts`
- `packages/dialer/src/inbound/rep-capacity-contracts.ts`
- `packages/dialer/src/inbound/rep-capacity-ports.ts`
- `packages/dialer/src/inbound/rep-capacity.test.ts`
- `packages/dialer/src/inbound/rep-capacity.ts`

## workspace-owned: activity log

- 2026-09-10 15:54:39 fs.write: `.task/dialer/rd3-shared-rep-capacity-offer-fencing-and-wrap-up/workpad.md`
- 2026-09-10 15:56:40 fs.write: `packages/dialer/src/inbound/rep-capacity.test.ts`
- 2026-09-10 15:58:25 fs.write: `packages/dialer/src/inbound/rep-capacity-contracts.ts`
- 2026-09-10 15:58:26 fs.write: `packages/dialer/src/inbound/rep-capacity.ts`
- 2026-09-10 16:01:11 fs.write: `packages/dialer-server/src/inbound/rep-capacity-migration.ts`
- 2026-09-10 16:01:12 fs.write: `packages/dialer/src/inbound/rep-capacity-ports.ts`
- 2026-09-10 16:03:23 fs.write: `packages/dialer-server/src/inbound/rep-capacity-projection.ts`
- 2026-09-10 16:03:23 fs.write: `packages/dialer-server/src/inbound/rep-capacity.ts`
- 2026-09-10 16:05:54 fs.write: `packages/dialer-server/src/inbound/rep-capacity.integration.test.ts`
- 2026-09-10 16:07:12 fs.write: `packages/dialer-server/src/inbound/rep-capacity-commands.ts`
- 2026-09-10 16:34:13 fs.write: `packages/dialer-server/src/inbound/REP-CAPACITY.md`
- 2026-09-10 16:36:01 fs.write: `areas/dialer/rd/receipts/RD3.md`
- 2026-09-10 16:37:47 fs.write: `.task/dialer/rd3-shared-rep-capacity-offer-fencing-and-wrap-up/workpad.md`

## workspace-owned: files read

- `packages/dialer-server/scripts/local-dialer-lab.ts`
- `packages/dialer-server/src/database/migrations.ts`

- 2026-09-10 16:01:11 write: `packages/dialer-server/src/inbound/rep-capacity-migration.ts`

- 2026-09-10 16:01:12 write: `packages/dialer/src/inbound/rep-capacity-ports.ts`

- 2026-09-10 16:03:23 write: `packages/dialer-server/src/inbound/rep-capacity-projection.ts`

- 2026-09-10 16:03:23 write: `packages/dialer-server/src/inbound/rep-capacity.ts`

- 2026-09-10 16:05:54 write: `packages/dialer-server/src/inbound/rep-capacity.integration.test.ts`

- 2026-09-10 16:07:12 write: `packages/dialer-server/src/inbound/rep-capacity-commands.ts`

## workspace-owned: validation evidence

- 2026-09-10 16:31:38 `review.run`: passed — OK
- 2026-09-10 16:34:13 write: `packages/dialer-server/src/inbound/REP-CAPACITY.md`
- 2026-09-10 16:34:46 `review.run`: passed — OK
- 2026-09-10 16:36:01 write: `areas/dialer/rd/receipts/RD3.md`
- 2026-09-10 16:36:21 `verify`: passed — OK
- 2026-09-10 16:37:57 `verify`: passed — OK

## Combined validation 2026-09-10 16:35 UTC

- 431 tests passed, zero failures, 1599 assertions across 68 files with local lab and RD3 real Postgres enabled.
- Both Nx typechecks/builds passed; strict review zero findings.
- Validation base 13134a0fc959ca03acecaf55044a83be70064947. RD2 simulator/worker/evidence/cleanup files preserved.
- Service test transcript: /tmp/rd3-package-tests.log (disposable; durable commands in receipt).
- Scope and downstream composition boundaries: packages/dialer-server/src/inbound/REP-CAPACITY.md.

## Publication gate and ancestry synchronization

Canonical verify passed with publishValid=true and zero review findings. Initial task.push refused because the local RD2 merge commit was ahead of the remote task bootstrap. Merged remote stream into the remote RD3 branch through the GitHub facade, then aligned the local branch/index with that remote merge while retaining working files and a recovery ref. All 17 validated file hashes remained identical. New task head before implementation publication: 231a0504a6c988bc1462b04e186132dbc394ff48. Revalidate the stamp against this head, then use normal task.push/task.pr.

- 2026-09-10 16:37:47 append: `.task/dialer/rd3-shared-rep-capacity-offer-fencing-and-wrap-up/workpad.md`

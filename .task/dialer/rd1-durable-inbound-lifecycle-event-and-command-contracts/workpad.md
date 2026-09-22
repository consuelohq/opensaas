# RD1 durable inbound lifecycle event and command contracts

branch: `task/dialer/rd1-durable-inbound-lifecycle-event-and-command-contracts`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2448
started: 2026-09-10

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `areas/dialer/rd/receipts/RD1.md`
- `packages/dialer-server/src/inbound/migration.ts`
- `packages/dialer-server/src/inbound/postgres-journal.ts`
- `packages/dialer-server/src/inbound/README.md`
- `packages/dialer-server/src/lab/inbound-journal-scenarios.ts`
- `packages/dialer/src/inbound/contracts.ts`
- `packages/dialer/src/inbound/index.ts`
- `packages/dialer/src/inbound/lifecycle.test.ts`
- `packages/dialer/src/inbound/lifecycle.ts`
- `packages/dialer/src/inbound/ports.ts`

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
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## RD1 acceptance and Test-first contract

Ko explicitly authorized foundation completion and RD1; stop after RD1, not RD2/RD3 implementation. Foundation #2446 is merged, consumed on task startup from stream/dialer (91fcb966...). Preserve the frozen rd-1 contract and D1-D4. Existing #2445 owns unrelated OS/workspace/main cleanup.

Own provider-neutral entity/event/decision/command contracts in packages/dialer, transactional Postgres adapter and additive reversible inbound migration in dialer-server, focused domain tests and isolated real-PG scenarios. No Hono/provider routes, scheduler, capacity selection, UI or external effects.

Behavior: six distinct entity lifecycles; terminal history cannot revive a leg; unknown effects stay explicit/protected; observed state versions fence writes; tenant-scoped fact dedupe cannot double-enqueue; facts/events/state/commands and immutable routing evidence commit atomically; replay has no effects. Concurrent conflicting transactions yield one winner. Invalid/stale plans roll back without swallowing future retries. Unknown schema versions and malformed identities/times are rejected.

Test-first: write domain reducer/replay tests and run red before production modules. Then add real Postgres up/down/up, duplicate/concurrent ingest, atomic rollback, cross-tenant references, immutable decision, outbox claim/outcome/replay scenarios. Reuse isolated lab service lifecycle; RD2's full simulator remains future work. No-test waiver: none for RD1 behavior.

Implementation boundary: normalized facts hold a stable semantic digest, adapter event identity and separate observed/provider times; no raw provider payload or PII in snapshots. Application transactions use a checked-out PG client, never pool-level BEGIN. Entity links and shared rep-slot identity are durable; RD3 supplies reservation policy atop this authority.

- 2026-09-10 03:12:59 append: `.task/dialer/rd1-durable-inbound-lifecycle-event-and-command-contracts/workpad.md`

## workspace-owned: files changed

- `areas/dialer/rd/receipts/RD1.md`
- `packages/dialer-server/src/inbound/migration.ts`
- `packages/dialer-server/src/inbound/postgres-journal.ts`
- `packages/dialer-server/src/inbound/README.md`
- `packages/dialer-server/src/lab/inbound-journal-scenarios.ts`
- `packages/dialer/src/inbound/contracts.ts`
- `packages/dialer/src/inbound/index.ts`
- `packages/dialer/src/inbound/lifecycle.test.ts`
- `packages/dialer/src/inbound/lifecycle.ts`
- `packages/dialer/src/inbound/ports.ts`

## workspace-owned: activity log

- 2026-09-10 03:12:59 fs.write: `.task/dialer/rd1-durable-inbound-lifecycle-event-and-command-contracts/workpad.md`
- 2026-09-10 03:17:39 fs.write: `packages/dialer/src/inbound/lifecycle.test.ts`
- 2026-09-10 03:20:48 fs.write: `packages/dialer/src/inbound/contracts.ts`
- 2026-09-10 03:20:49 fs.write: `packages/dialer/src/inbound/lifecycle.ts`
- 2026-09-10 03:20:50 fs.write: `packages/dialer/src/inbound/ports.ts`
- 2026-09-10 03:20:50 fs.write: `packages/dialer/src/inbound/index.ts`
- 2026-09-10 03:22:35 fs.write: `packages/dialer-server/src/inbound/migration.ts`
- 2026-09-10 03:24:12 fs.write: `packages/dialer-server/src/inbound/postgres-journal.ts`
- 2026-09-10 03:26:25 fs.write: `packages/dialer-server/src/lab/inbound-journal-scenarios.ts`
- 2026-09-10 03:32:01 fs.write: `packages/dialer-server/src/inbound/README.md`
- 2026-09-10 03:38:36 fs.write: `areas/dialer/rd/receipts/RD1.md`

## workspace-owned: files read

- `packages/dialer-server/src/database/migrations.test.ts`
- `packages/dialer-server/tsconfig.json`
- `packages/dialer/src/application/start-dialer-call.ts`
- `packages/dialer/src/ports/dialer-call-start.ts`

## workspace-owned: validation evidence

- 2026-09-10 03:28:28 `verify`: failed — COMMAND_FAILED
- 2026-09-10 03:32:01 write: `packages/dialer-server/src/inbound/README.md`
- 2026-09-10 03:35:22 `verify`: failed — COMMAND_FAILED
- 2026-09-10 03:36:13 `verify`: failed — COMMAND_FAILED
- 2026-09-10 03:37:27 `verify`: passed — OK
- 2026-09-10 03:38:36 write: `areas/dialer/rd/receipts/RD1.md`
- 2026-09-10 03:39:00 `verify`: passed — OK

## RD1 validation and scope completion
Implemented SDK version-1 contracts/reducer/replay/Effect ports; server journal/outbox and additive reversible migration006; isolated realPG/Redis scenarios. Lifecycle missingimport RED; lab missinginboundproof RED; expiry/commandsemantic guards RED then GREEN. Package suites403pass,1labskip,0fail; both Nx typechecks pass; Nxlab1pass29expects and scenarios. Canonical fullverify PASS publishvalid zero findings at91fcb9662e3eec519a1f8ad082a1717dbcfdb031. Receipt records boundaries and RD2/RD3 next wave. No live providers or main promotion.

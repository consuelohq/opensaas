# rd8 reconcile rep devices and calendar operation retries

branch: `task/dialer/rd8-reconcile-rep-devices-and-calendar-operation-retries`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2490
started: 2026-09-21

## acceptance criteria

- [x] Reconfiguration invalidates idle readiness without releasing owned capacity.
- [x] Same-window retry retains one revision and one booking; stale revisions are rejected.
- [x] Booking creation has one durable dispatch owner; unknown outcomes reconcile without retrying creates.
- [x] Real Postgres, UI, build, typecheck and formal verification pass.
- [ ] Publish task and integrate to stream; refresh stream CI and deployment evidence.

## plan

1. Reproduce the three review findings.
2. Implement durable guards and test uncertainty and stale management.
3. Run full verification, integrate to the dialer stream, then deploy only validated source.

## files changed

- See the completed evidence below.

## key decisions

- See the completed evidence below.

## notes for ko

- See the completed evidence below.

## improvements noticed

- See the completed evidence below.

## errors i ran into

- See the completed evidence below.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: Configuration changes cannot leave idle reps eligible on removed devices; retries of the same customer reschedule keep one operation; concurrent calendar booking submissions create exactly one local dispatch owner and uncertain provider outcomes reconcile by durable request identity.
existing local pattern: Shared fenced capacity actions, stable customer capability identity, append-only booking/cancellation evidence, real Postgres integration suites.
new or changed tests: Reconfigure a ready rep's endpoint then prove it cannot be reserved before readiness refresh; repeat/concurrently retry a reschedule and retain one revision; concurrent and restarted booking requests retain one provider effect and one persisted result, with unknown reconciliation.
focused red command: Existing Bun Postgres runtime registration, customer-entry and callbacks integration suites on disposable loopback port 56412.
expected red failure: Stale ready endpoint survives startup; same-window retry increments revision; concurrent booking creates two external appointments.
no-test waiver: Not applicable.

## Scope

Continue authorized RD8 finish/review. Prior fixes merged through PR2488, current stream 76153ab0a3967e5b5e1b3e60aa1c2d012cffd160. Address review comments4058807936,4058807942,4058807948. No subagents. No production migrations or real calls yet. Railway active and fresh private PG backup verified; deployment must wait for review closure. Existing test GHL connection choice remains pending.

- 2026-09-21 01:54:25 append: `.task/dialer/rd8-reconcile-rep-devices-and-calendar-operation-retries/workpad.md`

## workspace-owned: files changed

- See the completed evidence below.

## workspace-owned: activity log

- 2026-09-21 01:54:25 fs.write: `.task/dialer/rd8-reconcile-rep-devices-and-calendar-operation-retries/workpad.md`

## workspace-owned: validation evidence

- 2026-09-21 02:14:58 `review.run`: passed — OK
- 2026-09-21 02:16:19 `review.run`: passed — OK
- 2026-09-21 02:16:58 `verify`: passed — OK

## Completed implementation and evidence — 2026-09-21 02:17 UTC

RED: stale ready endpoint persisted; repeated reschedule produced booking-3 instead of booking-2; concurrent booking called the provider twice. Additional stale management regression resolved a request with expected revision 1 after revision 2 had already booked (trc_89675c86845c).

GREEN: 286 server tests passed against disposable real Postgres port 56412, zero failures; one separate lab launch test skipped by its explicit opt-in. 157 LeadConnector tests passed. Nx server/LeadConnector build and typecheck passed. Formal verify passed with zero findings and publishValid=true against 76153ab0a3967e5b5e1b3e60aa1c2d012cffd160 (trc_412b8202859d).

Changes: immutable booking-attempt migration 013 and provider creation authority; optional read-only reconcileBooking; creation-pending UI; reschedule idempotency and revision fencing; authoritative public window projection; idle readiness reset on startup; additive migration rollback sequencing tests. Unknown creation blocks cancellation/rescheduling, attempt evidence cannot be edited/deleted or rolled back, and one canonical result survives restart/concurrency. Documentation explains adapter evidence requirements.

Validation logs: /var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/rd8-2490-validation-vcbri35e. Initial broad run exposed two test-fixture issues (calling current runtime after rolling schema back, and expecting nested error text at the outer boundary); both corrected, final server run passes. One read-mode envelope falsely detected a concurrently generated Bun build artifact; subsequent inspection used verify mode. No production migration or live call was run by this task.

Risks/next: booking adapters must bind reconciliation to workspace/callback/revision and prove absence before reporting unavailable; no GHL calendar adapter is composed. Live test requires approved tenant/DID/reps. Publication does not prove carrier/audio behavior.

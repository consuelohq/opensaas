# rd8 address current-head review findings

branch: `task/dialer/rd8-address-current-head-review-findings`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2482
started: 2026-09-19

## acceptance criteria

- [x] Disabled inbound numbers with customer-entry config do not require `DIALER_CUSTOMER_ENTRY_SECRET` or expose the customer application.
- [x] Confirmed provider bookings are cancelled and persisted as cancelled before callback reschedule/cancel can report success.
- [x] Provider cancellation that cannot be proven fails closed before callback state mutation.
- [x] Public callback rate-limit identity ignores spoofable forwarding headers and uses Bun's server-observed peer address.
- [x] Focused tests are RED before implementation and GREEN afterward; full Dialer Server test/typecheck/build is green.
- [ ] Strict review and canonical verify are publish-valid, then PR #2482 is promoted to `stream/dialer`.
- [ ] Stream PR #2436 reruns current-head CI/review cleanly and is merged to `main`.

## plan

1. Reproduce the three current-head Codex findings with focused RED tests.
2. Fix only runtime activation, provider-booking reconciliation, and trusted client identity.
3. Run focused + full Dialer Server validation, strict review, and canonical verify.
4. Promote #2482, rerun #2436 CI/review on the new stream head, merge only when clean.

## files changed

- `packages/dialer-server/src/app.ts`
- `packages/dialer-server/src/architecture.test.ts`
- `packages/dialer-server/src/inbound/callback-booking.test.ts`
- `packages/dialer-server/src/inbound/callbacks.integration.test.ts`
- `packages/dialer-server/src/inbound/callbacks.ts`
- `packages/dialer-server/src/main.ts`
- `packages/dialer-server/src/routes/inbound-customer.test.ts`
- `packages/dialer-server/src/routes/inbound-customer.ts`
- `packages/dialer-server/src/runtime/inbound-customer-entry-activation.test.ts`
- `packages/dialer-server/src/runtime/inbound.ts`

## key decisions

- Trust only Bun `server.requestIP(request)?.address` for callback client identity. Forwarded headers remain untrusted and are ignored at the route boundary.
- Reconcile confirmed calendar bookings before changing callback revision/state; if the provider does not return a proven `cancelled` result, abort the callback transition.
- Persist the cancelled provider booking on the same callback revision so public `resultFor` cannot continue reporting a stale confirmed booking.
- Skip repeated provider cancellation when the same callback operation is already journaled; if a crash occurs after provider cancellation but before callback mutation, the persisted booking cancellation makes retry safe.

## notes for ko

- These fixes address all three Codex comments created on the exact previously-green stream head `9d2e13e8420af0acf9b86554ff020d094745a2b5`.

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

## Test-first contract

behavior under test:
1. Server startup must require `DIALER_CUSTOMER_ENTRY_SECRET` only when at least one enabled inbound number has an enabled customer-entry surface.
2. Callback cancellation and rescheduling must reconcile any confirmed provider calendar booking before reporting the prior callback state cancelled/rescheduled; provider failure/uncertainty must not produce false terminal success.
3. Public callback rate limiting must derive client identity from a server-observed/trusted source, not unauthenticated `cf-connecting-ip`, `x-forwarded-for`, or `x-real-ip` supplied by a direct caller.

existing local pattern: runtime config activation lives in `packages/dialer-server/src/runtime/inbound.ts`; callback obligation/calendar lifecycle lives in `packages/dialer-server/src/inbound/callbacks.ts`; public request boundary lives in `packages/dialer-server/src/routes/inbound-customer.ts` with route/application tests nearby.
new or changed tests: add focused regressions beside the existing runtime, callback, and public-customer route/application tests for each review finding before production edits.
focused red command: run only the affected inbound runtime/callback/customer tests once exact existing test files are identified.
expected red failure: each new assertion should fail on the current stream head for the corresponding review finding.
no-test waiver: not applicable.

Review source: Codex review 5256026967 on stream head `9d2e13e8420af0acf9b86554ff020d094745a2b5`, comments 4053460270 (P1 runtime secret activation), 4053460274 (P1 provider booking cancellation/reschedule), 4053460284 (P2 spoofable callback rate-limit identity).

- 2026-09-19 14:47:00 append: `.task/dialer/rd8-address-current-head-review-findings/workpad.md`

## workspace-owned: files changed

- `packages/dialer-server/src/app.ts`
- `packages/dialer-server/src/architecture.test.ts`
- `packages/dialer-server/src/inbound/callback-booking.test.ts`
- `packages/dialer-server/src/inbound/callbacks.integration.test.ts`
- `packages/dialer-server/src/inbound/callbacks.ts`
- `packages/dialer-server/src/main.ts`
- `packages/dialer-server/src/routes/inbound-customer.test.ts`
- `packages/dialer-server/src/routes/inbound-customer.ts`
- `packages/dialer-server/src/runtime/inbound-customer-entry-activation.test.ts`
- `packages/dialer-server/src/runtime/inbound.ts`

## workspace-owned: activity log

- 2026-09-19 14:47:00 fs.write: `.task/dialer/rd8-address-current-head-review-findings/workpad.md`
- 2026-09-19 14:51:48 fs.write: `.task/dialer/rd8-address-current-head-review-findings/workpad.md`
- 2026-09-19 14:53:59 fs.write: `.task/dialer/rd8-address-current-head-review-findings/workpad.md`
- 2026-09-19 14:55:48 fs.write: `.task/dialer/rd8-address-current-head-review-findings/workpad.md`

## workspace-owned: files read

- `packages/dialer-server/src/app.ts`
- `packages/dialer-server/src/contracts.ts`
- `packages/dialer-server/src/inbound/callbacks.integration.test.ts`
- `packages/dialer-server/src/inbound/callbacks.ts`
- `packages/dialer-server/src/inbound/customer-entry.integration.test.ts`
- `packages/dialer-server/src/inbound/customer-entry.ts`
- `packages/dialer-server/src/inbound/telephony-config.test.ts`
- `packages/dialer-server/src/main.ts`
- `packages/dialer-server/src/routes/inbound-customer.test.ts`
- `packages/dialer-server/src/routes/inbound-customer.ts`
- `packages/dialer-server/src/runtime/environment.ts`
- `packages/dialer-server/src/runtime/inbound.ts`
- `packages/dialer/src/inbound/callback-contracts.ts`
- `packages/dialer/src/inbound/callback-scheduler.ts`

- 2026-09-19 14:52:45 apply-patch: `packages/dialer-server/src/runtime/inbound.ts`
- 2026-09-19 14:52:45 apply-patch: `packages/dialer-server/src/routes/inbound-customer.ts`
- 2026-09-19 14:52:45 apply-patch: `packages/dialer-server/src/app.ts`
- 2026-09-19 14:52:45 apply-patch: `packages/dialer-server/src/main.ts`
- 2026-09-19 14:52:45 apply-patch: `packages/dialer-server/src/inbound/callbacks.ts`
- 2026-09-19 14:52:45 apply-patch: `packages/dialer-server/src/inbound/callbacks.integration.test.ts`
- 2026-09-19 14:53:07 apply-patch: `packages/dialer-server/src/runtime/inbound.ts`
GREEN validation (`trc_c8db27ebf331`): focused 12/12 (257 assertions); full Dialer Server 206 pass / 57 intentional service-backed skips / 0 fail (1,128 assertions); typecheck pass; compiled build pass (2,953 modules). A supplementary isolated-Postgres attempt failed before test execution because local `pg_ctl` could not start the temporary server (`trc_51baef416174`); no product test failed and the temp server was cleaned up. The existing callbacks integration regression remains committed for service-backed execution.

- 2026-09-19 14:53:59 append: `.task/dialer/rd8-address-current-head-review-findings/workpad.md`

- 2026-09-19 14:54:14 apply-patch: `.task/dialer/rd8-address-current-head-review-findings/workpad.md`

## workspace-owned: validation evidence

- 2026-09-19 14:54:44 `review.run`: passed — OK
- 2026-09-19 14:55:01 apply-patch: `packages/dialer-server/src/inbound/callbacks.ts`
- 2026-09-19 14:55:30 `review.run`: passed — OK
- 2026-09-19 14:55:40 `verify`: passed — OK

Publish gate GREEN: strict review 0 findings (`trc_e303c8ac2ced`); canonical verify pass / publishValid=true / DB 0 risk across exactly 10 intended Dialer Server files (`trc_233cbad5e5a2`). Ready to publish PR #2482 into `stream/dialer`.

- 2026-09-19 14:55:48 append: `.task/dialer/rd8-address-current-head-review-findings/workpad.md`

# make commercial billing access fail closed

branch: `task/dialer/make-commercial-billing-access-fail-closed`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1809/make-commercial-billing-access-fail-closed
github pr: https://github.com/consuelohq/opensaas/pull/1809
started: 2026-08-10

## acceptance criteria

- [x] `active` and `trialing` subscriptions remain call/number entitled.
- [x] `past_due`, `unpaid`, `incomplete`, paused, and unknown statuses cannot gain call/number access without valid grace evidence.
- [x] A real payment-failure timestamp preserves the configured grace window only for explicitly grace-eligible statuses.
- [x] Canceled/expired states remain non-entitled; billing management and history remain available.
- [x] Stripe webhook ordering cannot promote a known bad subscription status to active from `invoice.paid` alone.
- [x] Focused red/green tests, affected billing/application boundaries, strict review, and canonical verify are recorded.
- [x] Only code/tests/workpad are changed; no live Stripe, Railway, number, webhook, or call state is mutated.

## plan

1. Add focused red resolver tests for status-only bad states plus positive active/trialing and timestamped grace contracts.
2. Add an application/webhook ordering regression around subscription status and invoice events.
3. Implement the narrow status allowlist and prevent invoice success from inventing authoritative subscription status.
4. Run focused then broad dialer-server/LeadConnector boundary tests, typecheck, strict review, and canonical verify.
5. Update this workpad and push only the validated task files to PR #1809.

## current status

- Implementation and all requested validation are green. The task is ready to push to PR #1809; merge and `task.finish` remain intentionally out of scope.

## files changed

- `packages/dialer-server/src/billing/application.ts`
- `packages/dialer-server/src/commercial/application.ts`
- `packages/dialer-server/src/commercial.acceptance.test.ts`
- `packages/dialer-server/src/commercial-application.acceptance.test.ts`
- this task workpad and workspace-owned task metadata

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-10 01:58:12 `review.run`: passed — OK
- 2026-08-10 01:58:33 `verify`: passed — OK

## key decisions

- Subscription status is authoritative for entitlement: only explicit `active`/`trialing` states grant active access.
- Explicit payment-failure evidence may grant time-bounded grace only to known recovery states; unknown/new states fail closed.
- `invoice.paid` may clear failure evidence but must not independently promote a known bad subscription status to `active`.
- Invoice events resolve workspace identity from direct metadata or the subscription-details metadata that Checkout places on the subscription.

## discovery

- `resolveBillingAccess` currently grants `active` whenever `paymentFailedAt` is null, regardless of status.
- Call authorization consumes the resolver through `loadCallerContext`; `canManageBilling` and `canReadHistory` are intentionally always true.
- `invoice.payment_failed` records `past_due` plus the first failure timestamp. `customer.subscription.*` updates status while preserving that timestamp.
- `invoice.paid` currently writes `active` directly, so a paid event delivered after a bad subscription event can reopen access.
- Nx resolves `@consuelo/dialer-server:test` to the package's `bun test src` script; focused Bun test files are the narrow red/green seam.

## Test-first contract

- Behavior: non-good subscription statuses with no failure timestamp block calls and number purchases while preserving billing/history access.
- Status matrix: `past_due`, `unpaid`, `incomplete`, and an unknown status are blocked with null failure evidence; `active` and `trialing` stay active.
- Grace: `past_due` with a real timestamp remains entitled before the configured deadline and blocks at expiry.
- Ordering: a bad `customer.subscription.updated` state remains non-active whether `invoice.paid` is processed before or after it; payment failure ordering preserves only timestamp-backed grace.
- Existing pattern: `commercial.acceptance.test.ts` directly loads billing logic and `commercial-application.acceptance.test.ts` exercises verified webhook persistence with an in-memory query seam.
- Focused red commands: `bun test src/commercial.acceptance.test.ts` and `bun test src/commercial-application.acceptance.test.ts` from `packages/dialer-server`.
- Expected red: status-only bad rows resolve as `active`; an `invoice.paid` event after a bad subscription update writes `status = 'active'`.
- Red evidence: resolver suite 15 passed / 1 failed because `past_due` plus null `paymentFailedAt` returned active call/number access.
- Red evidence: commercial application suite 10 passed / 1 failed because caller authorization resolved after a verified `past_due` subscription webhook with no failure timestamp.
- Red evidence: number-purchase filter 0 passed / 1 failed because `unpaid` plus null failure evidence still reached provider provisioning.
- Red evidence: ordering filter 0 passed / 1 failed when an invoice delivered before the subscription projection exposed workspace identity only through subscription-details metadata.

## before/after semantics

- Before: every non-canceled status was active when `payment_failed_at` was null; after: only `active` and `trialing` are active.
- Before: any non-canceled status with a timestamp could receive grace; after: only `past_due`, `unpaid`, and `incomplete` can receive timestamp-backed grace.
- Before: unknown/paused statuses could grant calls and number purchases; after: they return blocked while retaining billing management and history.
- Before: number provisioning enforced inventory but did not consult billing access; after: it rejects `BILLING_ACCESS_BLOCKED` before the provider boundary.
- Before: `invoice.paid` wrote local status `active`; after: it only clears failure evidence and waits for an authoritative active/trialing subscription status.
- Before: a payment-failure event arriving before the subscription projection could lose its timestamp; after: it upserts a `past_due` row with the real observed timestamp and the later subscription projection preserves it.

## validation summary

- Focused billing resolver: 16/16 tests passed, 53 expectations.
- Focused commercial application/webhook/caller-context: 12/12 tests passed, 40 expectations.
- Full `@consuelo/dialer-server:test` Nx target: 126/126 tests passed, 639 expectations across 26 files.
- Commercial HTTP routes: 4/4 tests passed, 17 expectations.
- LeadConnector commercial UI: 6/6 tests passed, 53 expectations.
- `@consuelo/dialer-server:typecheck`: passed through Nx with cache disabled.
- Strict review against `origin/stream/dialer`: passed with 0 task issues, 0 pre-existing issues, and 0 blockers across 4 files.
- Canonical verify against `origin/stream/dialer`: passed in full mode; review passed, DB risk scan passed with 0 risks, and `publishValid` is true.

## notes for ko

- No Stripe API, Checkout/customer/subscription creation, provider webhook delivery, Railway mutation, number purchase, or carrier call was performed.
- Residual risk: webhook ordering is proven through the existing in-memory SQL/application seam, not a live Stripe delivery or service-backed Postgres run. This is intentional for the code/test-only scope.

## improvements noticed

- none yet

## issues and recovery

- The first diff request compared committed revisions and omitted the working tree; reran `git.diff` in working-tree mode and inspected the four scoped code/test files.
- The nested invoice metadata regression initially exposed a narrow mock return type; added an empty direct metadata value so TypeScript still proves the fallback to subscription-details metadata.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `.agents/skills/nx-run-tasks/SKILL.md`
- `.agents/skills/nx-workspace/SKILL.md`
- `AGENTS.md`
- `packages/dialer-server/src/commercial/application.ts`
- `packages/dialer-server/src/commercial/persistence.ts`
- `packages/workspace/senior-engineer.md`

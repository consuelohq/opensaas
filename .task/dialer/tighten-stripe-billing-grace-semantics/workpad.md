# tighten stripe billing grace semantics

branch: `task/dialer/tighten-stripe-billing-grace-semantics`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/1814
started: 2026-08-10

## acceptance criteria

- [ ] Preserve entitlement for Stripe `active` and `trialing` subscriptions.
- [ ] Preserve the configured payment-failure grace window only for `past_due` with a persisted `payment_failed_at` timestamp.
- [ ] Keep `incomplete`, `unpaid`, canceled/expired, paused, and unknown/new statuses blocked even when a stale failure timestamp exists.
- [ ] Preserve billing-management and history access while calls/number purchasing are blocked.
- [ ] Preserve event-order safety: `invoice.paid` clears payment-failure evidence but does not independently grant active subscription status.
- [ ] Run focused billing/commercial tests, full dialer-server suite, typecheck, strict review, and canonical verify before publish.

## Test-first contract

- Behavior under test: Stripe subscription status is authoritative for commercial consumption. Only `past_due` can receive the product's configured grace period after a recorded payment failure; terminal/non-activated statuses do not inherit grace merely from a timestamp.
- Red cases first: `unpaid` and `incomplete` with non-null `paymentFailedAt` must resolve `blocked`; application webhook ordering must not grant grace to `unpaid` after an earlier payment-failed event or to `incomplete` after a later invoice failure.
- Positive cases retained: active/trialing are active; `past_due` with a fresh failure timestamp is grace; past_due after grace expires is blocked.

## current status

- This task starts from stream SHA `0786db61ee9b44be87fe8cf4c92bc91b3f0fc96c`, which already contains PR #1809's fail-closed baseline.
- Independent Stripe documentation check confirms `past_due` is the retry/payment-attention state, while `unpaid` access should be revoked and `incomplete` has not activated the subscription. This task tightens the baseline accordingly.

## files changed

- none yet

## key decisions

- Grace is a recovery affordance for `past_due`, not a generic property of any non-good Stripe status carrying a stale failure timestamp.
- No live Stripe/customer state is touched in this code-only correction.

## publish safety

- `task.push` is allowed after validation.
- `task.pr` is a merge operation in this repo and will be invoked only deliberately by the orchestrator after review.
- Do not call `task.finish`; preserve the worktree.

- 2026-08-10 02:03:57 write: `.task/dialer/tighten-stripe-billing-grace-semantics/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-10 02:03:57 fs.write: `.task/dialer/tighten-stripe-billing-grace-semantics/workpad.md`

- 2026-08-10 02:04:05 apply-patch: `packages/dialer-server/src/commercial.acceptance.test.ts`
- 2026-08-10 02:04:05 apply-patch: `packages/dialer-server/src/commercial-application.acceptance.test.ts`
- 2026-08-10 02:04:16 apply-patch: `packages/dialer-server/src/billing/application.ts`

## workspace-owned: files read

- `packages/dialer-server/src/commercial-application.acceptance.test.ts`
- `packages/dialer-server/src/commercial/application.ts`

- 2026-08-10 02:05:24 apply-patch: `packages/dialer-server/src/commercial/application.ts`
- 2026-08-10 02:05:24 apply-patch: `packages/dialer-server/src/commercial-application.acceptance.test.ts`

## workspace-owned: validation evidence

- 2026-08-10 02:06:05 `review.run`: passed — OK
- 2026-08-10 02:06:06 `review.run`: passed — OK
- 2026-08-10 02:06:17 `verify`: passed — OK

# Enable Stripe-native plan bundles and separate number subscriptions

branch: `task/dialer/enable-stripe-native-plan-bundles-and-separate-number-subscriptions`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2723
started: 2026-10-31

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

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

## Authorized commercial model
Ko explicitly chose restructuring so configuration/editing stays on Stripe and separately approved number packs having their own subscriptions/invoices. Preserve Professional99, Agency149, Enterprise199 and Mercury25 per rep monthly, annual12x, number packs1/3,10/28,50/125 monthly and minute packs10/100,50/600,100/1400 once. New base subscriptions have exactly one recurring item: selected plan with or without Mercury for all chosen seats. Number pools have their own one-item subscription and invoice. No automatic legacy subscription migration, charges, calls or competing backend/edge release. The calling UI agent owns the current e11/PR2719 combined deployment; native billing is a separate versioned change. Reserve016 bookkeeping and preserve their015 scripts migration.

## Architecture and ownership
Own billing/public-checkout catalog/store/runtime logic, commercial billing routing, Stripe adapter, focused tests, pricing payment disclosure and after-payment redirect/confirmation. Preserve LeadConnector UI owned by DEV1649; only extend stable API contract where required. A pricing purchase with a number pack uses base hosted Checkout first and then a second hosted number Checkout under the SAME verified provider Customer; both are explicit separate invoices. The automatic confirmation bridge has no configuration fields. If the second purchase is canceled/unpaid, the paid base plan remains usable/claimable and number capacity is not granted; offer continuing number checkout without buying a second base subscription. Existing customers use authenticated workspace-owned Customer/subscription IDs or Stripe native verified email login, never raw-email lookup authorization.

## State and correctness
Persist versioned enrollment and random claim proof before external work. Preserve legacy v1 reconciliation unchanged. A child number checkout attempt is durable with unique identity, expected pack/billing, generation and provider IDs before provider work; retries reuse idempotency identity, unknown stays protected, and only proved expiry permits another attempt. Webhooks resolve primary and child enrollment, pull authoritative current provider state and commit fenced combined normalized entitlements; late child events cannot overwrite the current component. Base and number cancellations/payment failures stay separate. Initial minute grant stays one-time/idempotent. Native plan/seat/Mercury edits accept only known owned native price IDs and bounded quantities, confirm actual payment before increasing rights, update rep plan semantics and preserve in-flight media/capacity ownership.

## Native portal controls
Six base products (3 plans with/without Mercury) stay under Stripe10-product limit; separate number portal has3 pack products, fixed one pack quantity. Native deep links target the existing owned subscription. Base portal allows price and seat quantity; number portal changes pack and cancellation. Never enable shared-account global duplicate redirect or show foreign OS prices. Already-existing legacy subscriptions remain unchanged until an explicit supported switch; preserve their invoice/cancel path.

## Test-first contract
Before production edits, add red coverage for the single recurring base item with Mercury, separate number checkout and quote, native owned-price normalization and malicious cross-kind/foreign prices. Then disposable Postgres tests for persisted child retries/unknown/expiry, duplicate/out-of-order webhooks, base paid +child unpaid partial claim, independent cancellations, paid-only upgrades, quantity/role isolation and idempotent minutes. Stripe test-mode real subscriptions/portal prove updates and payment failures without live charges. Full review/verify and exact-source release gates required. Live proof remains unpaid only and all controlled sessions expire. Public/provider catalog mutation is versioned and old prices retained.

## Source correction
Implementation moved from website-stream bootstrap2722 to this main-based Dialer task2723 before runtime wiring. Current deployed main e64cfa62 includes e11 billing plus UI/scripts015. Only five new owned files copied and hash-checked; no old LeadConnector assets or runtime/app files carried over. Test Stripe catalog21 prices and6/3-product portal configs exist; controlled test Customer has two active one-item test subscriptions. No live pricing or charges changed.

## Native number component refinement
Stripe-native number management uses a free numbers-0 product plus the three paid packs, each with monthly/annual prices in its own four-product portal configuration. After verified base payment, provision a separate one-item zero-price number subscription under the same Customer. Durable provisioning precedes the API call; payment_behavior=default_incomplete prevents automatic debit if unexpected invoice items exist, and verify the initial zero invoice/subscription before offering edits. Resolve lost responses by exact Customer plus enrollment/attempt metadata; never create another component on unknown outcome after the idempotency window. No implicit reprovision after a known customer cancellation; only an explicit manage-number action can create another free component.
A selected initial paid number pack continues through Stripe's native subscription_update_confirm on that free component, not a second custom cart or second purchase of the base. Stripe handles separate invoice/proration/payment authentication. No paid number capacity until the current owned component's latest invoice is paid; canceled/unpaid number capacity cannot cancel or upgrade the base. The post-payment bridge may automatically open the native confirmation once, handles cancellation/partial completion, and preserves private recovery proof. The number interval can differ after native edits, so dashboard summaries must report component amounts/periods separately rather than invent a combined recurring total.

## workspace-owned: validation evidence

- 2026-10-31 01:29:11 `review.run`: passed — OK
- 2026-10-31 01:30:50 `review.run`: passed — OK
- 2026-10-31 01:34:58 `verify`: passed — OK
### Native payment and usage evidence
- User approved independent number-pack invoices. Base bundles are six one-item products (with/without all-seat Mercury); number pool is a separate one-item subscription with a free no-extra-numbers choice. Legacy subscriptions are retained.
- Native Stripe sandbox portal: successful paid Professional+Mercury, 3 seats; declined Enterprise+Mercury upgrade produced open invoice + pending_update while retaining old item. Runtime now protects both changed-item/unpaid and unchanged-item/pending-update cases. No live charge.
- Native hosted one-time minute picker rendered all 3 optional pack choices. Durable intents and paid-line-item validation feed immutable grants. A per-user/month monotonic debit ledger preserves spent credits through upgrades/downgrades and late historical usage.
- Focused PostgreSQL suite covers retries, lost responses, partial invoices, duplicate/stale facts, roles, overassigned downgrade, paid top-ups, foreign-price rejection, quota transitions and frozen closed-month quota. Full server+LeadConnector package run: 447 passed, 91 conditional suites skipped, 3002 assertions before final pending-update regression.
- Strict review and full verify passed; native SQL scenarios are also added to critical test selection so their opt-in gates cannot be silently skipped for billing edits.
- Creation flag stays disabled until live versioned catalog, native-aware backend and website consumer are all validated. Current production UI/source e64cfa preserved.
- 2026-10-31 01:36:32 `verify`: passed — OK

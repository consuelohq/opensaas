# Keep add-on selections on pricing before direct Stripe checkout

branch: `task/website/keep-add-on-selections-on-pricing-before-direct-stripe-checkout`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2718
started: 2026-10-30

## acceptance criteria

- [x] New-subscription add-ons remain on pricing and do not create a provider request on selection.
- [x] Explicit combined plan, seats, period and add-ons reach Stripe directly with the correct quote.
- [x] Bare legacy add-on URLs return to the pricing planner; unsupported existing-customer changes are explicit.
- [x] Focused tests, eight-size browser checks, strict review and full release gate pass.

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
bun run task:push -- --message "type(website): description" --changed
bun run task:pr
bun run task:finish
```

## Approved scope and test-first contract
Ko allows configuration directly on pricing and requires no second cart. Bare add-on links must not launch a guessed base subscription or disappear into the generic legacy redirect. Keep new-subscription choices on the existing pricing team planner; explicitly select plan/seats plus optional Mercury/minute/number packs, quote all recurring and one-time amounts, then send directly to Stripe. No provider side effect from merely selecting an add-on. Existing-customer upgrades and standalone top-ups remain DEV-1644 pending the supported management-flow choice; native portal email login cannot edit multi-product subscriptions. No backend/schema changes or migration015; that belongs to the calling UI owner.

Behavior under test: combined explicit plan/seat/add-on selection survives serialization and direct Checkout; bare add-on links open pricing selection without network effects; invalid counts disable purchase; legacy add-on-only URLs preserve the selection by redirecting to pricing. Existing pattern: checkout-selection validation/quote and team planner. New tests: one focused combined-selection regression plus browser clicks for Mercury, minutes and numbers with captured POST payload and no intermediate page. Red command: bun test tests/checkout-selection.test.ts. Expected red: missing canonical selection query serializer.

## workspace-owned: validation evidence

- 2026-10-30 23:57:53 `review.run`: passed — OK
- 2026-10-30 23:59:45 `verify`: passed — OK

## Evidence
Focused red corrected a test harness import typo, then failed for the intended missing selection serializer; green now preserves Agency2 annual + Mercury2 + 10 numbers +600 once and quotes456200 cents. All34 website tests262 assertions pass. Build succeeds with zero errors/warnings. Full8-size pricing browser matrix and expanded planner overflow checks pass; browser clicks verify no provider request from choosing three add-ons, preservation of explicit Agency/seats, direct Stripe payload with all chosen items and safe legacy add-on selection. Desktop/mobile planner screenshots visually reviewed. Strict review: zero introduced/blocking issues, one existing root Nx typecheck configuration advisory. No backend/schema change, card/email request or carrier call.

## Release gate
Full verify passed all four registered website suites and database guard, with publish-valid stamp. Next: push, exact-pushed-SHA verification, stream promotion, pinned isolated Pages deploy and deployed smoke.

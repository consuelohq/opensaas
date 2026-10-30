# Refine Dialer pricing layout and connect existing Stripe checkout

branch: `task/website/refine-dialer-pricing-layout-and-connect-existing-stripe-checkout`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2710
started: 2026-10-30

## acceptance criteria

- [x] Define explicit task acceptance criteria before coding; recorded in Scope / acceptance criteria and Test-first contract below.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/lead-connector/src/embed/api-client.ts`
- `packages/lead-connector/src/embed/api-client.test.ts`
- `packages/lead-connector/src/embed/controller.ts`
- `packages/lead-connector/src/embed/controller.test.ts`
- `packages/lead-connector/src/embed/internal-main.ts`
- `packages/lead-connector/src/embed/state-machine.ts`
- `packages/lead-connector/src/embed/view.ts`


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

## Scope / acceptance criteria
- Direct follow-up to unshipped stream pricing at 4619318480813b4472d03548195758e9c501767f; user approved additional UI and existing Stripe checkout integration.
- Pricing FAQs all expanded by default and can stay open together. Homepage FAQ retains its existing behavior.
- Automatic infrastructure wordmark carousel on white directly below FAQs; no arrows, no extra headings/subtitles, small “Built for scale” label; seven visible desktop marks; add OpenAI, Claude, OpenCode and Pi. Use real upstream wordmarks, preserve provenance. Pause on hover/focus and respect reduced motion. Explicit user request overrides the default no-loop decorative-motion rule for this strip only.
- Match reference plan hierarchy more closely: plan headings, billing, per-rep pricing/seat rows, product symbols, allowance and features. Tighten white top gap, no outlined/bordered outer sheet, desktop headline exactly two lines; remove hero subtitle and show prices earlier. Fewer unnecessary dividers.
- Improve team planner with a usable checkout CTA carrying plan, billing period and seat count.
- Reuse the existing Stripe account and application checkout contract. Audit account mode, active prices, authentication/tenant binding, add-on SKUs and deployed runtime before selecting a safe integration. Never open mailto for purchase actions. Do not silently charge old prices, trust a client-supplied price or create a parallel billing system. No purchase/payment submitted by this task.
- Preserve existing website lifecycle fixes and active Dialer/DEV-1642 ownership; no carrier calls, production domain cutover or unrelated backend changes.

## Plan / checklist
- [x] Previous integration completed and promoted: #2707 merged into draft stream review #2683; final live pricing/marketing smoke passes including eight plan/billing selections.
- [x] New managed task tsk_d7a98df5be09, task PR #2710, from stream/website.
- [x] Audit existing Stripe/checkout and current provider configuration; discover only genuine missing information.
- [x] Source verified logo wordmarks and record provenance.
- [x] Define focused red UI/checkout contracts, implement, validate build/browser and provider-safe checkout behavior.
- [ ] Publish into existing stream review, update isolated preview, verify actual HTTPS.

## Test-first contract
Behavior: expanded independent pricing FAQs; moving seven-across carousel with accessible pause/reduced-motion fallback; two-line desktop headline and earlier price visibility; correct plan/billing/seat checkout continuation; strict bounds and hostile-query protection; existing authenticated Stripe contract preserves workspace identity and server-owned price mapping. Purchase buttons must never resolve to mailto or silently substitute older catalog amounts.
Pattern: existing Bun contracts, Node/Playwright owned fixture, shared catalog, standalone billing service and adapter tests.
Focused red: extend pricing browser/delivery contracts for all-open FAQ, no mailto purchase CTAs and checkout selection before production edits; add billing contract tests if server changes are necessary.
No-test waiver: assets/copy/spacing use visual and source-byte verification; meaningful checkout and interaction behavior requires focused tests and E2E.

- 2026-10-30 21:05:55 append: `.task/website/refine-dialer-pricing-layout-and-connect-existing-stripe-checkout/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-30 21:05:55 fs.write: `.task/website/refine-dialer-pricing-layout-and-connect-existing-stripe-checkout/workpad.md`

## Approved Stripe scope update
Ko confirmed pay first, connect GoHighLevel afterward, Mercury $25 per rep/month, and explicitly asked this agent to implement Stripe now rather than hand it off. Reuse the existing Consuelo Stripe account and backend. Preserve legacy prices/subscribers. New catalog: Professional $99, Agency $149, Enterprise $199; annual is 12 monthly payments upfront with no invented discount. Add-on prices follow the approved pricing source.

Test-first checkout contract: server chooses prices/quantities from an owned catalog, persists an idempotent enrollment before external work, treats timeout as unknown, never activates based on success URL alone, and requires a secret claim plus an authenticated GHL admin to bind a paid purchase once. Signed events reconcile authoritative Stripe state; unclaimed payments remain durable. Reject tenant mismatch, duplicate binding, forged prices/redirects, unsupported quantities and cross-origin requests. Existing legacy billing remains intact.

## workspace-owned: validation evidence

- 2026-10-30 21:54:17 `review.run`: passed — OK
- 2026-10-30 21:57:37 `review.run`: passed — OK
- 2026-10-30 22:00:14 `verify`: failed — COMMAND_FAILED
- 2026-10-30 22:01:39 `review.run`: passed — OK
- 2026-10-30 22:02:38 `review.run`: passed — OK
Deployment tool gap: deployment.environment set failed with exit 1 and empty diagnostics for this explicitly scoped service. Reconciled names/values privately through code.call and used the current Railway variable set CLI with explicit project/environment/service and --skip-deploys. Only the three public checkout/portal/return-URL settings changed; credentials were not printed or changed.
- 2026-10-30 22:03:32 `verify`: passed — OK
- 2026-10-30 22:06:40 `verify`: passed — OK
- 2026-10-30 22:11:22 `verify`: passed — OK

## Release progress
- Existing Stripe account now contains the exact new catalog and dedicated launch portal configuration; older prices/subscribers were not edited. No payment submitted.
- Authenticated GHL claim hooks published separately as f2230af753ecea227d97905e87aed945c1a234e9 for the concurrent presentation owner (tsk_5385a75d6dc3 / PR2711). Contract and patch are in /tmp/consuelo-billing-ui-contract.json and /tmp/consuelo-billing-ui-hooks.patch. This task will not deploy competing edge presentation assets.
- Full verify passed all eight registered suites and DB guard. Focused disposable-Postgres proof passed 48 assertions. Additional inspection found that purchase claim must share the existing owner/admin authorization policy; adding an owner regression before final publication.
- Real webhook still targets the retired workers.dev host (404). After verified backend deployment, move that existing endpoint to calls.consuelohq.com/v1/webhooks/stripe while keeping its signing secret and existing events, and add checkout completion/expiry events. The billing return URL has been staged to the canonical calls domain without triggering deployment.

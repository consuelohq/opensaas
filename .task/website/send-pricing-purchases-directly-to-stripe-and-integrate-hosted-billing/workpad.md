# Send pricing purchases directly to Stripe and integrate hosted billing

branch: `task/website/send-pricing-purchases-directly-to-stripe-and-integrate-hosted-billing`
stream: `stream/website`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2717/send-pricing-purchases-directly-to-stripe-and-integrate-hosted-billing
github pr: https://github.com/consuelohq/opensaas/pull/2717
started: 2026-10-30

## acceptance criteria

- [x] Direct-checkout scope and provider constraints recorded before edits.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Direct hosted new-purchase flow complete; full browser and release gates underway. Existing-customer upgrades/add-on management remains explicitly dependent on the pending product choice.

## files changed

- Global Stripe launcher, recovery boundary, legacy redirect/post-payment confirmation, native billing login and focused website/browser tests.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-10-30 23:38:48 `review.run`: passed — OK
- 2026-10-30 23:39:18 `review.run`: passed — OK
- 2026-10-30 23:45:06 `review.run`: passed — OK
- 2026-10-30 23:47:45 `review.run`: passed — OK
- 2026-10-30 23:48:33 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(website): description" --changed
bun run task:pr
bun run task:finish
```

## Approved scope and product constraint
Ko explicitly removed the intermediate get-started cart. New purchase buttons and team selections should send directly from pricing to hosted Stripe. Legacy cart URLs may silently launch Checkout, but must not render plan/seat/add-on configuration again. Preserve after-payment GHL confirmation/secret claim and existing prices. Calling UI owner continues to use authenticated checkout API returning a hosted destination; no competing calling-edge deploy.

Stripe official docs verified: customer portal cannot update multi-product subscriptions, including plan + Mercury/number add-ons. Deep-link subscription_update_confirm is also limited to one item. A product-preference question is pending: choose changes on pricing then confirm/pay on Stripe versus rework packaging for all-Stripe editing. Do not enable unsupported portal updates or trust an email address as ownership. Complete independent new-purchase shortcut while this is pending; management architecture remains dependent on the answer.
References: https://docs.stripe.com/customer-management#limitations and https://docs.stripe.com/customer-management/portal-deep-links . Shared Stripe account also contains OS billing, so do not enable global duplicate-subscription redirection until product/account scope is verified.

## Test-first contract
Behavior: clicking a paid pricing CTA or team/add-on selection reaches Stripe with the selected plan, billing and quantities; no intermediate cart fields/page. Persist random private claim token and idempotency request before the network effect; unknown responses/reload reuse identity; validate redirect host. No ordinary test calls live Stripe/backend. Post-payment confirmation still needs provider-paid truth and secret proof; no activation from query params. Existing customer changes require verified owner and existing subscription, never raw email lookup authorization.
Tests: update existing rendered website/checkout tests to mock provider boundary and verify direct navigation, correct payload, retries/refresh, malicious redirect rejection, confirmation and Starter/no-JS fallback. Add backend regressions and disposable Postgres proofs for any changes to enrollment/owned updates.
Plan: finish shipped polish evidence; implement direct public launch and remove cart; inspect authenticated runtime contract; implement selected supported hosted billing path after product choice; gates, publish, exact-source deployment and unpaid provider proof where relevant. No payment/card entry, carrier calls or recordings.

## Parallel ownership
Calling UI agent owns presentation, monochrome branding, endpoint stability, nested settings pages, plan footer, history and Mercury page. Preserve PR2712/current main changes during future merge. Backend billing, checkout, catalog and verified entitlement synchronization remain this task. Coordination contract /tmp/consuelo-billing-ui-contract.json; no outbound agent messaging required.

## Implementation checkpoint
Direct redirect boundary and global pricing-link launcher implemented, with idempotent private browser recovery, redirect validation, page-lifecycle cancellation and no intermediate cart UI. Legacy get-started URLs auto-launch; generic start goes to pricing; after-payment confirmation retained with strict provider response and install-host checks. Browser suites now stub all public billing/Stripe/GHL destinations before testing direct navigation; no ordinary test should create live sessions. New unit boundary3 tests14 assertions passed. Build found one typed test array mismatch, corrected. Prettier cannot parse the pre-existing minified analytics block in MarketingLayout; preserve that block and format only the new modules/page instead.

## Hosted billing login
Enabled login_page on the existing dedicated live portal bpc_1UWNRkRyHwVDNd3Dl1huHoM9, with public return to the isolated pricing preview. Invoice/payment/cancellation features preserved; subscription item updates stay disabled because Stripe explicitly does not support our multi-product subscriptions. No global one-active-subscription setting changed: this is a shared OS/Dialer account and native email matching chooses the most recent active Customer, so raw email is not a product/tenant ownership shortcut. No email request, card or charge submitted. Public pricing Manage billing now points to Stripe's public email-verification login. Receipt /tmp/consuelo-direct-stripe-portal-login.json. Existing upgrade/package decision remains pending.

## Validation checkpoint
All 33 website unit tests / 260 assertions pass. Astro check/build passes with zero errors or warnings (seven advisory hints). Full pricing browser matrix passes at 320x568, 375x812, 430x932, 568x320, 667x375, 768x1024, 1024x768, 1440x1000; direct navigation/retry/reload, unsafe redirect rejection, secret confirmation, keyboard/no-JavaScript fallback pass. Marketing suite passes four plans by two billing periods, lifecycle and 84 local links. Fixtures intercept all public billing and Stripe destinations; no live side effects from ordinary tests. Strict review: zero issues introduced, zero blocking; only existing root Nx typecheck configuration advisory. Final portal-link smoke and full verification pending.

## Release gate
Full verify against origin/stream/website passed all four registered website suites and database guard; publish-valid stamp written. Strict review has zero introduced or blocking findings. Portal-link browser smoke passed 375/1440 and Stripe actual login returned 200 with visible email field, title Consuelo Billing; no email sent. The first portal smoke revealed the account-link data was not rendered; fixed by rendering Manage billing in the pricing fineprint and reran successfully. No unsupported subscription update capability is advertised as implemented.

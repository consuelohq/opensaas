# Website checkout and GoHighLevel connection

The website's public purchase flow reuses the existing Consuelo Stripe account and commercial database. It does not require a GoHighLevel session until the buyer claims the paid purchase.

## Catalog and runtime switches

The server owns launch catalog version `launch-20261030` in `src/billing/public-checkout-catalog.ts`. Prices are looked up by `consuelo_launch_20261030_<code>_<monthly|annual|once>` and verified for amount, USD currency, and recurring interval before Checkout creation. Professional is $99, Agency $149, Enterprise $199 per rep/month. Mercury is $25 per rep/month. Annual recurring items cost twelve monthly equivalents upfront; monthly minute allowances remain monthly.

- `DIALER_PUBLIC_CHECKOUT_ENABLED=true` enables backend composition and routes.
- `DIALER_CHECKOUT_WEBSITE_ORIGIN` selects the approved website checkout origin for new signups starting in GoHighLevel. Use the isolated preview until the public marketing release is approved; production can then use https://consuelohq.com.
- `STRIPE_PUBLIC_PORTAL_CONFIGURATION_ID` selects the launch-only portal configuration for payment methods, invoices, and period-end cancellation. Subscription item updates are disabled.
- `DIALER_BILLING_RETURN_URL=https://calls.consuelohq.com/admin`.
- `PUBLIC_DIALER_CHECKOUT_ENABLED=true` enables the website's payment button only after backend proof.
- Existing Stripe secret/webhook keys and GoHighLevel OAuth settings remain authoritative. Do not print them.

Active legacy subscription prices and entitlements remain intact. New trials receive the launch catalog and 100 total minutes. Authenticated new signups open the same owned website checkout selection, preserving their selected tier and seat count, so the embedded path cannot sell an older price. The single/standard/power storage codes remain intact. A claimed launch purchase gets its own scoped catalog and is projected into the existing seat-storage codes. The launch checkout does not migrate another subscription. Existing active subscriptions cannot be overwritten by a claim.

## Purchase contract

1. The browser generates a UUID request identity and 32-byte private claim token. It retains these in sessionStorage before the request, including through retries and refreshes. The token is never put into a URL or Stripe metadata.
2. `POST /v1/public/billing/checkout` accepts version, requestId, claimToken and a validated selection. Prices and return URLs are server-owned. A durable enrollment and token hash are stored before Stripe work. Stripe creation uses enrollment-specific idempotency.
3. A timeout preserves the enrollment. Repeating that same request recovers the same external Checkout session. A known-expired session can be replaced; an unknown outcome is not treated as a failed payment.
4. Stripe redirects to the originating approved website's confirmation page with only the purchase ID. That query does not activate access.
5. `GET /v1/public/billing/purchase/:id` requires the private token in `X-Purchase-Claim`. The server retrieves Stripe's current Checkout/subscription facts before reporting payment.
6. The buyer connects GoHighLevel, opens Dialer settings and pastes the private setup code. `POST /v1/commercial/billing/claim` requires the existing verified admin identity plus purchase ID/token. Workspace identity comes from authentication.
7. A transactional database function binds a purchase to one workspace, refuses replacement of another active subscription, checks capacity, projects inventory, and grants a one-time minute pack at most once. Repeating the claim does not undo later team assignments.

The confirmation tab must remain available until setup finishes. Automatic cross-device recovery of a lost private setup token is not implemented; support must verify the Stripe receipt and payer before a recovery procedure is added. Never accept an unverified email or the purchase ID alone as proof of ownership.

## Provider reconciliation and limits

Stripe signatures are verified by the existing commercial boundary. Public purchase events reconcile current provider state and record an event ID/type/outcome without duplicating billing PII. Each reconciler acquires a monotonic generation before fetching provider state. Only that current generation can project a result, preventing an older response from overwriting newer state. Unexpected subscription item changes suspend access for reconciliation rather than applying a guessed entitlement.

Claimed launch calls use the owned plan's monthly minutes, included number capacity and recording/transcript flags. Prepaid minutes form a workspace pool. Consumption is derived from the immutable connected-minute ledger: sum positive per-rep, per-calendar-month usage above the plan allowance, then subtract it from one-time grants. Current caller overage is added back only when calculating that caller's effective ceiling so usage is not deducted twice. In-flight usage retains the existing service's completed-call metering boundary.

Number bundles expand number inventory; releasing one of their numbers does not silently resize the purchased recurring bundle. General self-service plan/quantity changes and standalone repeat top-ups are separate billing work. The launch portal supports invoices, payment methods and cancellation. This implementation grants Mercury inventory; it does not implement the coaching features tracked by DEV-1645.

## Validation

Run focused catalog and legacy commercial regression suites, both package typechecks, and:

```bash
CONSUELO_RUN_PUBLIC_CHECKOUT_POSTGRES=1 bun test packages/dialer-server/src/public-checkout.postgres.integration.test.ts
```

This suite starts and tears down a disposable loopback PostgreSQL process; it never uses customer DATABASE_URL. It covers unknown outcomes, idempotency, capacity and tenant races, stale response fencing, rate limits, pooled credits, legacy isolation and unpaid/malformed purchases.

The website pricing browser test intercepts provider requests to prove the pay-first UI without creating a payment. Separately verify one actual hosted Checkout session and expire it without submitting card details. A simulated paid fixture is not evidence of a real charge or live GoHighLevel claim.

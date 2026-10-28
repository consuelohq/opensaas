# activate consuelo dialer commercial billing

branch: `task/dialer/activate-consuelo-dialer-commercial-billing`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1797/activate-consuelo-dialer-commercial-billing
github pr: https://github.com/consuelohq/opensaas/pull/1797
started: 2026-08-10

## acceptance criteria

- [x] Use the existing live Stripe account currently sourced from the legacy `consuelo_on_call_coaching` Railway service; do not modify legacy Stripe products/prices.
- [x] Create a fresh live Consuelo Dialer monthly catalog: Single $59, Standard $99, Power $159, additional number $1.99.
- [x] Create a dedicated Stripe webhook for the deployed dialer `/v1/webhooks/stripe` endpoint with only the commercial lifecycle events consumed by the server.
- [x] Stage all required commercial Railway variables while `DIALER_COMMERCIAL_ENABLED` remains off, including reviewed trial/seat/number/minute/grace values and exact Stripe price IDs/secrets.
- [x] Enable `DIALER_COMMERCIAL_ENABLED=true` only after the catalog, webhook, and runtime prerequisites are verified.
- [x] Prove `/health`, authenticated commercial caller/admin, Stripe signature rejection, Railway runtime logs, and authenticated GHL admin/overlay/queue-preview behavior after activation.
- [x] Do not complete a paid Checkout, buy/release a phone number, or initiate a carrier call during this activation task.
- [x] Keep product source unchanged; no runtime validation required a code change.

## Test-first contract

- Behavior under test: production configuration activates the already-reviewed commercial runtime with the approved catalog and dedicated Stripe webhook, while safe read-only GHL/dialer behavior remains healthy.
- Existing local pattern: `plans/catalog.ts`, `routes/commercial.ts`, commercial acceptance tests, Railway runtime composition, Cloudflare `/v1/` proxy, and PR #1782 production smoke.
- New/changed tests: none; no product source changed.
- No-test waiver: this phase is external provider/environment configuration only. Validation is provider read-back, Railway startup/runtime evidence, authenticated HTTP boundaries, and GHL browser smoke.

## completed activation

### Stripe

- Approved live account: `acct_1S3SiRRyHwVDNd3D` (`Consuelo`, US). The valid credential remains sourced from the legacy Railway service; legacy Stripe products/prices were not modified.
- Single: product `prod_V2mcjhC7NScp0z`, price `price_1U2h3PRyHwVDNd3DpdNFdFWN`, lookup `consuelo_dialer_single_monthly_v1`, $59/month.
- Standard: product `prod_V2mcR3bW7iIpbn`, price `price_1U2h3PRyHwVDNd3Dj3um6sqi`, lookup `consuelo_dialer_standard_monthly_v1`, $99/month.
- Power: product `prod_V2mcmnpBNi5cWt`, price `price_1U2h3QRyHwVDNd3DTEG8gAbt`, lookup `consuelo_dialer_power_monthly_v1`, $159/month.
- Additional Number: product `prod_V2mcsp67jHmtjA`, price `price_1U2h3RRyHwVDNd3DK4jAE8Zt`, lookup `consuelo_dialer_additional_number_monthly_v1`, $1.99/month.
- All four read back active, live, USD monthly, with `product_family=consuelo-dialer`.
- Dedicated webhook: `we_1U2h4URyHwVDNd3D4oIYtaFX` → `https://consuelo-lead-connector-embed.kokayi-90b.workers.dev/v1/webhooks/stripe`.
- Enabled webhook events exactly: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
- Stripe object creation used idempotency keys. The endpoint signing secret was written directly to Railway and never printed or persisted in this workpad.

### Railway configuration and activation

- Target service: `f97bc786-ba06-44e7-a854-3294ac857c06`, production environment `6de4fa99-b047-4587-b003-69f78b650aa1`.
- Configuration was staged with `DIALER_COMMERCIAL_ENABLED=false` and `--skip-deploys`, then read back exactly before activation.
- Reviewed runtime values: trial 500 minutes / 1 seat / 1 number / Standard entitlement; Single 1,388 minutes and $30 provider budget; 1/3/10 number caps; 1 included number per paid seat; $1.99 additional number; 3-day payment grace.
- Billing return URL: `https://consuelo-lead-connector-embed.kokayi-90b.workers.dev/admin`.
- Merged `loadDialerPlanCatalog(process.env)` accepted the staged Railway environment and emitted the expected safe catalog before the feature flag was enabled.
- `DIALER_COMMERCIAL_ENABLED=true` triggered activation deployment `e10107b4-263d-4c74-8916-500c361878bd` at 2026-08-10T00:28:52Z.
- Deployment status: `SUCCESS`; image digest `sha256:fe30baecd11b1c3170dbf7299524c5d0fa228d23d5ed3eefaba076f8f3d4c691`.
- Startup log: container started and `[dialer-server] listening on 0.0.0.0:8080`. The listener is intentionally written to stderr; no commercial runtime/configuration failure appeared.
- Railway `twilio OR queue` filter returned no error activity in the activation window.

### HTTP boundaries after activation

Both direct Railway and Cloudflare Worker origins returned:

- `/health` → 200.
- unauthenticated `/v1/commercial/catalog` → 401.
- unauthenticated `/v1/commercial/caller` → 401.
- unauthenticated `/v1/commercial/admin` → 401.
- unsigned `POST /v1/webhooks/stripe` → 401.

Before activation the commercial caller/admin paths were literal 404s, so these results prove the runtime is mounted while preserving authentication/signature boundaries.

### Authenticated GHL smoke

- Location: `Wkbuoi0VRjQ7KMKUjdTY`.
- Overlay reauthentication: `POST /v1/embed/session` → 201; contacts/opportunities/call reads → 200; `/v1/commercial/caller` repeatedly → 200.
- One pipeline request returned a transient 502 immediately after reconnect; every subsequent pipeline request observed returned 200 without another user action.
- Authenticated `/v1/commercial/admin` repeatedly → 200.
- Admin UI renders `Plans`, `Team`, `Phone numbers`, `Usage`, `Billing`, `Active calls`, and `Call history`; trial state defaults to one Standard seat and shows no paid seats/numbers.
- Deployed admin payload read-back: trial 500 minutes, 1 seat, 1 number, Standard; Single 5900 cents, Standard 9900, Power 15900, additional number 199, grace 3 days; no subscription, no paid seats, no provisioned numbers in the sandbox.
- Overlay renders queue-first setup with `Choose list`, `Single dial`, caller ID, local presence, calling mode, line count, and disabled `Start Dialer` before target selection.
- Read-only queue preview: Marketing Pipeline → New Lead; opportunity total 1, callable total 1, candidate count 1.
- Active calls before/after preview: 0 → 0; active payload unchanged; call-history payload byte-identical before/after.
- Temporary authenticated admin/overlay smoke iframes were removed after validation.

## wait evidence

- Commercial activation deploy: waited 10 seconds, then immediately checked Railway. New deployment `e10107b4-263d-4c74-8916-500c361878bd` was already `SUCCESS`; proceeded to logs/HTTP checks.
- GHL overlay reauthentication: waited 3 seconds after Retry; immediate verification showed embed session 201 and commercial caller 200.
- Authenticated admin iframe: waited 2 seconds; immediate snapshot/network proof showed commercial admin 200 and rendered commercial administration.
- Authenticated overlay queue smoke: waited 2 seconds; immediate snapshot exposed the queue-first controls; final read-only New Lead preview returned one callable candidate with no active/history mutation.

## files changed

- `.task/dialer/activate-consuelo-dialer-commercial-billing/workpad.md`

## key decisions

- New billing artifacts are canonically named `Consuelo Dialer`; legacy on-call-coaching Stripe/Railway artifacts remain untouched.
- The legacy Railway service is only the source of the valid existing Stripe account credential; it was not renamed or repurposed.
- New Stripe prices were created instead of modifying historical price objects.
- The Cloudflare Worker remains the public Stripe webhook boundary and proxies `/v1/` to dialer-server.
- No live paid checkout/customer/subscription, phone-number purchase/release, or carrier call was used as an activation test.

## issues and recovery

- No typed Stripe product/price/webhook workspace tool exists, so provider changes used the authenticated Railway-injected credential through scoped `mac.call`; secrets were never printed.
- Typed `railway.logs` is advertised but unavailable in the task bundle; authenticated Railway CLI was used for status/log evidence.
- `browser.wait` returned one transport 502; recovered with the workspace `wait` tool and immediate deterministic verification.
- A first request-detail auth extraction chose a request record without headers; no API mutation occurred. The retry used JSON request detail and kept the bearer token only in a local shell variable.

## current status

- Commercial runtime is enabled and production-safe smoke is green.
- Remaining optional next phase is a separately authorized billing canary (creating a Checkout/customer and, only if desired, completing a real charge) plus any later live Twilio number/call canary.

## publish checklist

```bash
bun run task:push -- --message "chore(dialer): record commercial billing activation" --changed
bun run task:pr
bun run task:finish
```

- 2026-08-10 00:38:04 write: `.task/dialer/activate-consuelo-dialer-commercial-billing/workpad.md`

## workspace-owned: files changed

- `.task/dialer/activate-consuelo-dialer-commercial-billing/workpad.md`

## workspace-owned: activity log

- 2026-08-10 00:38:04 fs.write: `.task/dialer/activate-consuelo-dialer-commercial-billing/workpad.md`

## workspace-owned: validation evidence

- 2026-08-10 00:40:21 `review.run`: passed — OK
- 2026-08-10 00:40:21 `review.run`: passed — OK
- 2026-08-10 00:40:21 `review.run`: passed — OK
- 2026-08-10 00:40:21 `review.run`: passed — OK
- 2026-08-10 00:40:21 `review.run`: passed — OK
- 2026-08-10 00:40:22 `review.run`: passed — OK
- 2026-08-10 00:40:22 `review.run`: passed — OK
- 2026-08-10 00:40:22 `review.run`: passed — OK
- 2026-08-10 00:41:56 `verify`: passed — OK
- 2026-08-10 00:41:56 `verify`: passed — OK

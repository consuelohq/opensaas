# RD7B — Customer entry and booking UI

## Scope

Implement the RD7B node from `areas/dialer/rd/GRAPH.md` on top of merged RD6. Own only public customer phone/callback/scheduled-callback/cancellation UI plus narrow adapters. Keep callback scheduling, consent/eligibility, capacity, carrier effects, and booking truth in RD6/server authority. Do not add customer browser telephony, imply marketing consent, invent an ETA, or claim an unconfirmed calendar request is booked.

## Acceptance criteria

- A public customer entry surface is addressable only by an explicit configured `customerEntry.publicId`, exposes a real `tel:` link, and never accepts or exposes internal `numberId`, workspace identity, queue identity, or account identity as browser authority.
- Public customer entry is fail-closed unless `customerEntry` is explicitly configured on an enabled inbound number. `customerEntry` must supply its abuse window and per-client/per-number request limits; RD7B does not invent production rate-limit defaults.
- Callback capability is hidden when the configured number has no active RD6 callback policy. Unknown/disabled entries fail closed.
- Immediate callback copy means “as soon as staffed capacity permits” and never invents a wait-time ETA.
- Scheduled callback inputs use server-authored staffed service windows in the authoritative queue timezone; the browser does not invent timezone/window truth.
- Public callback submission requires explicit request permission evidence, validates canonical E.164, is idempotent for duplicate browser submissions, and has durable abuse/cost admission limits.
- Public callback creation returns an opaque signed management capability. Callback IDs/workspace IDs/recipient phone numbers are not accepted as public authority.
- Management capability can read status, reschedule eligible obligations, and cancel the full obligation through RD6. Invalid/tampered/expired capabilities fail closed.
- Booking state is surfaced exactly as RD6 reports it: `unavailable`, `requested`, `confirmed`, or `cancelled`; only `confirmed` with provider + evidence references may render as a booked appointment.
- “No staff available now” is truthful and distinct from callback availability; the UI may still offer an enabled callback without promising an ETA.
- Public customer UI is a normal browser page and does not initialize LeadConnector iframe bootstrap, authenticated CRM APIs, or browser voice/microphone tooling.
- Existing `/`, `/admin`, `/overlay`, outbound, operator, and webhook behavior remains unchanged.
- No real carrier call, provider spend, external calendar booking, production deploy, recording, or transcription is performed by RD7B validation.

## Test-first contract

### Server public adapter

Create focused tests before implementation for a public RD7B adapter/route:

1. `GET /v1/inbound/customer/:publicId`
   - derives internal number/workspace/queue exclusively from server telephony configuration;
   - returns phone number, callback capability/disclosure, authoritative timezone, staffed service windows, and current staffing availability;
   - never returns internal number/workspace/queue/account credentials;
   - rejects unknown or disabled public entries and hides callback controls when policy is absent.
2. `POST /v1/inbound/customer/:publicId/callbacks`
   - rejects absent explicit permission, malformed E.164, malformed idempotency key, invalid/unknown service-window references, and forged internal authority fields;
   - same idempotency key returns the same RD6 obligation without duplication or consuming another rate slot;
   - distinct requests hit durable configured per-client and per-number admission bounds before provider-costing work;
   - immediate requests use the earliest staffed service window and truthful “staffed capacity permits” semantics;
   - scheduled requests use a server-authored queue-timezone service window and call RD6 `request`, then RD6 `book` only as a capability/truth probe.
3. Management routes use only an opaque signed capability token:
   - read status without exposing recipient/workspace/internal-number authority;
   - reschedule through RD6 `reschedule` and refresh RD6 `book` truth for the new revision;
   - cancel through RD6 `cancel` and never report cancelled until the obligation state says so;
   - tampered/expired/wrong-entry tokens fail closed.
4. Booking rendering contract keeps `requested` separate from `confirmed`; provider/evidence references are required for confirmation.

### Public browser surface

Create focused LeadConnector tests before implementation:

1. `/call/:publicId` resolves to a dedicated `customer` surface while `/`, `/admin`, `/overlay` keep existing behavior.
2. Cloudflare Worker serves the application shell for `/call/:publicId`, proxies `/v1/...`, applies public-page security headers, and does not grant microphone permission, Twilio WebSocket connectivity, or iframe embedding to the customer surface.
3. Customer controller/view:
   - displays `tel:` link and server-authored availability/timezone/disclosure/service windows;
   - hides callback/scheduling when unavailable;
   - distinguishes immediate callback from scheduled service window;
   - requires explicit permission checkbox;
   - double-submit reuses one idempotency key;
   - renders `requested`/`confirmed`/`unavailable` truthfully;
   - exposes cancel/reschedule only with returned management capability;
   - never boots iframe parent bridge, authenticated CRM controller, or agent voice.

### Planned regression validation

- Focused RD7B server tests + LeadConnector public-surface tests.
- Existing inbound callback/telephony unit tests.
- Existing dialer-server ordinary suite and `@consuelo/dialer` suite.
- LeadConnector test/build/typecheck.
- Real isolated Postgres callback integration for duplicate/rate-limit/manage/restart behavior; simulated carrier only.
- Strict workspace review and canonical verify before publish.

## Implementation plan

1. Add red server contract tests and red public-surface tests.
2. Extend inbound-number config with optional explicit `customerEntry` public-id + abuse-limit policy; add a durable customer-entry admission/consent ledger if required by the red tests.
3. Add a narrow server-side customer-entry application around configured inbound numbers + RD6 callbacks. Derive tenant/queue server-side and issue signed management capabilities.
4. Mount public customer routes before `/v1/*` authentication in `dialer-server`.
5. Add a dedicated LeadConnector customer surface and public-only browser entry path without touching internal iframe bootstrap/voice lifecycle.
6. Run focused tests, then broader package/integration checks; fix regressions.
7. Write `areas/dialer/rd/receipts/RD7B.md`, run strict review/canonical verify, push PR #2477, promote task → `stream/dialer`, verify merge, and cleanup.

## Files changed

- `.task/dialer/rd7b-customer-entry-and-booking-ui/workpad.md`
- `areas/dialer/rd/receipts/RD7B.md`
- `packages/dialer-server/src/inbound/customer-entry-migration.ts`
- `packages/dialer-server/src/inbound/customer-entry.integration.test.ts`
- `packages/dialer-server/src/inbound/customer-entry.ts`
- `packages/dialer-server/src/inbound/telephony-config.test.ts`
- `packages/dialer-server/src/routes/inbound-customer.test.ts`
- `packages/dialer-server/src/routes/inbound-customer.ts`
- `packages/lead-connector/src/embed/customer-main.ts`
- `packages/lead-connector/src/embed/customer.test.ts`
- `packages/lead-connector/src/embed/customer.ts`
- `packages/lead-connector/src/embed/main.ts`

## Evidence / notes

- Correct task: `tsk_c64f22a3e47b`, PR #2477, branch `task/dialer/rd7b-customer-entry-and-booking-ui`, based on current `stream/dialer`.
- Bootstrap-only mistaken PR #2476 was closed before production edits; it is not the RD7B implementation branch.
- RD6 PR #2474 is merged in the task base and receipt explicitly authorizes RD7B to consume callback/booking contracts.

## Completion evidence

- Implemented explicit `customerEntry.publicId` + configured abuse limits; all internal workspace/queue/number authority is resolved server-side.
- Implemented durable migration `20260913_011_customer_entry`, HMAC-pseudonymized admission/permission evidence, server-side concurrent idempotency, per-client/per-number bounds, and opaque restart-safe management capabilities.
- Implemented server-authored queue-timezone service-window capabilities, truthful staffing availability, RD6-backed create/reschedule/cancel, side-effect-free status reads, and booking truth that cannot promote `requested` to `confirmed` without provider + evidence references.
- Implemented isolated `/call/:publicId` customer browser surface with direct `tel:` calling, immediate/scheduled callback forms, explicit one-request permission, cancel/reschedule/status, responsive customer-only layout, and session-scoped management-token reload continuity.
- Public customer bootstrap is code-split from internal CRM/iframe/Twilio Voice code; customer edge CSP denies framing/microphone and removes Twilio WebSocket connectivity while existing admin/overlay policy remains unchanged.
- Full Dialer suite: **261 passed / 0 failed / 609 assertions**.
- Full ordinary Dialer Server suite: **196 passed / 0 failed / 50 service-backed skips**.
- Full LeadConnector suite: **142 passed / 0 failed**.
- Isolated real-Postgres RD7B integration: **2 passed / 0 failed / 24 assertions**, including concurrent duplicate collapse, both abuse ceilings, restart continuity, tampered capability rejection, A → B → A reschedule, management-expiry extension, and cancellation.
- Isolated Postgres + Redis dialer lab: **1 passed / 0 failed / 37 assertions**, including migration 011 rollback/reapply and deterministic cleanup.
- Dialer, Dialer Server, and LeadConnector typechecks/builds passed; Dialer compiled Node smoke passed.
- Strict `review.run --strict --no-tests` against `stream/dialer`: **0 task findings / 0 blockers / 0 pre-existing findings**.
- Receipt written: `areas/dialer/rd/receipts/RD7B.md`.
- Safety boundary preserved: no real carrier call/audio, provider spend, recording/transcription, external-calendar booking/cancellation, or production deployment was performed or claimed.

- 2026-09-13 21:08:31 write: `.task/dialer/rd7b-customer-entry-and-booking-ui/workpad.md`

## workspace-owned: files changed

- `.task/dialer/rd7b-customer-entry-and-booking-ui/workpad.md`
- `areas/dialer/rd/receipts/RD7B.md`
- `packages/dialer-server/src/inbound/customer-entry-migration.ts`
- `packages/dialer-server/src/inbound/customer-entry.integration.test.ts`
- `packages/dialer-server/src/inbound/customer-entry.ts`
- `packages/dialer-server/src/inbound/telephony-config.test.ts`
- `packages/dialer-server/src/routes/inbound-customer.test.ts`
- `packages/dialer-server/src/routes/inbound-customer.ts`
- `packages/lead-connector/src/embed/customer-main.ts`
- `packages/lead-connector/src/embed/customer.test.ts`
- `packages/lead-connector/src/embed/customer.ts`
- `packages/lead-connector/src/embed/main.ts`

## workspace-owned: activity log

- 2026-09-13 21:08:31 fs.write: `.task/dialer/rd7b-customer-entry-and-booking-ui/workpad.md`
- 2026-09-13 21:09:40 fs.write: `packages/dialer-server/src/inbound/telephony-config.test.ts`
- 2026-09-13 21:09:50 fs.write: `packages/dialer-server/src/routes/inbound-customer.test.ts`
- 2026-09-13 21:10:00 fs.write: `packages/lead-connector/src/embed/customer.test.ts`
- 2026-09-13 21:11:33 fs.write: `packages/dialer-server/src/routes/inbound-customer.ts`
- 2026-09-13 21:11:56 fs.write: `packages/lead-connector/src/embed/customer.ts`
- 2026-09-13 21:13:47 fs.write: `packages/dialer-server/src/inbound/customer-entry.integration.test.ts`
- 2026-09-13 21:14:37 fs.write: `packages/dialer-server/src/inbound/customer-entry-migration.ts`
- 2026-09-13 21:16:31 fs.write: `packages/dialer-server/src/inbound/customer-entry.ts`
- 2026-09-13 21:18:10 fs.write: `packages/lead-connector/src/embed/main.ts`
- 2026-09-13 21:18:15 fs.write: `packages/lead-connector/src/embed/customer-main.ts`
- 2026-09-13 21:26:59 fs.write: `areas/dialer/rd/receipts/RD7B.md`

## workspace-owned: files read

- `areas/dialer/rd/receipts/RD6.md`
- `packages/dialer-server/package.json`
- `packages/dialer-server/scripts/local-dialer-lab.ts`
- `packages/dialer-server/src/app.contract.test.ts`
- `packages/dialer-server/src/app.ts`
- `packages/dialer-server/src/contracts.ts`
- `packages/dialer-server/src/database/migrations.ts`
- `packages/dialer-server/src/inbound/callback-migration.ts`
- `packages/dialer-server/src/inbound/callbacks.integration.test.ts`
- `packages/dialer-server/src/inbound/callbacks.ts`
- `packages/dialer-server/src/inbound/customer-entry.integration.test.ts`
- `packages/dialer-server/src/inbound/customer-entry.ts`
- `packages/dialer-server/src/inbound/postgres-journal.ts`
- `packages/dialer-server/src/inbound/rep-capacity.ts`
- `packages/dialer-server/src/inbound/routing-policy.ts`
- `packages/dialer-server/src/inbound/telephony-admission.ts`
- `packages/dialer-server/src/inbound/telephony-config.ts`
- `packages/dialer-server/src/inbound/telephony-contracts.ts`
- `packages/dialer-server/src/inbound/telephony.ts`
- `packages/dialer-server/src/lab/learning-rollback-scenario.ts`
- `packages/dialer-server/src/lab/local-dialer-lab.integration.test.ts`
- `packages/dialer-server/src/routes/inbound-customer.ts`
- `packages/dialer-server/src/routes/inbound-operator.ts`
- `packages/dialer-server/src/routes/inbound.ts`
- `packages/dialer-server/src/runtime/environment.ts`
- `packages/dialer-server/src/runtime/inbound.ts`
- `packages/dialer-server/tsconfig.json`
- `packages/dialer/package.json`
- `packages/dialer/src/inbound/routing-contracts.ts`
- `packages/dialer/src/inbound/routing-policy.ts`
- `packages/lead-connector/package.json`
- `packages/lead-connector/scripts/build-embed.ts`
- `packages/lead-connector/src/embed/api.ts`
- `packages/lead-connector/src/embed/architecture.contract.test.ts`
- `packages/lead-connector/src/embed/cloudflare-worker.ts`
- `packages/lead-connector/src/embed/index.html`
- `packages/lead-connector/src/embed/main.ts`
- `packages/lead-connector/src/embed/styles.css`
- `packages/lead-connector/src/embed/surface.ts`
- `packages/lead-connector/tsconfig.json`

## workspace-owned: validation evidence

- 2026-09-13 21:25:17 `review.run`: passed — OK
- 2026-09-13 21:25:29 apply-patch: `packages/dialer-server/src/routes/inbound-customer.ts`
- 2026-09-13 21:25:29 apply-patch: `packages/lead-connector/src/embed/main.ts`
- 2026-09-13 21:25:53 `review.run`: passed — OK
- 2026-09-13 21:26:01 apply-patch: `packages/dialer-server/src/routes/inbound-customer.ts`
- 2026-09-13 21:26:18 `review.run`: passed — OK
- 2026-09-13 21:26:59 write: `areas/dialer/rd/receipts/RD7B.md`
- 2026-09-13 21:27:06 apply-patch: `.task/dialer/rd7b-customer-entry-and-booking-ui/workpad.md`
- 2026-09-13 21:28:05 `verify`: passed — OK

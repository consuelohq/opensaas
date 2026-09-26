# Dialer release readiness — 2026-09-26

This is a source audit and deployed no-carrier smoke receipt, not live-call acceptance.
Source: stream/dialer at `d768f6cc7fd7b472b619e20c441dffd329f80c2a`.
Stream PR: [#2436](https://github.com/consuelohq/opensaas/pull/2436), open and conflicting with main when inspected.
Audit task: #2596. No product source or deployment configuration changed during this audit. Initial task verification passed for this documentary change; no runtime suites were selected.

## What is installed and what works

- Railway dialer-server is running; direct Railway and public `https://calls.consuelohq.com/health` return HTTP 200.
- Railway deployment `7f7135c4-9546-4ba3-83dd-12227221b630` was created 2026-09-22. Image digest: `sha256:6e709de6508b2259e5716cffee5ad8774df678e51dde1a6c014e389af2e972e3`. Manual artifact deployment metadata has no source SHA, and SHA environment variables are absent. Do not claim this equals the stream candidate.
- Dedicated dialer-postgres and dialer-redis services report running.
- The existing authenticated GHL sub-account has a Consuelo Dialer custom sidebar entry and the hosted Marketplace launcher script/CSS.
- Contacts -> Open Consuelo Dialer creates the /overlay iframe. Authenticated requests for contacts, pipelines, active calls, call history, and commercial/caller return HTTP 200. This proves those request paths, not call delivery or every UI interaction.
- The admin shell at /admin loads directly, but direct standalone loading does not prove GHL authentication.

## Immediate installation blockers

1. Clicking the existing custom sidebar entry does not navigate or create its admin iframe. Compare the saved app/sidebar configuration with /admin, iframe mode, location/role scope and microphone permission. Agency Custom Menu Links shows no records; the visible entry may come from the Marketplace app. Browser click automation has also failed on other links, so confirm this observation before treating it as a product defect.
2. Opening the Contacts overlay produces HTTP 502 from POST /v1/integrations/leadconnector/opportunities/search with body {"limit":100}. Other authenticated data requests succeed. Capture the sanitized upstream error before changing the adapter. The [current advanced-search documentation](https://marketplace.gohighlevel.com/docs/ghl/opportunities/search-opportunities-advanced/) specifies API Version v3 and zero-indexed pagination; current source already uses v3 and omits an undefined page. This is a diagnostic lead, not a confirmed cause.
3. Railway LEADCONNECTOR_REDIRECT_URI points at the legacy workers.dev host, while source Worker configuration disables workers.dev and serves calls.consuelohq.com. Verify and align the Marketplace allowed callback and backend callback before reinstalling. Existing sessions working do not prove fresh installation.
4. Ko explicitly selected the existing Wet Stone sub-account for testing. GHL app sign-in is complete. Marketplace developer-portal sign-in is separate and pending so its saved sidebar and OAuth settings can be inspected.

These three technical failures are in [DEV-1619](https://linear.app/consuelo/issue/DEV-1619/dialer-repair-gohighlevel-installation-and-queue-loading-smoke).

## Inbound and billing activation gaps

Present by secret-safe presence checks: database/Redis URLs, Twilio credentials, LeadConnector client/secret/redirect/shared-secret/token-encryption settings, embed-session secret, Stripe secret/webhook secret and four price settings.

Absent on Railway: DIALER_INBOUND_ENABLED, DIALER_INBOUND_CONFIG_JSON, DIALER_CALLBACK_RECIPIENT_SECRET, DIALER_CUSTOMER_ENTRY_SECRET and DIALER_EDGE_PROXY_SECRET. The edge secret exists in the GitHub deployment environment; matching deployed values are not proven. Inbound numbers, queues and representative endpoints are therefore not configured for a live inbound acceptance test.

Stripe credentials are live-mode. Presence is not proof of checkout, subscription webhook, entitlement or billing-portal behavior. Do payment acceptance in an isolated test-mode setup; do not replace global live settings or run a real charge as a smoke test. GHL's agency dashboard asks to connect Stripe, which is a separate setup surface from Consuelo's backend Stripe billing. Do not assume that agency connection is required for the embedded product's own checkout.

Calendar callback windows are implemented, but no external calendar adapter is composed in the current runtime. Do not advertise confirmed GHL calendar appointments yet. Operator configuration editing is explicitly read-only/501; customer browser calling and embedded transfers remain outside the current release.

## Package and deployment boundaries

| Package | Responsibility | Deployment role |
| --- | --- | --- |
| packages/dialer | Reusable dialing/routing domain and canonical telephony behavior | Consumed by the backend; not another hosted server |
| packages/dialer-server | Hono/Bun/Effect HTTP, WebSocket, persistence, provider composition and billing | Railway service |
| packages/lead-connector | GHL OAuth/resources, signed embedded application and launcher | Cloudflare UI/edge plus Marketplace bootstrap/custom menu |

All three are needed for this architecture. Railway, the Cloudflare application and GHL installation records are distinct surfaces.

The repository already has a production release workflow and rollback workflow. Release automation runs checks, deploys Railway and the Cloudflare embed, checks public routes/assets and records a manifest. No separate Dialer canary/stable environments were found. Begin with one isolated GHL test location and an identifiable deployment candidate. A test location isolates CRM activity; it does not by itself isolate shared backend billing/carrier credentials.

## Review triage

Full inventory: 62 inline threads, still marked unresolved by GitHub. Their UI status is not a reliable fix list. Current source inspection classified 44 as source-addressed/superseded, one as a false positive, and 17 as remaining or partly remaining. No GitHub thread was marked resolved by this audit. See [the per-comment ledger](REVIEW-TRIAGE-2026-09-26.json).

Five grouped fix issues were created (mostly 3–4 related work items, with a related decline-control residual in the readiness issue):

- [DEV-1614](https://linear.app/consuelo/issue/DEV-1614/dialer-keep-rep-availability-accurate-across-reloads-idle-time-and): keep rep availability accurate across reloads, idle time, and outbound calls.
- [DEV-1615](https://linear.app/consuelo/issue/DEV-1615/dialer-recover-rejected-call-creation-and-interrupted-callback): recover rejected call creation and interrupted callback attempts.
- [DEV-1616](https://linear.app/consuelo/issue/DEV-1616/dialer-finish-callback-lifecycle-draining-after-hours-and-reschedule): finish callback lifecycle, draining, after-hours and reschedule guards.
- [DEV-1617](https://linear.app/consuelo/issue/DEV-1617/dialer-repair-reproducible-release-inputs-and-migration-rollback): repair reproducible release inputs and migration rollback verification.
- [DEV-1618](https://linear.app/consuelo/issue/DEV-1618/dialer-website-initialize-section-analytics-after-page-content-exists): initialize section analytics after page content exists.

CodeRabbit's latest review was skipped due to size/credits; Qodo was paused. These are not successful review evidence. The actionable inline findings in this inventory are from Codex. Do not open implementation tickets for bot subscription noise.

False-positive example: review 4058893028 alleges a mismatched double hash. recordTelephonyFact hashes its supplied key again at telephony-store.ts:159, so the reconciliation lookup matches persistence. Do not change that lookup based only on the review wording.

## Fastest testing sequence

1. Select the test GHL location. Repair DEV-1619, then verify sidebar, overlay, signed session, contacts, pipelines and populated/empty stage queues without placing a call.
2. Repair DEV-1617's release-input/lab failures: stale Bun lockfile contacts dependency, migration 013 rollback ordering, edge-secret preflight. Use the existing focused checks; do not disable the release guard or build an unrelated CI system.
3. Identify the exact release candidate, reconcile #2436 with main, and capture the deployment manifest. Back up the target database before schema-changing deployment. Verify backend origin, edge asset hashes, auth and unsigned-webhook rejection.
4. Configure one queue, one owned inbound number and one representative with browser/phone endpoints in the approved environment. Set callback/customer-entry and paired edge secrets. Resolve the readiness/reconciliation issues before enabling affected live inbound/callback paths.
5. Run the existing service-backed lab and focused failure tests: duplicate/out-of-order events, competing accepts, caller abandonment, browser refresh, definitive provider rejection, unknown effects, callback retry and capacity release. Historical RD8 green results predate the current source and are not a substitute.
6. Obtain the exact controlled call's source, destination, fanout and media scope. Prove both media legs, signed callbacks, terminal cleanup and capacity reuse. Phone and browser acceptance, no-answer callback retry, voicemail and wrap-up each need their own evidence.
7. Test Stripe checkout -> webhook -> entitlement -> cancellation in test mode separately. Calendar integration and marketing analytics should not delay the first no-carrier UI test.

CI is useful before first release as well as afterward: it catches broken installation, schemas and contracts while browser/carrier testing catches integration gaps. Add regressions from these observed failures to the existing pipeline.

## Continuation

Start with DEV-1619 and DEV-1617. DEV-1614/1615/1616 gate the affected inbound and callback paths; DEV-1618 is marketing measurement work. Refresh current stream and issue state before assigning fixes. Preserve the open audit task while Marketplace sign-in/install work remains. Do not describe this receipt, historical lab results, or HTTP 200 health as a shipped, carrier-validated product.

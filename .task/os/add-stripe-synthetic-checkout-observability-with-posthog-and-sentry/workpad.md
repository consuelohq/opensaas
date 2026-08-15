# Add Stripe synthetic checkout observability with PostHog and Sentry

branch: `task/os/add-stripe-synthetic-checkout-observability-with-posthog-and-sentry`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1997/add-stripe-synthetic-checkout-observability-with-posthog-and-sentry
github pr: https://github.com/consuelohq/opensaas/pull/1997
started: 2026-08-15

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-15 02:51:12 fs.write: `.task/os/add-stripe-synthetic-checkout-observability-with-posthog-and-sentry/workpad.md`
- 2026-08-15 03:01:19 fs.write: `.task/os/add-stripe-synthetic-checkout-observability-with-posthog-and-sentry/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 03:00:34 `review.run`: passed — OK
- 2026-08-15 03:01:09 `review.run`: passed — OK
- 2026-08-15 03:02:03 `verify`: failed — COMMAND_FAILED
- 2026-08-15 03:03:35 `verify`: passed — OK

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: an internal-only synthetic checkout lane can exercise the production auth/onboarding/routing surface against Stripe sandbox credentials without ever creating a real managed-cloud provisioning job; checkout funnel and failures emit privacy-safe PostHog events and Sentry errors/traces.
existing local pattern: Device Authority owns Google auth, onboarding, managed-cloud checkout creation/webhook fulfillment, and production health. Stripe billing already separates checkout creation from signed webhook fulfillment. Existing observability must be reused where present.
new or changed tests: synthetic-mode authorization and isolation; sandbox checkout success/decline/3DS/abandon flows; sandbox webhook cannot provision a real VM; PostHog event schema/redaction; Sentry error/trace capture and secret/config readiness.
focused red command: run the existing managed-cloud onboarding/Worker suites plus new synthetic/observability tests before production edits.
expected red failure: no synthetic routing contract, no PostHog/Sentry funnel instrumentation, and no sandbox-vs-live provisioning isolation exist yet.
no-test waiver: not applicable.

## Safety invariants

- Stripe test cards are never sent to live-mode Stripe.
- Synthetic checkout traffic is available only to an authenticated internal test principal/session and is denied for ordinary users.
- Sandbox webhook events may exercise fulfillment logic but cannot create or enqueue a real cloud VM.
- Production live checkout behavior remains unchanged for normal users.
- No payment details, OAuth tokens, Stripe secrets, cookies, email addresses, or raw webhook payloads are sent to PostHog/Sentry.
- Observability identifiers use stable opaque IDs (workspace/user/checkout/job IDs) and explicit synthetic=true tags.

- 2026-08-15 02:51:12 append: `.task/os/add-stripe-synthetic-checkout-observability-with-posthog-and-sentry/workpad.md`

## Implementation status

### Acceptance criteria

- [x] Production checkout emits privacy-safe PostHog funnel events for catalog view, plan selection, session creation, cancellation, completion, and failure.
- [x] Checkout operational failures can be sent to Sentry without raw Stripe payloads, payment details, cookies, OAuth tokens, email addresses, or secret values.
- [x] Internal synthetic checkout route is protected by an authority session, CSRF on mutation, and an explicit opaque account-ID allowlist; non-allowlisted valid sessions receive 404.
- [x] Synthetic Checkout uses a separate Stripe sandbox/test credential and separate webhook signing secret.
- [x] Synthetic Checkout return/webhook paths run on the production Device Authority routing surface.
- [x] Synthetic webhook fulfillment is structurally isolated from workspace membership and managed-cloud provisioning writes.
- [x] Synthetic Stripe configuration is release-ready only when sandbox key, sandbox webhook secret, and account allowlist are configured together.
- [x] Production health reports live billing, synthetic checkout, and checkout observability readiness separately.
- [x] Focused test selection owns checkout/observability sources and excludes the unrelated broad OS package suite.
- [ ] Deploy to production, configure sandbox credentials/allowlist, and run browser scenarios against production routing.
- [ ] Confirm PostHog receives funnel events and Sentry receives a controlled synthetic exception/test event; create or document dashboard/funnel views.

### Validation evidence

- RED baseline: new checkout observability/synthetic test file failed because the new modules did not exist.
- GREEN: `managed-cloud-checkout-observability`, existing cloud-first onboarding, Device Authority Worker, release contract, web-auth contract, architecture, universal-login, and security scan suites: 113/113 passed.
- Test-selection registry regenerated; workspace test-selection suite: 34/34 passed.
- Syntax checker passed.
- Strict review: 0 blocking findings after hardening the synthetic session lookup async boundary.
- Production currently has `POSTHOG_API_KEY`, `SENTRY_DSN`, `OS_STRIPE_SECRET_KEY`, and `OS_STRIPE_WEBHOOK_SECRET`; synthetic Stripe configuration remains intentionally absent until deployment.

### Key decisions

- Never send Stripe test cards to live-mode Stripe. Production live smoke stops at hosted Checkout; completion scenarios use Stripe sandbox/test credentials through an internal-only production route.
- Synthetic webhooks cannot call managed-cloud provisioning by construction.
- PostHog is the checkout funnel/product analytics sink; Sentry is the operational exception sink. Both are advisory and cannot alter product outcomes.
- Account IDs, checkout IDs, plan/pricing metadata, outcomes, durations, and CF Ray IDs may be emitted; raw payment/webhook payloads and PII/secrets may not.

- 2026-08-15 03:01:19 append: `.task/os/add-stripe-synthetic-checkout-observability-with-posthog-and-sentry/workpad.md`

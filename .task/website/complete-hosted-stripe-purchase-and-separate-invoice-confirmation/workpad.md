# Complete hosted Stripe purchase and separate invoice confirmation

branch: `task/website/complete-hosted-stripe-purchase-and-separate-invoice-confirmation`
stream: `stream/website`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2726/complete-hosted-stripe-purchase-and-separate-invoice-confirmation
github pr: https://github.com/consuelohq/opensaas/pull/2726
started: 2026-10-31

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

- none yet

## workspace-owned: validation evidence

- 2026-10-31 01:53:56 `review.run`: passed — OK
- 2026-10-31 01:55:56 `verify`: passed — OK

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

## Test-first contract

Behavior: paid-base/unfinished-number confirmation retains the private claim and redirects into the verified native Stripe confirmation once; cancellation/reload remains recoverable without a new purchase. Claimed-but-unfinished numbers must retain recovery. Reject non-Stripe/credential-bearing redirects. Legacy single-invoice results remain compatible.
Existing pattern: get-started.astro private purchase status + direct-checkout.ts sessionStorage.
New tests: purchase-confirmation state/URL tests and browser cases for partial native payment, cancellation, claimed partial, failure and hostile portal URL.
Focused red command: bun test packages/dialer-website/tests/purchase-confirmation.test.ts (new helper absent).
No-test waiver: none. Preview only.

## Validation and publication
-4 state/URL regressions green; all38 website unit tests278 assertions pass. Astro check/build0errors/0warnings,7 unchanged hints.
- Strict review0 changed findings after adding the native route error boundary. Full publish-valid verify passed with4 selected suites; known standalone Nx no-typecheck-target advisory is covered by Astro check.
- Eight viewport pricing run320x568,375x812,430x932,568x320,667x375,768x1024,1024x768,1440x1000 passed. Native paid-base/unfinished-number, auto-once Stripe handoff, canceled return, claimed partial recovery, explicit retry, pending-payment and hostile-URL cases passed at375/1440; keyboard/no-JS cases passed. Final run completed with cleanup.
- An earlier browser run collided with verification cleaning dist; that run was discarded and rerun separately after verification. Do not run a build while a browser test reads the same dist.
- Native live catalog24prices prepared with no subscriptions/charges; plan portalbpc_1UWRLQRyHwVDNd3DSGvD4XBl, number portalbpc_1UWRLQRyHwVDNd3Dlm9DoS3w. Native backend main7a73d1fa8b0acbd9fd23841a3591e9a27657a20a is being deployed with new creation disabled.
- Current source preserves approved pricing UI. Calling-plan total excludes separately invoiced numbers; Mercury applies to all plan seats; existing-customer Mercury opens verified-email native Stripe portal. No extra pre-payment configuration page.
- Preview publication and deployed browser proof pending. No production marketing/auth/domain cutover.

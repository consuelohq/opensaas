# Accept canonical pricing URLs in hosted browser verification

branch: `task/website/accept-canonical-pricing-urls-in-hosted-browser-verification`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2721
started: 2026-10-31

## acceptance criteria

- [x] Hosted browser assertions accept pricing with and without the canonical trailing slash.
- [x] Hosted mobile/desktop pricing flow passes without changing application behavior or creating live billing sessions.

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

## Test-first contract
Observed red: /tmp/consuelo-pricing-addon-deployed.json passed375/1440 viewport checks, then failed exact pathname assertion because Pages canonicalized /pricing to /pricing/. The same mismatch applies to legacy add-on selection URL wait. Allow only the optional trailing slash in both assertions; preserve query/hash checks and all feature assertions. Focused green command: DIALER_PRICING_BASE_URL=https://cb1f1f79.consuelo-dialer-website-preview.pages.dev node scripts/test-pricing-browser.mjs --smoke, with all billing/Stripe requests intercepted by fixtures. No application source or deployment needed; app preview remains source61d7a294. Existing full eight-size local matrix and real unpaid Stripe proof remain valid.

## workspace-owned: validation evidence

- 2026-10-31 00:06:40 `review.run`: passed — OK
- 2026-10-31 00:07:56 `verify`: passed — OK

## Evidence
Hosted smoke now passes375x812 and1440x1000, combined selection without side effects, direct Stripe fixtures, retry/reload/redirect/claim safeguards, main FAQ and keyboard/no-JavaScript. Actual live Stripe combined4562 proof and signed unpaid expiry remain at app61d7. Strict review zero introduced/blocking issues; full verify all4 registered website suites and DB guard passed, publish-valid. Only test assertions changed; no app rebuild/deployment or provider side effect needed for this follow-up.

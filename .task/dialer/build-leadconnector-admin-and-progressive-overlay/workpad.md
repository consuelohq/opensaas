# Build LeadConnector admin and progressive overlay

branch: `task/dialer/build-leadconnector-admin-and-progressive-overlay`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1687/build-leadconnector-admin-and-progressive-overlay
github pr: https://github.com/consuelohq/opensaas/pull/1687
started: 2026-07-28

## acceptance criteria

- [x] The legacy LeadConnector OAuth callback path on `consuelohq.com` forwards the complete, untouched query string to the canonical Worker callback.
- [x] The callback page does not render, log, persist, or otherwise expose OAuth `code` or `state` values.
- [x] The route is static-hosting compatible, uses `location.replace`, disables referrer leakage, and is excluded from indexing.
- [ ] The exact draft app update can complete without changing the live Marketplace version or submitting for review.
- [ ] Contacts and Opportunities load one Dial launcher after the draft installation refreshes.
- [ ] No carrier call is placed during validation.

## plan

1. Add a source-level contract for the compatibility callback and prove it fails while the route is absent.
2. Implement the smallest static Astro callback page that preserves the query string and redirects to the canonical Worker callback.
3. Run focused tests and the website build; inspect the generated route.
4. Push the focused compatibility change for review.
5. Request explicit approval before deploying the production website route.
6. After deployment, rerun the exact draft Update flow and validate Contacts, Opportunities, and the overlay with mock-only behavior.

## test-first contract

- Behavior under test: a request to `/calls/api/integrations/oauth/callback` is transferred client-side to the Worker callback with the original query string preserved exactly and without exposing sensitive parameters.
- Existing local pattern: static Astro browser-parameter handling in `src/pages/login/device.astro` plus source-contract tests in `packages/consuelo-website/tests`.
- New test: `packages/consuelo-website/tests/leadconnector-oauth-callback.test.mjs`.
- Focused red command: `bun test packages/consuelo-website/tests/leadconnector-oauth-callback.test.mjs`.
- Expected red failure: the callback Astro route does not exist.

## current status

- Root cause confirmed. The saved Custom JS works when executed directly in the CRM, but the Marketplace update rolls back after OAuth reaches the legacy public callback and receives a 404.
- The draft UI intentionally prevents changing the default callback for a draft version; forcing the model or backend is out of scope.
- The public redirect chain is `www.consuelohq.com` -> apex `consuelohq.com` -> 404 for the legacy callback path.
- The exact launcher script works when executed directly in the live Contacts page; the Marketplace update rollback is the remaining blocker.
- Focused red test recorded: 0 pass, 2 fail with ENOENT for the missing callback route.
- Implemented and locally validated the static compatibility callback. PR preparation complete; no production deployment has been performed.

## files changed

- `packages/consuelo-website/tests/leadconnector-oauth-callback.test.mjs` — behavior contract.
- `packages/consuelo-website/src/pages/calls/api/integrations/oauth/callback.astro` — static compatibility callback.
- `.task/dialer/build-leadconnector-admin-and-progressive-overlay/workpad.md` — task evidence and plan.

## workspace-owned: files changed

- Managed by workspace tooling.

## workspace-owned: activity log

- Managed by workspace tooling.

## workspace-owned: validation evidence

- Red: `bun test tests/leadconnector-oauth-callback.test.mjs` from `packages/consuelo-website` failed 0/2 because the route was absent.
- Green: focused source and VM behavior contract passed 3/3.
- Build: `bun run build` completed with 0 errors and emitted `/calls/api/integrations/oauth/callback/index.html` with the Worker target, exact query forwarding, history replacement, and no-referrer metadata.
- Browser proof attempt was blocked by a missing shared Playwright Chromium binary; no browser installation was performed. Replaced with deterministic VM execution using synthetic parameters.
- Adjacent website structure suite: callback tests passed, but three unrelated pre-existing assertions failed for current homepage/header/design-operator content. Those files were not modified.
- Workspace review: 0 issues in this change; one pre-existing project-level missing Nx typecheck target.
- Workspace verify: passed, publishValid true. The registry did not auto-select the new test, so the focused 3/3 run is the behavioral evidence.
- 2026-07-28 05:26:56 `review.run`: passed — OK
- 2026-07-28 05:27:14 `verify`: passed — OK
- 2026-07-28 05:31:15 `verify`: passed — OK

## key decisions

- Use a static callback page rather than modifying Marketplace live configuration or bypassing the draft default-redirect guard.
- Preserve the query string via browser URL APIs and immediately use `location.replace`; never parse, display, log, or store `code`/`state`.
- Do not deploy the public website route until Ko explicitly approves the production change.

## notes for ko

- Production deployment approval is required before publishing the compatibility route to `consuelohq.com`.
- Reinstalling again cannot solve this until the legacy callback stops returning 404; the OAuth redirect causes the Marketplace update to roll back.
- Sandbox validation remains mock-only and will not place a carrier call.

## improvements noticed

- Add a regression test and runbook note documenting that draft test updates use the app's configured default callback.
- File the persistent browser headed-window detachment defect separately.

## issues and recovery

- The original OS task session terminated; recovered through the approved legacy workspace fallback.
- A new task session `tsk_aa0e812e7b84` and PR #1687 were recovered against `stream/dialer`.
- Marketplace radio automation was not bypassed after confirming the draft-status guard is intentional.

---

## publish checklist

```bash
bun run task:push -- --message "fix(dialer): bridge legacy LeadConnector OAuth callback" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: test selection

- changed files: `.task/dialer/build-leadconnector-admin-and-progressive-overlay/current.json`, `.task/dialer/build-leadconnector-admin-and-progressive-overlay/session.json`, `.task/dialer/build-leadconnector-admin-and-progressive-overlay/workpad.md`, `.task/tasks/dialer/build-leadconnector-admin-and-progressive-overlay.json`, `packages/consuelo-website/src/pages/calls/api/integrations/oauth/callback.astro`, `packages/consuelo-website/tests/leadconnector-oauth-callback.test.mjs`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

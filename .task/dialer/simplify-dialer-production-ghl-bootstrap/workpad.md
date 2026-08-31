# simplify dialer production GHL bootstrap

branch: `task/dialer/simplify-dialer-production-ghl-bootstrap`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1966/simplify-dialer-production-ghl-bootstrap
github pr: https://github.com/consuelohq/opensaas/pull/1966
started: 2026-08-14

## acceptance criteria

- [x] Normal `main` dialer releases require only Railway and Cloudflare deployment credentials; no HighLevel private token or Custom Menu record ID is required.
- [x] Production release order remains exact-source validation → Railway deploy/smoke → Cloudflare deploy/edge verification → immutable release manifest.
- [x] The release manifest records the generated one-time Marketplace launcher bootstrap hash instead of claiming per-release GHL Custom Menu read-back.
- [x] The Marketplace bootstrap remains a stable HTTPS loader for the dialer-owned `https://calls.consuelohq.com` origin and is explicitly documented as a one-time installation alongside the Marketplace sidebar `/admin` configuration.
- [x] CI/release contracts fail if recurring GHL credential/menu mutation is reintroduced.
- [x] Existing rollback behavior remains explicit-ID only.
- [x] `calls.consuelohq.com` is explicitly owned by the LeadConnector Worker as both a Cloudflare custom domain and the exact `calls.consuelohq.com/*` Worker Route, so the exact Route wins over the OS `*.consuelohq.com/*` fallback.
- [x] Marketplace bootstrap, Custom Page `/admin`, production edge verification, and GitHub production config all use the branded `https://calls.consuelohq.com` origin after the custom-domain binding is live.

## plan

1. Update release contracts first so they reject recurring GHL secrets/menu mutation and require Marketplace bootstrap evidence.
2. Remove the GHL production menu step/settings from the `main` release workflow and replace Custom Menu manifest evidence with the built loader SHA-256.
3. Update LeadConnector operational documentation/package surface to describe the one-time Marketplace bootstrap and recurring Railway/Cloudflare release model.
4. Run focused release/loader tests, typechecks/builds, workflow policy, strict review, and canonical verify before publish.

## current status

- Current truth re-established on 2026-08-14: PR #1813 is closed, merged reconciliation PR #1899 carried the dialer payload into `main`, and `stream/dialer` is 0 ahead / 0 behind `main`.
- Current `main` release workflow still requires `LEADCONNECTOR_PRODUCTION_PRIVATE_INTEGRATION_TOKEN` and `LEADCONNECTOR_PRODUCTION_CUSTOM_MENU_ID`, mutates a v3 Custom Menu every release, and makes the manifest depend on that read-back.
- Read-only production discovery found zero official GHL Custom Menu records; the visible Consuelo Dialer sidebar item is Marketplace-owned. The stable Marketplace loader already exists for the native Contacts/Opportunities launcher.
- The earlier workers.dev bootstrap/canary was temporary discovery evidence and is superseded by the branded-host repair below.
- Hostname regression repaired after Ko review. Final LeadConnector Worker version `bbeaf9fa-1e38-4791-959c-6034489dcad9` owns both `calls.consuelohq.com/*` (zone route) and `calls.consuelohq.com` (Custom Domain), with `workers_dev=false` and preview URLs disabled. The OS `*.consuelohq.com/*` route remains unchanged and no OS exact `calls` route is allowed by the regression contract.
- Final branded production-edge verification: `/`, `/admin`, `/overlay`, and `/health` all return 200 from `https://calls.consuelohq.com`; launcher JS SHA-256 is `71d8ebf2e850a39dd8d2faf2af8a8d9328bdcaa3d69fbe30a28feef02827000f`; CSS remains `78d258d7433eb957559ea6e3d9112ed52b08eb9c4bd8d8a4e5d431b22ca22378`. Browser `/admin` renders the real Dialer settings UI, not OS protection.
- GitHub production vars restored to the branded origin: `LEADCONNECTOR_PRODUCTION_EMBED_URL=https://calls.consuelohq.com` and `LEADCONNECTOR_MARKETPLACE_BOOTSTRAP_SHA256=7693210d3808d3a598bf30b9c9bbfc848d60391052e0a8135ee41d32a09c6daa`.
- GHL draft Custom JS read-back: 1,167 bytes, SHA-256 `7693210d...c6daa`, `jsValidationPassed=true`, zero validation errors. Custom Page read-back: both live/testing URLs `https://calls.consuelohq.com/admin`, microphone enabled.
- Final GHL App Test on Contacts: `calls` CSS/JS 200, one launcher/one host/zero iframe before open; iframe `https://calls.consuelohq.com/overlay`; embed session 201; commercial caller 200; real call setup rendered without starting a call. Opportunities retained exactly one launcher/one host and the branded overlay lifecycle.
- Marketplace publication workflow completed with HighLevel's only available Major version bump. Version `3.0.0` is now `In review` as of 2026-08-14; HighLevel controls transition from In review to Live.

## files changed

- `.github/workflows/consuelo-production-release.yaml`
- `packages/dialer-server/scripts/write-release-manifest.ts`
- `packages/dialer-server/src/release/production-release.test.ts`
- `packages/dialer-server/src/release/production-release.ts`
- `packages/lead-connector/EMBED.md`
- `packages/lead-connector/scripts/build-embed.ts`
- `packages/lead-connector/src/deployment/marketplace-bootstrap.test.ts`
- `packages/lead-connector/src/deployment/marketplace-bootstrap.ts`
- `packages/lead-connector/src/deployment/release-workflow.contract.test.ts`
- `packages/lead-connector/scripts/verify-marketplace-bootstrap.ts`


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-14 21:08:42 `review.run`: passed — OK
- 2026-08-14 21:09:02 `verify`: passed — OK
- 2026-08-14 22:04:07 `review.run`: passed — OK
- 2026-08-14 22:04:22 `verify`: passed — OK

## key decisions

- Treat Marketplace configuration as a one-time installation boundary, not a recurring CI deployment boundary.
- Keep Railway/Twilio/Stripe/runtime secrets out of GitHub; the dialer production environment needs only the Railway project token and Cloudflare Worker token for recurring releases.
- The existing Marketplace sidebar/admin page and the Custom JS loader are distinct one-time configuration surfaces; CI must not claim it verifies either on every release.
- Correction after Ko review: `calls.consuelohq.com` is a dedicated dialer hostname and must not inherit OS workspace protection. Cloudflare Routes execute before Custom Domains, so a Custom Domain alone does not bypass the OS wildcard route. The OS Worker keeps its broad `*.consuelohq.com/*` fallback; the LeadConnector Worker owns both the `calls.consuelohq.com` Custom Domain and the more-specific `calls.consuelohq.com/*` Worker Route. `workers.dev` and preview URLs are disabled.
- The GitHub hash is the approved bootstrap source hash. One-time Marketplace PATCH/read-back + App Test establish that the draft contains and executes that source; recurring releases verify the source hash before any provider deployment.

## notes for ko

- The old stream PR #1813 should remain historical/closed. Reconciliation PR #1899 already carried the dialer into `main`; this task starts from current company truth.
- Marketplace version `3.0.0` has been submitted and is `In review`; HighLevel controls the transition to Live.
- Final Cloudflare Worker version `bbeaf9fa-1e38-4791-959c-6034489dcad9` is live on the dedicated `calls.consuelohq.com` route/domain. No Railway deployment, call, billing, phone-number, recording, or transcription mutation occurred during the hostname repair/App Test.
- GitHub Environment configuration now matches the approved recurring release model: exactly two deployment secrets (Railway + Cloudflare), branded `calls.consuelohq.com` embed origin, and the pinned bootstrap source hash.

## improvements noticed

- none yet

## issues and recovery

- Old stream PR #1813 is historical/closed. Do not reopen or use its stale CI; current implementation starts from reconciled `main`.
- Marketplace draft validation: replacing the inline launcher with a top-level `<link>` + external `<script src>` loader did not persist. HighLevel called `/marketplace/app/profile/validate` and returned HTTP 500 before any module PATCH. No saved Marketplace state changed. Recovery: make the one-time Custom JS bootstrap a single inline `<script>` that idempotently injects both the external stylesheet and launcher script, then rerun draft validation/App Test.
- Historical discovery: `https://calls.consuelohq.com` initially fell through to the Consuelo workspace protection page because the OS wildcard Worker Route was more specific in Cloudflare routing precedence than a Custom Domain alone. The temporary workers.dev workaround proved the application while the branded-route ownership bug was diagnosed; it is no longer part of production.
- Root-cause correction: the protection page was not an intended security boundary for the dialer. `packages/os/cloudflare/workspace-edge/wrangler.toml` owns `*.consuelohq.com/*` as a fallback, while `packages/lead-connector/wrangler.jsonc` had no more-specific Worker Route. Adding only a Custom Domain still left the OS Route in front, as confirmed by a protection-page response after Worker version `e67ef9d4-26ad-4a0a-91f6-0494cb9ca444`. Fix by keeping the Custom Domain for DNS/origin and adding the more-specific `calls.consuelohq.com/*` Route to the LeadConnector Worker; keep the OS wildcard unchanged.
- Cloudflare typed `deployment.deploy` accepted the approved dry-run but returned `MALFORMED_OUTPUT` before provider execution. Recovery used the task-scoped, authenticated repo-pinned Wrangler CLI. Final branded-route Worker version is `bbeaf9fa-1e38-4791-959c-6034489dcad9`.
- Marketplace visible Save path called `/marketplace/app/profile/validate` and failed before module PATCH. Recovery used a one-time authenticated backend PATCH with strict old-content hash preconditions and exact GET read-back; temporary HAR/auth helper files were deleted immediately after each use and no auth values were printed or stored in repo/CI.

## Test-first contract

- Behavior under test: the production workflow must not require or invoke HighLevel production API credentials/menu mutation; it must still build the stable Marketplace loader and include immutable bootstrap evidence in the release manifest.
- Existing local pattern: `packages/lead-connector/src/deployment/release-workflow.contract.test.ts` statically owns release ordering/secret boundaries; `marketplace-bootstrap.test.ts` owns the stable loader contract; `packages/dialer-server/src/release/production-release.test.ts` owns manifest fail-closed behavior.
- Changed tests: make the workflow contract require absence of `LEADCONNECTOR_PRODUCTION_PRIVATE_INTEGRATION_TOKEN`, `LEADCONNECTOR_PRODUCTION_CUSTOM_MENU_ID`, and `Reconcile GoHighLevel Custom Menu`; require loader/bootstrap evidence before manifest creation. Update manifest tests to use `marketplaceBootstrap` evidence instead of `customMenu`.
- Focused RED command: `bun test packages/lead-connector/src/deployment/release-workflow.contract.test.ts packages/dialer-server/src/release/production-release.test.ts`.
- Expected RED: current workflow still contains recurring GHL secret/menu mutation and current manifest still requires `customMenu` read-back.
- RED evidence: focused run on 2026-08-14 produced 7 pass / 4 fail / 1 module error. Failures were exactly the intended gaps: workflow missing `Verify installed Marketplace bootstrap compatibility`; `buildDialerReleaseManifest` still dereferenced `input.customMenu`; invalid bootstrap SHA could not reach the new validation; and `verifyLeadConnectorMarketplaceBootstrap` was not yet exported.
- Marketplace compatibility refinement: the loader contract must begin with an inline `<script>` wrapper and create the external stylesheet/script elements from JavaScript rather than placing `<link>` at the top level. Focused loader coverage must fail against the initial top-level-link implementation before that generator changes.
- Follow-up hostname contract: `packages/lead-connector/wrangler.jsonc` must declare both `{ pattern: 'calls.consuelohq.com', custom_domain: true }` and `{ pattern: 'calls.consuelohq.com/*', zone_name: 'consuelohq.com' }`, with `workers_dev=false` and `preview_urls=false`; `build-embed.ts` generates the one-time Marketplace bootstrap against `https://calls.consuelohq.com`. Focused RED first proved the missing custom-domain binding/temporary workers.dev origin, then a second RED proved the missing exact Route and stale workers.dev browser allowlist after Cloudflare route precedence was confirmed.

## implementation notes

- Recurring production release no longer requires or calls HighLevel production APIs. It verifies the one-time loader source hash before Railway, then performs Railway smoke, Cloudflare deploy/edge verification, and secret-free manifest creation.
- Loader is an inline idempotent bootstrap because HighLevel validates the Custom JS module as JavaScript-bearing HTML; it injects `calls.consuelohq.com` stylesheet/script nodes marked with `data-consuelo-dialer-loader`.
- Release manifest replaces per-release `customMenu` read-back evidence with `{ sha256, installationMode: 'one-time' }` launcher-bootstrap evidence.

## final validation evidence

- Final destructive-literal safety preflight: 71 Dialer/dialer-server/LeadConnector test/spec entrypoints scanned, zero findings.
- Full Dialer, dialer-server, and LeadConnector suites passed on the final tree; LeadConnector is 122/122 with 1,055 expectations.
- Dialer, dialer-server, and LeadConnector typechecks/builds: green.
- GitHub workflow-security checker: zero findings; workflow-policy: 12/12; Prettier: green; both committed and working-tree `git diff --check`: green.
- Bootstrap source/GHL/GitHub hash agreement: `7693210d3808d3a598bf30b9c9bbfc848d60391052e0a8135ee41d32a09c6daa`.
- Production edge: `calls.consuelohq.com` `/`, `/admin`, `/overlay`, `/health` all 200 with exact launcher JS/CSS hashes; OS protection is not in the dialer path.
- Marketplace: version `3.0.0` is `In review` with the calls-based Custom JS and `/admin` Custom Page settings read back before submission.
- GHL draft read-back: Custom JS 1,295 bytes with the same hash, `jsValidationPassed=true`, zero JS validation errors.
- GHL App Test: public Worker launcher CSS/JS returned 200; Contacts singleton launcher/host; embed session 201; commercial caller 200; Opportunities singleton launcher/host; no call start.
- Production-edge canary: Worker version `322915c2-3052-4b84-94c2-791a20884ebf`; `/`, `/admin`, `/overlay`, `/health` all green and launcher JS/CSS hashes match the build.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `.github/workflows/ci-server.yaml`
- `.github/workflows/ci-shared.yaml`
- `.github/workflows/consuelo-ci.yaml`
- `.github/workflows/consuelo-production-release.yaml`
- `packages/dialer-server/scripts/write-release-manifest.ts`
- `packages/dialer-server/src/release/production-release.test.ts`
- `packages/dialer-server/src/release/production-release.ts`
- `packages/lead-connector/EMBED.md`
- `packages/lead-connector/package.json`
- `packages/lead-connector/scripts/build-embed.ts`
- `packages/lead-connector/scripts/configure-production-menu.ts`
- `packages/lead-connector/scripts/verify-production-edge.ts`
- `packages/lead-connector/src/deployment/marketplace-bootstrap.test.ts`
- `packages/lead-connector/src/deployment/marketplace-bootstrap.ts`
- `packages/lead-connector/src/deployment/release-workflow.contract.test.ts`
- `packages/lead-connector/src/deployment/worker-release.test.ts`
- `packages/lead-connector/src/deployment/worker-release.ts`
- `packages/lead-connector/src/embed/architecture.contract.test.ts`
- `packages/lead-connector/src/embed/click-to-call-runtime.test.ts`
- `packages/lead-connector/src/embed/cloudflare-worker.ts`
- `packages/lead-connector/src/embed/public/consuelo-lead-connector-click-to-call.js`
- `packages/workspace/package.json`
- `packages/workspace/scripts/ci/check-github-workflows.cjs`
- `packages/workspace/tests/github-workflow-policy.test.js`

- 2026-08-14 22:03:50 apply-patch: `.task/dialer/simplify-dialer-production-ghl-bootstrap/workpad.md`

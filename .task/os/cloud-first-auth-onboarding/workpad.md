# cloud first auth onboarding

branch: `task/os/cloud-first-auth-onboarding`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1951/cloud-first-auth-onboarding
github pr: https://github.com/consuelohq/opensaas/pull/1951
started: 2026-08-14

## acceptance criteria

- [x] Replace the plain `os.consuelohq.com` login with a polished Consuelo OS auth shell closely matching the Vercel reference composition: compact OS mark top-left, Sign Up top-right, centered `Log in to Consuelo OS`, one outlined Google button with Google mark, and `Don't have an account? Sign Up` footer copy.
- [x] Preserve Consuelo identity with a restrained two-tone/rule motif from the existing device authorization surface, plus accessible light/dark behavior, mobile layout, focus states, and reduced-motion safety.
- [x] Login and Sign Up both use the existing native Google OAuth provider; login reuses existing canonical users/workspaces, while Sign Up may create a canonical first-time OS user/workspace only through the authoritative OS identity boundary.
- [x] Browser authentication is durable across ordinary revisits using the existing secure session model; cookies/tokens remain HttpOnly/Secure/SameSite appropriate and are never exposed to client JavaScript or logs.
- [x] First-time signup asks only for a workspace name before provisioning; workspace naming is validated, canonical, idempotent, and saved in the authoritative OS control plane.
- [x] New cloud-first workspaces receive a 14-day free trial entitlement and automatically select the second public managed-cloud plan tier, with price/machine details re-derived server-side rather than trusted from the browser.
- [x] Cloud provisioning reuses the existing one-click managed-cloud job, runner, enrollment, connector, and first-node default/home contracts; duplicate callbacks/submits cannot create duplicate users, workspaces, trials, or billable nodes.
- [x] The managed VM completes the same required OS bootstrap as the installer: runtime/skills/background services become ready before onboarding completes; no local device install is required for the cloud-first path.
- [x] Successful onboarding finishes at the user's existing OS launcher; existing users with an already-ready workspace skip onboarding and go directly to the launcher.
- [x] Stripe/trial behavior reuses existing repository billing primitives when they are the authoritative pattern; ordinary tests use mocks/fixtures and never create a live charge, subscription, or cloud VM.
- [x] Existing device approval, canonical identity, installer, managed-cloud, launcher, and tenant-security regression suites remain green; focused browser/UI evidence covers the new auth/onboarding flow.

## plan

1. Inspect the live login DOM and exact repository source, then map the current native Google OAuth/session/canonical-identity path introduced by the recent OS auth cutover.
2. Inspect Branch 12 one-click provisioning, managed-cloud pricing tiers, installer/bootstrap completion, and existing Stripe/trial primitives. Reuse these boundaries; do not recreate them in the page handler.
3. Freeze the signup/login domain contract and add focused auth/onboarding tests first, including negative tenant/idempotency/session cases and the Vercel-like page contract. Run RED before production edits.
4. Implement the smallest authoritative cloud-first onboarding service plus auth/session/page wiring. Keep browser adapters thin; keep provisioning and billing behind existing service contracts.
5. Run focused GREEN suites, syntax/type checks, then local/browser validation for desktop/mobile/light/dark and a mocked end-to-end signup -> workspace -> provisioning -> launcher journey.
6. Inspect the diff, run strict review and full verify against `origin/stream/os`, push the task, and promote it into `stream/os`.

## current status

- Implementation is complete on PR #1951 and ready for full publish verification. Live `https://os.consuelohq.com/` baseline evidence was captured before edits; production has not been mutated by this task.
- Native Device Authority Google OAuth now resolves canonical Consuelo users for web auth too; first-time users get workspace naming, a durable 14-day Standard cloud entitlement, existing managed-cloud provisioning/enrollment, readiness gating, then the existing launcher.
- Vercel-like black/white auth composition is browser-validated on mobile/desktop/light/dark with Consuelo's small two-tone device-auth stripe motif and no copied Vercel logo asset.

## files changed

- `packages/os/cloudflare/os-device-authority/src/services/cloud-first-onboarding.ts`
- `packages/os/tests/cloud-first-web-onboarding.test.ts`

## workspace-owned: files changed

- `packages/os/cloudflare/os-device-authority/src/services/cloud-first-onboarding.ts`
- `packages/os/tests/cloud-first-web-onboarding.test.ts`

## workspace-owned: activity log

- 2026-08-14 09:09:53 fs.write: `packages/os/tests/cloud-first-web-onboarding.test.ts`
- 2026-08-14 09:11:13 fs.write: `packages/os/cloudflare/os-device-authority/src/services/cloud-first-onboarding.ts`

## workspace-owned: validation evidence

- 2026-08-14 09:24:15 `review.run`: passed — OK
- 2026-08-14 09:25:22 `review.run`: passed — OK
- 2026-08-14 09:26:38 `verify`: passed — OK
- 2026-08-14 09:27:03 `verify`: passed — OK

## key decisions

- Treat login, signup, workspace creation, trial entitlement, managed-cloud provisioning, and launcher handoff as one cloud-first onboarding state machine, but keep identity, billing, provisioning, and UI adapters as separate boundaries.
- No live Stripe subscription, charge, Cloudflare mutation, or GCP VM will be created during implementation validation; provider boundaries must be mocked unless Ko separately requests a live canary.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- Initial large discovery batch returned a transient MCP network error. Retried as a smaller independent batch successfully; no repository mutation was lost.

## Test-first contract — cloud-first auth + onboarding
- Behavior under test: the public OS root renders the Vercel-like Google-only auth shell; verified Google auth always resolves to a canonical Consuelo user; a first-time canonical user can name one workspace, receives one durable 14-day Standard-plan cloud trial, and creates one server-priced/idempotent managed-cloud provisioning job before being handed to the existing workspace launcher when ready.
- Existing local pattern: native Google OAuth state/nonce verification in `google-oauth.ts`, canonical identity records in the install control-plane repository, authority/workspace host-only session cookies in `web-auth.ts`, CSRF-protected launcher control-plane routes, and Branch 12's server-repriced `createManagedCloudProvisioningJob` contract.
- New/changed tests: `packages/os/tests/os-universal-login.test.ts` and `packages/os/tests/cloud-first-web-onboarding.test.ts`.
- Focused RED command: `bun --cwd packages/os test tests/os-universal-login.test.ts tests/cloud-first-web-onboarding.test.ts`.
- Expected RED: the root still contains the old plain login; web OAuth still authenticates as `google:<sub>`; no onboarding workspace/trial/status routes or trial persistence exist; the current browser session TTL is shorter than the requested durable-login behavior.
- Negative coverage: missing/forged CSRF cannot create a workspace; pricing-unavailable signup cannot enqueue a cloud job; duplicate onboarding submits cannot create a second trial/job; one authority session cannot read another account's provisioning job; provider machine/cost/secrets never enter customer HTML/JSON.
- Provider boundary: no live Google, Stripe, Cloudflare, or GCP mutation in tests. Google token exchange and cloud pricing are deterministic fakes; cloud execution remains behind the existing provisioning runner.

### RED evidence
- Focused RED ran exactly `tests/os-universal-login.test.ts` + `tests/cloud-first-web-onboarding.test.ts`: 10 failed / 2 passed, as expected before product edits.
- New onboarding failures start at missing OAuth `intent`; the root still renders the old plain `Continue to your workspace / Sign in with Google` HTML; zero-membership auth still renders `No workspace is connected`; canonical membership tests fail because web OAuth still creates `google:<sub>` sessions instead of canonical users.
- No production file had been modified before this RED run.

### Focused selection contract
- Current selector correctly maps `google-oauth.ts` to canonical device approval and `stores.ts` / `types.ts` to one-click managed cloud, but the new web-auth route/service/tests fall through to `auto:@consuelo/os:package-test`.
- Test-first change: add a selector regression asserting the cloud-first web surface is owned by a critical/exclusive `os-cloud-first-auth-onboarding` rule and the broad OS package suite is not selected.
- The focused rule must run the new 12-test web journey plus canonical Google/device identity, managed-cloud one-click/enrollment/pricing/lifecycle, launcher node control-plane, Device Authority Worker, and OS syntax contracts.

### GREEN + browser evidence
- Focused auth/onboarding GREEN: `os-universal-login.test.ts` + `cloud-first-web-onboarding.test.ts` passed 12/12 before the recovery hardening; the added fail-once provisioning regression then passed independently and is included in the final selector run.
- Partial-commit recovery is explicit: if workspace/trial persistence succeeds but provisioning-job persistence fails once, retry reuses the trial's exact `provisioningJobId` and repairs the missing job rather than returning 409 or creating a second billable node.
- Exact task selector with execution passed all selected suites and no broad OS package suite: workspace selector 30/30; cloud-first auth/onboarding; canonical Google device approval; one-click managed cloud (13 files / 89 tests); Device Authority Worker; syntax; server selector; workflow policy; TypeORM compatibility. Zero failed suites.
- Local browser rendered the actual task source at `http://127.0.0.1:43891/` without touching production. Captured screenshots: mobile light 390x844, desktop light 1440x900, desktop dark 1440x900 with reduced motion.
- Computed mobile layout: 366px auth card with 18px gutters, 29px heading, 52px Google button, 80px fixed header, 7px two-tone stripe. Computed desktop layout: 402px centered card, 32px heading, 52px Google button, top-right Sign Up at 42px high. Dark mode resolves black background / `rgb(237,237,237)` foreground and gray two-tone stripes; reduced-motion media query is active.
- Device Authority currently emits no CSP that would block the progress page's inline polling script; browser security-header audit found no `script-src` / `Content-Security-Policy` conflict on this surface.

### Strict review + billing boundary
- First strict review found five `ERROR_HANDLING` blockers on the new async boundaries. Fixed all five by making identity lookup, workspace derivation/persistence, onboarding-status reads, pending-cloud checks, and root session lookup fail closed with controlled 503 behavior. Focused auth tests remained green (13/13) and syntax passed after the fixes.
- Second strict review is clean: 0 blockers, 0 attributed pre-existing findings.
- The 14-day trial is a durable OS-native workspace entitlement tied to the exact Standard provisioning job. This branch does not create a Stripe customer/subscription or automatic post-trial charge/VM teardown: the existing Stripe implementation belongs to the separate API/Postgres billing stack, this minimal Google onboarding collects no payment method, and coupling Device Authority back to that stack would violate the native OS identity/control-plane direction. Paid conversion / expiry enforcement is an explicit follow-up billing lifecycle, not silently coupled to signup.

## final verification
- Full `verify --base origin/stream/os` passed with `publishValid: true`.
- Review: 0 blockers, 0 related/pre-existing findings attributed to this task.
- DB guard: 0 risks, 0 findings.
- Final focused auth tests: 13/13; final exact selector execution includes cloud-first 46/46, canonical device approval 60/60, one-click managed cloud 89/89, Device Authority Worker 26/26, syntax and workspace/server/workflow compatibility suites, all green.
- `git diff --check` is clean. Local browser preview was shut down; no production auth page, Google account, Stripe object, Cloudflare Worker, or GCP VM was mutated during validation.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/api/src/services/subscription.ts`
- `packages/consuelo-website/DESIGN.md`
- `packages/os/cloudflare/os-device-authority/src/app.ts`
- `packages/os/cloudflare/os-device-authority/src/http.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/google-oauth.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/health.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/managed-cloud-provisioning.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/web-auth.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts`
- `packages/os/cloudflare/os-device-authority/src/services/canonical-device-identity.ts`
- `packages/os/cloudflare/os-device-authority/src/services/cloud-first-onboarding.ts`
- `packages/os/cloudflare/os-device-authority/src/services/managed-cloud-pricing.ts`
- `packages/os/cloudflare/os-device-authority/src/stores.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/cloudflare/os-device-authority/src/utils.ts`
- `packages/os/scripts/lib/install-control-plane-d1.ts`
- `packages/os/scripts/lib/install-control-plane.ts`
- `packages/os/scripts/lib/managed-cloud-node.ts`
- `packages/os/scripts/lib/managed-cloud-pricing.ts`
- `packages/os/scripts/lib/managed-cloud-provisioning-runner.ts`
- `packages/os/scripts/lib/managed-cloud-provisioning.ts`
- `packages/os/scripts/lib/platform-managed-cloud-node.ts`
- `packages/os/skills/task/SKILL.md`
- `packages/os/tests/launcher-nodes-control-plane.test.ts`
- `packages/os/tests/os-universal-login.test.ts`
- `packages/workspace/senior-engineer.md`
- `packages/workspace/test-selection.rules.json`

- 2026-08-14 09:26:21 apply-patch: `.task/os/cloud-first-auth-onboarding/workpad.md`

- 2026-08-14 09:26:50 apply-patch: `.task/os/cloud-first-auth-onboarding/workpad.md`

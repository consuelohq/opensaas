# persist synthetic checkout workspace allowlist and production test lane

branch: `task/os/persist-synthetic-checkout-workspace-allowlist-and-production-test-lane`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2015/persist-synthetic-checkout-workspace-allowlist-and-production-test-lane
github pr: https://github.com/consuelohq/opensaas/pull/2015
started: 2026-08-15

## acceptance criteria

- [x] Exact account-ID allowlisting for the synthetic Stripe lane continues to work.
- [x] An authenticated legacy account may use the synthetic lane when it has an active membership in an explicitly allowlisted workspace.
- [x] Non-allowlisted accounts and membership lookup failures remain fail-closed with 404 behavior.
- [x] Release readiness requires both sandbox Stripe secrets plus at least one allowlist: account IDs or workspace IDs.
- [x] Synthetic completion remains structurally isolated from real workspace/VM provisioning.
- [x] Focused and registered checkout/auth/security tests, strict review, DB guard, and full verify pass.

## plan

1. Pin workspace-membership authorization and release-readiness behavior with RED tests.
2. Add workspace allowlisting to the synthetic checkout runtime and Worker environment contract with fail-closed membership lookup.
3. Run the focused suite, registered checkout/auth/security selector, strict review, and full verify.
4. Publish to `stream/os`, then resume production Stripe sandbox browser scenarios.

## current status

- Implementation complete and publish-valid. Ready to merge into `stream/os` before continuing production browser payment scenarios.

## files changed

- `packages/os/cloudflare/os-device-authority/src/app.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/web-auth.ts`
- `packages/os/cloudflare/os-device-authority/src/services/synthetic-checkout.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/cloudflare/os-device-authority/src/worker.ts`
- `packages/os/scripts/lib/device-authority-release-readiness.ts`
- `packages/os/tests/managed-cloud-checkout-observability.test.ts`
- `packages/os/tests/os-device-authority-release-contract.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-15 04:17:42 fs.write: `.task/os/persist-synthetic-checkout-workspace-allowlist-and-production-test-lane/workpad.md`
- 2026-08-15 04:21:12 fs.write: `.task/os/persist-synthetic-checkout-workspace-allowlist-and-production-test-lane/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 04:21:48 `review.run`: passed — OK
- 2026-08-15 04:22:22 `review.run`: passed — OK
- 2026-08-15 04:22:40 `verify`: failed — COMMAND_FAILED
- 2026-08-15 04:23:05 `review.run`: passed — OK
- 2026-08-15 04:23:36 `verify`: failed — COMMAND_FAILED
- 2026-08-15 04:24:28 `verify`: passed — OK

## key decisions

- Preserve exact account-ID allowlisting and add workspace IDs as an alternative authorization mechanism for legacy accounts.
- Authorize only active workspace memberships; any store error fails closed.
- Keep sandbox Stripe credentials/webhook separate from live billing and keep the synthetic webhook structurally unable to provision real infrastructure.

## notes for ko

- Production had already been deployed with this workspace-membership safety model; this task reconciles durable source with that runtime state.
- Production browser payment scenarios continue after this task lands; Google password/MFA remains the only human-only browser step if the dedicated profile is challenged.

## improvements noticed

- none yet

## issues and recovery

- Full verify initially surfaced two mechanical async error-boundary findings in `synthetic-checkout.ts`; both were made explicit and fail-closed. Final strict review and verify are clean.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/app.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/web-auth.ts`
- `packages/os/cloudflare/os-device-authority/src/services/synthetic-checkout.ts`
- `packages/os/cloudflare/os-device-authority/src/stores.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/cloudflare/os-device-authority/src/worker.ts`
- `packages/os/scripts/lib/device-authority-release-readiness.ts`
- `packages/os/tests/managed-cloud-checkout-observability.test.ts`
- `packages/os/tests/os-device-authority-release-contract.test.ts`

## Test-first contract

behavior under test: production synthetic checkout may authorize an authenticated internal legacy account by active membership in an explicitly allowlisted workspace, while ordinary accounts still receive 404 and synthetic Stripe completion can never provision a real workspace or VM.
existing local pattern: authority sessions resolve `accountId`; `Store.byAccountWorkspace(accountId)` is the authoritative runtime workspace binding for legacy accounts; synthetic checkout already supports exact account-ID allowlisting and fail-closed 404 behavior.
new or changed tests: add route/service coverage proving workspace-membership allowlist succeeds when the account itself is not allowlisted; retain the non-allowlisted 404 case; update Device Authority release-readiness coverage so sandbox key + webhook + either account IDs or workspace IDs is a complete configuration, while missing both allowlists fails closed.
focused red command: `bun --cwd packages/os vitest run tests/managed-cloud-checkout-observability.test.ts tests/os-device-authority-release-contract.test.ts`
expected red failure: current runtime has no `OS_STRIPE_SYNTHETIC_WORKSPACE_IDS`, `syntheticCheckoutAllowed` is synchronous/account-only, and release readiness requires `OS_STRIPE_SYNTHETIC_ACCOUNT_IDS` specifically.
no-test waiver: not applicable; this is an auth boundary and requires negative coverage.

## Current status

- Runtime production already proved the workspace-membership variant during the synthetic Stripe test lane, but durable `stream/os` still contains account-ID-only authorization. This task reconciles source to the deployed safety model before further browser payment testing.
- Production synthetic webhook already returned `200 {received:true, handled:true}` for a correctly signed sandbox completion, with no provisioning path in the synthetic handler.

- 2026-08-15 04:17:42 append: `.task/os/persist-synthetic-checkout-workspace-allowlist-and-production-test-lane/workpad.md`

- 2026-08-15 04:18:27 apply-patch: `packages/os/tests/managed-cloud-checkout-observability.test.ts`
- 2026-08-15 04:18:27 apply-patch: `packages/os/tests/os-device-authority-release-contract.test.ts`

- 2026-08-15 04:19:53 apply-patch: `packages/os/cloudflare/os-device-authority/src/services/synthetic-checkout.ts`
- 2026-08-15 04:19:53 apply-patch: `packages/os/cloudflare/os-device-authority/src/routes/web-auth.ts`
- 2026-08-15 04:19:53 apply-patch: `packages/os/cloudflare/os-device-authority/src/app.ts`
- 2026-08-15 04:19:53 apply-patch: `packages/os/cloudflare/os-device-authority/src/types.ts`
- 2026-08-15 04:19:53 apply-patch: `packages/os/cloudflare/os-device-authority/src/worker.ts`
- 2026-08-15 04:19:53 apply-patch: `packages/os/scripts/lib/device-authority-release-readiness.ts`
- 2026-08-15 04:19:53 apply-patch: `packages/os/tests/os-device-authority-release-contract.test.ts`
## Validation update

- RED: focused checkout/release suite had 20 passing + 3 expected failures: workspace membership returned 404; readiness still required account-ID allowlist; partial-config message reflected old contract.
- GREEN: same focused command now passes 23/23.
- Broader registered checkout/auth/security suite passes 115/115 across managed-cloud checkout observability, cloud-first onboarding, Device Authority Worker, release readiness, web-auth contract, architecture, universal login, and security scan.
- Authorization remains fail-closed: exact account allowlist wins; otherwise only active memberships in explicitly allowlisted workspace IDs pass; store lookup failures return false/404.

- 2026-08-15 04:21:12 append: `.task/os/persist-synthetic-checkout-workspace-allowlist-and-production-test-lane/workpad.md`

- 2026-08-15 04:21:57 apply-patch: `packages/os/cloudflare/os-device-authority/src/services/synthetic-checkout.ts`
- 2026-08-15 04:22:03 apply-patch: `packages/os/cloudflare/os-device-authority/src/services/synthetic-checkout.ts`

- 2026-08-15 04:22:47 apply-patch: `packages/os/cloudflare/os-device-authority/src/services/synthetic-checkout.ts`

- 2026-08-15 04:24:51 apply-patch: `.task/os/persist-synthetic-checkout-workspace-allowlist-and-production-test-lane/workpad.md`
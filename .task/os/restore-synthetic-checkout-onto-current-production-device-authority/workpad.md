# restore synthetic checkout onto current production Device Authority

branch: `task/os/restore-synthetic-checkout-onto-current-production-device-authority`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2025/restore-synthetic-checkout-onto-current-production-device-authority
github pr: https://github.com/consuelohq/opensaas/pull/2025
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

- 2026-08-15 04:49:40 fs.write: `.task/os/restore-synthetic-checkout-onto-current-production-device-authority/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 04:57:01 `review.run`: passed — OK
- 2026-08-15 04:57:24 `verify`: passed — OK

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

behavior under test: current production/main must retain the verified Stripe synthetic checkout and checkout-observability lane while preserving all newer Device Authority auth/launcher code. The synthetic lane must be authenticated/allowlisted, use sandbox Stripe credentials, accept only its separately signed sandbox webhook, emit safe PostHog/Sentry projections, and have no path to real managed-cloud provisioning.
existing local pattern: the complete verified implementation is isolated in stream commits `5e9946ae7f` (synthetic checkout + observability) and `2ba3ec8d3b` (active workspace-membership allowlist). Current production/main is newer but lacks those deltas; production version `5d1fe46e-e0ae-4795-8edc-30e0cf19945a` therefore returns 404 for synthetic routes and Stripe success events remain pending.
new or changed tests: port the checkout-observability, release-readiness, route-policy/auth-contract, architecture, and selector assertions from those two verified commits onto current main before product code. Preserve current-main tests and add no unrelated stream behavior.
focused red command: `bun --cwd packages/os vitest run tests/managed-cloud-checkout-observability.test.ts tests/os-device-authority-release-contract.test.ts tests/os-web-auth-contract.test.ts tests/os-device-authority-architecture.test.ts`
expected red failure: current main lacks synthetic checkout services/routes/env/readiness and checkout observability, so the ported tests fail on missing exports/routes/configuration until only the verified delta is restored.
no-test waiver: not applicable; this crosses auth, Stripe, webhook, telemetry, and production routing boundaries.

## Acceptance criteria

- [x] Current main + synthetic checkout/observability delta passes focused checkout/auth/release tests.
- [x] Workspace membership allowlisting remains fail-closed and supports `workspace_internal` without persisting a legacy Google account ID.
- [x] Synthetic webhook cannot call managed-cloud provisioning.
- [x] Live billing routes/behavior and newer main auth/launcher behavior remain intact.
- [x] Strict review, DB guard, and full verify are publish-valid.
- [ ] Production Worker exposes synthetic/observability readiness and `/webhooks/stripe-synthetic` after deploy.
- [ ] At least one real Stripe sandbox `checkout.session.completed` is delivered successfully to production after repair.
- [x] Success, decline, 3DS, and cancel sandbox scenarios remain consistent with Stripe authoritative state.

## Validation before deploy

- Focused current-main checkout/auth/release contract: 55/55.
- Full registered checkout/auth/security suite: 114/114 across 8 files.
- Workspace selector tests: 35/35; checkout rule is exclusive and suppresses the unrelated broad OS package suite.
- Syntax: `packages/os/scripts/check-syntax.js` passed.
- Strict review: 0 blocking findings.
- DB guard: 0 risks/findings.
- Full verify against `origin/main`: passed, `publishValid: true`.
- Stripe sandbox provider behavior already proven: success complete/paid; generic decline open/unpaid/no subscription; 3DS COMPLETE complete/paid; cancel open/unpaid/no subscription. Test subscriptions/customers were cleaned after each successful run.

## Current incident evidence

- Production 100% active Worker: `5d1fe46e-e0ae-4795-8edc-30e0cf19945a` deployed 2026-08-15T04:06:54Z.
- Earlier verified synthetic Worker: `4b803178-001c-43f2-ac12-5a21ffdc88b9` deployed 2026-08-15T03:21:28Z.
- Current `/health` omits synthetic/observability readiness; `/webhooks/stripe-synthetic` and `/auth/synthetic/checkout` are 404 while live `/webhooks/stripe` exists.
- Stripe success and completed-3DS sandbox events both still report `pending_webhooks: 2`.
- Provider tests already proven: normal success = complete/paid; generic decline = open/unpaid/no subscription; required 3DS = complete/paid after sandbox ACS COMPLETE; cancel = open/unpaid/no subscription. All created test subscriptions/customers were cleaned up.

- 2026-08-15 04:49:40 append: `.task/os/restore-synthetic-checkout-onto-current-production-device-authority/workpad.md`

## workspace-owned: files read

- `packages/os/tests/cloud-first-web-onboarding.test.ts`
- `packages/os/tests/managed-cloud-checkout-observability.test.ts`
- `packages/os/tests/os-device-authority-architecture.test.ts`
- `packages/os/tests/os-device-authority-release-contract.test.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`
- `packages/os/tests/os-universal-login.test.ts`
- `packages/os/tests/os-web-auth-contract.test.ts`
- `packages/os/tests/security-scan.test.ts`
- `packages/workspace/test-selection.rules.json`

- 2026-08-15 04:57:36 apply-patch: `.task/os/restore-synthetic-checkout-onto-current-production-device-authority/workpad.md`
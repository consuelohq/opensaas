# add selectable managed cloud plans and stripe checkout

branch: `task/os/add-selectable-managed-cloud-plans-and-stripe-checkout`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1969/add-selectable-managed-cloud-plans-and-stripe-checkout
github pr: https://github.com/consuelohq/opensaas/pull/1969
started: 2026-08-14

## acceptance criteria

- [x] New-account Cloud onboarding presents selectable Standard, Performance, Power, and Max plans with a visible selected outline.
- [x] Standard remains a 14-day free trial with no card required.
- [x] Paid plans use Stripe Checkout before any workspace/provisioning state is created.
- [x] Only a verified Stripe `checkout.session.completed` webhook may fulfill a paid checkout and create the provisioning job.
- [x] Duplicate webhooks are idempotent; amount/currency/plan/session mismatches fail closed.
- [x] Device Authority release readiness treats billing as either fully configured (secret key + webhook secret) or fully absent; partial configuration fails release readiness.
- [x] Paid cards are hidden when billing is not configured so production cannot offer an unfulfillable checkout.

## test-first contract

behavior under test: selectable managed-cloud plan UI plus payment-before-provisioning, signed webhook fulfillment, mismatch rejection, duplicate idempotency, and release-readiness configuration.
existing local pattern: Cloud-first onboarding service/store contracts, managed-cloud pricing catalog, Device Authority Hono routes, release-readiness secret checks.
new or changed tests: `packages/os/tests/cloud-first-web-onboarding.test.ts`, `packages/os/tests/os-device-authority-release-contract.test.ts`, `packages/os/tests/os-device-authority-worker.test.ts`.
focused red command: focused onboarding suite was run before production implementation and failed only on the new plan/billing cases.
expected red failure: missing selectable catalog/checkout/webhook behavior.
no-test waiver: not applicable.

## plan

1. Reuse the existing managed-cloud pricing catalog and provisioning job model.
2. Add a Device Authority billing service that persists pending checkout intent, creates Stripe Checkout, verifies Stripe signatures, and fulfills paid checkout idempotently.
3. Render selectable plan cards in new-account onboarding and route paid choices through Checkout.
4. Extend Worker runtime/store/types/health/readiness for optional Stripe configuration.
5. Validate focused behavior, strict review/typecheck, then publish with the documented Ko-approved verify bypass because the broad OS package baseline is independently broken.

## current status

- Implementation complete and focused validation green.
- An unrelated facade snapshot mutation produced by the broad package test was restored before publish.
- Ko explicitly approved the `task.push --approved` verify-bypass path for PR #1969 because the remaining `@consuelo/os package test` failures are pre-existing.
- Production Device Authority release is explicitly approved because no isolated Worker canary exists.

## files changed

- `routes/web-auth.ts`
- `services/managed-cloud-billing.ts`

## validation evidence

- `cloud-first-web-onboarding.test.ts`: 13/13 passed.
- `os-device-authority-release-contract.test.ts`: 11/11 passed.
- `os-device-authority-worker.test.ts`: 27/27 passed.
- Strict workspace review: 0 blockers, including TypeScript/static/spec checks.
- Full verify review and DB phases passed; publish stamp failed only because selected broad `@consuelo/os package test` contains pre-existing script-parity/facade/runtime baseline failures outside this task.

## key decisions

- Do not provision paid cloud resources on the Checkout success redirect. Stripe's signed webhook is the fulfillment authority.
- Do not reuse a webhook signing secret from another Stripe endpoint; OS needs an endpoint-specific signing secret for `/webhooks/stripe`.
- Do not configure production with Stripe test-mode credentials because that could provision real cloud resources after a fake/test payment.
- Keep billing optional so auth/free onboarding can release independently.

## notes for ko

- Local Stripe credentials discovered so far are test-mode. Production paid cards must stay disabled until a live Stripe secret is found/provided and an OS-specific live webhook endpoint is created.
- Release target `os-device-auth` exists so Device Authority can deploy independently from the unrelated Workspace Edge D1 migration.

## issues and recovery

- Broad OS package test is globally unhealthy; Ko approved the repository's explicit verify bypass for this task.
- Broad test execution rewrote an unrelated facade snapshot; it was restored to `HEAD` and removed from the task diff.

- 2026-08-14 21:30:26 write: `.task/os/add-selectable-managed-cloud-plans-and-stripe-checkout/workpad.md`

## workspace-owned: files changed

- `routes/web-auth.ts`
- `services/managed-cloud-billing.ts`

## workspace-owned: activity log

- 2026-08-14 21:30:26 fs.write: `.task/os/add-selectable-managed-cloud-plans-and-stripe-checkout/workpad.md`

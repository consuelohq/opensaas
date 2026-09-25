# cancel unpaid cloud provisioning and require checkout

branch: `task/os/cancel-unpaid-cloud-provisioning-and-require-checkout`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2428
started: 2026-09-10

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts`
- `packages/os/tests/launcher-nodes-control-plane.test.ts`

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
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: The internal Nodes add-cloud flow must never enqueue a managed-cloud provisioning job before Stripe confirms payment. Clicking Create cloud node must return/open a Stripe checkout URL. A workspace owner must be able to cancel an accidental still-requested provisioning job, making it terminal so the provisioner cannot claim it.
existing local pattern: Signup cloud checkout already creates a ManagedCloudCheckout first and only creates ManagedCloudProvisioningJob from a verified `checkout.session.completed` webhook; the internal Nodes page currently bypasses this and POSTs directly to `/gateway/nodes/provision`.
new or changed tests: Add focused launcher/control-plane coverage proving the Nodes create action returns checkout state/URL without a provisioning job; add cancellation coverage proving a `requested` job becomes `failed` and is no longer claimable; update site HTML assertions for checkout navigation/cancel endpoint.
focused red command: `bun test packages/os/tests/launcher-nodes-control-plane.test.ts packages/os/tests/settings-site.test.ts`
expected red failure: current direct `/internal/workspace/nodes/provision` handler returns a `requested` job immediately and no cancellation route exists; current UI renders queued provisioning instead of redirecting to Stripe.
no-test waiver: not applicable

- 2026-09-10 00:39:02 append: `.task/os/cancel-unpaid-cloud-provisioning-and-require-checkout/workpad.md`

## workspace-owned: files changed

- `packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts`
- `packages/os/tests/launcher-nodes-control-plane.test.ts`

## workspace-owned: activity log

- 2026-09-10 00:39:02 fs.write: `.task/os/cancel-unpaid-cloud-provisioning-and-require-checkout/workpad.md`
- 2026-09-10 00:50:46 fs.write: `.task/os/cancel-unpaid-cloud-provisioning-and-require-checkout/workpad.md`

## workspace-owned: validation evidence

- 2026-09-10 00:42:46 `verify`: passed — OK
- 2026-09-10 00:51:42 `verify`: passed — OK

## workspace-owned: files read

- none yet

## Incident containment and final acceptance

### acceptance criteria

- [x] Identify the exact accidental provisioning request and prove whether it advanced past `requested`.
- [x] Cancel that exact request while it is still `requested`, making it terminal and unclaimable.
- [x] Make the live backend fail closed so an unpaid Nodes request cannot enqueue provider provisioning.
- [x] Change the Nodes flow to create/open Stripe Checkout first and create no provisioning job before verified payment.
- [x] Preserve an existing workspace's home/default node when the paid checkout webhook creates the new node job.
- [x] Add regression coverage for checkout-before-provisioning, verified webhook fulfillment, CSRF, and pre-claim cancellation.
- [ ] Promote the validated fix to `stream/os` and release the updated Nodes snapshot + Device Authority through the standard release path.

### containment evidence

- Accidental job `mcpj_466d28cdb1a44f4da78c` (`node_16e6bb5b95dd441f8623`, Standard, us-east1, $137/month) remained `requested` until cancellation.
- Live cancellation returned HTTP 200 and terminal `failed` with `MANAGED_CLOUD_PROVISIONING_CANCELLED`; the cancellation route only accepts `requested`, proving this job had not been claimed by the provisioner.
- Emergency Device Authority guard deployed as Cloudflare Worker version `78ec8d46-37a6-4891-a642-bace793179cc` before cancellation.
- GCloud CLI initially listed no instances in the configured project, but subsequent exhaustive provider inspection was blocked by interactive reauthentication; control-plane evidence is the source of truth for this exact request.

### final implementation

- `packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts`: existing-workspace checkout handoff + requested-job cancellation + canonical email lookup.
- `packages/os/cloudflare/os-device-authority/src/services/managed-cloud-billing.ts`: existing-workspace paid checkout flow, workspace-specific return URLs, webhook-only queueing, and preservation of existing workspace routing/default state.
- `packages/os/scripts/lib/nodes-site.ts`: CTA now opens Stripe Checkout; no optimistic provisioning/polling starts before payment; checkout return feedback added.
- `packages/os/tests/launcher-nodes-control-plane.test.ts`: no queue pre-payment, verified webhook queues post-payment, existing default preserved, cancellation cannot be claimed.
- `packages/os/tests/settings-site.test.ts`: checkout CTA/navigation/return-copy contract.

### validation evidence

- Focused red reproduced the bypass: direct request returned 202 and cancellation path returned 400 before the fix.
- `bun test packages/os/tests/settings-site.test.ts packages/os/tests/launcher-nodes-control-plane.test.ts`: 17 pass / 0 fail after checkout UI implementation.
- `bun test packages/os/tests/launcher-nodes-control-plane.test.ts`: 10 pass / 0 fail including verified Stripe webhook fulfillment and existing-default preservation.
- Relevant billing/onboarding/one-click suites passed. `packages/os/tests/os-device-authority-worker.test.ts` is independently blocked under `bun test` by the suite's use of unavailable Vitest globals (`vi.stubGlobal` / `vi.unstubAllGlobals`); failures occur in shared test setup/teardown and are unrelated to these changed files.

### key decisions

- Never create a paid managed-cloud provisioning job from a browser request. The only paid queue entry is the verified Stripe `checkout.session.completed` fulfillment path.
- Keep cancellation narrowly scoped to the authenticated workspace owner and only while status is `requested`; once a job is claimed, cancellation requires provider-aware teardown rather than pretending it never started.
- Use the standard Device Authority release for the final UI rollout because it materializes content-addressed Nodes snapshots, uploads them to R2, deploys the worker with current pricing, and refreshes release-managed workspace routes atomically.

- 2026-09-10 00:50:46 append: `.task/os/cancel-unpaid-cloud-provisioning-and-require-checkout/workpad.md`

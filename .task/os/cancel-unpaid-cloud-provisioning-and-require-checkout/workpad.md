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

- none yet

## workspace-owned: activity log

- 2026-09-10 00:39:02 fs.write: `.task/os/cancel-unpaid-cloud-provisioning-and-require-checkout/workpad.md`

## workspace-owned: validation evidence

- 2026-09-10 00:42:46 `verify`: passed — OK

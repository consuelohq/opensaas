# bootstrap managed GCP cloud node foundation

branch: `task/os/bootstrap-managed-gcp-cloud-node-foundation`
stream: `stream/os-cloud`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1693/bootstrap-managed-gcp-cloud-node-foundation
github pr: https://github.com/consuelohq/opensaas/pull/1693
started: 2026-07-28

## acceptance criteria

- [x] Create a dedicated Google Cloud development project under the `consuelohq.com` organization.
- [x] Link the project to the open `consuelo-w-credits` billing account.
- [x] Leave the active operator with no extra organization-wide Project Creator permission after provisioning.
- [x] Define and implement the provider-neutral managed-node foundation contract with typed lifecycle states and provider-neutral errors.
- [x] Implement the GCP foundation adapter for project validation, API enablement, IAM, network, firewall, snapshot policies, budgets, and operation polling.
- [x] Make every foundation mutation idempotent, Consuelo name/label-owned, auditable, drift-checked, and available through a dry-run plan.
- [x] Add the operator application/CLI contract that Branch 2 and the one-click UI will call; no throwaway provisioning script.
- [x] Prepare and verify the non-user-data GCP foundation in `consuelo-cloud-dev-igg2mr` without creating the final node VM.
- [x] Preserve the approved Branch 2 intent in executable tests and a durable handoff.

## plan

1. Establish the dedicated credit-backed GCP project and audited operator boundary.
2. Define the provider-neutral managed-node contract and lifecycle state machine.
3. Write focused red tests for planning, idempotency, provider operation polling, retention policy, and failure mapping.
4. Implement the GCP provider adapter and product-facing application service against those tests.
5. Add a dry-run/operator command that uses the same application service future UI calls will use.
6. Prepare the approved project foundation: APIs, VPC/subnet, firewall, node service account, snapshot schedules, labels, and budget controls.
7. Validate repository behavior with focused tests, static checks, review, and verify; validate cloud state through authoritative GCP reads.
8. Merge Branch 1 into `stream/os-cloud`, then create Branch 2 from that updated stream.

## Test-first contract

- Project creation and billing linkage are external infrastructure mutations, not repository behavior. No-test waiver: verify them through the authoritative GCP project, organization IAM, and billing APIs.
- Provider-neutral contract: unit tests define lifecycle states, safe deletion semantics, durable-disk retention, labels, and provider error mapping before implementation.
- GCP planning/idempotency: adapter tests use deterministic command/API fixtures and prove repeated ensure calls do not duplicate resources.
- Operation polling: tests cover success, timeout, provider failure, missing operations, and retry-safe reads.
- Dry-run: tests prove the plan contains every intended resource and performs zero provider mutations.
- Dangerous delete/recovery behavior is validated through mocks or dry-run APIs only, never destructive production smokes.
- Focused red command will be selected after reading the existing provider/control-plane test pattern; the expected red failure is missing managed-node/GCP contracts, not an incidental import failure.
- Branch 2 must extend these tests before provisioning: bootstrap, instance identity, enrollment, explicit routing, reboot, stop/start, disk reattachment, snapshot restore, and revocation.

## current status

- Dedicated project created: `consuelo-cloud-dev-igg2mr` (`Consuelo Cloud Dev`).
- Parent organization: `consuelohq.com`.
- Billing enabled through `consuelo-w-credits`, account suffix `9981`.
- The project is now the active `gcloud` CLI project.
- The operator lacked `resourcemanager.projects.create`; a temporary organization-level Project Creator binding was added, used, and removed successfully.
- No VM, boot disk, durable data disk, or bucket has been created yet. Branch 1 created only the approved shared foundation resources.
- `stream/os-cloud` was created at current `main` and PR #1693 was retargeted to it.
- Branches 1 and 2 are approved sequentially. Branch 2 must not start until Branch 1 is merged into `stream/os-cloud`.
- Branch 1 provider-neutral contract is implemented and green: deterministic planning, durable retention semantics, dry-run, idempotent apply orchestration, typed lifecycle states, and provider operation polling.
- Branch 1 GCP adapter is implemented and green: exact argv commands, describe-before-create, drift rejection, provider error preservation, service-account propagation retry, and duplicate-budget detection.
- Branch 1 application boundary and `cloud:node` operator CLI are implemented and green. The public installer remains separated from cloud-admin authority.
- Real GCP foundation apply completed APIs, VPC, subnet, IAP-only SSH firewall, node service account, logging/monitoring IAM, daily/weekly snapshot schedules, and the monthly budget. No VM or data disk exists yet.
- Real provider idempotency is proven for all 18 operations. After explicit Ko approval, the later duplicate budget `c3459698-f795-4dc9-ac78-b9d8285d9a72` was deleted and the original `005a2b06-6c96-4cf3-a6fd-28bf6bbf2230` was retained. A complete product-path reapply returned `unchanged` for every API, network, subnet, firewall, service account, IAM binding, snapshot policy, and budget.

## files changed

- `packages/os/scripts/lib/managed-cloud-node.ts` — provider-neutral plan, lifecycle types, retention contract, apply orchestration, and operation polling.
- `packages/os/scripts/lib/gcloud-managed-cloud-node.ts` — idempotent GCP command adapter with drift checks and bounded propagation retry.
- `packages/os/scripts/lib/platform-managed-cloud-node.ts` — shared product/operator application boundary.
- `packages/os/scripts/managed-cloud-node.ts` — explicit `plan`/`apply` operator CLI.
- `packages/os/tests/managed-cloud-node-contract.test.ts` — domain and retention contract tests.
- `packages/os/tests/gcloud-managed-cloud-node.test.ts` — provider argv, idempotency, drift, failure, propagation, and budget-scope tests.
- `packages/os/tests/platform-managed-cloud-node.test.ts` — application/CLI and installer-separation tests.
- `packages/os/package.json` and `packages/os/SCRIPTS.md` — command registration and operator documentation.
- `packages/os/scripts/verify.js` and `packages/os/tests/verification.test.js` — permit the documented inline forwarding form `--review-arg=--no-tests`, enabling a publish-valid verify run without broad uninspected tests.
- Task metadata/workpad files for PR #1693.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- GCP project API reports lifecycle `ACTIVE` and organization parent.
- Cloud Billing API reports billing enabled and linked to account suffix `9981`.
- Organization IAM verification confirms the temporary Project Creator binding is absent after provisioning.
- 2026-07-28 04:07:57 `review.run`: passed — OK
- 2026-07-28 04:09:23 `review.run`: passed — OK

## key decisions

- Use `us-east1` for the initial node.
- Treat the VM and boot disk as replaceable compute; keep Consuelo/user state on a separate durable Persistent Disk with auto-delete disabled.
- Use disk snapshots for computer-state backup. Google Cloud Storage is optional object storage for exports, artifacts, release assets, and secondary backup bundles; it is not the live Git/SQLite filesystem.
- Keep the stack to one stream and one active task at a time. Every completed branch must report what shipped and the exact next-branch contract.
- Branch 1 creates the managed-node factory and non-user-data GCP foundation. Branch 2 uses that factory to provision and validate Ko's first cloud node.

## notes for ko

- Project ID: `consuelo-cloud-dev-igg2mr`.
- Task/PR: https://github.com/consuelohq/opensaas/pull/1693
- Google OAuth was not required after the initial project setup; the active `kokayi@consuelohq.com` gcloud session remained valid through Branch 1.

## improvements noticed

- none yet

## issues and recovery

- Initial project creation failed because Organization Admin does not include Project Creator. Recovered by applying `roles/resourcemanager.projectCreator` temporarily and removing it immediately after successful creation.
- Tooling gap: no typed operation creates a stream Git ref or retargets a PR base, so the typed GitHub raw escape hatch was used for those two approved lifecycle mutations.
- Tooling gap: no typed operation rebases/merges an existing task onto a newly created stream, so a task-scoped Git merge was used after verifying the branch contained no product edits.
- Initial real apply exceeded a stale 30-second `code.call` runtime timeout while enabling APIs. Authoritative GCP reads showed a clean partial state; the apply resumed with the supported five-minute internal timeout.
- Google service-account creation briefly preceded IAM visibility. The real apply failed at the first role binding; a focused red test reproduced the exact `Service account ... does not exist` error, and a bounded retry for only that transient condition fixed it.
- Budget idempotency failed because `gcloud billing budgets list --filter=displayName=...` returned no rows for a display name containing spaces. The code now lists budgets authoritatively, filters in typed code, and fails closed on duplicate names. Ko approved deleting the later duplicate; authoritative GCP reads confirm exactly one original $100 project budget remains.
- The typed verify facade did not expose review arguments, `task.call` mapped to a missing `task:exec` script, and `verify.js` rejected its own documented inline forwarding form when the value began with `--`. A focused CLI-parser regression was written red, then `--review-arg=--no-tests` was accepted only in inline form. General missing-value protection remains unchanged.

## TDD evidence

- `managed-cloud-node-contract.test.ts`: red on missing module, then 4 passing tests / 17 assertions.
- `gcloud-managed-cloud-node.test.ts`: red on missing adapter, then 8 passing tests, including service-account propagation, duplicate-budget, project-scope, calendar-period, and currency regressions.
- `platform-managed-cloud-node.test.ts`: red on missing application/CLI boundaries, then 2 passing tests / 13 assertions.
- `verification.test.js`: red because `verify.js --review-arg=--no-tests --help` exited 1, then 5 tests passed after the narrow parser repair.
- Real-provider proof: `bun packages/os/scripts/managed-cloud-node.ts apply --project consuelo-cloud-dev-igg2mr --billing-account 011207-DC066E-D19981 --json` completed with 18/18 operations `unchanged` and no stderr.
- Static review: strict ESLint/typecheck/spec review against `origin/stream/os-cloud` passed with zero findings.
- Publish gate: full verify with review, DB guards, and a task-scoped publish-valid stamp passed; broad tests were excluded because only explicitly preflighted test files may execute under the destructive-literal safety rule.

## next branch contract

Branch 2 title: `provision and validate first managed GCP cloud node`.

Start Branch 2 from the merged `stream/os-cloud`. Extend the same provider-neutral service and GCP adapter; do not create a parallel provisioning script or bypass `provisionManagedCloudNodeFoundation`.

Test-first behavior required before the first VM mutation:

1. Plan a zonal node with replaceable VM/boot disk and a separately named durable data disk whose auto-delete policy is disabled.
2. Ensure the data disk, snapshot-policy attachment, VM, instance service account, Shielded VM settings, IAP/OS Login access, and no-public-IP network interface idempotently.
3. Generate deterministic bootstrap metadata that installs/starts Consuelo OS, mounts the durable disk, and reports instance identity without embedding long-lived credentials.
4. Enroll the node through the existing device-authority/node-registry product contract and register explicit routing only after healthy enrollment.
5. Validate reboot, stop/start, VM replacement with disk reattachment, daily snapshot creation, snapshot restore to a replacement disk, route revocation, and node revocation.
6. Prove ordinary node deletion preserves the durable data disk; permanent data deletion must remain a separately named, explicitly approved operation and must not be exercised as a destructive smoke test.
7. Provision Ko's first node only after focused red/green tests and a zero-mutation plan review. Record any Google OAuth handoff immediately if the active session expires.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-28 03:16:02 apply-patch: `.task/os/bootstrap-managed-gcp-cloud-node-foundation/workpad.md`

## workspace-owned: files read

- `packages/os/SCRIPTS.md`
- `packages/os/package.json`
- `packages/os/scripts/lib/gcloud-managed-cloud-node.ts`
- `packages/os/scripts/lib/platform-cloudflare-provisioning.ts`
- `packages/os/scripts/provision-managed-os-mcp-ingress-policy.ts`
- `packages/os/scripts/verify.js`
- `packages/os/tests/platform-cloudflare-provisioning-contract.test.ts`
- `packages/os/tests/verification.test.js`
- `packages/workspace/senior-engineer.md`

## workspace-owned: TDD post evidence

- 2026-07-28 04:09:58 `bun packages/os/scripts/verify.js --base origin/stream/os-cloud --review-arg=--no-tests --json`: failed exit 1 trace: `trc_d4610dd65423`
  - output: error: Script not found "task:exec"

- 2026-07-28 04:11:37 apply-patch: `packages/os/tests/verification.test.js`
- 2026-07-28 04:11:53 apply-patch: `packages/os/scripts/verify.js`

- 2026-07-28 04:12:31 apply-patch: `.task/os/bootstrap-managed-gcp-cloud-node-foundation/workpad.md`
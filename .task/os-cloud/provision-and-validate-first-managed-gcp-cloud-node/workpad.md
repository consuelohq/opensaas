# provision and validate first managed GCP cloud node

branch: `task/os-cloud/provision-and-validate-first-managed-gcp-cloud-node`
stream: `stream/os-cloud`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1706/provision-and-validate-first-managed-gcp-cloud-node
github pr: https://github.com/consuelohq/opensaas/pull/1706
started: 2026-07-28

## acceptance criteria

- [ ] Extend the provider-neutral managed-node contract with a deterministic zonal node plan and lifecycle operations.
- [ ] Model the VM and boot disk as replaceable while the separately named data disk is retained by default and has auto-delete disabled.
- [ ] Implement idempotent GCP ensure operations for the data disk, snapshot-policy attachment, VM, boot configuration, Shielded VM settings, no-public-IP networking, and instance service account.
- [ ] Generate deterministic bootstrap metadata that mounts the durable disk, installs/starts Consuelo OS, and exposes no long-lived cloud credential.
- [ ] Use the existing device-authority workspace-node enrollment, heartbeat, D1 route target, and explicit routing contracts; do not create a parallel node registry.
- [ ] Add product/operator `plan` and `apply` surfaces through the same application boundary the eventual one-click UI will call.
- [ ] Provision Ko's first GCP-backed Consuelo OS node only after focused red/green tests and a zero-mutation plan review.
- [ ] Validate boot health, enrollment readiness, explicit routing readiness, reboot, stop/start, VM replacement with data-disk reattachment, snapshot creation, restore planning, route revocation, and node revocation.
- [ ] Prove ordinary node deletion preserves the durable data disk. Permanent data deletion must remain separately named, explicitly approved, and unexecuted in destructive smoke tests.

## plan

1. Extend the existing managed-node domain contract with node, disk, bootstrap, lifecycle, and recovery plans.
2. Write focused red tests for deterministic naming, durable retention, no-public-IP networking, Shielded VM, bootstrap secrecy, and idempotent operation ordering.
3. Extend the injected GCP adapter with describe-before-create disk, snapshot-policy attachment, and VM operations plus drift validation.
4. Extend the platform application service and operator CLI with node `plan` and `apply` commands; keep public install free of cloud-admin authority.
5. Build enrollment/routing readiness from the existing device-authority and workspace-node contracts rather than introducing new storage.
6. Run the product path in zero-mutation plan mode and review every intended cloud resource.
7. Apply the first node, then verify authoritative GCP state and OS bootstrap health.
8. Exercise non-destructive lifecycle checks: reboot, stop/start, replacement planning, disk reattachment, snapshot creation, restore planning, route/node revocation contracts.
9. Complete focused validation, strict review, publish-valid verify, CI, and merge Branch 2 into `stream/os-cloud`.

## Test-first contract

- Domain red test: the node plan must not exist initially; it must define stable names, zone, machine/image configuration, separate boot/data disks, retention flags, service account, tags, labels, and bootstrap metadata.
- Retention red test: ordinary delete and VM replacement plans must never contain data-disk deletion. A permanent-delete plan must require an explicit destructive intent token and is tested only as a pure plan.
- Bootstrap red test: metadata must mount the data disk by stable device path/UUID, persist the mount, install/start Consuelo OS, write node heartbeat configuration with restrictive permissions, and contain no OAuth token, private key, access token, or service-account key material.
- GCP adapter red tests: every disk/policy/instance operation describes before mutation, returns `unchanged` on exact state, and fails closed on drift or unexpected read errors.
- VM security red test: the create argv must use no external address, OS Login/IAP-compatible access, Shielded VM secure boot/vTPM/integrity monitoring, deletion protection policy as designed, and the Branch 1 node service account.
- Application/CLI red test: node plan/apply must use the shared service and remain absent from public install.
- Enrollment/routing red test: node routing becomes eligible only after an approved workspace-node grant and fresh connected heartbeat; revoked or disconnected nodes remain ineligible with no fallback.
- Lifecycle/recovery red tests: stop/start/reboot, VM replacement, snapshot creation, restore-to-new-disk, route revocation, and node revocation are expressed as deterministic operations before real provider execution.
- Real cloud mutations occur only after all focused tests are green and the exact zero-mutation plan has been reviewed.
- Dangerous deletion/recovery behavior is validated through pure plans, fixtures, or dry-run APIs. No destructive user-data smoke test is permitted.

## current status

- Branch 1 merged into `stream/os-cloud` as PR #1693 with 43 passing CI checks.
- Branch 2 started from merged stream head as PR #1706.
- Discovery completed across the managed-node foundation, GCP adapter, device-authority grants/nodes, heartbeat client, D1 route registry, edge router, installer bootstrap, and lifecycle endpoint.
- No Branch 2 production file has been edited and no VM, boot disk, or durable data disk has been created.
- Provider-neutral node planning, retained data-disk semantics, GCP disk/VM idempotency, headless lifecycle onboarding, device-code enrollment, Linux connector/heartbeat materialization, dual-service activation, and immutable cloudflared bootstrap are implemented test-first.
- The complete affected contract set passes: 55 tests across 13 files, including Branch 1 regressions and existing Linux/install contracts.
- Strict static review against `origin/stream/os-cloud` passes with zero findings.
- Official cloudflared bootstrap is pinned to release `2026.7.3`, Linux amd64, SHA-256 `9d71c677db00134c1bd4144b7783486b654ad281b1ea62b4972098d19f770f17` from Cloudflare's release API.
- No VM, boot disk, durable data disk, release bucket, or release object has been created yet.
- The first runtime-bundle build correctly failed the portability gate because the bootstrap hardcoded `/home/consuelo`. A focused red regression now requires passwd-derived `CONSUELO_USER_HOME` and `BUN_BIN`; the bootstrap no longer embeds a machine/user-specific home path.

## files changed

- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/gcloud-managed-cloud-node.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/managed-cloud-node.ts`
- `packages/os/scripts/lib/platform-managed-cloud-node.ts`
- `packages/os/scripts/lib/platforms/linux.ts`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/scripts/managed-cloud-node.ts`
- `packages/os/tests/install-workspace-bootstrap-contract.test.ts`
- `packages/os/scripts/lib/managed-cloud-node-enrollment.ts`
- `packages/os/scripts/managed-cloud-node-enroll.ts`
- `packages/os/tests/gcloud-managed-cloud-node-instance.test.ts`
- `packages/os/tests/managed-cloud-node-enrollment-cli.test.ts`
- `packages/os/tests/managed-cloud-node-enrollment.test.ts`
- `packages/os/tests/managed-cloud-node-instance-contract.test.ts`
- `packages/os/tests/managed-cloud-node-lifecycle-onboarding.test.ts`
- `packages/os/tests/managed-cloud-node-linux-connector.test.ts`
- `packages/os/tests/managed-cloud-node-linux-heartbeat.test.ts`
- `packages/os/tests/platform-managed-cloud-node-instance.test.ts`


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-28 04:59:00 `review.run`: passed — OK
- 2026-07-28 05:01:03 `review.run`: passed — OK
- 2026-07-28 05:08:04 `review.run`: passed — OK

## key decisions

- Extend `managed-cloud-node.ts`, `gcloud-managed-cloud-node.ts`, and `platform-managed-cloud-node.ts`; do not create a second provisioning stack.
- Reuse workspace-node grants, heartbeat, D1 route targets, and explicit routing as the enrollment/control-plane substrate.
- Initial region remains `us-east1`; zone selection must be explicit and deterministic in the node plan.
- The VM and boot disk are replaceable. The data disk is a separately named retained resource with auto-delete disabled.
- The initial VM has no public IPv4 address. Administrative access is through IAP/OS Login-compatible policy.
- Bootstrap uses instance identity/metadata and approved device enrollment; no long-lived service-account key or embedded OAuth credential.

## notes for ko

- Branch 2 PR: https://github.com/consuelohq/opensaas/pull/1706
- Google OAuth is not currently required. I will stop immediately if the active gcloud session expires or a browser approval is required.

## improvements noticed

- none yet

## issues and recovery

- Branch 1 lifecycle tooling required fallbacks because `task/os/*` did not match `stream/os-cloud`. Branch 2 uses `task/os-cloud/*`, so standard task PR/finish operations should map correctly.
- The public bootstrap is macOS-specific, so the cloud node uses the existing signed runtime-bundle lifecycle contract plus a validated noninteractive onboarding descriptor rather than wrapping the macOS installer.
- The approved `websocket-relay` transport has no executable runtime client. Managed cloud enrollment therefore fails closed unless device authority returns the implemented Cloudflare Tunnel token, then activates both the durable cloudflared service and node-heartbeat timer before reporting enrolled.
- Existing install contract source assertions were stale after extracting the approved-grant mapper and after the site catalog moved to `sites/artifacts/data/catalog.json`; assertions were updated to current ownership and generated artifacts while behavior checks remained intact.

## TDD evidence

- `managed-cloud-node-instance-contract.test.ts`: red on missing node contract, then 4 passing tests.
- `gcloud-managed-cloud-node-instance.test.ts`: red on missing provider adapter, then 4 passing tests.
- `platform-managed-cloud-node-instance.test.ts`: red on missing shared service and CLI commands, then 3 passing tests.
- `managed-cloud-node-lifecycle-onboarding.test.ts`: red on missing headless onboarding, then 3 passing tests.
- `managed-cloud-node-enrollment.test.ts`: red on missing enrollment, denial propagation, tunnel enforcement, and service activation; now 5 passing tests.
- `managed-cloud-node-enrollment-cli.test.ts`: red on missing entrypoint, then 2 passing tests.
- `managed-cloud-node-linux-heartbeat.test.ts`: red because websocket-relay produced no heartbeat materialization, then passing with durable systemd service/timer.
- `managed-cloud-node-linux-connector.test.ts`: red on missing Linux cloudflared service, then passing with token-file isolation.
- Affected regression set: 55 passing tests across 13 files with destructive-literal preflight.
- Runtime portability regression: bundle build failed on a machine-specific absolute path, `managed-cloud-node-instance-contract.test.ts` was extended red, and all 4 node-domain tests pass after deriving the Linux account home at runtime.

## discovery

- Provider-neutral foundation ownership: `packages/os/scripts/lib/managed-cloud-node.ts`.
- GCP describe-before-create adapter: `packages/os/scripts/lib/gcloud-managed-cloud-node.ts`.
- Shared application service: `packages/os/scripts/lib/platform-managed-cloud-node.ts`.
- Operator CLI: `packages/os/scripts/managed-cloud-node.ts`.
- Enrollment registration: `cloudflare/os-device-authority/src/services/grants.ts` and workspace-node routes.
- Presence/heartbeat: `scripts/lib/workspace-node-heartbeat-client.ts` and device-authority node services.
- Explicit routing: `scripts/lib/workspace-cloudflare-d1-route-registry.ts`, connector registration, and edge router resolution.
- Local bootstrap precedent: `scripts/install.ts`, `scripts/lib/install-state.ts`, and install workspace bootstrap contract tests.

---

## publish checklist

```bash
bun run task:push -- --message "type(os-cloud): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/docs/distribution/release-channels.md`
- `packages/os/docs/linux-platform.md`
- `packages/os/package.json`
- `packages/os/scripts/build-runtime-bundle.ts`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/gcloud-managed-cloud-node.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/lifecycle/release.ts`
- `packages/os/scripts/lib/lifecycle/types.ts`
- `packages/os/scripts/lib/managed-cloud-node-enrollment.ts`
- `packages/os/scripts/lib/managed-cloud-node.ts`
- `packages/os/scripts/lib/managed-component-install.ts`
- `packages/os/scripts/lib/platform-managed-cloud-node.ts`
- `packages/os/scripts/lib/platforms/linux.ts`
- `packages/os/scripts/lib/workspace-connector-transport.ts`
- `packages/os/scripts/lib/workspace-device-authorization.ts`
- `packages/os/scripts/lib/workspace-device-login-client.ts`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/scripts/managed-cloud-node.ts`
- `packages/os/scripts/prepare-release-publication.ts`
- `packages/os/scripts/testing/distribution/runtime-fixture-server.ts`
- `packages/os/scripts/workspace-node-heartbeat.ts`
- `packages/os/tests/distribution/runtime-bundle.test.ts`
- `packages/os/tests/install-workspace-bootstrap-contract.test.ts`
- `packages/os/tests/linux-platform.test.ts`
- `packages/os/tests/managed-cloud-node-enrollment.test.ts`
- `packages/os/tests/platform-managed-cloud-node.test.ts`

- 2026-07-28 05:06:58 apply-patch: `packages/os/tests/managed-cloud-node-instance-contract.test.ts`
- 2026-07-28 05:07:24 apply-patch: `packages/os/scripts/lib/managed-cloud-node.ts`

- 2026-07-28 05:07:47 apply-patch: `.task/os-cloud/provision-and-validate-first-managed-gcp-cloud-node/workpad.md`

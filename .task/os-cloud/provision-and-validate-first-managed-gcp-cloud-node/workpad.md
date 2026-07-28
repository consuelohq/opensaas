# provision and validate first managed GCP cloud node

branch: `task/os-cloud/provision-and-validate-first-managed-gcp-cloud-node`
stream: `stream/os-cloud`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1706/provision-and-validate-first-managed-gcp-cloud-node
github pr: https://github.com/consuelohq/opensaas/pull/1706
started: 2026-07-28

## acceptance criteria

- [x] Extend the provider-neutral managed-node contract with a deterministic zonal node plan and lifecycle operations.
- [x] Model the VM and boot disk as replaceable while the separately named data disk is retained by default and has auto-delete disabled.
- [x] Implement idempotent GCP ensure operations for the data disk, snapshot-policy attachment, VM, boot configuration, Shielded VM settings, no-public-IP networking, and instance service account.
- [x] Generate deterministic bootstrap metadata that mounts the durable disk, installs/starts Consuelo OS, and exposes no long-lived cloud credential.
- [x] Use the existing device-authority workspace-node enrollment, heartbeat, D1 route target, and explicit routing contracts; do not create a parallel node registry.
- [x] Add product/operator `plan` and `apply` surfaces through the same application boundary the eventual one-click UI will call.
- [x] Provision Ko's first GCP-backed Consuelo OS node only after focused red/green tests and a zero-mutation plan review.
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
- Runtime-bundle closure regression: the customer archive must include `scripts/lib/distribution/runtime-bundle.ts` because lifecycle state and release activation import it at runtime. The focused test must fail while the whole distribution directory is classified source-only, then pass after the narrow runtime classification fix.
- Clean customer onboarding regression: an extracted runtime archive must complete noninteractive cloud install, create normal OS configuration, and keep operator-only content absent.

## current status

- Branch 1 merged into `stream/os-cloud` as PR #1693 with 43 passing CI checks.
- Branch 2 started from merged stream head as PR #1706.
- Discovery completed across the managed-node foundation, GCP adapter, device-authority grants/nodes, heartbeat client, D1 route registry, edge router, installer bootstrap, and lifecycle endpoint.
- Provider-neutral node planning, retained data-disk semantics, GCP disk/VM idempotency, headless lifecycle onboarding, device-code enrollment, Linux connector/heartbeat materialization, dual-service activation, and immutable cloudflared bootstrap are implemented test-first.
- The complete affected contract set passes: 89 tests across 15 executed files; 10 install-contract tests are environment-gated and skipped by their existing test harness.
- Official cloudflared bootstrap is pinned to release `2026.7.3`, Linux amd64, SHA-256 `9d71c677db00134c1bd4144b7783486b654ad281b1ea62b4972098d19f770f17` from Cloudflare's release API.
- A dedicated private release bucket `consuelo-cloud-dev-igg2mr-os-releases-f401931d` exists in `us-east1`; anonymous reads return HTTP 403 and the managed-node service account has object-viewer access.
- Private release delivery is implemented test-first: lifecycle can obtain cached short-lived bearer authorization from the GCE metadata service, and both initial bundle download and channel/bundle lifecycle requests use that identity. No access token is embedded in Git, metadata, logs, URLs, or the node config.
- The zero-mutation node plan exposed a missing egress prerequisite: Private Google Access reaches GCS but does not provide general outbound internet for Debian, Bun, or the pinned Cloudflare binary. Cloud Router `consuelo-os-cloud-us-east1-router` and Cloud NAT `consuelo-os-cloud-us-east1-nat` are now part of the idempotent foundation contract.
- Real GCP foundation apply created exactly the router and NAT while the previous 18 operations remained unchanged; a second apply proved 20/20 operations `unchanged`.
- The foundation now explicitly includes IAP and OS Login APIs. A real apply against billing account `011207-DC066E-D19981` proved 22/22 operations `unchanged`.
- The first runtime-bundle build correctly failed the portability gate because the bootstrap hardcoded `/home/consuelo`. A focused red regression now requires passwd-derived `CONSUELO_USER_HOME` and `BUN_BIN`; the bootstrap no longer embeds a machine/user-specific home path.
- VM `consuelo-ko-cloud-1` is RUNNING in `us-east1-b` with no external IP, Shielded VM enabled, and service account `consuelo-os-node@consuelo-cloud-dev-igg2mr.iam.gserviceaccount.com`.
- Durable disk `consuelo-ko-cloud-1-data` is READY, attached read-write with auto-delete disabled, and protected by the daily 90-day and weekly 1-year snapshot schedules. A second node apply proved all 4 node operations `unchanged`.
- IAP/OS Login access succeeds. The first guest bootstrap mounted the retained disk and verified both the signed runtime archive and cloudflared, then failed before activation because the archive excluded `scripts/lib/distribution/runtime-bundle.ts`.
- The runtime-closure repair is green: all 19 bundle tests pass, and an extracted real customer archive successfully starts `scripts/lifecycle.ts status` on a clean temporary home.
- After the executable-closure repair, the second real bootstrap reached lifecycle onboarding and failed because `provisionLocalOs` treated the intentionally excluded `operator/` directory as mandatory. Release policy requires operator-only content to remain outside customer bundles; clean customer installs must skip that optional materialization rather than fail.
- After skipping absent operator-only prompts, the clean-archive regression advances to artifact-site generation and fails because the bundle omits the proven runtime dependency `assets/consuelo-mark.png`.
- Clean customer onboarding is now green: the extracted archive completes noninteractive cloud installation, explicitly skips absent operator-only prompts, includes the exact required `assets/consuelo-mark.png`, creates normal OS state, and leaves `operator/` absent. All 22 full-source installer tests still materialize operator prompts for local source installs.
- Remaining runtime work: publish a new signed immutable archive, rerun guest bootstrap, complete device authorization, prove connector/heartbeat/routing readiness, and execute the non-destructive lifecycle/recovery validation matrix.

## files changed

- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/managed-cloud-node.ts`
- `packages/os/tests/distribution/runtime-bundle.test.ts`
- `packages/os/tests/managed-cloud-node-contract.test.ts`
- `packages/os/tests/platform-managed-cloud-node.test.ts`


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-28 04:59:00 `review.run`: passed — OK
- 2026-07-28 05:01:03 `review.run`: passed — OK
- 2026-07-28 05:08:04 `review.run`: passed — OK
- 2026-07-28 05:19:59 `review.run`: passed — OK
- 2026-07-28 05:36:24 `review.run`: passed — OK
- 2026-07-28 06:01:15 `review.run`: passed — OK
- 2026-07-28 06:50:49 `review.run`: passed — OK
- 2026-07-28 06:51:07 `verify`: passed — OK

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
- Google Cloud organization policy rejected `allUsers` object-viewer access on the task release bucket. No public grant was applied and no object was uploaded. Recovery is a private bucket plus managed-node service-account object viewer and GCE metadata bearer authentication.
- The first real VM bootstrap downloaded and digest-verified the signed runtime and cloudflared, then failed before lifecycle activation with `Cannot find module '../distribution/runtime-bundle'` from `scripts/lib/lifecycle/state.ts`. The bundle policy excluded a module used by the shipped lifecycle runtime; Branch 2 owns the executable-closure repair and artifact replacement.
- After the executable-closure repair, the second real bootstrap reached lifecycle onboarding and failed because `provisionLocalOs` treated the intentionally excluded `operator/` directory as mandatory. The customer runtime must skip absent operator-only prompts while preserving normal full-source installs.
- The clean-install regression then exposed one required customer asset: `scripts/lib/artifacts.ts` reads `assets/consuelo-mark.png` while materializing the canonical Artifacts site. Only that exact asset should enter discovery; unrelated screenshot fixtures remain excluded.

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
- `lifecycle-gcp-metadata-release-source.test.ts`: red on missing metadata-token authentication and authenticated release requests, then 3 passing tests covering token caching, required headers, manifest/bundle authorization, and fail-closed responses.
- Router/NAT foundation regression: domain/provider tests were red on missing egress resources, then passed with deterministic planning, exact describe-before-create argv, real 20-operation idempotency, and explicit NAT drift rejection.
- IAP/OS Login service regression: the foundation contract was red while those APIs were absent, then passed after both services were added; real provider apply reports 22/22 resources unchanged.
- Runtime executable-closure regression: the bundle suite was red on classification and real-archive inventory, then 19/19 passed after narrowly classifying `scripts/lib/distribution/runtime-bundle.ts` as runtime content. The real-archive test now extracts the customer bundle and starts the bundled lifecycle CLI.
- Clean customer onboarding regression: red on the exact missing-operator guest failure, then red on the missing `assets/consuelo-mark.png` runtime dependency, then green after optional operator materialization and exact asset discovery/classification.
- Current affected validation: 89 passing tests, 10 existing environment-gated skips, and no destructive-literal preflight findings.

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
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/scripts/lib/gcloud-managed-cloud-node.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/lifecycle/release.ts`
- `packages/os/scripts/lib/lifecycle/state.ts`
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
- `packages/os/tests/gcloud-managed-cloud-node.test.ts`
- `packages/os/tests/install-workspace-bootstrap-contract.test.ts`
- `packages/os/tests/lifecycle-engine.test.ts`
- `packages/os/tests/linux-platform.test.ts`
- `packages/os/tests/managed-cloud-node-contract.test.ts`
- `packages/os/tests/managed-cloud-node-enrollment.test.ts`
- `packages/os/tests/platform-managed-cloud-node.test.ts`
- `packages/workspace/senior-engineer.md`

- 2026-07-28 06:48:04 apply-patch: `packages/os/scripts/lib/distribution/runtime-bundle.ts`

- 2026-07-28 06:48:56 apply-patch: `.task/os-cloud/provision-and-validate-first-managed-gcp-cloud-node/workpad.md`

- 2026-07-28 06:49:25 apply-patch: `.task/os-cloud/provision-and-validate-first-managed-gcp-cloud-node/workpad.md`

- 2026-07-28 06:50:21 apply-patch: `.task/os-cloud/provision-and-validate-first-managed-gcp-cloud-node/workpad.md`

## workspace-owned: test selection

- changed files: `.task/os-cloud/provision-and-validate-first-managed-gcp-cloud-node/current.json`, `.task/os-cloud/provision-and-validate-first-managed-gcp-cloud-node/read-log.json`, `.task/os-cloud/provision-and-validate-first-managed-gcp-cloud-node/session.json`, `.task/os-cloud/provision-and-validate-first-managed-gcp-cloud-node/workpad.md`, `.task/tasks/os-cloud/provision-and-validate-first-managed-gcp-cloud-node.json`, `packages/os/scripts/lib/distribution/runtime-bundle.ts`, `packages/os/scripts/lib/install-state.ts`, `packages/os/tests/distribution/runtime-bundle.test.ts`
- matched rules: `auto:@consuelo/os:package-test`
- selected suites: `@consuelo/os package test`
- run results: `@consuelo/os package test` passed
- failed suites: none

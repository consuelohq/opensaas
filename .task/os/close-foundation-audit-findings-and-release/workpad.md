
## acceptance criteria

- Consolidate production fixes from superseded OS audit and implementation PRs onto the Foundation 2 merged base.
- Verify every still-valid review finding from PRs 1714, 1710, 1708, 1707, 1706, 1696, 1695, and 1688; fix code findings and preserve audit reports only as evidence.
- Keep Consuelo local-agent, Caddy, Cloudflare, multi-node, platform, distribution, and managed-cloud security boundaries fail-closed.
- Create one replacement task PR, close superseded audit/implementation PRs after replacement coverage is durable, merge through stream/os, and promote the verified stream PR to main.
- Do not mutate the live Consuelo installation during repository consolidation.

## discovery

- Foundation 2 PR 1714 is merged into main; stream/os was synced to that base before this task.
- Audit PRs 1708, 1707, 1696, and 1688 now differ from main primarily by audit evidence/report files.
- PR 1695 is empty relative to main.
- PR 1710 contains local-agent/Caddy lifecycle implementation and three actionable review findings.
- PR 1706 contains the managed GCP cloud-node implementation and requires final review/CI disposition.

## Test-first contract

### Behavior under test

- Hosted and repair installs resolve the active runtime bridge and flattened managed Caddy state, and verify each configured agent credential independently.
- Cloudflare publication fails closed for missing secrets and omitted child sites without per-request hashing overhead.
- Multi-node heartbeats reject malformed connector state, bound nonce storage, report real connector health, schedule on supported platforms, and migrate existing D1 schemas safely.
- Managed GCP apply detects security, disk, budget, enrollment, and service drift on an existing node.

### Focused red command

Run the smallest existing contract for each verified finding before implementation; add a regression test when the current suite does not fail.

### Expected red failure

Each still-valid review finding should reproduce as a focused failing assertion or receive a documented stale/no-test disposition before production edits.

## Lifecycle and ingress repair consolidation

- Imported the tested product changes from PR #1710 onto the Foundation 2 stream while preserving the availability daemon, current device identity flow, and current uninstall coverage.
- Added red regressions for hosted MCP runtime resolution, flattened Caddy install state, and independent per-agent credential verification.
- Fixed the installed consuelo-mcp bridge to prefer runtime/current/packages/os/scripts/mcp-stdio.ts with an explicit source-install fallback.
- Fixed LaunchAgent repair to reload the flattened .consuelo/.env and fall back to the pinned .consuelo/bin/caddy.
- Fixed verification to probe and persist each configured local agent independently instead of applying the first agent result to every client.
- Focused result: 73 passed, 10 skipped across lifecycle, bridge, installer, install-state, and port-cutover suites.

## workspace-owned: validation evidence

- 2026-07-29 03:41:53 `verify`: failed — COMMAND_FAILED
- 2026-07-29 03:46:11 `verify`: failed — COMMAND_FAILED
- 2026-07-29 03:47:07 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.github/workflows/consuelo-os-distribution-environments.yaml`, `.github/workflows/consuelo-os-runtime-publish.yaml`, `.task/os/close-foundation-audit-findings-and-release/current.json`, `.task/os/close-foundation-audit-findings-and-release/session.json`, `.task/os/close-foundation-audit-findings-and-release/workpad.md`, `.task/tasks/os/close-foundation-audit-findings-and-release.json`, `packages/os/SCRIPTS.md`, `packages/os/cloudflare/os-device-authority/src/routes/device.ts`, `packages/os/cloudflare/os-device-authority/src/routes/google-oauth.ts`, `packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts`, `packages/os/cloudflare/os-device-authority/src/services/connectors.ts`, `packages/os/cloudflare/os-device-authority/src/services/grants.ts`, `packages/os/cloudflare/os-device-authority/src/services/nodes.ts`, `packages/os/cloudflare/os-device-authority/src/stores.ts`, `packages/os/cloudflare/os-device-authority/src/types.ts`, `packages/os/cloudflare/os-device-authority/wrangler.toml`, `packages/os/cloudflare/workspace-edge/migrations/0003_current_route_target_kinds.sql`, `packages/os/cloudflare/workspace-edge/wrangler.toml`, `packages/os/package.json`, `packages/os/scripts/bootstrap.sh`, `packages/os/scripts/deploy-cloudflare-worker.ts`, `packages/os/scripts/generate-system-daemons.sh`, `packages/os/scripts/install-system-daemons.sh`, `packages/os/scripts/install.ts`, `packages/os/scripts/lib/cloudflare-worker-release-readiness.ts`, `packages/os/scripts/lib/device-authority-release-readiness.ts`, `packages/os/scripts/lib/distribution/release-channel-provider.ts`, `packages/os/scripts/lib/distribution/runtime-bundle.ts`, `packages/os/scripts/lib/gcloud-managed-cloud-node.ts`, `packages/os/scripts/lib/install-edge-site-publisher.ts`, `packages/os/scripts/lib/install-state.ts`, `packages/os/scripts/lib/lifecycle/engine.ts`, `packages/os/scripts/lib/lifecycle/release.ts`, `packages/os/scripts/lib/lifecycle/retention.ts`, `packages/os/scripts/lib/lifecycle/runtime-release-path.ts`, `packages/os/scripts/lib/local-agent-connectivity.ts`, `packages/os/scripts/lib/local-agent-mcp-bridge.ts`, `packages/os/scripts/lib/managed-cloud-node-enrollment.ts`, `packages/os/scripts/lib/managed-cloud-node.ts`, `packages/os/scripts/lib/platform-managed-cloud-node.ts`, `packages/os/scripts/lib/platforms/linux.ts`, `packages/os/scripts/lib/security-gateway.ts`, `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`, `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`, `packages/os/scripts/lib/workspace-device-login-client.ts`, `packages/os/scripts/lib/workspace-edge-route-seed.ts`, `packages/os/scripts/lib/workspace-node-heartbeat-client.ts`, `packages/os/scripts/lib/workspace-node-heartbeat-scheduler.ts`, `packages/os/scripts/lifecycle.ts`, `packages/os/scripts/managed-cloud-node-enroll.ts`, `packages/os/scripts/managed-cloud-node.ts`, `packages/os/scripts/mcp-stdio.ts`, `packages/os/scripts/server/main.ts`, `packages/os/scripts/start-caddy-daemon.sh`, `packages/os/scripts/start-consuelo-daemon.sh`, `packages/os/scripts/start-portless-daemon.sh`, `packages/os/scripts/uninstall-system-daemons.sh`, `packages/os/scripts/verify-local-agents.ts`, `packages/os/scripts/verify.js`, `packages/os/scripts/workspace-node-heartbeat.ts`, `packages/os/tests/cloudflare-connector-transport-contract.test.ts`, `packages/os/tests/cloudflare-edge-router.test.ts`, `packages/os/tests/cloudflare-worker-deployment-contract.test.ts`, `packages/os/tests/cloudflare-worker-release-readiness.test.ts`, `packages/os/tests/distribution/release-channel-provider-retries.test.ts`, `packages/os/tests/distribution/release-channel-workflows.test.ts`, `packages/os/tests/distribution/runtime-bundle.test.ts`, `packages/os/tests/distribution/workflow-contract.test.ts`, `packages/os/tests/finish-line-lifecycle-contract.test.ts`, `packages/os/tests/gcloud-managed-cloud-node-instance.test.ts`, `packages/os/tests/gcloud-managed-cloud-node.test.ts`, `packages/os/tests/install-edge-site-publisher.test.ts`, `packages/os/tests/install-state.test.ts`, `packages/os/tests/install-workspace-bootstrap-contract.test.ts`, `packages/os/tests/installer-local-agent-connectivity.test.ts`, `packages/os/tests/installer-runtime-dependencies.test.ts`, `packages/os/tests/lifecycle-engine.test.ts`, `packages/os/tests/lifecycle-gcp-metadata-release-source.test.ts`, `packages/os/tests/lifecycle-retention-uninstall.test.ts`, `packages/os/tests/linux-platform.test.ts`, `packages/os/tests/local-agent-connectivity.test.ts`, `packages/os/tests/local-agent-mcp-bridge.test.ts`, `packages/os/tests/local-os-port-cutover.test.ts`, `packages/os/tests/managed-cloud-node-contract.test.ts`, `packages/os/tests/managed-cloud-node-enrollment-cli.test.ts`, `packages/os/tests/managed-cloud-node-enrollment.test.ts`, `packages/os/tests/managed-cloud-node-instance-contract.test.ts`, `packages/os/tests/managed-cloud-node-lifecycle-onboarding.test.ts`, `packages/os/tests/managed-cloud-node-linux-connector.test.ts`, `packages/os/tests/managed-cloud-node-linux-heartbeat.test.ts`, `packages/os/tests/managed-cloud-review-regressions.test.ts`, `packages/os/tests/os-device-authority-release-contract.test.ts`, `packages/os/tests/os-device-authority-worker.test.ts`, `packages/os/tests/platform-managed-cloud-node-instance.test.ts`, `packages/os/tests/platform-managed-cloud-node.test.ts`, `packages/os/tests/verification.test.js`, `packages/os/tests/windows-platform.test.ts`, `packages/os/tests/workspace-cloudflare-d1-migration-regression.test.ts`, `packages/os/tests/workspace-edge-route-seed-contract.test.ts`, `packages/os/tests/workspace-node-heartbeat-client.test.ts`, `packages/os/tests/workspace-node-heartbeat-scheduler.test.ts`, `packages/os/tests/workspace-node-registry-routing.test.ts`, `packages/os/tests/workspace-site-snapshot-publishing.test.ts`, `packages/workspace/scripts/os-release-device-auth.ts`
- matched rules: `auto:@consuelo/os:package-test`
- selected suites: `@consuelo/os package test`
- run results: `@consuelo/os package test` passed
- failed suites: none

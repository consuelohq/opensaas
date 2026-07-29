# address foundation mainline review blockers

branch: `task/os/address-foundation-mainline-review-blockers`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1717/address-foundation-mainline-review-blockers
github pr: https://github.com/consuelohq/opensaas/pull/1717
started: 2026-07-29

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Review round 2 findings are fixed locally; focused and expanded lifecycle validation are green before republish.

## files changed

- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/local-agent-connectivity.ts`
- `packages/os/scripts/lib/platforms/linux.ts`
- `packages/os/tests/finish-line-lifecycle-contract.test.ts`
- `packages/os/tests/local-agent-connectivity.test.ts`
- `packages/os/tests/managed-cloud-node-linux-connector.test.ts`
- `packages/os/tests/managed-cloud-node-linux-heartbeat.test.ts`


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-29 04:08:54 `verify`: passed — OK
- 2026-07-29 04:21:38 `verify`: passed — OK
- 2026-07-29 04:24:45 `verify`: passed — OK

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

## Mainline P1 review discovery

- Review blocker: immutable runtime MCP wrapper must resolve runtime/current/scripts/mcp-stdio.ts.
- Review blocker: managed Linux systemd user units must be written under the actual user config home, not CONSUELO_HOME.
- Test-first contract: add focused failing regressions for both production install layouts before implementation.

## Test-first red contracts

- Added regression assertions for the immutable runtime MCP path.
- Added distinct runtime-home and user-home fixtures for Linux cloudflared and heartbeat systemd materialization.

## Red result

- Focused run: 3 files failed, with exactly one expected regression failure in each file.
- Implementation: corrected runtime/current MCP entrypoint and separated runtimeHome from userHome for Linux user units.

## workspace-owned: test selection

- changed files: `.github/workflows/consuelo-os-distribution-environments.yaml`, `.github/workflows/consuelo-os-runtime-publish.yaml`, `.task/os/address-foundation-mainline-review-blockers/current.json`, `.task/os/address-foundation-mainline-review-blockers/session.json`, `.task/os/address-foundation-mainline-review-blockers/verify.json`, `.task/os/address-foundation-mainline-review-blockers/workpad.md`, `.task/os/close-foundation-audit-findings-and-release/current.json`, `.task/os/close-foundation-audit-findings-and-release/session.json`, `.task/os/close-foundation-audit-findings-and-release/verify.json`, `.task/os/close-foundation-audit-findings-and-release/workpad.md`, `.task/tasks/os/address-foundation-mainline-review-blockers.json`, `.task/tasks/os/close-foundation-audit-findings-and-release.json`, `packages/os/SCRIPTS.md`, `packages/os/cloudflare/os-device-authority/src/routes/device.ts`, `packages/os/cloudflare/os-device-authority/src/routes/google-oauth.ts`, `packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts`, `packages/os/cloudflare/os-device-authority/src/services/connectors.ts`, `packages/os/cloudflare/os-device-authority/src/services/grants.ts`, `packages/os/cloudflare/os-device-authority/src/services/nodes.ts`, `packages/os/cloudflare/os-device-authority/src/stores.ts`, `packages/os/cloudflare/os-device-authority/src/types.ts`, `packages/os/cloudflare/os-device-authority/wrangler.toml`, `packages/os/cloudflare/workspace-edge/migrations/0003_current_route_target_kinds.sql`, `packages/os/cloudflare/workspace-edge/wrangler.toml`, `packages/os/package.json`, `packages/os/scripts/bootstrap.sh`, `packages/os/scripts/deploy-cloudflare-worker.ts`, `packages/os/scripts/generate-system-daemons.sh`, `packages/os/scripts/install-system-daemons.sh`, `packages/os/scripts/install.ts`, `packages/os/scripts/lib/cloudflare-worker-release-readiness.ts`, `packages/os/scripts/lib/device-authority-release-readiness.ts`, `packages/os/scripts/lib/distribution/release-channel-provider.ts`, `packages/os/scripts/lib/distribution/runtime-bundle.ts`, `packages/os/scripts/lib/gcloud-managed-cloud-node.ts`, `packages/os/scripts/lib/install-edge-site-publisher.ts`, `packages/os/scripts/lib/install-state.ts`, `packages/os/scripts/lib/lifecycle/engine.ts`, `packages/os/scripts/lib/lifecycle/release.ts`, `packages/os/scripts/lib/lifecycle/retention.ts`, `packages/os/scripts/lib/lifecycle/runtime-release-path.ts`, `packages/os/scripts/lib/local-agent-connectivity.ts`, `packages/os/scripts/lib/local-agent-mcp-bridge.ts`, `packages/os/scripts/lib/managed-cloud-node-enrollment.ts`, `packages/os/scripts/lib/managed-cloud-node.ts`, `packages/os/scripts/lib/platform-managed-cloud-node.ts`, `packages/os/scripts/lib/platforms/linux.ts`, `packages/os/scripts/lib/security-gateway.ts`, `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`, `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`, `packages/os/scripts/lib/workspace-device-login-client.ts`, `packages/os/scripts/lib/workspace-edge-route-seed.ts`, `packages/os/scripts/lib/workspace-node-heartbeat-client.ts`, `packages/os/scripts/lib/workspace-node-heartbeat-scheduler.ts`, `packages/os/scripts/lifecycle.ts`, `packages/os/scripts/managed-cloud-node-enroll.ts`, `packages/os/scripts/managed-cloud-node.ts`, `packages/os/scripts/mcp-stdio.ts`, `packages/os/scripts/server/main.ts`, `packages/os/scripts/start-caddy-daemon.sh`, `packages/os/scripts/start-consuelo-daemon.sh`, `packages/os/scripts/start-portless-daemon.sh`, `packages/os/scripts/uninstall-system-daemons.sh`, `packages/os/scripts/verify-local-agents.ts`, `packages/os/scripts/verify.js`, `packages/os/scripts/workspace-node-heartbeat.ts`, `packages/os/tests/cloudflare-connector-transport-contract.test.ts`, `packages/os/tests/cloudflare-edge-router.test.ts`, `packages/os/tests/cloudflare-worker-deployment-contract.test.ts`, `packages/os/tests/cloudflare-worker-release-readiness.test.ts`, `packages/os/tests/distribution/release-channel-provider-retries.test.ts`, `packages/os/tests/distribution/release-channel-workflows.test.ts`, `packages/os/tests/distribution/runtime-bundle.test.ts`, `packages/os/tests/distribution/workflow-contract.test.ts`, `packages/os/tests/finish-line-lifecycle-contract.test.ts`, `packages/os/tests/gcloud-managed-cloud-node-instance.test.ts`, `packages/os/tests/gcloud-managed-cloud-node.test.ts`, `packages/os/tests/install-edge-site-publisher.test.ts`, `packages/os/tests/install-state.test.ts`, `packages/os/tests/install-workspace-bootstrap-contract.test.ts`, `packages/os/tests/installer-local-agent-connectivity.test.ts`, `packages/os/tests/installer-runtime-dependencies.test.ts`, `packages/os/tests/lifecycle-engine.test.ts`, `packages/os/tests/lifecycle-gcp-metadata-release-source.test.ts`, `packages/os/tests/lifecycle-retention-uninstall.test.ts`, `packages/os/tests/linux-platform.test.ts`, `packages/os/tests/local-agent-connectivity.test.ts`, `packages/os/tests/local-agent-mcp-bridge.test.ts`, `packages/os/tests/local-os-port-cutover.test.ts`, `packages/os/tests/managed-cloud-node-contract.test.ts`, `packages/os/tests/managed-cloud-node-enrollment-cli.test.ts`, `packages/os/tests/managed-cloud-node-enrollment.test.ts`, `packages/os/tests/managed-cloud-node-instance-contract.test.ts`, `packages/os/tests/managed-cloud-node-lifecycle-onboarding.test.ts`, `packages/os/tests/managed-cloud-node-linux-connector.test.ts`, `packages/os/tests/managed-cloud-node-linux-heartbeat.test.ts`, `packages/os/tests/managed-cloud-review-regressions.test.ts`, `packages/os/tests/os-device-authority-release-contract.test.ts`, `packages/os/tests/os-device-authority-worker.test.ts`, `packages/os/tests/platform-managed-cloud-node-instance.test.ts`, `packages/os/tests/platform-managed-cloud-node.test.ts`, `packages/os/tests/verification.test.js`, `packages/os/tests/windows-platform.test.ts`, `packages/os/tests/workspace-cloudflare-d1-migration-regression.test.ts`, `packages/os/tests/workspace-edge-route-seed-contract.test.ts`, `packages/os/tests/workspace-node-heartbeat-client.test.ts`, `packages/os/tests/workspace-node-heartbeat-scheduler.test.ts`, `packages/os/tests/workspace-node-registry-routing.test.ts`, `packages/os/tests/workspace-site-snapshot-publishing.test.ts`, `packages/workspace/scripts/os-release-device-auth.ts`
- matched rules: `auto:@consuelo/os:package-test`
- selected suites: `@consuelo/os package test`
- run results: `@consuelo/os package test` passed
- failed suites: none

## Review round 2 findings and fixes

- P1: updated the finish-line lifecycle contract to require the immutable `runtime/current/scripts/mcp-stdio.ts` entrypoint.
- P2: provisioning detection now uses the explicit `userHome` for no-selection and returned post-write state.
- P2: Linux cloudflared and heartbeat units preserve `XDG_CONFIG_HOME` while keeping `CONSUELO_HOME` pointed at runtime data.
- Repaired the already-stale Caddy contract assertion to match the actual managed-ingress input while retaining the 127.0.0.1 and Caddy checks.

## Review round 2 validation

- Focused red: the added user-home and XDG regressions failed before the implementation fix; the existing finish-line contract also exposed its stale Caddy assertion.
- Focused green: 4 files, 21 tests passed.
- Expanded lifecycle green: 16 files, 71 tests passed.
- `bun run typecheck`: passed.
- `git diff --check`: passed.

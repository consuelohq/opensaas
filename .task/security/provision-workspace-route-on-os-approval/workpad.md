# Provision workspace route on OS approval

## Acceptance criteria

- Approved OS device grants dynamically provision the approved workspace hostname into the workspace-edge route registry.
- The provisioning path uses the workspace slug/host from the live device request; no test host is hardcoded.
- The public installer still does not require operator Cloudflare credentials. Cloudflare D1/R2 mutations stay inside the os-device-authority control plane Worker.
- If route provisioning fails, the device grant must not be marked approved and the installer must not receive scoped bootstrap material that points at a missing hostname.
- Existing interactive install flow continues after silently resolving OS home; daemon installation remains the final prompt/background step.

## Test-first contract

Behavior under test:
- Google-backed device approval calls a workspace route provisioner with the dynamic workspace identity before marking the grant approved.
- Provisioning failures keep the grant pending and return an explicit approval failure instead of letting the installer finish with WORKSPACE_HOSTNAME_NOT_FOUND.
- The default route provisioner writes a per-workspace launcher snapshot to R2 and upserts D1 using the requested hostname/slug, not a fixed test route.

Existing pattern to follow:
- packages/os/tests/os-device-authority-worker.test.ts covers the device code/approval/access-token lifecycle with deterministic in-memory storage and mocked Google.
- packages/os/tests/install-edge-site-publisher.test.ts covers route snapshot shape and Cloudflare metadata expectations.

New or changed tests:
- Extend os-device-authority-worker tests with dynamic route provisioning success and failure cases.
- Add coverage for the exported route provisioner using fake D1/R2 bindings.

Focused red command:
- CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/os-device-authority-worker.test.ts

Expected red failure before implementation:
- Missing workspaceRouteProvisioner/createWorkspaceRouteProvisioner support and no route provisioning call during approval.

## Notes

Ko reported that a fresh approved hostname still returns WORKSPACE_HOSTNAME_NOT_FOUND after install. Earlier manual D1 repair only proved a specific hostname; this task fixes the real dynamic path.

## workspace-owned: validation evidence

- 2026-06-23 03:39:40 `review.run`: passed — OK
- 2026-06-23 03:40:23 `review.run`: passed — OK
- 2026-06-23 03:40:42 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/security/provision-workspace-route-on-os-approval/current.json`, `.task/security/provision-workspace-route-on-os-approval/session.json`, `.task/security/provision-workspace-route-on-os-approval/workpad.md`, `.task/tasks/security/provision-workspace-route-on-os-approval.json`, `packages/os/cloudflare/os-device-authority/src/index.ts`, `packages/os/cloudflare/os-device-authority/wrangler.toml`, `packages/os/tests/os-device-authority-worker.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## Implementation summary

- Added dynamic workspace route provisioning in os-device-authority.
- Approval now provisions a per-workspace launcher snapshot to R2 and upserts workspace_route_registry before marking the grant approved.
- If route provisioning fails, approval returns an error and the grant remains pending.
- Added D1/R2 bindings to the os-device-authority Worker config.
- Added tests proving dynamic hostnames are used and no fixed testing/mac-air-test route is embedded.

## Validation

- Red: CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/os-device-authority-worker.test.ts failed with missing provisioning behavior.
- Green: CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/os-device-authority-worker.test.ts passed, 9 tests.
- Green: CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/oauth-device-http-client.test.ts tests/oauth-device-onboarding-contract.test.ts tests/install-workspace-bootstrap-contract.test.ts passed, 15 tests.
- Green: CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/os-device-authority-worker.test.ts tests/oauth-device-http-client.test.ts tests/oauth-device-onboarding-contract.test.ts tests/install-workspace-bootstrap-contract.test.ts tests/install-edge-site-publisher.test.ts passed, 28 tests.
- Green: CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/bootstrap-source.test.ts passed, 7 tests.
- Green: wrangler deploy --dry-run --config cloudflare/os-device-authority/wrangler.toml showed DEVICE_GRANTS, WORKSPACE_ROUTE_REGISTRY, SITES_SNAPSHOTS bindings.
- Green: review.run --base origin/main found 0 issues.
- Green: verify --base origin/main --no-stamp publish-valid.

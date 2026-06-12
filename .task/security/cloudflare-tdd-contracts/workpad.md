# cloudflare tdd contracts

## Goal

Write red, opt-in TDD contracts for the next security stream implementation agent. Scope is tests only. The implementation agent should make these contracts green without weakening the tests.

## Source context

PR #896 landed the local installed security layer: generated auth, signed local routes, Caddy config, and local server protection.

PR #950 landed the Cloudflare route registry, edge router, provisioning planner, D1-style registry persistence, and POST body preservation contracts.

This task covers the next missing bridge: deployed Cloudflare Worker, D1 migration/Wrangler config, OAuth device onboarding, install workspace bootstrap, Cloudflare Tunnel connector launch, and final beta smoke plan.

## Test-first contract

Behavior under test:
- The repository ships a Wrangler-deployable `consuelo-workspace-edge` Worker under `packages/os/cloudflare/workspace-edge` with wildcard workspace route config, D1 binding, migration SQL, and package scripts.
- The Worker entrypoint composes `createWorkspaceCloudflareEdgeRouter` with `createWorkspaceCloudflareD1RouteRegistry` and uses Worker env bindings rather than Node process env.
- OAuth device onboarding starts without leaking credentials, polls with pending/slow_down behavior, and exchanges approval for workspace identity plus a short-lived connector bootstrap token.
- Installed OS provisioning accepts approved workspace bootstrap data and writes real workspace identity instead of `local-consuelo-os` placeholders.
- Connector bootstrap material stays out of config/auth/Caddy files.
- Connector setup plans a Cloudflare Tunnel launchd service that uses Consuelo-provisioned tunnel tokens and does not require a user Cloudflare login.
- A future WebSocket relay transport remains an explicit, disabled boundary instead of being the default ingress path.
- A final beta smoke plan verifies local health, local auth, replay denial, unknown/revoked edge hosts, Dialer via signed edge headers, and OS routes through the outbound connector.

## New contract tests

- `packages/os/tests/cloudflare-worker-deployment-contract.test.ts`
- `packages/os/tests/oauth-device-onboarding-contract.test.ts`
- `packages/os/tests/install-workspace-bootstrap-contract.test.ts`
- `packages/os/tests/cloudflare-connector-transport-contract.test.ts`
- `packages/os/tests/workspace-edge-beta-smoke-contract.test.ts`

## Focused commands

Default gated run should stay green/skipped:

```bash
bun --cwd packages/os test \
  tests/cloudflare-worker-deployment-contract.test.ts \
  tests/oauth-device-onboarding-contract.test.ts \
  tests/install-workspace-bootstrap-contract.test.ts \
  tests/cloudflare-connector-transport-contract.test.ts \
  tests/workspace-edge-beta-smoke-contract.test.ts
```

Focused red run for the implementation agent:

```bash
CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test \
  tests/cloudflare-worker-deployment-contract.test.ts \
  tests/oauth-device-onboarding-contract.test.ts \
  tests/install-workspace-bootstrap-contract.test.ts \
  tests/cloudflare-connector-transport-contract.test.ts \
  tests/workspace-edge-beta-smoke-contract.test.ts
```

## Current evidence

- Syntax check passed for all five new files.
- Default gated test run passed with 5 files skipped / 16 tests skipped.
- Opt-in red run failed as expected with 5 files failed / 16 tests failed. Primary failures are missing expected implementation files/modules and install provisioning still using local placeholders.

## Implementation notes for next agent

Implement, do not weaken, these expected surfaces:
- `packages/os/cloudflare/workspace-edge/wrangler.toml`
- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/os/cloudflare/workspace-edge/migrations/0001_workspace_route_registry.sql`
- package scripts: `cloudflare:workspace-edge:dev`, `cloudflare:workspace-edge:deploy:dry-run`, `cloudflare:workspace-edge:deploy`, `cloudflare:workspace-edge:migrate`, `smoke:workspace-edge`
- `packages/os/scripts/lib/workspace-device-authorization.ts`
- `packages/os/scripts/lib/workspace-connector-transport.ts`
- `packages/os/scripts/lib/workspace-edge-beta-smoke.ts`
- `provisionLocalOs({ workspaceBootstrap })` handling in `packages/os/scripts/lib/install-state.ts`

Stop condition: all five contract files pass when `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1` is set, and the default gated run stays green without requiring Cloudflare credentials.

- 2026-06-11 18:00:02 write: `.task/security/cloudflare-tdd-contracts/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-11 18:00:02 fs.write: `.task/security/cloudflare-tdd-contracts/workpad.md`

## workspace-owned: files read

- `packages/os/tests/cloudflare-connector-transport-contract.test.ts`
- `packages/os/tests/oauth-device-onboarding-contract.test.ts`

## workspace-owned: validation evidence

- 2026-06-11 18:01:41 `review.run`: passed — OK

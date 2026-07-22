# make workspace gateway contracts green

branch: `task/security/make-workspace-gateway-contracts-green`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/976/make-workspace-gateway-contracts-green
github pr: https://github.com/consuelohq/opensaas/pull/976
started: 2026-06-11

## acceptance criteria

- [x] Opt-in workspace gateway contracts pass with `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1`.
- [x] Default gated command remains green with contracts skipped/preserved by guard.
- [x] D1 route registry focused contract remains green.
- [x] Implement Cloudflare workspace-edge Worker, Wrangler config, D1 migration, package scripts, device authorization, connector transport, beta smoke planning, and installer workspace bootstrap handling.
- [x] Preserve security constraints: no durable connector bootstrap token persistence, no public direct-to-OS tunnel routing, Worker uses Cloudflare env bindings, D1 migration stores route/connector registry only, local OS remains behind `127.0.0.1` gateway upstream.
- [x] Run `review.run` against `stream/security` and `verify --base origin/stream/security` before publish.

## Test-first contract

Behavior under test:
- The opt-in workspace gateway contract suite proves the Cloudflare Worker deployment surface, OAuth device onboarding states, install bootstrap identity handling, connector transport plan, and beta smoke plan.
- The default gated run proves the contracts remain skipped unless explicitly opted in.
- The D1 route registry focused contract proves route resolution storage behavior remains green.

Existing local pattern followed:
- `packages/os/tests/*gateway*contract.test.ts` uses Vitest/Bun tests as executable architecture contracts with opt-in gates.
- Existing `packages/os/scripts/lib/workspace-cloudflare-*` modules model gateway planning surfaces and fail-closed route resolution without durable secret persistence.

New or changed tests:
- None. The user explicitly required preserving existing tests without weakening, skipping, deleting, loosening, or renaming them.

Focused red command:
```bash
CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test \
  tests/cloudflare-worker-deployment-contract.test.ts \
  tests/oauth-device-onboarding-contract.test.ts \
  tests/install-workspace-bootstrap-contract.test.ts \
  tests/cloudflare-connector-transport-contract.test.ts \
  tests/workspace-edge-beta-smoke-contract.test.ts
```

Red result:
- 2026-06-11: red as expected. 5 files failed, 16 contract tests failed.
- Meaningful failure signal: required implementation modules and deployment files were missing or incomplete, including `workspace-connector-transport.ts`, `workspace-device-authorization.ts`, `workspace-edge-beta-smoke.ts`, Cloudflare workspace-edge files, package scripts, and install-state workspace bootstrap handling.

## implementation summary

- Added Cloudflare workspace edge Worker under `packages/os/cloudflare/workspace-edge` with Wrangler config, D1 binding `WORKSPACE_ROUTE_REGISTRY`, fail-closed fetch handling, and no `process.env` usage.
- Added D1 migration for workspace hostname routes and connector registry tables/indexes. Migration contains registry metadata only and no tunnel credentials/signing/API secrets.
- Added package scripts for workspace edge dev, dry-run deploy, deploy, migrate, and smoke plan execution.
- Added device authorization helper with start/poll support for pending, slow_down, approval, denial, unknown, and expiry states. Approval returns real workspace identity and short-lived connector bootstrap material.
- Added connector transport planner that defaults OS ingress to Cloudflare Tunnel with Consuelo-provisioned token material handled by token file path, and keeps WebSocket relay as an explicit future/non-default transport boundary.
- Added beta smoke plan helper covering local health, protected route 401, signed local success, replay denial, unknown/revoked edge failure, Dialer route, and OS connector route.
- Updated installer bootstrap handling so approved workspace identity is written into installed `config.json` and generated auth material, while connector bootstrap tokens stay out of `config.json`, `auth.json`, and `Caddyfile`.
- Kept generated local gateway upstream bound to `127.0.0.1` through existing `createGatewaySecurityConfig` behavior.
- Added lazy imports for Bun-only runtime modules in installer/doctor paths so architecture contracts can import install-state under Vitest without pulling static `bun:sqlite` dependencies.

## files changed

- `packages/os/cloudflare/workspace-edge/migrations/0001_workspace_route_registry.sql`
- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/os/cloudflare/workspace-edge/wrangler.toml`
- `packages/os/package.json`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/workspace-connector-transport.ts`
- `packages/os/scripts/lib/workspace-device-authorization.ts`
- `packages/os/scripts/lib/workspace-edge-beta-smoke.ts`

## key decisions

- Cloudflare remains the public edge/router; the installed local OS server is not exposed directly as the public workspace host.
- Cloudflare Tunnel is the first OS ingress transport, but WebSocket relay remains separable and non-default.
- Durable local config records workspace identity and connector metadata only; token-bearing bootstrap material is excluded from `config.json`, `auth.json`, and `Caddyfile`.
- Worker runtime configuration is modeled as Cloudflare Worker env bindings, not Node `process.env`.
- Review static error-handling findings were fixed by adding fail-closed Worker fetch handling and D1 wrapper error wrapping.

## validation evidence

```bash
CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test \
  tests/cloudflare-worker-deployment-contract.test.ts \
  tests/oauth-device-onboarding-contract.test.ts \
  tests/install-workspace-bootstrap-contract.test.ts \
  tests/cloudflare-connector-transport-contract.test.ts \
  tests/workspace-edge-beta-smoke-contract.test.ts
```
- Pass: 5 files passed, 16 tests passed. Trace: `trc_d175aea7b0e3`.

```bash
bun --cwd packages/os test \
  tests/cloudflare-worker-deployment-contract.test.ts \
  tests/oauth-device-onboarding-contract.test.ts \
  tests/install-workspace-bootstrap-contract.test.ts \
  tests/cloudflare-connector-transport-contract.test.ts \
  tests/workspace-edge-beta-smoke-contract.test.ts
```
- Pass: 5 files skipped, 16 tests skipped by default gate. Trace: `trc_e7f098bbe309`.

```bash
CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/cloudflare-d1-route-registry.test.ts
```
- Pass: 1 file passed, 6 tests passed. Trace: `trc_f3b423ce9682`.

```bash
review.run against stream/security
```
- Pass: 0 your issues, 0 pre-existing issues, 0 blocking issues. Trace: `trc_08cbc68c1e9e`.

```bash
bun run verify -- --base origin/stream/security --json
```
- Pass: publish-valid true, review passed, DB guard passed with migration warning and 0 findings. Trace: `trc_db516e401560`.

## issues and recovery

- Initial implementation hit static `bun:sqlite` import failures when the install-state contract imported installer code under Vitest. Recovery: avoid static Bun-only imports on the contract import path and keep doctor/runtime-only imports lazy.
- Initial `review.run` reported two error-handling blockers. Recovery: add fail-closed Worker fetch try/catch and D1 registry wrapper try/catch.

## publish status

- Ready for `task.push`, `task.pr`, and stream review promotion.

- 2026-06-11 20:24:12 write: `.task/security/make-workspace-gateway-contracts-green/workpad.md`

# Refactor OS device authority into Hono boundaries

branch: `task/security/refactor-os-device-authority-hono-boundaries`
stream: `stream/security`
started: 2026-07-10

## acceptance criteria

- [x] Replace the 1,400-line device-authority entrypoint with a Hono HTTP composition layer.
- [x] Delete `src/index.ts`; Wrangler deploys `src/worker.ts`.
- [x] Preserve every existing route, method restriction, status, response body, header, Worker binding, and Durable Object export.
- [x] Keep grants, workspace membership, nodes, connector provisioning, OAuth, and MCP proxy logic framework-neutral.
- [x] Define an explicit route-policy contract for public, OAuth-protected, and internal/device-proof surfaces.
- [x] Keep Sites Gateway, workspace edge, Caddy, and provisioning-engine migrations out of scope.
- [x] Fix fail-closed behavior when the route registry is absent and preserve terminal diagnostics.
- [x] Keep credential redaction centralized and covered.
- [x] Existing worker, OAuth/onboarding, provisioning, and release behavior assertions pass unchanged.
- [x] Focused tests, typecheck, Wrangler dry run, review, and verify pass.

## plan

1. Add route-policy and entrypoint/deletion contracts while retaining the current black-box worker suite.
2. Add Hono to the Bun-owned OS package.
3. Extract types, stores, security helpers, services, and route modules with explicit dependencies.
4. Compose routes in `app.ts`, export Cloudflare wiring and Durable Object from `worker.ts`, and remove `index.ts`.
5. Run the existing worker suite after each extraction slice.
6. Run adjacent suites, typecheck, Wrangler dry run, review, verify, then promote through `stream/security`.

## test-first contract

- Existing black-box contract: `os-device-authority-worker.test.ts` must remain green without assertion rewrites.
- New architecture contract: Wrangler points to `src/worker.ts`, `src/index.ts` is absent, route policies enumerate all externally reachable surfaces, and route modules are composed by Hono.
- Security regression: route creation fails closed without a route registry and diagnostics redact bearer/token-shaped values.
- Expected initial red state: architecture contract fails because Wrangler still targets `src/index.ts`, the monolith exists, Hono is absent, and route policies are implicit.

## scope boundary

- Hono is used only for the device-authority Worker HTTP edge.
- Caddy remains generated proxy configuration.
- Connector provisioning remains a plain service.
- Sites Gateway and workspace edge remain separate Workers for later bounded tasks.
- Shared patterns are types and contracts, not a new generic framework.

- 2026-07-11 02:02:45 write: `.task/security/refactor-os-device-authority-hono-boundaries/workpad.md`

## implementation evidence

- Architecture contract began red on the old Wrangler entrypoint, retained monolith, and missing route policy; it is now green.
- Device-authority and installer regression set: 83 tests passed.
- Auth hardening contract: 5 tests passed.
- Cloudflare and workspace gateway provisioning contracts: 41 tests passed.
- OS syntax/typecheck passed.
- Wrangler dry run bundled `src/worker.ts` with `OsDeviceGrantDurableObject` and the existing D1/DO bindings.
- Legacy test formatting was restored; only import paths and required fail-closed success fixtures changed, with assertions left intact.
- Broad tests exposed and now cover generated node IDs ending in `-`, which previously broke reconnect lookup after normalization.

## review evidence

- Initial strict review found five error-boundary findings. The Hono wrapper now returns its promise directly, and route/security boundaries sanitize non-Error throws while preserving known errors and the existing centralized 500 response.
- Strict review rerun: 0 blocking issues.
- Verify: publish-valid stamp written against `HEAD`.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-07-11 02:02:45 fs.write: `.task/security/refactor-os-device-authority-hono-boundaries/workpad.md`

## workspace-owned: files read

- `packages/workspace/senior-engineer.md`

## workspace-owned: validation evidence

- 2026-07-11 02:23:55 `review.run`: passed — OK
- 2026-07-11 02:26:10 `review.run`: passed — OK
- 2026-07-11 02:26:30 `verify`: passed — OK
- 2026-07-11 02:26:59 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/security/refactor-os-device-authority-hono-boundaries/current.json`, `.task/security/refactor-os-device-authority-hono-boundaries/evidence-log.json`, `.task/security/refactor-os-device-authority-hono-boundaries/read-log.json`, `.task/security/refactor-os-device-authority-hono-boundaries/session.json`, `.task/security/refactor-os-device-authority-hono-boundaries/verify.json`, `.task/security/refactor-os-device-authority-hono-boundaries/workpad.md`, `.task/tasks/security/refactor-os-device-authority-hono-boundaries.json`, `packages/os/bun.lock`, `packages/os/cloudflare/os-device-authority/src/app.ts`, `packages/os/cloudflare/os-device-authority/src/constants.ts`, `packages/os/cloudflare/os-device-authority/src/http.ts`, `packages/os/cloudflare/os-device-authority/src/index.ts`, `packages/os/cloudflare/os-device-authority/src/routes/device.ts`, `packages/os/cloudflare/os-device-authority/src/routes/google-oauth.ts`, `packages/os/cloudflare/os-device-authority/src/routes/health.ts`, `packages/os/cloudflare/os-device-authority/src/routes/mcp-oauth.ts`, `packages/os/cloudflare/os-device-authority/src/routes/mcp-proxy.ts`, `packages/os/cloudflare/os-device-authority/src/security/device-auth.ts`, `packages/os/cloudflare/os-device-authority/src/security/redaction.ts`, `packages/os/cloudflare/os-device-authority/src/security/route-policies.ts`, `packages/os/cloudflare/os-device-authority/src/services/connectors.ts`, `packages/os/cloudflare/os-device-authority/src/services/google-oauth.ts`, `packages/os/cloudflare/os-device-authority/src/services/grants.ts`, `packages/os/cloudflare/os-device-authority/src/services/mcp-oauth.ts`, `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`, `packages/os/cloudflare/os-device-authority/src/stores.ts`, `packages/os/cloudflare/os-device-authority/src/types.ts`, `packages/os/cloudflare/os-device-authority/src/utils.ts`, `packages/os/cloudflare/os-device-authority/src/worker.ts`, `packages/os/cloudflare/os-device-authority/wrangler.toml`, `packages/os/package.json`, `packages/os/tests/os-device-approval-auth-hardening-contract.test.ts`, `packages/os/tests/os-device-authority-architecture.test.ts`, `packages/os/tests/os-device-authority-worker.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

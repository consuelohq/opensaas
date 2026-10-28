# Refactor local OS server onto Hono

branch: `task/security/refactor-local-os-server-onto-hono`
stream: `stream/security`
started from: current `main`
pr: https://github.com/consuelohq/opensaas/pull/1405

## acceptance criteria

- [x] Replace the flat `packages/os/scripts/server.ts` HTTP composition with a Hono application under `packages/os/scripts/server/`.
- [x] Keep Bun as the runtime and preserve loopback binding and configured port behavior (`CONSUELO_OS_PORT`, then `PORT`, then `8960`).
- [x] Preserve every current route, accepted method, status code, response body, content type, auth challenge/header, security ordering, MCP JSON-RPC behavior, trace behavior, and lazy OS runtime loading.
- [x] Keep existing security/domain modules framework-neutral; Hono owns only HTTP composition and middleware.
- [x] Move the canonical runtime entrypoint to `packages/os/scripts/server/main.ts` and delete the old flat `packages/os/scripts/server.ts` after all imports/spawn paths are updated.
- [x] Correct health metadata so `toolNames` is exactly `['get_steering', 'call']` and `tools` is `2`; expose MCP separately as protocol/endpoint metadata without changing `/mcp` behavior.
- [x] Add architecture and route-behavior preservation tests before production edits.
- [x] Do not perform the later prelaunch port cutover or unrelated cleanup.
- [x] Focused server/security tests, OS typecheck, strict review, and verify pass.
- [x] Push and promote through `stream/security` for review; stop at the stream PR.

## plan

1. Inventory the current route/method/auth matrix and all entrypoint/import references.
2. Add an architecture contract for `server/main.ts`, Hono composition, deletion of the old flat server, and Bun/LaunchAgent/package entrypoints.
3. Add table-driven black-box route preservation coverage, including health metadata and MCP protocol separation.
4. Run focused tests red against the current flat server.
5. Extract environment, responses, security middleware, services, and route modules without changing existing domain/security modules.
6. Compose `createLocalOsApp` in Hono and export a compatibility `handleRequest` from the new app boundary for existing black-box tests.
7. Move Bun startup to `server/main.ts`; update package scripts, daemon wrappers, process detection, and test imports/spawns; delete `scripts/server.ts`.
8. Run focused green suites, process-level loopback smoke, typecheck, strict review, verify, then publish.

## test-first contract

- Behavior under test: the local Bun server is composed by Hono from explicit route modules while all existing HTTP/security/MCP behavior remains byte-compatible at the contract level.
- Existing local pattern: `mcp-gateway.test.ts`, `security-gateway.test.ts`, `dangerous-material-policy.test.ts`, and `os-raw-steering.test.ts` exercise `handleRequest` and process-level server behavior.
- New architecture test: `packages/os/tests/local-os-server-hono-architecture.test.ts`.
- New/changed behavior coverage: table-driven method/path checks against the real app handler; health asserts exactly two server-visible tools and separate MCP protocol metadata; existing route/security suites remain unchanged except import/spawn paths.
- Focused red command: `bun --cwd packages/os vitest run tests/local-os-server-hono-architecture.test.ts tests/os-raw-steering.test.ts`.
- Expected red failure: `scripts/server/main.ts` and Hono route composition do not exist, old `scripts/server.ts` still exists, entrypoint references still point to it, and health currently reports MCP as a third tool.
- Scope boundary: no port selection/cutover, no changes to token formats, OAuth introspection behavior, route scopes, SQLite schemas, Cloudflare provisioning, or MCP tool semantics.

## initial evidence

- Current server is a 558-line flat Bun handler with route dispatch, auth orchestration, response helpers, OAuth introspection, trace gateway wiring, and startup in one file.
- Hono `^4.11.9` is already installed in `packages/os` from the device-authority refactor.
- Existing health implementation incorrectly reports `['get_steering', 'call', 'mcp']` and `tools: 3`; the process-level test already expects the correct two-tool surface.
- Existing entrypoint references include package scripts, three daemon wrappers, server manager/reload process detection, and tests importing/spawning `scripts/server.ts`.

## execution notes

- PR 1 had initially reached only `stream/security`. Its fully green, bounded stream PR #1404 was merged to `main`, then this task was rebased onto merge commit `eec0d0e1f3` before production edits.
- TDD red proof: the focused architecture/health run produced 7 expected failures and 5 existing passes. Valid failures were missing Hono structure/entrypoints and the incorrect three-tool health metadata. One initial fallback assertion was corrected before implementation because an explicit `CONSUELO_OS_AUTH_CONFIG` path intentionally counts as configured even when unreadable.
- Hono implicitly maps `HEAD` to GET handlers. A direct runtime probe caught this compatibility risk; explicit method guards now preserve the old fallback behavior for `HEAD /get_steering` and `HEAD /gateway/traces/*`.
- The local port remains unchanged. `CONSUELO_OS_PORT`, then `PORT`, then `8960` is still the canonical precedence, and Bun still binds only `127.0.0.1`.

## final validation

- Focused server/security/install suite: 76 passed across 8 files.
- Route/security subset after review fixes: 54 passed across 5 files.
- Process-level Bun health test passed through `os-raw-steering.test.ts` using `scripts/server/main.ts` on a configured loopback port.
- `bun run --cwd packages/os typecheck`: passed.
- Shell syntax for all three daemon wrappers: passed.
- `git diff --check`: passed.
- Strict `review.run --base origin/main --no-tests`: passed with 0 findings.
- `verify --base origin/main`: passed with a publish-valid stamp; automatic suite selection reported zero mapped suites, so the explicit 76-test run is the behavioral evidence.
- Adjacent Trace endpoint suite: 5 behavioral tests passed; one pre-existing Node-hosted Vitest case cannot import `bun:sqlite`. Runtime/state and install-state suites passed, and no trace implementation changed.

- 2026-07-11 03:41:46 write: `.task/security/refactor-local-os-server-onto-hono/workpad.md`

## files changed

- `packages/os/scripts/server.ts` (deleted)
- `packages/os/scripts/server/app.ts`
- `packages/os/scripts/server/env.ts`
- `packages/os/scripts/server/main.ts`
- `packages/os/scripts/server/middleware/auth.ts`
- `packages/os/scripts/server/middleware/dangerous-material.ts`
- `packages/os/scripts/server/middleware/errors.ts`
- `packages/os/scripts/server/middleware/fallback.ts`
- `packages/os/scripts/server/route-policies.ts`
- `packages/os/scripts/server/routes/call.ts`
- `packages/os/scripts/server/routes/health.ts`
- `packages/os/scripts/server/routes/mcp.ts`
- `packages/os/scripts/server/routes/steering.ts`
- `packages/os/scripts/server/routes/traces.ts`
- `packages/os/scripts/server/services/call-service.ts`
- `packages/os/scripts/server/services/oauth-introspection.ts`
- `packages/os/scripts/server/services/os-runtime.ts`
- `packages/os/scripts/server/services/steering-service.ts`
- `packages/os/scripts/server/services/trace-gateway.ts`
- `packages/os/tests/local-os-server-hono-architecture.test.ts`

## workspace-owned: files changed

- `packages/os/scripts/server.ts` (deleted)
- `packages/os/scripts/server/app.ts`
- `packages/os/scripts/server/env.ts`
- `packages/os/scripts/server/main.ts`
- `packages/os/scripts/server/middleware/auth.ts`
- `packages/os/scripts/server/middleware/dangerous-material.ts`
- `packages/os/scripts/server/middleware/errors.ts`
- `packages/os/scripts/server/middleware/fallback.ts`
- `packages/os/scripts/server/route-policies.ts`
- `packages/os/scripts/server/routes/call.ts`
- `packages/os/scripts/server/routes/health.ts`
- `packages/os/scripts/server/routes/mcp.ts`
- `packages/os/scripts/server/routes/steering.ts`
- `packages/os/scripts/server/routes/traces.ts`
- `packages/os/scripts/server/services/call-service.ts`
- `packages/os/scripts/server/services/oauth-introspection.ts`
- `packages/os/scripts/server/services/os-runtime.ts`
- `packages/os/scripts/server/services/steering-service.ts`
- `packages/os/scripts/server/services/trace-gateway.ts`
- `packages/os/tests/local-os-server-hono-architecture.test.ts`

## workspace-owned: activity log

- 2026-07-11 03:41:46 fs.write: `.task/security/refactor-local-os-server-onto-hono/workpad.md`
- 2026-07-11 03:46:11 fs.write: `packages/os/tests/local-os-server-hono-architecture.test.ts`
- 2026-07-11 03:46:59 fs.write: `packages/os/scripts/server/env.ts`
- 2026-07-11 03:47:06 fs.write: `packages/os/scripts/server/middleware/errors.ts`
- 2026-07-11 03:47:16 fs.write: `packages/os/scripts/server/services/oauth-introspection.ts`
- 2026-07-11 03:47:32 fs.write: `packages/os/scripts/server/middleware/auth.ts`
- 2026-07-11 03:47:39 fs.write: `packages/os/scripts/server/middleware/dangerous-material.ts`
- 2026-07-11 03:47:47 fs.write: `packages/os/scripts/server/services/os-runtime.ts`
- 2026-07-11 03:47:52 fs.write: `packages/os/scripts/server/services/call-service.ts`
- 2026-07-11 03:48:00 fs.write: `packages/os/scripts/server/services/steering-service.ts`
- 2026-07-11 03:48:10 fs.write: `packages/os/scripts/server/services/trace-gateway.ts`
- 2026-07-11 03:48:17 fs.write: `packages/os/scripts/server/routes/health.ts`
- 2026-07-11 03:48:29 fs.write: `packages/os/scripts/server/routes/mcp.ts`
- 2026-07-11 03:48:36 fs.write: `packages/os/scripts/server/routes/steering.ts`
- 2026-07-11 03:49:16 fs.write: `packages/os/scripts/server/routes/call.ts`
- 2026-07-11 03:49:23 fs.write: `packages/os/scripts/server/routes/traces.ts`
- 2026-07-11 03:49:30 fs.write: `packages/os/scripts/server/route-policies.ts`
- 2026-07-11 03:49:38 fs.write: `packages/os/scripts/server/app.ts`
- 2026-07-11 03:49:44 fs.write: `packages/os/scripts/server/main.ts`
- 2026-07-11 03:50:14 fs.trash: `packages/os/scripts/server.ts`
- 2026-07-11 03:52:23 fs.write: `packages/os/scripts/server/middleware/fallback.ts`

## workspace-owned: files read

- `packages/os/scripts/consuelo-reload.js`
- `packages/os/scripts/server.js`
- `packages/os/scripts/server/app.ts`
- `packages/os/scripts/server/middleware/auth.ts`
- `packages/os/scripts/server/routes/call.ts`
- `packages/os/scripts/server/routes/mcp.ts`
- `packages/os/scripts/start-brain-daemon.sh`
- `packages/os/scripts/start-brain.sh`
- `packages/os/scripts/start-consuelo-daemon.sh`
- `packages/os/tests/bun-product-server-contract.test.ts`
- `packages/os/tests/dangerous-material-policy.test.ts`
- `packages/os/tests/os-device-authority-architecture.test.ts`
- `packages/os/tests/os-raw-steering.test.ts`
- `packages/workspace/scripts/review.js`

## workspace-owned: validation evidence

- 2026-07-11 03:53:26 `review.run`: passed — OK
- 2026-07-11 03:54:37 apply-patch: `packages/os/scripts/server/routes/call.ts`
- 2026-07-11 03:54:37 apply-patch: `packages/os/scripts/server/routes/mcp.ts`
- 2026-07-11 03:54:37 apply-patch: `packages/os/scripts/server/routes/steering.ts`
- 2026-07-11 03:54:37 apply-patch: `packages/os/scripts/server/routes/traces.ts`
- 2026-07-11 03:54:37 apply-patch: `packages/os/scripts/server/services/call-service.ts`
- 2026-07-11 03:54:37 apply-patch: `packages/os/scripts/server/services/steering-service.ts`
- 2026-07-11 03:55:00 `review.run`: passed — OK
- 2026-07-11 03:55:23 `verify`: passed — OK
- 2026-07-11 03:55:58 `verify`: passed — OK
- 2026-07-11 03:56:30 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/security/refactor-local-os-server-onto-hono/current.json`, `.task/security/refactor-local-os-server-onto-hono/evidence-log.json`, `.task/security/refactor-local-os-server-onto-hono/read-log.json`, `.task/security/refactor-local-os-server-onto-hono/session.json`, `.task/security/refactor-local-os-server-onto-hono/verify.json`, `.task/security/refactor-local-os-server-onto-hono/workpad.md`, `.task/tasks/security/refactor-local-os-server-onto-hono.json`, `packages/os/Dockerfile`, `packages/os/docs/runtime-surfaces.md`, `packages/os/package.json`, `packages/os/scripts/consuelo-reload.js`, `packages/os/scripts/server.js`, `packages/os/scripts/server.ts`, `packages/os/scripts/server/app.ts`, `packages/os/scripts/server/env.ts`, `packages/os/scripts/server/main.ts`, `packages/os/scripts/server/middleware/auth.ts`, `packages/os/scripts/server/middleware/dangerous-material.ts`, `packages/os/scripts/server/middleware/errors.ts`, `packages/os/scripts/server/middleware/fallback.ts`, `packages/os/scripts/server/route-policies.ts`, `packages/os/scripts/server/routes/call.ts`, `packages/os/scripts/server/routes/health.ts`, `packages/os/scripts/server/routes/mcp.ts`, `packages/os/scripts/server/routes/steering.ts`, `packages/os/scripts/server/routes/traces.ts`, `packages/os/scripts/server/services/call-service.ts`, `packages/os/scripts/server/services/oauth-introspection.ts`, `packages/os/scripts/server/services/os-runtime.ts`, `packages/os/scripts/server/services/steering-service.ts`, `packages/os/scripts/server/services/trace-gateway.ts`, `packages/os/scripts/start-brain-daemon.sh`, `packages/os/scripts/start-brain.sh`, `packages/os/scripts/start-consuelo-daemon.sh`, `packages/os/tests/bun-product-server-contract.test.ts`, `packages/os/tests/dangerous-material-policy.test.ts`, `packages/os/tests/install-state.test.ts`, `packages/os/tests/local-os-server-hono-architecture.test.ts`, `packages/os/tests/mcp-gateway.test.ts`, `packages/os/tests/os-raw-steering.test.ts`, `packages/os/tests/security-gateway.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

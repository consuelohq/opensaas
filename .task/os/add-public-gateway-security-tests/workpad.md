# add public gateway security tests

branch: `task/os/add-public-gateway-security-tests`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/877/add-public-gateway-security-tests
started: 2026-06-09

## acceptance criteria

- [x] Read StreamOS v1 spec through Tailnet/local wiki route and capture gateway/security intent.
- [x] Read current `packages/os` server, install, install-state, tooling, manifests, and existing tests before writing tests.
- [x] Add tests only for the public gateway/security behavior contract; do not implement production gateway behavior.
- [x] Cover localhost/private server boundary, Consuelo-specific auth config, request signing/replay resistance, scoped tokens, Caddy config, route registry, outbound connector, tool policy/audit, and final install folder behavior.
- [x] Run focused tests and package checks; expected failures are acceptable when they prove missing implementation.
- [ ] Publish the task into the stream review PR with a PR description that says implementation comes next.

## plan

1. Read spec and external references enough to extract security/test constraints.
2. Inspect existing OS code and tests to follow local patterns.
3. Write the test-first contract and add failing tests without production implementation.
4. Run targeted tests to record intended failures and syntax/package checks to catch test defects.
5. Inspect diff, update this workpad, push, and promote to the stream PR.

## initial assumptions

- This is a tests-only task. Production behavior changes are out of scope unless a tiny missing test helper is required to express the tests.
- Tests should intentionally fail where security/gateway implementation is missing.
- The task starts from `stream/os` because Ko established `stream/os` as the active stream and this work should layer on current OS stream state.

## Test-first contract

Behavior under test: public gateway/security contract for Consuelo OS: local-only server boundary, generated Consuelo-specific auth, replay-resistant signed requests, scoped app/agent tokens, deterministic Caddy gateway config, workspace route registry, outbound connector config, tool policy/audit, and final install-root security layout.

Existing local pattern followed: current OS tests use Vitest, disposable temp homes, `bun -e` subprocesses for clean import/env isolation, real `provisionLocalOs`, and direct file/HTTP assertions. `server.ts` exports `handleRequest`, so the suite exercises real HTTP request handling without starting a long-lived server. Install tests already assert final-root layout and no source-path runtime dependency.

New or changed tests: new `packages/os/tests/security-gateway.test.ts`. It intentionally combines fast contract checks with real handler/install checks so the red suite cannot be satisfied only by placeholder files.

Focused red command: `bun --cwd packages/os test tests/security-gateway.test.ts`.

Expected red failure: current server allows protected routes with no auth and honors `MCP_BEARER_TOKEN`; install does not generate the required `security/generated` and `security/overrides` shape; `scripts/lib/security-gateway.ts` does not exist yet, so signing/token/policy/route/Caddy/connector/audit contract tests fail until implementation is added.

No-test waiver: none. This PR is the test suite.

## evidence log

- Read task prompt from `/tmp/consuelo-os-public-gateway-security-tdd-prompt.md`.
- Ran `stream.context` for `os`; found active `stream/os` and open OS task PRs.
- Ran `stream.sync` for `os`; stream sync succeeded and pushed `stream/os`.
- Started task branch from `stream/os` with task session `tsk_0395ac8c7189`.
- Opened Tailnet spec URL and extracted headings/links; spec length is 49,791 characters and includes the required public gateway/security model and Security TDD track.
- Read official external references enough to shape the tests: OAuth2 Proxy config/proxy warnings, Authelia proxy integration docs, Tailscale Serve docs, Open Policy Agent docs, Caddy TLS client auth docs, OWASP ASVS/WSTG, Practical Test Pyramid, and behavior-focused testing guidance.
- Read current OS server/install state. Current `server.ts` binds to `127.0.0.1`, keeps `/health` public, but allows all protected routes when no bearer token exists and falls back to legacy `MCP_BEARER_TOKEN`. Current install root materializes package files and tools but does not include `security/` in `REQUIRED_DIRS`.
- `code.run` failed in this task worktree with `Cannot find module './lib/codemode/tools/index'`; switched to direct task-scoped file tools.
- `fs.patch` multiline patch attempts failed because the facade requires line numbers and rejects unsafe multiline content; a scoped `task.call` Python edit fixed the dynamic import path.

## files changed

- `packages/os/tests/security-gateway.test.ts`

## validation evidence

- `bun --cwd packages/os test tests/security-gateway.test.ts` — expected red: 1 passed, 9 failed.
  - Pass: `/health` remains public and does not expose obvious secret material.
  - Fail: protected `/get_steering` returns 200 without generated auth; expected 401/403.
  - Fail: legacy `MCP_BEARER_TOKEN` authenticates protected route; expected ignored/rejected.
  - Fail: install does not create `security/` generated auth/Caddy config.
  - Fail: missing `packages/os/scripts/lib/security-gateway.ts` contract module for connector, signing/replay, token rotation/revocation, policy/audit, Caddy rendering, and route registry behavior.
- `bun --cwd packages/os test tests/install-state.test.ts tests/skills-registry.test.ts tests/tool-manifest.test.ts` — 25 tests passed.
- `node ./packages/os/scripts/check-syntax.js` — passed: workspace script syntax checks passed.
- `review.run --base origin/stream/os --noTests` — passed: 0 issues, 1 affected file, tests intentionally skipped for review because the new red suite is expected to fail.

## expected failing tests

- `rejects protected routes when generated Consuelo auth is missing` — current server returns 200 because `isAuthorized` allows all requests when no token is configured.
- `does not accept the legacy generic MCP_BEARER_TOKEN fallback` — current server uses the generic MCP fallback.
- `installs generated Consuelo-specific security config into the final OS root` — current install root has no `security/generated/auth.json`, `security/generated/Caddyfile`, or `security/overrides`.
- `blocks public or tunnel mode unless generated auth and workspace identity exist` — missing gateway contract module and implementation.
- `verifies signed machine requests and rejects replay, stale timestamps, tampered bodies, and tenant mismatch` — missing signing/replay contract implementation.
- `rotates and revokes scoped app tokens without preserving old credentials` — missing token lifecycle implementation.
- `enforces read, write, and dangerous tool policy splits and records safe audit events` — missing tool policy/audit implementation.
- `renders deterministic Caddy config that proxies only to the private Bun server` — missing Caddy renderer implementation.
- `routes public workspace URLs by workspace identity and fails closed for unknown tenants or paths` — missing route registry implementation.

## follow-up implementation prompt

Implement the Consuelo OS public gateway/security contract captured by `packages/os/tests/security-gateway.test.ts` without weakening or deleting tests. Start from `stream/os`, read the StreamOS v1 spec public gateway/security model, then implement the minimum production behavior required for the tests to pass:

1. Remove the generic `MCP_BEARER_TOKEN` fallback and require generated Consuelo auth for all non-health routes.
2. Extend install/provision to create `~/.consuelo/os/security/generated/` and `~/.consuelo/os/security/overrides/`, write generated auth and Caddy config with 0600 secret files, and record Consuelo-specific security config in `config.json`.
3. Add `packages/os/scripts/lib/security-gateway.ts` with the contract exports used by the test file: config generation/loading, scoped app token issue/rotate/revoke, request signing and verification with timestamp+nonce replay resistance, Caddy config rendering, workspace route registry, outbound connector config, tool policy decisions, and audit event writing.
4. Ensure public/tunnel/connector mode cannot start without generated auth and workspace identity.
5. Keep the Bun server private (`127.0.0.1`) and keep Caddy proxying only to that private upstream.
6. Preserve final install-root behavior: no `/Users/kokayi/Dev/opensaas`, no `~/.consuelo/source/opensaas`, and no required `~/.consuelo/os/source` runtime dependency.
7. Run `bun --cwd packages/os test tests/security-gateway.test.ts` until green, then run the existing install/manifest suites and package checks.

## workspace-owned: files changed

- `packages/os/tests/security-gateway.test.ts`

## workspace-owned: activity log

- 2026-06-09 20:07:01 fs.write: `.task/os/add-public-gateway-security-tests/workpad.md`
- 2026-06-09 20:12:33 fs.write: `.task/os/add-public-gateway-security-tests/workpad.md`
- 2026-06-09 20:14:05 fs.write: `packages/os/tests/security-gateway.test.ts`
- 2026-06-09 20:15:38 task.call: Python edit to fix dynamic import path after `fs.patch` multiline limitation
- 2026-06-09 20:16:18 task.call: red run for `tests/security-gateway.test.ts`
- 2026-06-09 20:16:36 task.call: existing install/manifest suites
- 2026-06-09 20:17:04 task.call: `check-syntax.js`
- 2026-06-09 20:19:00 review.run: no-tests review gate
- 2026-06-09 20:19:42 fs.write: `.task/os/add-public-gateway-security-tests/workpad.md`

## workspace-owned: files read

- `AGENTS.md`
- `CODING-STANDARDS.md`
- `packages/os/package.json`
- `packages/os/scripts/check-syntax.js`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/server.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/skills-registry.test.ts`
- `packages/os/tests/tool-manifest.test.ts`

- 2026-06-09 20:19:42 write: `.task/os/add-public-gateway-security-tests/workpad.md`

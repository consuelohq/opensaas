# fix dynamic MCP OAuth discovery

branch: `task/security/fix-dynamic-mcp-oauth-discovery`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1291/fix-dynamic-mcp-oauth-discovery
github pr: https://github.com/consuelohq/opensaas/pull/1291
started: 2026-06-30

## acceptance criteria

- [x] Dynamic workspace MCP hostnames such as `https://<workspace>.consuelohq.com/mcp` expose OAuth discovery/configuration without hard-coded test domains.
- [x] OAuth protected resource metadata, authorization server metadata, authorization URL handling, token exchange inputs, and MCP authorization checks derive safe public origins from the incoming request or registry data.
- [x] Reserved platform hosts are not accidentally treated as workspace MCP hostnames.
- [x] Browser-visible OAuth metadata and errors do not leak tunnel credentials, local bearer tokens, private keys, raw request bodies, local filesystem paths, or internal tunnel origins.
- [x] Focused tests cover generated/random workspace hostnames and fail if a previous fixed hostname is hard-coded.
- [x] Validate the next deterministic OAuth flow step after discovery so the fix does not only move the failure to redirect, callback, token, scope/resource, or MCP authorization handling.
- [x] Push task changes and promote them into `stream/security` if validation is credible.

## plan

1. Use `context.search` and `explore` to recover prior OAuth/MCP stream context and locate the current gateway/device-auth code path.
2. Read the OAuth metadata, workspace edge, route registry, MCP gateway, and existing tests before editing.
3. Write or update focused tests first for dynamic workspace host OAuth discovery and the next deterministic OAuth step.
4. Run the focused test red and record the failure signal.
5. Implement the smallest dynamic-host-safe fix while preserving reserved-host and secret-redaction boundaries.
6. Rerun focused tests green, then run relevant OS security/gateway contracts, typecheck/syntax, review, and verify against `origin/stream/security`.
7. Push the task and run `task.pr` to promote the task into the security stream review path.

## current status

- Task started from `stream/security` with task session `tsk_626ef91a35ce`.
- Required `CODING-STANDARDS.md`, `AGENTS.md`, and OS task/senior-engineer skills were read before code edits.
- Implementation complete; focused OAuth/MCP tests, broader relevant OS gateway tests, typecheck, review, and verify have run.
- `verify` passed against `origin/stream/security` and wrote a publish-valid stamp.

## Test-first contract

- Behavior under test: dynamic per-workspace MCP hostnames expose OAuth protected-resource and authorization-server metadata, return unauthenticated MCP challenges that point at that metadata, and preserve the subsequent authorization/token/resource contract without stale fixed hostnames.
- Existing local pattern to follow: to be selected after reading current OS OAuth/MCP tests.
- Existing local pattern to follow: `packages/os/tests/cloudflare-edge-router.test.ts`, `packages/os/tests/mcp-gateway.test.ts`, and `packages/os/tests/os-device-authority-worker.test.ts` already cover edge metadata, MCP bearer auth, and device-authority OAuth code/token/introspection flows.
- New or changed tests: dynamic-host protected-resource metadata now uses generated hostnames and checks redaction; new dynamic-host authorization-server metadata alias; new non-POST `/mcp` challenge test; new ChatGPT CIMD client and resource echo token-exchange test.
- Focused red command: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun test tests/cloudflare-edge-router.test.ts tests/mcp-gateway.test.ts tests/os-device-authority-worker.test.ts -t 'dynamic workspace MCP hosts|non-POST MCP probes|CIMD clients|first-party OAuth authorization server metadata'` from `packages/os`.
- Red result: failed as expected. GET `/mcp` returned 404 instead of 401 OAuth challenge; dynamic-host `/.well-known/oauth-authorization-server` returned 503; auth metadata lacked `client_id_metadata_document_supported`; CIMD authorization returned 400 instead of redirecting into Google approval.
- Additional note: the raw `bun test` red runner also exposed Bun/Vitest global-stub incompatibilities in broader runs; all green validation used the package test script (`bun run test -- ...`) so Vitest semantics matched the existing suite.
- Expected red failure: current implementation either misses `.well-known` OAuth metadata for dynamic hosts or emits stale/fixed-origin metadata/challenges.
- No-test waiver: not applicable; this is a behavior/security fix and needs test-first coverage.

## files changed

- `packages/os/cloudflare/os-device-authority/src/index.ts`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/server.ts`
- `packages/os/tests/cloudflare-edge-router.test.ts`
- `packages/os/tests/mcp-gateway.test.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`
- `.task/security/fix-dynamic-mcp-oauth-discovery/*`
- `.task/tasks/security/fix-dynamic-mcp-oauth-discovery.json`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-06-30 focused green: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test -- tests/cloudflare-edge-router.test.ts tests/mcp-gateway.test.ts tests/os-device-authority-worker.test.ts -t 'dynamic workspace MCP hosts|non-POST MCP probes|CIMD clients|first-party OAuth authorization server metadata'` — passed, 4 tests.
- 2026-06-30 full relevant OAuth files: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test -- tests/cloudflare-edge-router.test.ts tests/mcp-gateway.test.ts tests/os-device-authority-worker.test.ts` — passed, 40 tests.
- 2026-06-30 adjacent edge/security files: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test -- tests/workspace-hostname-edge-router.test.ts tests/workspace-edge-sites-gateway-integration.test.ts tests/security-gateway.test.ts` — `workspace-edge-sites-gateway-integration` and `security-gateway` passed; `workspace-hostname-edge-router` had one unrelated static-shell cache expectation failure (`cachePuts` remained empty).
- 2026-06-30 `bun run typecheck` from `packages/os`: passed — workspace script syntax checks passed.
- 2026-06-30 20:04:19 `review.run`: passed — OK
- 2026-06-30 20:06:20 `verify --base origin/stream/security`: passed — publish-valid stamp written to `.task/security/fix-dynamic-mcp-oauth-discovery/verify.json`.
- 2026-06-30 20:06:20 `verify`: passed — OK
- 2026-06-30 20:08:32 `verify`: passed — OK

## key decisions

- Started a fresh task from `stream/security` because Ko explicitly named the security lane and asked to push all the way to the stream if possible.
- Dynamic workspace-host `/.well-known/oauth-authorization-server` now validates the inbound host by resolving the `/mcp` route and requiring an allowed `os-connector` route before returning OS authorization-server metadata.
- Protected-resource metadata keeps `authorization_servers: ['https://os.consuelohq.com']`; dynamic workspace hosts advertise the OS auth origin for authorization, token, and introspection endpoints rather than proxying those through the connector domain.
- ChatGPT CIMD clients are accepted only for constrained `https://chatgpt.com/oauth/.../client.json` client IDs, while the redirect URI remains constrained to the ChatGPT connector callback.
- Non-POST `/mcp` probes now receive the same unauthenticated OAuth challenge as POST probes; scope-authorized wrong-method requests receive `405 Allow: POST`.
- The MCP token exchange enforces resource echo when the client supplies `resource`, preventing a code issued for one MCP resource from being silently rebound to another.

## notes for ko

- Official Apps SDK auth guidance expects MCP auth to advertise protected-resource and authorization-server discovery metadata. This task keeps the authorization server on `https://os.consuelohq.com` while supporting per-workspace protected resources such as `https://depredtif.consuelohq.com/mcp`.

## improvements noticed

- none yet

## issues and recovery

- The workspace manifest does not expose `context.search`; used the `context` search operation instead.
- Initial `code.call` usage used a command-array shape; corrected to the facade's `language/mode/code` input shape.
- Initial raw `bun test` red validation was not the package's Vitest runner; green validation used `bun run test -- ...`.
- Adjacent `workspace-hostname-edge-router.test.ts` has a pre-existing/unrelated static-shell cache assertion failure: `cachePuts` was `[]` for `serves public workspace root snapshots for personal and business hostnames`.

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/package.json`
- `packages/os/scripts/server.ts`

## workspace-owned: test selection

- changed files: `.task/security/fix-dynamic-mcp-oauth-discovery/current.json`, `.task/security/fix-dynamic-mcp-oauth-discovery/evidence-log.json`, `.task/security/fix-dynamic-mcp-oauth-discovery/read-log.json`, `.task/security/fix-dynamic-mcp-oauth-discovery/session.json`, `.task/security/fix-dynamic-mcp-oauth-discovery/verify.json`, `.task/security/fix-dynamic-mcp-oauth-discovery/workpad.md`, `.task/tasks/security/fix-dynamic-mcp-oauth-discovery.json`, `packages/os/cloudflare/os-device-authority/src/index.ts`, `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`, `packages/os/scripts/server.ts`, `packages/os/tests/cloudflare-edge-router.test.ts`, `packages/os/tests/mcp-gateway.test.ts`, `packages/os/tests/os-device-authority-worker.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

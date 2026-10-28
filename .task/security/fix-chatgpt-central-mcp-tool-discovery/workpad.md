# Fix ChatGPT central MCP tool discovery

branch: `task/security/fix-chatgpt-central-mcp-tool-discovery`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1494/fix-chatgpt-central-mcp-tool-discovery
github pr: https://github.com/consuelohq/opensaas/pull/1494
started: 2026-07-14

## acceptance criteria

- [x] ChatGPT OAuth tokens minted for `https://os.consuelohq.com/mcp` are introspected against that same canonical resource.
- [x] The local node still rejects OAuth tokens bound to another workspace or missing the required scope.
- [x] Loopback MCP requests may continue using node-local bearer credentials.
- [x] Public connector requests reject node-local bearer credentials and require Consuelo OAuth.
- [x] OAuth access tokens remain short-lived and hashed at rest.
- [x] Rotating refresh tokens provide login-once UX without storing raw refresh tokens server-side.
- [x] Expired, revoked, replayed, wrong-client, wrong-resource, and wrong-workspace credentials fail closed.
- [x] Sensitive credentials remain redacted from diagnostics and owner-readable only on node storage.
- [ ] Focused tests, broader OS tests, review, verify, and a live MacBook connector smoke pass.

## plan

1. Lock the canonical OAuth resource and ingress-specific auth matrix with focused failing tests.
2. Implement the smallest local gateway change: loopback accepts local bearer; public connector accepts OAuth only.
3. Add hashed, rotating refresh-token storage, refresh exchange, and revocation to the existing device authority.
4. Preserve resource, workspace, client, scope, expiry, and PKCE checks.
5. Run focused and broad validation, publish to `stream/security`, release, and verify the live MacBook.

## current status

- Implementation and focused validation complete; review, publish, release, and live smoke remain.
- The node now classifies only exact loopback hosts as eligible for node-local bearer auth; public hosts always use central OAuth.
- The device authority now issues one-hour access tokens plus rotating, hashed 30-day refresh tokens and exposes RFC-style revocation.
- Live proof: a node-local `cst_*` bearer successfully called `tools/list` through the public opaque connector.
- Root cause for ChatGPT 424: the central `coa_*` token is bound to `https://os.consuelohq.com/mcp`, but the node introspects it as `https://testing45-78.consuelohq.com/mcp`.

## files changed

- Local gateway auth and introspection resource handling.
- Device-authority OAuth metadata, token exchange, refresh rotation, revocation, stores, and route policy.
- Gateway, Worker, and route-matrix regression tests.

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- `bun test packages/os/tests/mcp-gateway.test.ts`: 12 passed.
- `bunx vitest run packages/os/tests/os-device-authority-worker.test.ts packages/os/tests/os-device-authority-architecture.test.ts`: 48 passed.
- `bun run --cwd packages/os typecheck`: passed.
- `bunx wrangler deploy --config packages/os/cloudflare/os-device-authority/wrangler.toml --dry-run`: passed.
- 2026-07-14 21:32:51 `review.run`: passed — OK
- 2026-07-14 21:37:59 `review.run`: passed — OK
- 2026-07-14 21:38:32 `verify`: passed — OK

## key decisions

- Do not persist ChatGPT's raw OAuth access token on the node or in Durable Object storage.
- Do not replace node-local secret files with environment variables; files are installed mode `0600`.
- Keep the stable node credential for loopback-only use.
- Treat access-token rotation as invisible platform behavior; manual user rotation is only for explicit revocation or compromise.
- Keep the future auth dashboard/provider migration out of this task.

## Test-first contract

- Behavior under test: canonical central resource validation, public rejection of local bearers, loopback preservation, rotating refresh tokens, replay/revocation failure.
- Existing local pattern: `packages/os/tests/mcp-gateway.test.ts` for gateway behavior and `packages/os/tests/os-device-authority-worker.test.ts` for OAuth lifecycle behavior.
- New/changed tests: extend those suites without weakening existing OAuth, PKCE, workspace, or scope assertions.
- Focused red command: `bun test packages/os/tests/mcp-gateway.test.ts packages/os/tests/os-device-authority-worker.test.ts`.
- Expected red failure: current node sends the workspace URL as introspection resource, public requests accept local bearer tokens, and token endpoint rejects `refresh_token` grants.

## TDD evidence

- RED (2026-07-14): the device-authority worker contract fails because the authorization-code exchange does not return a rotating refresh token.
- The local gateway suite imports `bun:sqlite` and therefore runs under Bun. Its fetch doubles are runner-neutral so the red failure reflects ingress behavior rather than a test-runner mismatch.
- RED (2026-07-14): `127.attacker.example` was accepted as loopback because the classifier used a prefix match.
- GREEN (2026-07-14): exact loopback classification, canonical introspection, public rejection, refresh rotation/replay/revocation, syntax, and Worker bundling all pass.

## notes for ko

- No additional Google or Cloudflare login is required for implementation.
- A final ChatGPT disconnect/reconnect may require Ko's browser session after the live release.

## improvements noticed

- none yet

## issues and recovery

- The task guide references `context.search`, but that tool is not in the current workspace manifest. Continued with current code and live MacBook evidence.
- A root-level full Vitest sweep is not a stable isolated gate for this task: it rewrote facade snapshots and surfaced unrelated environment/task failures. The generated snapshot was restored; scoped tests plus workspace review/verify are the broader gates.

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-14 19:55:57 apply-patch: `.task/security/fix-chatgpt-central-mcp-tool-discovery/workpad.md`
- 2026-07-14 20:02:40 apply-patch: `packages/os/tests/mcp-gateway.test.ts`
- 2026-07-14 20:02:40 apply-patch: `packages/os/tests/os-device-authority-worker.test.ts`

- 2026-07-14 20:09:13 apply-patch: `packages/os/tests/mcp-gateway.test.ts`
- 2026-07-14 20:09:13 apply-patch: `.task/security/fix-chatgpt-central-mcp-tool-discovery/workpad.md`
- 2026-07-14 20:42:38 apply-patch: `packages/os/tests/os-device-authority-worker.test.ts`
- 2026-07-14 20:42:38 apply-patch: `packages/os/tests/os-device-authority-architecture.test.ts`
- 2026-07-14 20:47:16 apply-patch: `packages/os/scripts/server/middleware/auth.ts`
- 2026-07-14 20:47:16 apply-patch: `packages/os/scripts/server/services/oauth-introspection.ts`
- 2026-07-14 20:47:16 apply-patch: `packages/os/cloudflare/os-device-authority/src/constants.ts`
- 2026-07-14 20:47:16 apply-patch: `packages/os/cloudflare/os-device-authority/src/types.ts`
- 2026-07-14 20:47:16 apply-patch: `packages/os/cloudflare/os-device-authority/src/stores.ts`
- 2026-07-14 20:47:16 apply-patch: `packages/os/cloudflare/os-device-authority/src/services/mcp-oauth.ts`
- 2026-07-14 20:47:16 apply-patch: `packages/os/cloudflare/os-device-authority/src/routes/mcp-oauth.ts`
- 2026-07-14 20:47:16 apply-patch: `packages/os/cloudflare/os-device-authority/src/security/route-policies.ts`
- 2026-07-14 21:01:29 apply-patch: `packages/os/tests/mcp-gateway.test.ts`
- 2026-07-14 21:26:32 apply-patch: `packages/os/tests/mcp-gateway.test.ts`
- 2026-07-14 21:28:32 apply-patch: `packages/os/scripts/server/middleware/auth.ts`

- 2026-07-14 21:34:44 apply-patch: `packages/os/cloudflare/os-device-authority/src/services/mcp-oauth.ts`
- 2026-07-14 21:35:50 apply-patch: `packages/os/cloudflare/os-device-authority/src/services/mcp-oauth.ts`

## workspace-owned: test selection

- changed files: `.task/security/fix-chatgpt-central-mcp-tool-discovery/current.json`, `.task/security/fix-chatgpt-central-mcp-tool-discovery/session.json`, `.task/security/fix-chatgpt-central-mcp-tool-discovery/workpad.md`, `.task/tasks/security/fix-chatgpt-central-mcp-tool-discovery.json`, `packages/os/cloudflare/os-device-authority/src/constants.ts`, `packages/os/cloudflare/os-device-authority/src/routes/mcp-oauth.ts`, `packages/os/cloudflare/os-device-authority/src/security/route-policies.ts`, `packages/os/cloudflare/os-device-authority/src/services/mcp-oauth.ts`, `packages/os/cloudflare/os-device-authority/src/stores.ts`, `packages/os/cloudflare/os-device-authority/src/types.ts`, `packages/os/scripts/server/middleware/auth.ts`, `packages/os/scripts/server/services/oauth-introspection.ts`, `packages/os/tests/mcp-gateway.test.ts`, `packages/os/tests/os-device-authority-architecture.test.ts`, `packages/os/tests/os-device-authority-worker.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

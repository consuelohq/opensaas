# Add OAuth discovery for workspace MCP

## Acceptance criteria

- Keep the public MCP endpoint on workspace hosts as `https://<workspace>.consuelohq.com/mcp`; do not introduce `/app`.
- Workspace-edge serves OAuth protected-resource metadata for workspace hosts by resolving the existing `/mcp` os-connector route.
- Unauthenticated MCP responses advertise protected-resource metadata with `WWW-Authenticate` instead of showing placeholder OAuth values.
- `os.consuelohq.com` serves first-party OAuth authorization-server metadata with real authorize/token endpoints.
- Consuelo OAuth supports fixed public client + PKCE authorization-code flow using the existing Google identity verification surface.
- Issued OAuth access tokens are scoped and introspectable; local OS `/mcp` can accept them after Consuelo introspection without requiring ChatGPT to send Consuelo signed internal headers.
- Manual local bearer token remains supported for dev/debug.
- DCR remains omitted/disabled for v1.

## Test-first contract

Behavior under test:
- Workspace-edge: `/.well-known/oauth-protected-resource` on a workspace host returns JSON containing `resource: https://<host>/mcp` and `authorization_servers: [https://os.consuelohq.com]`, and it fails closed if the host has no active `/mcp` connector route.
- Local server: missing MCP auth returns a `WWW-Authenticate` header with protected-resource metadata; bearer tokens that are not local tokens can be accepted through Consuelo OAuth introspection when active, scoped, and bound to the current workspace host.
- Device-authority: `/.well-known/oauth-authorization-server` exposes real OAuth endpoints; `/oauth/authorize` redirects through Google; `/oauth/token` exchanges authorization code + PKCE for a Consuelo MCP access token; `/oauth/introspect` returns active/scoped token metadata.

Existing patterns to follow:
- `tests/cloudflare-edge-router.test.ts` covers workspace-edge routing and fail-closed behavior.
- `tests/mcp-gateway.test.ts` covers local server MCP auth.
- `tests/os-device-authority-worker.test.ts` covers the Google approval flow and durable auth state.

Focused red command:
- `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/cloudflare-edge-router.test.ts tests/mcp-gateway.test.ts tests/os-device-authority-worker.test.ts`

Expected red failure before implementation:
- no protected-resource metadata route exists on workspace-edge.
- local `/mcp` missing auth has no OAuth discovery challenge and rejects Consuelo OAuth access tokens as unknown local bearer tokens.
- device-authority has no OAuth authorization-server metadata, authorize/token/introspect endpoints.

Security notes:
- Do not add DCR in v1.
- Do not use `/app` as a second protocol route.
- Do not expose cloudflared tunnel tokens, local signing keys, or local bearer tokens through OAuth metadata.

## workspace-owned: validation evidence

- 2026-06-24 03:13:53 `review.run`: passed — OK
- 2026-06-24 03:15:08 `review.run`: passed — OK
- 2026-06-24 03:15:34 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/security/add-oauth-discovery-for-workspace-mcp/current.json`, `.task/security/add-oauth-discovery-for-workspace-mcp/session.json`, `.task/security/add-oauth-discovery-for-workspace-mcp/workpad.md`, `.task/tasks/security/add-oauth-discovery-for-workspace-mcp.json`, `packages/os/cloudflare/os-device-authority/src/index.ts`, `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`, `packages/os/scripts/server.ts`, `packages/os/tests/cloudflare-edge-router.test.ts`, `packages/os/tests/mcp-gateway.test.ts`, `packages/os/tests/os-device-authority-worker.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## Implementation summary

- Kept the public MCP endpoint on workspace hosts at `https://<workspace>.consuelohq.com/mcp`; no `/app` route was added.
- Workspace-edge now serves OAuth protected-resource metadata from `/.well-known/oauth-protected-resource` only when the host has an active `/mcp` os-connector route.
- Local OS `/mcp` missing-auth responses now include a `WWW-Authenticate` discovery challenge.
- Local OS `/mcp` still accepts local generated bearer tokens and signed internal requests, and now falls back to Consuelo OAuth introspection for opaque OAuth tokens.
- `os.consuelohq.com` now serves first-party OAuth authorization-server metadata.
- Added fixed-client OAuth authorization-code + PKCE flow for `chatgpt-consuelo-os`, backed by the existing Google identity verification path.
- Added `/oauth/introspect` for local OS gateway validation of Consuelo OAuth access tokens.
- DCR remains omitted.

## Validation

- Red: focused command failed before implementation on missing protected-resource metadata, missing `WWW-Authenticate`, missing authorization-server metadata, and missing authorize/token endpoints.
- Green: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/cloudflare-edge-router.test.ts tests/mcp-gateway.test.ts tests/os-device-authority-worker.test.ts` passed, 36 tests.
- Green: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/security-gateway.test.ts tests/mcp-gateway.test.ts tests/install-state.test.ts tests/cloudflare-edge-router.test.ts tests/os-device-authority-worker.test.ts tests/workspace-edge-route-seed-contract.test.ts` passed, 78 tests.
- Green: `wrangler deploy --dry-run --config cloudflare/os-device-authority/wrangler.toml`.
- Green: `wrangler deploy --dry-run --config cloudflare/workspace-edge/wrangler.toml`.
- Green: `bun run os:release-install -- --dry-run`, bootstrap SHA unchanged at `4d110380f0b0b849fcfe30e7976806bb9da8d409a7de0ee8e6719159c08a67ba`.
- Green: `review.run --base origin/main`, 0 issues after adding explicit OAuth token-exchange error handling.
- Green: `verify --base origin/main --no-stamp`, publish-valid.

## Release notes

This change requires deploying both Cloudflare Workers after merge:
- `consuelo-os-device-authority` for OAuth metadata/authorize/token/introspection.
- `consuelo-workspace-edge` for workspace protected-resource metadata.

No installer Worker deploy is required because `bootstrap.sh` is unchanged.

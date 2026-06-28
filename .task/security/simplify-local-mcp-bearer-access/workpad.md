# Simplify local MCP bearer access

## Acceptance criteria

- Remove `runtime/` from the default Consuelo OS home shape when it has no runtime-owned files or behavior.
- Preserve `runs/` because runtime-state uses it for execution traces/run state.
- Add a bearer-only MCP path: ChatGPT can call `https://<workspace>.consuelohq.com/mcp` with `Authorization: Bearer <opaque-token>` and no signed gateway headers.
- Bearer MCP auth must still fail closed on missing auth, revoked/expired tokens, and missing tool scopes.
- Installer writes a user-facing, 0600 `security/generated/chatgpt-mcp.json` containing the workspace MCP URL and opaque bearer token.
- Do not expose cloudflared tunnel tokens or private signing keys as the ChatGPT bearer token.

## Test-first contract

Behavior under test:
- `provisionLocalOs` no longer creates `runtime/` and tests no longer expect it.
- `issueAgentAppToken` returns a separate opaque `bearerToken`, stores only its hash, and never stores raw bearer token material in `auth.json`.
- `verifyBearerMcpRequest` validates the opaque bearer token, checks route/tool scopes, updates last-used/audit state, and rejects revoked/unknown/missing-scope tokens.
- `server.ts /mcp` accepts bearer-only Authorization for MCP requests while preserving signed-header auth for existing machine callers.
- `provisionLocalOs` writes `security/generated/chatgpt-mcp.json` with `url`, `localUrl`, `tokenId`, `bearerToken`, `scopes`, and clear auth mode.

Existing pattern to follow:
- `tests/mcp-gateway.test.ts` already covers signed MCP auth and server `/mcp` behavior.
- `tests/security-gateway.test.ts` covers token lifecycle and revocation.
- `tests/install-state.test.ts` covers OS home shape.

Focused red command:
- `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/mcp-gateway.test.ts tests/install-state.test.ts`

Expected red failure before implementation:
- `runtime/` is still expected/created.
- no `bearerToken` exists on issued tokens.
- `/mcp` with only `Authorization: Bearer <opaque-token>` returns `MISSING_SIGNATURE`.
- no `chatgpt-mcp.json` is created.

## workspace-owned: validation evidence

- 2026-06-24 00:53:33 `review.run`: passed — OK
- 2026-06-24 00:53:51 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/security/simplify-local-mcp-bearer-access/current.json`, `.task/security/simplify-local-mcp-bearer-access/session.json`, `.task/security/simplify-local-mcp-bearer-access/workpad.md`, `.task/tasks/security/simplify-local-mcp-bearer-access.json`, `packages/os/scripts/lib/install-state.ts`, `packages/os/scripts/lib/security-gateway.ts`, `packages/os/scripts/server.ts`, `packages/os/tests/install-state.test.ts`, `packages/os/tests/mcp-gateway.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## Implementation summary

- Removed `runtime/` from the required OS home directory list and install-state expectations.
- Left `runs/` in place because `runtime-state.ts` uses it as `runsDir` for execution/run state.
- Added an opaque MCP bearer credential path separate from Cloudflare tunnel tokens and private signing keys.
- `auth.json` stores a hash of the opaque MCP credential and never stores the raw value.
- `security/generated/chatgpt-mcp.json` is generated with the workspace `/mcp` URL, local URL, token ID, opaque credential, auth mode, and scopes.
- `/mcp` now accepts either existing signed machine headers or a bearer-only Authorization header.
- Scope checking supports read wildcard `tool:*:read` for the ChatGPT MCP connection while preserving exact scope checks for signed callers.

## Validation

- Red: focused suite initially failed because `runtime/` still existed, no opaque MCP credential existed, and `/mcp` required signed headers.
- Green: `bun --cwd packages/os test tests/install-state.test.ts` passed, 14 tests.
- Green: `bun --cwd packages/os test tests/mcp-gateway.test.ts` passed, 9 tests, with credential-shaped output redacted.
- Green: `bash -n packages/os/scripts/bootstrap.sh`.
- Green: `bun --cwd packages/os test tests/security-gateway.test.ts tests/mcp-gateway.test.ts tests/install-state.test.ts tests/runtime-state.test.ts` passed, 47 tests, with credential-shaped output redacted.
- Green: `bun run os:release-install -- --dry-run` passed, bootstrap SHA unchanged at `4d110380f0b0b849fcfe30e7976806bb9da8d409a7de0ee8e6719159c08a67ba`.
- Green: `review.run --base origin/main`, 0 issues.
- Green: `verify --base origin/main --no-stamp`, publish-valid.

## Notes for Ko

The user-facing file is `~/.consuelo/os/security/generated/chatgpt-mcp.json`. It is intentionally sensitive and should be mode 0600 via the existing JSON writer.

# fix ChatGPT OAuth permission warning after reconnect

branch: `task/os/fix-chatgpt-oauth-permission-warning-after-reconnect`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2381/fix-chatgpt-oauth-permission-warning-after-reconnect
github pr: https://github.com/consuelohq/opensaas/pull/2381
started: 2026-09-04

## acceptance criteria

- [x] `tools/list` declares only the grantable OAuth scopes for both public OS tools.
- [x] Modern top-level and compatibility `_meta` security schemes remain identical.
- [x] Focused and related authorization/gateway tests pass before canary release.

## plan

1. Reproduce the missing per-tool OAuth metadata with a focused failing test.
2. Add the narrow public tool scope contract, including the Apps SDK compatibility mirror.
3. Verify, publish through the OS stream PR, release to canary, and validate the live descriptor.

## current status

- Implementation and review-follow-up are green; ready to refresh the stream PR and release.

## files changed

- `packages/os/scripts/lib/mcp-gateway.ts`
- `packages/os/tests/mcp-gateway.test.ts`


## workspace-owned: files changed

- Keep top-level `securitySchemes` and `_meta.securitySchemes` backed by the same constants so the compatibility contract cannot drift.

## workspace-owned: activity log

- 2026-09-04 20:55:56 fs.write: `.task/os/fix-chatgpt-oauth-permission-warning-after-reconnect/workpad.md`
- 2026-09-04 21:04:26 fs.write: `.task/os/fix-chatgpt-oauth-permission-warning-after-reconnect/workpad.md`

## workspace-owned: validation evidence

- 2026-09-04 21:04:52 `review.run`: passed — OK
- 2026-09-04 21:05:16 `verify`: passed — OK
- 2026-09-04 21:11:22 `verify`: passed — OK
- 2026-09-04 21:12:00 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: public MCP tools/list explicitly declares only grantable OAuth scopes for each exposed tool, so ChatGPT does not inherit or request an ungrantable permission after reconnect
existing local pattern: packages/os/scripts/lib/mcp-gateway.ts owns MCP_TOOL_DESCRIPTORS and packages/os/tests/mcp-gateway.test.ts asserts tools/list behavior
new or changed tests: packages/os/tests/mcp-gateway.test.ts will assert securitySchemes on get_steering and call; authority/edge tests will remain the discovery coverage
focused red command: bun vitest run tests/mcp-gateway.test.ts
expected red failure: tool descriptors currently omit securitySchemes entirely
no-test waiver: not applicable

- 2026-09-04 20:55:56 append: `.task/os/fix-chatgpt-oauth-permission-warning-after-reconnect/workpad.md`

- 2026-09-04 20:57:55 apply-patch: `packages/os/tests/mcp-gateway.test.ts`
- 2026-09-04 20:58:18 apply-patch: `packages/os/scripts/lib/mcp-gateway.ts`
## Findings and implementation

- User reproduced the partial-permissions banner after reconnect, invalidating the stale-token-only hypothesis.
- OpenAI developer-mode documentation requires Refresh after authentication, schema, or annotation changes; reconnect does not rescan metadata.
- Plugin permission inspection shows os inherits the normal Allow low-risk actions setting; that setting is not the OAuth banner cause.
- MCP tool descriptors omitted per-tool securitySchemes. Added exact OAuth contracts: get_steering requires route:/mcp:read and call requires mcp:call. No operator-only scope is exposed or granted.

## Validation

- Red: bun vitest run tests/mcp-gateway.test.ts failed on missing securitySchemes (28 passed, 1 failed).
- Green: same focused test passed (29/29).
- Related suite: mcp-gateway, central proxy scope, operator OAuth client, device authority worker, and workspace gateway proxy passed (105/105).
- Syntax: node ./scripts/check-syntax.js passed.
- Codex PR review identified the required Apps SDK `_meta.securitySchemes` compatibility mirror; it is now implemented and covered by the focused test. The related 105-test suite, syntax check, and full verification pass after the change.
- Remaining live acceptance: publish runtime, update local node, refresh the developer-mode ChatGPT connection metadata, then call get_steering.

- 2026-09-04 21:04:26 append: `.task/os/fix-chatgpt-oauth-permission-warning-after-reconnect/workpad.md`

- 2026-09-04 21:10:48 apply-patch: `packages/os/scripts/lib/mcp-gateway.ts`
- 2026-09-04 21:10:48 apply-patch: `packages/os/tests/mcp-gateway.test.ts`

- 2026-09-04 21:11:42 apply-patch: `.task/os/fix-chatgpt-oauth-permission-warning-after-reconnect/workpad.md`

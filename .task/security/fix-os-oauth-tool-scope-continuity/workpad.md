# Fix OS OAuth tool scope continuity

branch: `task/security/fix-os-oauth-tool-scope-continuity`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1510/fix-os-oauth-tool-scope-continuity
github pr: https://github.com/consuelohq/opensaas/pull/1510
started: 2026-07-15

## acceptance criteria

- [x] Keep OAuth token activity independent from per-tool scope authorization.
- [x] Let an existing ChatGPT token with `mcp:call` invoke ordinary read/write OS tools, including `mac.process`.
- [x] Keep dangerous tools denied unless the token has an explicit matching dangerous scope.
- [x] Return `403 MISSING_SCOPE` for an active token without sufficient tool scope, not `401 UNKNOWN_TOKEN`.
- [x] Preserve `401 UNKNOWN_TOKEN` for absent, expired, revoked, or resource-mismatched tokens.
- [x] Prove the behavior with focused worker and local-server tests before implementation, then run broader OS validation.

## plan

1. Add failing tests for scope-independent introspection and local `mcp:call` authorization.
2. Separate OAuth token activity checks from tool-scope checks.
3. Map `mcp:call` to ordinary tool read/write categories while preserving the dangerous boundary.
4. Run focused and broader auth/MCP tests, review, verify, publish, release, and validate through the OS connector only.

## current status

- Implementation and focused validation complete. Preparing review and publish.

## files changed

- `packages/os/cloudflare/os-device-authority/src/services/mcp-oauth.ts`
- `packages/os/scripts/server/services/oauth-introspection.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`
- `packages/os/tests/local-os-server-review-findings.test.ts`
- `.task/security/fix-os-oauth-tool-scope-continuity/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- Red proof: worker introspection returned `active: false` for `tool:mac.process:write`; local authorization returned `403` despite `mcp:call`.
- Focused green: 1 worker regression test and 5 local OAuth authorization tests passed.
- Full device-authority worker suite: 24 passed.
- OS syntax/typecheck: passed.
- `git diff --check`: passed.
- Existing broader local-server and MCP-gateway Vitest runs remain blocked by their pre-existing Node/Bun module-loading failures (`bun:sqlite`, and under Bun-run Vitest a `zod` interop failure). The changed auth tests pass independently.
- 2026-07-15 05:05:39 `review.run`: passed — OK
- 2026-07-15 05:06:29 `verify`: passed — OK

## key decisions

- OAuth introspection establishes token identity, validity, resource binding, and granted scopes; the local resource server owns per-tool authorization.
- `mcp:call` authorizes ordinary read/write MCP tool calls. It never implicitly grants the `dangerous` category.
- Existing connected ChatGPT tokens should recover without reconnecting because they already carry `mcp:call`.

## notes for ko

- No workspace connector fallback is valid for this test because it targets a different computer. Live proof must stay on OS.

## improvements noticed

- none yet

## issues and recovery

- Initial `bun test` invocation used Bun's compatibility test runner and lacked Vitest global APIs. Re-ran through the package's `vitest run` script.
- Full local-server and MCP-gateway suites hit existing runtime-loader failures outside this change; recorded above rather than weakening or rewriting those tests.

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-15 04:56:22 apply-patch: `.task/security/fix-os-oauth-tool-scope-continuity/workpad.md`
- 2026-07-15 04:57:32 apply-patch: `packages/os/tests/os-device-authority-worker.test.ts`
- 2026-07-15 04:57:32 apply-patch: `packages/os/tests/local-os-server-review-findings.test.ts`
- 2026-07-15 05:00:58 apply-patch: `packages/os/cloudflare/os-device-authority/src/services/mcp-oauth.ts`
- 2026-07-15 05:00:58 apply-patch: `packages/os/scripts/server/services/oauth-introspection.ts`

- 2026-07-15 05:04:48 apply-patch: `.task/security/fix-os-oauth-tool-scope-continuity/workpad.md`

## workspace-owned: test selection

- changed files: `.task/security/fix-os-oauth-tool-scope-continuity/current.json`, `.task/security/fix-os-oauth-tool-scope-continuity/session.json`, `.task/security/fix-os-oauth-tool-scope-continuity/workpad.md`, `.task/tasks/security/fix-os-oauth-tool-scope-continuity.json`, `packages/os/cloudflare/os-device-authority/src/services/mcp-oauth.ts`, `packages/os/scripts/server/services/oauth-introspection.ts`, `packages/os/tests/local-os-server-review-findings.test.ts`, `packages/os/tests/os-device-authority-worker.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

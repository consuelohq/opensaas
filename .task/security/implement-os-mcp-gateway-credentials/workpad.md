# Implement OS MCP Gateway Credentials

## Acceptance criteria

- Keep implementation in `packages/os`; do not modify Twenty MCP code.
- Keep `/mcp` as the compatibility route, backed by the Consuelo OS gateway boundary.
- Add first-class OS MCP adapter for JSON-RPC `initialize`, `tools/list`, and `tools/call`.
- Reuse existing Ed25519 verifier-based credential model and extend persisted status metadata with subject, device, connector, connection, app/caller, workspace, scopes, expiry, rotation, revocation, and last-use fields.
- Raw private credential material is returned only on issue/rotate and is never returned by list/get/status or persisted.
- Bind MCP use to workspace, caller/app identity, method/path/body signature, timestamp, nonce, and manifest-backed scopes.
- Audit issue/rotate/revoke/use/deny decisions without raw body, raw nonce, private key, tunnel origin, or local absolute paths.
- Add focused tests only after static safety review; no broad local security suite until reviewed.

## Design decision

`/mcp` remains the external compatibility route. The implementation should treat it as an OS gateway service endpoint rather than adding a Twenty dependency or changing public route shape.

## Files read

- `CODING-STANDARDS.md`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/server.ts`
- `packages/os/scripts/lib/manifest.ts`
- `packages/os/scripts/lib/types.ts`
- `packages/os/tests/security-gateway.test.ts`
- `packages/os/tests/safe-temp-cleanup.ts`
- `.task/sites/trace-gateway-boundary-contracts/workpad.md`

## Safety preflight

- Static scan completed before focused test execution.
- `packages/os/tests/mcp-gateway.test.ts`: no destructive command/sink literals found.
- `packages/os/scripts/lib/mcp-gateway.ts`: no destructive command/sink literals found.
- `packages/os/scripts/server.ts`: no destructive command/sink literals found.
- `packages/os/scripts/lib/security-gateway.ts`: one pre-existing `unlinkSync` in secure JSON temp-file cleanup.
- Broader `packages/os/tests/security-gateway.test.ts` remains outside the run scope because it uses subprocess execution and temp cleanup paths.

## Validation evidence

- `bun run test tests/mcp-gateway.test.ts`: passed, 6 tests.
- `bun run typecheck`: passed, workspace script syntax checks passed.
- `review.run` with tests disabled: passed, 0 must-fix issues.
- Accidental server process from an earlier bad test import was checked; PID was no longer running.

- 2026-06-18 22:00:15 apply-patch: `packages/os/scripts/lib/security-gateway.ts`
- 2026-06-18 22:02:59 apply-patch: `packages/os/scripts/lib/security-gateway.ts`
- 2026-06-18 22:03:07 apply-patch: `packages/os/scripts/lib/security-gateway.ts`
- 2026-06-18 22:03:18 apply-patch: `packages/os/scripts/lib/security-gateway.ts`
- 2026-06-18 22:03:25 apply-patch: `packages/os/scripts/lib/security-gateway.ts`
- 2026-06-18 22:03:36 apply-patch: `packages/os/scripts/lib/security-gateway.ts`
- 2026-06-18 22:03:45 apply-patch: `packages/os/scripts/lib/security-gateway.ts`
- 2026-06-18 22:04:34 apply-patch: `packages/os/scripts/lib/security-gateway.ts`
- 2026-06-18 22:05:52 apply-patch: `packages/os/scripts/lib/mcp-gateway.ts`
- 2026-06-18 22:06:18 apply-patch: `packages/os/scripts/server.ts`
- 2026-06-18 22:08:11 apply-patch: `packages/os/tests/mcp-gateway.test.ts`
- 2026-06-18 22:08:42 apply-patch: `packages/os/scripts/server.ts`
- 2026-06-18 22:08:51 apply-patch: `packages/os/tests/mcp-gateway.test.ts`
- 2026-06-18 22:09:10 apply-patch: `packages/os/tests/mcp-gateway.test.ts`
- 2026-06-18 22:09:53 apply-patch: `packages/os/scripts/server.ts`
- 2026-06-18 22:10:01 apply-patch: `packages/os/scripts/server.ts`

## workspace-owned: validation evidence

Pending.
- 2026-06-18 22:00:15 apply-patch: `packages/os/scripts/lib/security-gateway.ts`
- 2026-06-18 22:02:59 apply-patch: `packages/os/scripts/lib/security-gateway.ts`
- 2026-06-18 22:03:07 apply-patch: `packages/os/scripts/lib/security-gateway.ts`
- 2026-06-18 22:03:18 apply-patch: `packages/os/scripts/lib/security-gateway.ts`
- 2026-06-18 22:03:25 apply-patch: `packages/os/scripts/lib/security-gateway.ts`
- 2026-06-18 22:03:36 apply-patch: `packages/os/scripts/lib/security-gateway.ts`
- 2026-06-18 22:03:45 apply-patch: `packages/os/scripts/lib/security-gateway.ts`
- 2026-06-18 22:04:34 apply-patch: `packages/os/scripts/lib/security-gateway.ts`
- 2026-06-18 22:05:52 apply-patch: `packages/os/scripts/lib/mcp-gateway.ts`
- 2026-06-18 22:06:18 apply-patch: `packages/os/scripts/server.ts`
- 2026-06-18 22:08:11 apply-patch: `packages/os/tests/mcp-gateway.test.ts`
- 2026-06-18 22:08:42 apply-patch: `packages/os/scripts/server.ts`
- 2026-06-18 22:08:51 apply-patch: `packages/os/tests/mcp-gateway.test.ts`
- 2026-06-18 22:09:10 apply-patch: `packages/os/tests/mcp-gateway.test.ts`
- 2026-06-18 22:09:53 apply-patch: `packages/os/scripts/server.ts`
- 2026-06-18 22:10:01 apply-patch: `packages/os/scripts/server.ts`
- 2026-06-18 22:11:14 `review.run`: passed — OK
- 2026-06-18 22:11:34 apply-patch: `packages/os/scripts/server.ts`
- 2026-06-18 22:11:54 `review.run`: passed — OK
- 2026-06-18 22:12:13 apply-patch: `.task/security/implement-os-mcp-gateway-credentials/workpad.md`
- 2026-06-18 22:12:41 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/security/close-security-report-gaps/current.json`, `.task/security/close-security-report-gaps/session.json`, `.task/security/close-security-report-gaps/verify.json`, `.task/security/close-security-report-gaps/workpad.md`, `.task/security/implement-os-mcp-gateway-credentials/current.json`, `.task/security/implement-os-mcp-gateway-credentials/session.json`, `.task/security/implement-os-mcp-gateway-credentials/workpad.md`, `.task/security/plan-security-tightening-pass/current.json`, `.task/security/plan-security-tightening-pass/evidence-log.json`, `.task/security/plan-security-tightening-pass/read-log.json`, `.task/security/plan-security-tightening-pass/session.json`, `.task/security/plan-security-tightening-pass/workpad.md`, `.task/tasks/security/close-security-report-gaps.json`, `.task/tasks/security/implement-os-mcp-gateway-credentials.json`, `.task/tasks/security/plan-security-tightening-pass.json`, `packages/os/docs/security-tightening-evidence.md`, `packages/os/scripts/lib/mcp-gateway.ts`, `packages/os/scripts/lib/security-gateway.ts`, `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`, `packages/os/scripts/server.ts`, `packages/os/tests/cloudflare-edge-router.test.ts`, `packages/os/tests/dangerous-material-policy.test.ts`, `packages/os/tests/local-guardrails.test.ts`, `packages/os/tests/mcp-gateway.test.ts`, `packages/os/tests/safe-temp-cleanup.ts`, `packages/os/tests/security-gateway.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

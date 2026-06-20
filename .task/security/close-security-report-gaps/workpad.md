# Security tightening follow-up workpad

## Acceptance criteria

- Next PR clearly closes or explicitly documents the MCP persistent credential gap.
- MCP connected-app credentials, if implemented, are scoped to subject/workspace/device/connector/scopes.
- Raw credentials are never persisted.
- Credential issue/rotate/revoke/use decisions are auditable without logging secrets.
- Cache policy has negative tests for revoked/disabled/private/missing-route D1 results.
- Caddy hardening remains intact.
- Manifest-backed tool scope enforcement remains intact and fails closed.
- Test cleanup remains constrained to verified temp directories.
- Destructive test payloads are redacted or inert where possible.
- Validation evidence is recorded here.
- Follow-up work is pushed, PR’d, and propagated with workspace push/pr/prs tools.

## Files read

- CODING-STANDARDS.md
- packages/os/scripts/lib/security-gateway.ts
- packages/os/scripts/server.ts
- packages/os/scripts/lib/workspace-cloudflare-edge-router.ts
- packages/os/tests/security-gateway.test.ts
- packages/os/tests/cloudflare-edge-router.test.ts
- packages/os/tests/dangerous-material-policy.test.ts
- packages/os/tests/safe-temp-cleanup.ts
- packages/twenty-server/src/engine/api/mcp/controllers/mcp-core.controller.ts
- packages/twenty-server/src/engine/api/mcp/services/mcp-protocol.service.ts
- packages/twenty-server/src/engine/api/mcp/mcp.module.ts
- packages/twenty-server/src/engine/api/mcp/controllers/__tests__/mcp-core.controller.spec.ts
- packages/twenty-server/src/engine/api/mcp/services/__tests__/mcp-protocol.service.spec.ts
- packages/twenty-server/src/engine/api/mcp/services/mcp-tool-executor.service.ts
- packages/twenty-server/src/engine/core-modules/api-key/api-key.entity.ts

## Safety preflight

Static scan completed before running tests. Scope: packages/os/tests and packages/twenty-server/src/engine/api/mcp.

Findings:

- No direct dangerous delete shell literal was found in the scanned target paths.
- Dangerous test payloads in dangerous-material-policy.test.ts are built from joined fragments and char codes instead of raw destructive command strings.
- Recursive cleanup calls remain common across the wider OS test suite, but the touched security tests mostly use removeSafeTempDir(), which requires the target to live under the OS temp directory and match an expected prefix before calling rmSync().
- security-gateway.test.ts still has direct rmSync calls inside tempHome for generated logs and generated auth/Caddy artifacts; these are constrained to mkdtemp-created temp homes but can be tightened further if desired.
- Several tests use execFileSync/spawnSync to run Bun, Git, or SQLite in temp workspaces. No local tests have been executed in this task yet.

Decision: focused touched tests are eligible only after this inventory is reviewed and any remaining direct cleanup in touched tests is either accepted as temp-scoped or converted to removeSafeTempDir()/targeted file deletion.

## MCP persistent credential gap

Initial inspection confirms the current Twenty MCP path is limited to JWT/workspace auth and API-key auth for the JSON-RPC `/mcp` POST endpoint. I did not find `/mcp/oauth/start`, `/mcp/oauth/callback`, `/mcp/connections`, persistent connected-app credential records, grant audit trail, or raw credential non-persistence checks in the inspected MCP controller/service/module/test files.

Decision pending: implement a scoped persistent MCP credential lifecycle now if the existing core module patterns can support it without a broad migration, otherwise document a follow-up security gap explicitly in this PR.

## Cache policy gap

PR #1138 already resolves D1 policy before public cache hits. Remaining work is negative tests proving cached snapshots are not served for denied/private/missing policy results.

## Deployment/provider evidence gap

Repo-local Cloudflare evidence found in workspace-edge and os-device-authority wrangler configs. No repo-local Cloudflare WAF rule, provider IP allowlist, or provider-level filtering configuration was found, so provider filtering remains an evidence gap until read-only provider config can be checked or IaC is added.

## Task metadata decision

The repository already tracks broad `.task` history on main. I left prior security task metadata intact and added this task workpad rather than deleting only the previous security task metadata.

## Validation evidence

- Static preflight scan: completed via code.call/python before any test execution.
- Focused cache-policy test: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test tests/cloudflare-edge-router.test.ts` from `packages/os` passed, 1 file / 14 tests.
- Diff hygiene: `git diff --check` passed.
- Changed-file secret/safety scan: no real secrets or destructive literals found. The only secret-pattern hits were existing test fixture values named `edge-test-secret`.
- Workspace review: `review.run` passed for this branch with 0 issues in my changes. It reported 10 pre-existing `ERROR_HANDLING` findings in `packages/os/scripts/context.js` and `packages/os/scripts/task-start.js`.

## PR propagation

- Task branch created: task/security/close-security-report-gaps
- Draft PR created by task.start: https://github.com/consuelohq/opensaas/pull/1141
- Push/pr/prs propagation for follow-up changes: pending.

- 2026-06-18 14:01:17 apply-patch: `packages/os/tests/cloudflare-edge-router.test.ts`
- 2026-06-18 14:02:27 apply-patch: `packages/os/docs/security-tightening-evidence.md`

- 2026-06-18 14:03:09 apply-patch: `.task/security/close-security-report-gaps/workpad.md`

## workspace-owned: validation evidence

- Static preflight scan: completed via code.call/python before any test execution.
- Focused cache-policy test: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun run test tests/cloudflare-edge-router.test.ts` from `packages/os` passed, 1 file / 14 tests.
- 2026-06-18 14:04:13 `review.run`: passed — OK
- 2026-06-18 14:04:27 apply-patch: `.task/security/close-security-report-gaps/workpad.md`
- 2026-06-18 14:05:03 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/security/close-security-report-gaps/current.json`, `.task/security/close-security-report-gaps/session.json`, `.task/security/close-security-report-gaps/workpad.md`, `.task/security/plan-security-tightening-pass/current.json`, `.task/security/plan-security-tightening-pass/evidence-log.json`, `.task/security/plan-security-tightening-pass/read-log.json`, `.task/security/plan-security-tightening-pass/session.json`, `.task/security/plan-security-tightening-pass/workpad.md`, `.task/tasks/security/close-security-report-gaps.json`, `.task/tasks/security/plan-security-tightening-pass.json`, `packages/os/docs/security-tightening-evidence.md`, `packages/os/scripts/lib/security-gateway.ts`, `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`, `packages/os/scripts/server.ts`, `packages/os/tests/cloudflare-edge-router.test.ts`, `packages/os/tests/dangerous-material-policy.test.ts`, `packages/os/tests/local-guardrails.test.ts`, `packages/os/tests/safe-temp-cleanup.ts`, `packages/os/tests/security-gateway.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

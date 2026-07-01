# address mcp gateway review comments

branch: `task/security/address-mcp-gateway-review-comments`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1144/address-mcp-gateway-review-comments
github pr: https://github.com/consuelohq/opensaas/pull/1144
started: 2026-06-18

## acceptance criteria

- [x] Verify each linked and pasted review finding against current `stream/security` code.
- [x] Fix only still-valid findings with minimal changes.
- [x] Keep validation focused; do not run broad security suites with unreviewed destructive cleanup paths.

## plan

1. Merge current `origin/stream/security` into the task branch because task start bootstrapped from `main`.
2. Fetch PR #1143 review threads and compare with pasted findings.
3. Patch still-valid findings in `packages/os` only.
4. Run static safety scan, focused tests, typecheck, and review gate.

## current status

- Four findings verified and fixed.
- PR #1143 linked threads: MCP facade-tool listing and legacy credential migration.
- Pasted findings: symlink-safe temp cleanup and `handleRequest` indentation.

## files changed

- `packages/os/scripts/lib/mcp-gateway.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/server.ts`
- `packages/os/tests/mcp-gateway.test.ts`
- `packages/os/tests/safe-temp-cleanup.test.ts`
- `packages/os/tests/safe-temp-cleanup.ts`

## workspace-owned: files changed

- `packages/os/scripts/lib/mcp-gateway.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/server.ts`
- `packages/os/tests/mcp-gateway.test.ts`
- `packages/os/tests/safe-temp-cleanup.test.ts`
- `packages/os/tests/safe-temp-cleanup.ts`

## workspace-owned: activity log

- 2026-06-18: fetched PR #1143 review threads; found two linked unresolved threads.
- 2026-06-18: confirmed both pasted findings against current code.
- 2026-06-18: static dangerous-test scan found no destructive command/sink literals in touched tests; only pre-existing `unlinkSync` secure temp cleanup in `security-gateway.ts`.

## workspace-owned: validation evidence

- `bun run test tests/mcp-gateway.test.ts tests/safe-temp-cleanup.test.ts`: passed, 2 files / 9 tests.
- `bun run typecheck`: passed, workspace script syntax checks passed.
- 2026-06-18 22:37:12 `review.run`: passed — OK
- 2026-06-18 22:37:55 `verify`: passed — OK

## key decisions

- MCP lists and accepts only callable OS skills because `/mcp` dispatches through `executeCall()`.
- Legacy secret-backed gateway tokens now fail closed with a rotation-required error instead of being normalized away.
- `removeSafeTempDir()` resolves real filesystem paths before containment checks.

## notes for ko

- All four supplied findings were valid and fixed.

## improvements noticed

- none yet

## issues and recovery

- Task start used `main`; recovered by merging `origin/stream/security` before verification and edits.

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-06-18 22:34:36 apply-patch: `packages/os/tests/safe-temp-cleanup.ts`
- 2026-06-18 22:34:53 apply-patch: `packages/os/scripts/lib/mcp-gateway.ts`
- 2026-06-18 22:35:14 apply-patch: `packages/os/scripts/lib/security-gateway.ts`
- 2026-06-18 22:35:48 apply-patch: `packages/os/tests/mcp-gateway.test.ts`
- 2026-06-18 22:36:25 apply-patch: `packages/os/tests/safe-temp-cleanup.test.ts`

- 2026-06-18 22:37:36 apply-patch: `.task/security/address-mcp-gateway-review-comments/workpad.md`

## workspace-owned: test selection

- changed files: `.task/security/address-mcp-gateway-review-comments/current.json`, `.task/security/address-mcp-gateway-review-comments/session.json`, `.task/security/address-mcp-gateway-review-comments/workpad.md`, `.task/security/close-security-report-gaps/current.json`, `.task/security/close-security-report-gaps/session.json`, `.task/security/close-security-report-gaps/verify.json`, `.task/security/close-security-report-gaps/workpad.md`, `.task/security/implement-os-mcp-gateway-credentials/current.json`, `.task/security/implement-os-mcp-gateway-credentials/session.json`, `.task/security/implement-os-mcp-gateway-credentials/verify.json`, `.task/security/implement-os-mcp-gateway-credentials/workpad.md`, `.task/security/plan-security-tightening-pass/current.json`, `.task/security/plan-security-tightening-pass/evidence-log.json`, `.task/security/plan-security-tightening-pass/read-log.json`, `.task/security/plan-security-tightening-pass/session.json`, `.task/security/plan-security-tightening-pass/workpad.md`, `.task/tasks/security/address-mcp-gateway-review-comments.json`, `.task/tasks/security/close-security-report-gaps.json`, `.task/tasks/security/implement-os-mcp-gateway-credentials.json`, `.task/tasks/security/plan-security-tightening-pass.json`, `packages/os/docs/security-tightening-evidence.md`, `packages/os/scripts/lib/mcp-gateway.ts`, `packages/os/scripts/lib/security-gateway.ts`, `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`, `packages/os/scripts/server.ts`, `packages/os/tests/cloudflare-edge-router.test.ts`, `packages/os/tests/dangerous-material-policy.test.ts`, `packages/os/tests/local-guardrails.test.ts`, `packages/os/tests/mcp-gateway.test.ts`, `packages/os/tests/safe-temp-cleanup.test.ts`, `packages/os/tests/safe-temp-cleanup.ts`, `packages/os/tests/security-gateway.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

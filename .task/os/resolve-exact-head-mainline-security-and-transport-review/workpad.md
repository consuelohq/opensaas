# resolve exact head mainline security and transport review

branch: `task/os/resolve-exact-head-mainline-security-and-transport-review`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1722/resolve-exact-head-mainline-security-and-transport-review
github pr: https://github.com/consuelohq/opensaas/pull/1722
started: 2026-07-29

## Discovery

- Exact-head Codex review targets MCP stdio framing, served snapshot hashing, Caddy mTLS enforcement, and persisted Bun discovery during daemon repair.
- Delayed CodeRabbit corroborates MCP parser hardening and Caddy mTLS placement; its remaining lifecycle and test suggestions will be classified against current stream code.
- Ownership is bounded to packages/os runtime and security scripts plus focused regressions.

## Test-first contract

- Extend MCP connectivity coverage to prove newline-delimited responses and iterative handling of long blank-line input.
- Add a workspace-edge regression proving the response hash is computed from served HTML bytes, not copied from route metadata.
- Add Caddy configuration coverage proving mTLS can never be emitted on a plaintext listener.
- Add clean-shell daemon repair coverage proving persisted flattened BUN_BIN is loaded before local-agent verification.
- Run focused red tests before implementation, then focused green, strict review, and full verification.

## acceptance criteria

- [x] Native MCP clients receive newline-delimited JSON-RPC and blank input lines cannot recurse.
- [x] Workspace snapshot responses fail closed when served bytes differ from D1 content authority.
- [x] Caddy rejects mTLS configuration while its tunnel origin is intentionally plaintext loopback.
- [x] Clean-shell daemon repair resolves Bun from flattened Consuelo install state.
- [x] Focused red/green evidence, strict review, and full verification pass.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Exact-head Codex findings are fixed and focused tests pass: 86 tests, 480 assertions.
- Corroborating finish-line and shell checks pass: 18 tests, 92 assertions, plus `bash -n`.
- Strict review reports zero issues; full verification is publish-valid.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-29 07:13:33 `review.run`: passed — OK
- 2026-07-29 07:13:44 `verify`: passed — OK
- 2026-07-29 07:15:43 `verify`: passed — OK

## key decisions

- mTLS is rejected on the plaintext loopback tunnel origin instead of emitting a policy Caddy cannot enforce.
- Snapshot hash mismatches return the existing safe 503 boundary and never serve corrupted HTML.
- The delayed Qodo dry-run credential report is stale: credential materialization is already wholly inside `if (!dryRun)`; remaining unresolved Qodo entries are naming/style rules or D1 migration conventions, not runtime defects, and strict repository review reports no violations.
- CodeRabbit's recursive MCP parser and invalid mTLS placement findings are resolved. Its remaining lifecycle wrapping and test-style notes are non-functional refactor suggestions; typed errors are idempotently preserved and the focused lifecycle suite remains green.

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

- 2026-07-29 07:06:46 apply-patch: `.task/os/resolve-exact-head-mainline-security-and-transport-review/workpad.md`
- 2026-07-29 07:10:45 apply-patch: `packages/os/tests/local-agent-connectivity.test.ts`
- 2026-07-29 07:10:45 apply-patch: `packages/os/tests/cloudflare-edge-router.test.ts`
- 2026-07-29 07:10:45 apply-patch: `packages/os/tests/security-gateway.test.ts`
- 2026-07-29 07:10:45 apply-patch: `packages/os/tests/workspace-gateway-contract.test.ts`
- 2026-07-29 07:10:45 apply-patch: `packages/os/tests/installer-runtime-dependencies.test.ts`
- 2026-07-29 07:12:12 apply-patch: `packages/os/scripts/mcp-stdio.ts`
- 2026-07-29 07:12:12 apply-patch: `packages/os/scripts/lib/local-agent-connectivity.ts`
- 2026-07-29 07:12:12 apply-patch: `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- 2026-07-29 07:12:12 apply-patch: `packages/os/scripts/lib/security-gateway.ts`
- 2026-07-29 07:12:12 apply-patch: `packages/os/scripts/install-system-daemons.sh`
- 2026-07-29 07:12:34 apply-patch: `packages/os/tests/local-agent-connectivity.test.ts`

## workspace-owned: test selection

- changed files: `.task/os/resolve-exact-head-mainline-security-and-transport-review/current.json`, `.task/os/resolve-exact-head-mainline-security-and-transport-review/session.json`, `.task/os/resolve-exact-head-mainline-security-and-transport-review/verify.json`, `.task/os/resolve-exact-head-mainline-security-and-transport-review/workpad.md`, `.task/tasks/os/resolve-exact-head-mainline-security-and-transport-review.json`, `packages/os/scripts/install-system-daemons.sh`, `packages/os/scripts/lib/local-agent-connectivity.ts`, `packages/os/scripts/lib/security-gateway.ts`, `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`, `packages/os/scripts/mcp-stdio.ts`, `packages/os/tests/cloudflare-edge-router.test.ts`, `packages/os/tests/installer-runtime-dependencies.test.ts`, `packages/os/tests/local-agent-connectivity.test.ts`, `packages/os/tests/security-gateway.test.ts`, `packages/os/tests/workspace-gateway-contract.test.ts`
- matched rules: `auto:@consuelo/os:package-test`
- selected suites: `@consuelo/os package test`
- run results: `@consuelo/os package test` passed
- failed suites: none

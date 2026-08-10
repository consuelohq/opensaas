# mcp auth principal context

branch: `task/os/mcp-auth-principal-context`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1819/mcp-auth-principal-context
github pr: https://github.com/consuelohq/opensaas/pull/1819
started: 2026-08-10

## acceptance criteria

- [x] MCP authorization exposes a typed authenticated principal instead of discarding verified OAuth/local caller identity.
- [x] OAuth introspection propagates verified `sub`, `client_id`, workspace binding, and granted scopes into that principal context.
- [x] OAuth bearer remains the end-to-end authority for normal central/workspace MCP; no delegated principal/scope headers were added.
- [x] Cloudflare central MCP performs defense-in-depth MCP operation grant checks before forwarding, while the OS node remains authoritative for exact manifest-derived tool/action scope through OAuth re-introspection.
- [x] Client-controlled workspace/routing identity headers remain overwritten by server-derived route data before forwarding.
- [x] MCP HTTP requests reject an explicitly invalid `Origin` while preserving native clients that omit `Origin` and trusted/configured origins.
- [x] OAuth authorization responses include RFC 9207 issuer (`iss`) binding.
- [x] Advertised ChatGPT Client ID Metadata Document support performs actual metadata validation, including client ID and redirect URI binding.
- [x] Existing raw and decoded dangerous-material admission remains before execution and Branch 1 security regressions stay green.
- [x] Existing machine credentials, local bearer tokens, OAuth, workspace routing, MCP sessions, and Caddy generation remain compatible.
- [x] Request tracing receives a safe principal correlation key/context without logging raw credentials, subjects, client IDs, or bearer tokens.
- [x] No MCP session removal, worker-pool work, replay-store redesign, steering-guard atomicity work, or Caddy load-balancing changes were made.

## implementation

- Added `AuthenticatedMcpPrincipal` with stable `principalKey` derived from verified identity fields; scopes are deliberately excluded from identity derivation so grant changes do not create a new principal.
- Added principal-producing OAuth, local-bearer, machine, and workspace-edge authentication results while preserving legacy authorization wrappers.
- Kept OAuth bearer end-to-end through central/workspace MCP; no custom delegated identity headers were introduced.
- Added coarse central `tools/call` grant enforcement (`mcp:read` for `get_steering`, `mcp:call` for other calls); exact dynamic tool/action scope is still recomputed and enforced on the OS node.
- Added MCP Origin validation before request execution. Missing Origin remains valid for native clients; explicit untrusted/null origins fail closed; configured trusted origins are supported.
- Added OAuth authorization response `iss` and real dynamic ChatGPT Client ID Metadata Document validation.
- Added successful MCP authentication trace correlation using only workspace, route, required scope, auth mode, and `principalKey`.
- Preserved `Mcp-Session-Id` issuance/session-isolated steering guard behavior unchanged; principal context does not replace the existing transport-session guard key in this branch.

## test-first contract

Behavior/security changes were restored and re-run red before production changes after the outage:

- Pre-outage red traces: `trc_7b5683ead886`, `trc_7ba40950b56b`, `trc_de993b6ef0db`.
- Recovered red run `trc_246b59ebbe36` reproduced the intended gaps: missing principal export, missing Origin validator, route-only central `tools/call` forwarded with 200, OAuth callback `iss` absent, mismatched CIMD accepted with 302, and the new trace recorder absent.
- The authority worker suite uses Vitest; Bun-native unit tests use `bun test`.

## files changed

- `packages/os/cloudflare/os-device-authority/src/routes/mcp-oauth.ts`
- `packages/os/cloudflare/os-device-authority/src/services/mcp-oauth.ts`
- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- `packages/os/cloudflare/os-device-authority/src/utils.ts`
- `packages/os/scripts/lib/trace-persistence.ts`
- `packages/os/scripts/server/middleware/auth.ts`
- `packages/os/scripts/server/routes/mcp.ts`
- `packages/os/scripts/server/services/oauth-introspection.ts`
- `packages/os/tests/fixtures/trace-persistence-runtime.ts`
- `packages/os/tests/mcp-gateway-action-scopes.test.ts`
- `packages/os/tests/mcp-gateway.test.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`
- `packages/os/tests/trace-persistence.test.ts`
- `packages/os/scripts/server/security/authenticated-principal.ts`
- `packages/os/scripts/server/security/mcp-origin.ts`
- `packages/os/tests/mcp-authenticated-principal.test.ts`
- `packages/os/tests/mcp-central-proxy-scope.test.ts`
- `packages/os/tests/mcp-origin.test.ts`


## validation evidence

- `trc_8bcc0f35aae9`: 17/17 Bun principal/Origin/central-scope/action-scope tests; 43/43 MCP gateway + authority worker tests; principal trace regression passed.
- `trc_ca4ab9c3c00b`: 86/86 adjacent security tests across workspace edge auth, tool scope authorization, operator OAuth, authority architecture, universal login, and local Hono architecture.
- `trc_cbcd7e4aae0b`: security gateway/Caddy 25/25 and workspace gateway node proxy 7/7; 14 environment-gated edge integration tests skipped by their existing gate.
- `trc_77ba4b5b3ce2`: MCP gateway 16/16 before the added Origin integration case; `trc_8bcc0f35aae9` supersedes it with 17/17.
- `trc_3a2efbf128be`: post-review-error-boundary OAuth action-scope 11/11 and MCP gateway 17/17.
- `trc_cebccaff6732`: package syntax/typecheck command passed.
- `trc_67d02fae9e5c`: `git diff --check` passed.
- `trc_29364daa0526`: strict `review.run` passed with 0 branch issues after fixing its two error-handling findings.

### known unrelated baseline failure

Running the entire `tests/trace-persistence.test.ts` file currently has one unchanged baseline failure: its pre-existing `fail-open` fixture invokes the removed `context` facade alias and now receives `NOT_FOUND`. The Branch 1 diff does not modify that fixture path; `git diff` shows only the new principal-trace import/scenario/test. The Branch 1 principal-trace regression itself passes. This alias drift is intentionally not fixed in this security branch.

## key decisions

- Preserve stateful MCP session compatibility in Branch 1. Session removal belongs to Branch 3.
- Treat verified principal context and MCP transport-session steering guard identity as separate concepts; do not change the existing session-isolation contract here.
- Preserve OAuth bearer end-to-end; edge signatures remain routing-integrity mechanisms, not delegated OAuth identity containers.
- Keep exact tool/action policy authoritative on the OS node to prevent policy drift between Cloudflare and the manifest.
- Missing Origin is valid for native/non-browser MCP clients; explicit untrusted Origin fails closed.
- `requestId` remains correlation metadata; this branch does not introduce idempotency.

## recovery notes

- The OS outage returned 502s during the first green verification and the temporary worktree contents were later lost before commit.
- Branch/PR refs contained only the bootstrap commit; recovery used durable task trace patch payloads rather than guessed reconstruction.
- The stale worktree residue contained only `.task`; it was preserved by rename to `task-os-mcp-auth-principal-context.recovery-backup-20260810T0331Z` before `task.start` recreated the same branch/worktree.
- Same PR #1819 and original task session `tsk_ed7327e9ccf1` were reattached; no duplicate branch or PR was created.

## CI wait cycle

Wait reason: GitHub CI for published PR #1819 is still propagating with 15 checks pending and 0 failed.
Duration: bounded polling, 30s first interval.
Resume action: re-read PR #1819 checks immediately after wake.
Expected signal: pending checks decrease or reach zero with no failures.
Fallback: if checks remain pending, record the observed state and stop after a bounded cycle; if any check fails, inspect that check before making any code change.

Observed result after first 30s poll: PR #1819 has 49 checks total, 0 failed, 4 pending. `Consuelo / verify` and `Consuelo / Sites Gateway + Cloudflare` are among the remaining in-progress jobs.
Next decision: run one final 30s bounded poll, then stop if the remaining jobs are still pending; inspect immediately if any failure appears.

Observed result after final 30s poll: PR #1819 has 50 checks total, 0 failed, 4 pending. `Consuelo / verify` and `Consuelo / Sites Gateway + Cloudflare` remain in progress.
Next decision: bounded CI wait is complete; stop polling with no failure signal. No code change is warranted from CI at this point.

## remaining gate

- [x] `verify` full task safety gate: `trc_c40a3c8af4e9` — passed, publish-valid, 0 review issues, 0 DB risks.
- [ ] publish/refresh PR #1819 only after verify outcome is recorded.

- 2026-08-10 03:40:39 write: `.task/os/mcp-auth-principal-context/workpad.md`

## workspace-owned: files changed

- `.task/os/mcp-auth-principal-context/workpad.md`
- `packages/os/cloudflare/os-device-authority/src/routes/mcp-oauth.ts`
- `packages/os/cloudflare/os-device-authority/src/services/mcp-oauth.ts`
- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- `packages/os/cloudflare/os-device-authority/src/utils.ts`
- `packages/os/scripts/lib/trace-persistence.ts`
- `packages/os/scripts/server/middleware/auth.ts`
- `packages/os/scripts/server/routes/mcp.ts`
- `packages/os/scripts/server/security/authenticated-principal.ts`
- `packages/os/scripts/server/security/mcp-origin.ts`
- `packages/os/scripts/server/services/oauth-introspection.ts`
- `packages/os/tests/fixtures/trace-persistence-runtime.ts`
- `packages/os/tests/mcp-authenticated-principal.test.ts`
- `packages/os/tests/mcp-central-proxy-scope.test.ts`
- `packages/os/tests/mcp-gateway-action-scopes.test.ts`
- `packages/os/tests/mcp-gateway.test.ts`
- `packages/os/tests/mcp-origin.test.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`
- `packages/os/tests/trace-persistence.test.ts`

## workspace-owned: activity log

- 2026-08-10 03:40:39 fs.write: `.task/os/mcp-auth-principal-context/workpad.md`

## workspace-owned: validation evidence

- `trc_8bcc0f35aae9`: 17/17 Bun principal/Origin/central-scope/action-scope tests; 43/43 MCP gateway + authority worker tests; principal trace regression passed.
- `trc_ca4ab9c3c00b`: 86/86 adjacent security tests across workspace edge auth, tool scope authorization, operator OAuth, authority architecture, universal login, and local Hono architecture.
- `trc_cbcd7e4aae0b`: security gateway/Caddy 25/25 and workspace gateway node proxy 7/7; 14 environment-gated edge integration tests skipped by their existing gate.
- `trc_77ba4b5b3ce2`: MCP gateway 16/16 before the added Origin integration case; `trc_8bcc0f35aae9` supersedes it with 17/17.
- `trc_3a2efbf128be`: post-review-error-boundary OAuth action-scope 11/11 and MCP gateway 17/17.
- `trc_cebccaff6732`: package syntax/typecheck command passed.
- `trc_67d02fae9e5c`: `git diff --check` passed.
- `trc_29364daa0526`: strict `review.run` passed with 0 branch issues after fixing its two error-handling findings.
### known unrelated baseline failure
Running the entire `tests/trace-persistence.test.ts` file currently has one unchanged baseline failure: its pre-existing `fail-open` fixture invokes the removed `context` facade alias and now receives `NOT_FOUND`. The Branch 1 diff does not modify that fixture path; `git diff` shows only the new principal-trace import/scenario/test. The Branch 1 principal-trace regression itself passes. This alias drift is intentionally not fixed in this security branch.
- 2026-08-10 03:40:49 `verify`: passed — OK

- 2026-08-10 03:41:00 apply-patch: `.task/os/mcp-auth-principal-context/workpad.md`

- 2026-08-10 03:42:13 apply-patch: `.task/os/mcp-auth-principal-context/workpad.md`

- 2026-08-10 03:44:14 apply-patch: `.task/os/mcp-auth-principal-context/workpad.md`

- 2026-08-10 03:45:00 apply-patch: `.task/os/mcp-auth-principal-context/workpad.md`
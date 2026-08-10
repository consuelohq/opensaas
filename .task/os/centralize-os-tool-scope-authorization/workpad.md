# centralize OS tool scope authorization

branch: `task/os/centralize-os-tool-scope-authorization`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1535/centralize-os-tool-scope-authorization
github pr: https://github.com/consuelohq/opensaas/pull/1535
started: 2026-07-19

## acceptance criteria

- [x] A normally connected OS MCP client can call every known facade tool without a transport-level `MISSING_SCOPE`, including tools classified as `dangerous` such as `task.push`.
- [x] Tool names and action categories continue to come from the generated manifest and existing action-aware classification; unknown tools remain fail-closed.
- [x] One shared scope matcher owns local signed-token, local bearer-token, and OAuth-introspection decisions. No tool-specific scope exceptions are added.
- [x] `os:tools` is the explicit umbrella grant for the authenticated OS facade. Existing OAuth grants containing `mcp:call` remain compatible across read, write, and dangerous tool categories.
- [x] Route authorization such as `route:/mcp:read` stays separate from tool authorization.
- [x] Granular exact and category-wildcard tool credentials continue to work, and unrelated scopes continue to deny.
- [x] New ChatGPT MCP connections receive the standard OS facade scopes.
- [x] Re-provisioning upgrades an existing read-only ChatGPT MCP credential in place without rotating or exposing its bearer token.
- [x] Cloud OAuth metadata and default grants advertise/include the umbrella tool capability without allowing refresh-token scope escalation.
- [x] Tool-owned approval, validation, task-session, verification, and destructive-action safeguards remain authoritative after transport authorization succeeds.
- [x] Permission documentation explains the separation between connection authorization and action authorization.
- [x] Focused tests prove manifest-wide coverage, local signed/bearer behavior, OAuth behavior, migration, redaction, and unknown-tool denial.

## plan

1. Encode the shared scope contract and manifest-wide connected-client behavior in focused tests.
2. Run the focused suite red and record the expected failures for `task.push`, dangerous actions, and existing connection scope migration.
3. Add a pure shared scope-authorization module and route every local/cloud scope check through it.
4. Update OAuth defaults and local ChatGPT MCP issuance to use the standard facade grants.
5. Reconcile existing generated ChatGPT MCP credential scopes in place with audit-safe metadata updates.
6. Update the permissions doctrine and run focused, regression, review, verify, and release/build checks.
7. Push and promote through OS. Use another facade only if the still-running pre-fix OS runtime blocks its own publish operation, and report the exact blocker.

## Test-first contract

### Behavior under test

- `os:tools` and compatibility grant `mcp:call` satisfy every known `tool:<name>:<category>` scope generated for the OS facade, including `dangerous` tools.
- Exact and category-wildcard grants retain their current behavior; route scopes are not implied by tool grants.
- Unknown tools still fail with `UNKNOWN_TOOL_SCOPE` before execution.
- OAuth introspection and local generated credentials use the same matcher.
- Standard ChatGPT MCP connection metadata includes `route:/mcp:read`, `mcp:call`, and `os:tools`.
- Re-provisioning upgrades the stored active token and metadata without changing `tokenId` or bearer token and without recording secret material.
- OAuth default scope normalization includes `os:tools`; refresh flows remain bounded by the original grant.

### Existing patterns

- Tool classification: `packages/os/scripts/lib/security-gateway.ts` and `resolveToolScope`.
- MCP nested-call authorization: `packages/os/scripts/lib/mcp-gateway.ts`.
- OAuth local enforcement: `packages/os/scripts/server/services/oauth-introspection.ts`.
- OAuth scope issuance: `packages/os/cloudflare/os-device-authority/src/constants.ts`, `utils.ts`, and `services/mcp-oauth.ts`.
- Generated local connection: `packages/os/scripts/lib/install-state.ts`.
- Credential audit and persistence: `packages/os/scripts/lib/security-gateway.ts`.

### Intended tests

- Add `packages/os/tests/tool-scope-authorization.test.ts` for shared matcher and manifest-wide coverage.
- Extend `packages/os/tests/mcp-gateway-action-scopes.test.ts` for `task.push`, dangerous action compatibility, and restricted denial.
- Extend `packages/os/tests/security-gateway.test.ts` for signed/bearer umbrella behavior and in-place scope reconciliation.
- Extend install-state coverage for standard scopes and non-rotating migration.
- Extend device-authority OAuth contracts for advertised/default umbrella scope and refresh non-escalation.

### Focused red command

`bun --cwd packages/os test tests/tool-scope-authorization.test.ts tests/mcp-gateway-action-scopes.test.ts tests/security-gateway.test.ts tests/install-state.test.ts tests/os-device-authority-worker.test.ts`

### Expected red failure

- The shared scope module does not exist.
- `mcp:call` currently authorizes only read/write in the OAuth adapter, so `task.push` and dangerous actions return `MISSING_SCOPE`.
- `os:tools` is advertised but not honored by local or cloud matchers.
- Generated ChatGPT MCP credentials contain only `route:/mcp:read` and `tool:*:read`, and existing credentials are preserved without scope reconciliation.
- Default OAuth normalization omits `os:tools`.

## current status

- Implementation and documentation are complete.
- Scope matching is centralized in `scripts/lib/tool-scope-authorization.ts` and consumed by local signed credentials, local bearer credentials, OAuth introspection, and the cloud OAuth utility.
- `os:tools` and existing `mcp:call` grants authorize every known manifest tool category. Unknown tools and unrelated routes remain denied.
- New local ChatGPT MCP credentials use `route:/mcp:read`, `mcp:call`, and `os:tools`.
- Re-provisioning upgrades valid read-only credentials in place and replaces stale metadata only when its stored credential is missing or inactive.
- Strict review and full verify are green and publish-valid.

## files changed

- `packages/os/scripts/lib/tool-scope-authorization.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/server/services/oauth-introspection.ts`
- `packages/os/cloudflare/os-device-authority/src/utils.ts`
- `packages/os/cloudflare/os-device-authority/src/services/mcp-oauth.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/permissions.md`
- `packages/os/tests/tool-scope-authorization.test.ts`
- `packages/os/tests/mcp-gateway-action-scopes.test.ts`
- `packages/os/tests/security-gateway.test.ts`
- `packages/os/tests/install-state.test.ts`
- task metadata and evidence under `.task/os/centralize-os-tool-scope-authorization/`

## workspace-owned: files changed

- `.task/os/centralize-os-tool-scope-authorization/workpad.md`
- `packages/os/scripts/lib/tool-scope-authorization.ts`
- `packages/os/tests/tool-scope-authorization.test.ts`

## workspace-owned: activity log

- 2026-07-19 17:21:42 fs.write: `.task/os/centralize-os-tool-scope-authorization/workpad.md`
- 2026-07-19 17:22:55 fs.write: `packages/os/tests/tool-scope-authorization.test.ts`
- 2026-07-19 17:24:50 fs.write: `packages/os/scripts/lib/tool-scope-authorization.ts`
- Confirmed the live installed ChatGPT MCP token has only `route:/mcp:read` and `tool:*:read`.
- Read OS steering, stream context, auth runtime state, scope classifiers, MCP gateway, OAuth authority, introspection adapter, generated connection materialization, permission doctrine, tests, and the prior placeholder PR.

## workspace-owned: validation evidence

- TDD red: 4 files failed as expected. The shared module was absent; `mcp:call` and `os:tools` returned `MISSING_SCOPE` for dangerous actions; generated credentials stayed read-only; migration did not occur.
- Corrected one test-only mistake before implementation: `verifyMachineRequest` is synchronous, so the new assertion was changed from `.resolves` to a direct match.
- Focused green: 4 files, 59 tests passed covering manifest-wide scope resolution, OAuth action scopes, signed/bearer authorization, valid in-place migration, stale credential replacement, audit redaction, and install behavior.
- Broader OS regression: 77 tests passed and 10 environment-gated tests skipped across MCP gateway, OAuth, device authority, architecture, tool manifest, and install bootstrap contracts.
- OAuth refresh regression initially found that a missing refresh `scope` parameter was being normalized as a new default request. The refresh path now distinguishes an omitted scope and preserves the original grant; the full device-authority suite then passed.
- `node packages/os/scripts/check-syntax.js`: passed.
- Device-authority Wrangler bundle dry run: passed; 209.65 KiB upload, 45.34 KiB gzip.
- Strict review against `origin/stream/os`: zero issues and zero blocking findings across 10 production/test files.
- Full task verify: passed with `publishValid: true` and zero database risks.
- 2026-07-19 17:28:12 `review.run`: passed — OK
- 2026-07-19 17:28:23 `verify`: passed — OK
- 2026-07-19 17:29:46 `verify`: passed — OK

## key decisions

- `os:tools` is the canonical facade-wide tool grant.
- `mcp:call` remains a compatibility grant for already-issued OAuth tokens and authorizes known nested OS tool calls across all action categories.
- Scope authorization establishes which authenticated facade may be called. Tool manifests, input validation, task sessions, verify stamps, explicit approval inputs, and dangerous-action guardrails decide whether a particular action may execute.
- Unknown tools remain denied before the umbrella grant is evaluated.
- Existing local connection secrets will be preserved; only safe stored scope metadata will be reconciled.

## notes for ko

- PR #1534 is a separate placeholder on `stream/workspace-agents` with no substantive implementation. This task is correctly scoped to `stream/os`; no destructive cleanup of the stale PR is included.

## improvements noticed

- The cloud and local runtimes duplicate scope-matching rules, which allowed the partial read/write-only patch to drift from the intended OS facade contract.
- `evaluateToolPolicy` documents approval semantics but is currently test-only; this task preserves existing action safeguards and does not broaden into an approval-system redesign.

## issues and recovery

- A task-scoped `batch` did not propagate `taskSession` to child `fs.search` calls and returned `AMBIGUOUS_TASK_SELECTION`. Continued with direct task-scoped OS calls; no workspace fallback was used.
- An exact search containing an unescaped `(` failed regex parsing. Re-ran with the symbol name only.
- A broad OAuth regression failed because refresh requests with no `scope` parameter were treated as a request for the new default scopes. Fixed the refresh-token path to preserve stored scopes when the parameter is omitted and reject only explicit escalation.
- The device-authority test runner emitted its existing non-blocking `bun:sqlite` trace-persistence warning under Vitest; all selected functional assertions passed.

---

## publish checklist

```bash
bun run task:push -- --message "fix(os): centralize facade scope authorization" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `AGENTS.md`
- `CODING-STANDARDS.md`
- `packages/os/AGENTS.md`
- `packages/os/SCRIPTS.md`
- `packages/os/cloudflare/os-device-authority/src/constants.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/mcp-oauth.ts`
- `packages/os/cloudflare/os-device-authority/src/services/mcp-oauth.ts`
- `packages/os/cloudflare/os-device-authority/src/utils.ts`
- `packages/os/manifests/tool.manifest.json`
- `packages/os/permissions.md`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/mcp-gateway.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/server/middleware/auth.ts`
- `packages/os/scripts/server/routes/call.ts`
- `packages/os/scripts/server/routes/mcp.ts`
- `packages/os/scripts/server/services/oauth-introspection.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/mcp-gateway-action-scopes.test.ts`
- `packages/os/tests/mcp-gateway.test.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`
- `packages/os/tests/security-gateway.test.ts`
- `packages/workspace/senior-engineer.md`

- 2026-07-19 17:29:39 apply-patch: `.task/os/centralize-os-tool-scope-authorization/workpad.md`

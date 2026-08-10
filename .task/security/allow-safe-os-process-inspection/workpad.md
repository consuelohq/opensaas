# Allow safe OS process inspection

branch: `task/security/allow-safe-os-process-inspection`
stream: `stream/security`
pr: https://github.com/consuelohq/opensaas/pull/1525
started: 2026-07-16

## acceptance criteria

- [x] Resolve `mac.process { action: "list" }` as a read operation.
- [x] Resolve `mac.process { action: "kill" }` as a dangerous operation.
- [x] Fail closed for missing or unknown `mac.process` actions.
- [x] Keep ordinary read/write calls authorized by `mcp:call`.
- [x] Keep dangerous calls denied unless an explicit dangerous scope is present.
- [x] Preserve unknown-tool fail-closed behavior and all existing OAuth/MCP contracts.
- [x] Audit other mixed-action tools and record follow-up scope without broadening this fix.

## plan

1. Add behavior tests at the MCP nested-call scope boundary.
2. Confirm the focused test fails because `mac.process` is classified only from manifest-level mutability.
3. Add a small action-aware scope override and pass typed tool input into scope resolution.
4. Run focused MCP, OAuth, and security gateway suites.
5. Audit mixed-action tools, inspect the diff, then run review and verify gates.

## discovery

- ChatGPT proved OS transport and OAuth token continuity with `tools.search`, `mac.list`, and `mac.read`.
- `mac.process { action: "list" }` reached OS but returned `403 MISSING_SCOPE`.
- Current manifest marks the whole `mac.process` tool as mutating, so `resolveToolScope` returns `tool:mac.process:write` without inspecting the action.
- Current local OAuth policy accepts manifest-level read/write scopes under `mcp:call` and rejects dangerous scopes.
- Therefore stale runtimes block process listing, while simply releasing the current coarse policy would also authorize process killing too broadly.
- Dangerous command-material scanning is complementary but does not classify typed `mac.process` actions.

## Test-first contract

- Behavior under test: scope resolution is based on `tool + typed input action` for mixed-action Mac tools.
- Existing pattern: `resolveMcpGatewayRequiredScope` parses the nested facade call and delegates to `resolveToolScope`; OAuth then authorizes the returned category.
- New test: table-driven MCP resolver coverage for `list`, `kill`, missing action, and unknown action.
- Focused red command: `cd packages/os && bun test tests/mcp-gateway-action-scopes.test.ts`.
- Observed red failure: four table cases received `tool:mac.process:write`; expected read for `list` and dangerous for `kill`, missing, and unknown actions. Trace: `trc_07a5ed223a43`.

## current status

- Action-aware scope resolution is implemented at both the central MCP nested-call boundary and the local signed `/call` boundary.
- Focused Bun proof: 7 passed, 0 failed. Trace: `trc_9b1789f47c5a`.
- Focused Vitest plus security regression suite: 29 passed, 0 failed. Trace: `trc_4c49b9feb8ad`.
- OS syntax checks passed. Trace: `trc_2478042969a2`.
- Ordinary `mcp:call` authorizes process listing and rejects process termination; an exact `tool:mac.process:dangerous` scope authorizes termination.

## files changed

- `.task/security/allow-safe-os-process-inspection/workpad.md`
- `packages/os/scripts/lib/mcp-gateway.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/server/routes/call.ts`
- `packages/os/tests/mcp-gateway-action-scopes.test.ts`

## key decisions

- Keep OAuth as workspace/node membership plus general `mcp:call`; enforce operation risk at the local OS tool/action boundary.
- Introduce an explicit narrow override for `mac.process` rather than guessing action semantics for every manifest tool.
- Unknown/missing actions fail closed as dangerous.

## notes for ko

- This restores observational access without making process termination implicit.
- The public facade remains two tools: `get_steering` and `call`.

## improvements noticed

- Other mixed-action facade entries include `browser.clipboard`, `browser.cookies`, `browser.dialog`, `browser.find`, `browser.tabs`, `browser.trace`, `gh`, `media.svg`, `server`, and `tmp`. They remain coarse write operations in this task; each needs a separate reviewed action-policy table rather than inferred semantics.
- The product OAuth flow currently grants general `mcp:call`; short-lived dangerous capability minting and user approval UX remain separate security work.
- Review the public `call` MCP annotations separately because a dynamic facade cannot truthfully be globally read-only.

## issues and recovery

- Workspace app binding was unavailable; Ko explicitly approved using the underlying Bun scripts as the emergency repo workflow.

- 2026-07-16 13:44:44 write: `.task/security/allow-safe-os-process-inspection/workpad.md`

## workspace-owned: files changed

- `.task/security/allow-safe-os-process-inspection/workpad.md`

## workspace-owned: activity log

- 2026-07-16 13:44:44 fs.write: `.task/security/allow-safe-os-process-inspection/workpad.md`

- 2026-07-16 13:47:23 apply-patch: `packages/os/tests/mcp-gateway.test.ts`

## workspace-owned: files read

- `package.json`
- `packages/os/package.json`
- `packages/os/permissions.md`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/server/services/oauth-introspection.ts`
- `packages/os/tests/mcp-gateway-action-scopes.test.ts`
- `packages/os/vitest.config.ts`

- 2026-07-16 14:19:24 apply-patch: `.task/security/allow-safe-os-process-inspection/workpad.md`
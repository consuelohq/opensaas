# fix ChatGPT MCP tool descriptor discovery

branch: `task/security/fix-chatgpt-mcp-tool-descriptor-discovery`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1503/fix-chatgpt-mcp-tool-descriptor-discovery
github pr: https://github.com/consuelohq/opensaas/pull/1503
started: 2026-07-15

## acceptance criteria

- [x] MCP `tools/list` exposes exactly `get_steering` and `call`.
- [x] Both public tool descriptors include boolean `readOnlyHint`, `openWorldHint`, and `destructiveHint` annotations accepted by ChatGPT.
- [x] `get_steering` uses the existing guarded OS steering runtime.
- [x] `call` dispatches the nested typed facade tool and preserves `input`, `taskSession`, and `timeout`.
- [x] Authorization derives scope from the nested tool and fails closed for malformed or unknown calls.
- [x] Existing OAuth, signed connector, and MCP JSON-RPC behavior remains green.
- [ ] The released MacBook runtime returns the two descriptors and ChatGPT exposes a callable OS action.

## plan

1. Add focused failing MCP gateway tests for the public facade descriptors, dispatch, and nested scope resolution.
2. Implement the two-tool adapter over the existing steering and typed facade executors.
3. Run focused tests, OS regression tests, review, and verification.
4. Publish through the security stream, promote to main, release OS, update the test MacBook, and verify live ChatGPT invocation.

## current status

- Implementation and local verification complete. OAuth and connector transport remain unchanged.
- Root cause fixed: the MCP gateway now publishes the intended two-tool OS facade with standard MCP impact annotations.
- Focused gateway tests: 13 passed, 0 failed, 69 assertions.
- Device-authority regression tests: 24 passed; configuration-gated edge-router tests skipped as expected.
- Bun bundles, strict review, publish verification, and diff checks passed.
- Remaining: promote, release, update the test MacBook runtime, and prove a live ChatGPT tool call.

## files changed

- `packages/os/scripts/lib/mcp-gateway.ts`
- `packages/os/scripts/mcp-stdio.ts`
- `packages/os/scripts/server/routes/mcp.ts`
- `packages/os/scripts/server/services/call-service.ts`
- `packages/os/scripts/server/services/steering-service.ts`
- `packages/os/tests/mcp-gateway.test.ts`

## workspace-owned: files changed

- MCP gateway facade descriptors and nested authorization.
- HTTP and stdio service wiring.
- Focused gateway and signed-route coverage.

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-15 02:14:00 `review.run`: passed — OK
- 2026-07-15 02:15:17 `verify`: passed — OK

## key decisions

- Match the established OS contract: public `get_steering` plus `call`.
- Keep authorization bound to the nested facade tool; do not grant blanket write access to the outer `call`.
- Use conservative impact annotations for the dynamic `call` tool.
- Preserve existing connector/OAuth transport and change only MCP adaptation and its service wiring.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- A broad `bun test` run used the wrong runner for Vitest-only worker suites and generated a facade snapshot; the snapshot was restored exactly from HEAD. The gateway stayed on `bun test`, while worker routes were rerun with Vitest.

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: test selection

- changed files: `.task/security/fix-chatgpt-mcp-tool-descriptor-discovery/current.json`, `.task/security/fix-chatgpt-mcp-tool-descriptor-discovery/session.json`, `.task/security/fix-chatgpt-mcp-tool-descriptor-discovery/workpad.md`, `.task/tasks/security/fix-chatgpt-mcp-tool-descriptor-discovery.json`, `packages/os/scripts/lib/mcp-gateway.ts`, `packages/os/scripts/mcp-stdio.ts`, `packages/os/scripts/server/routes/mcp.ts`, `packages/os/scripts/server/services/call-service.ts`, `packages/os/scripts/server/services/steering-service.ts`, `packages/os/tests/mcp-gateway.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

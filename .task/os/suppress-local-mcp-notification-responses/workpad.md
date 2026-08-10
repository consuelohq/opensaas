# suppress local MCP notification responses

branch: `task/os/suppress-local-mcp-notification-responses`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1723/suppress-local-mcp-notification-responses
github pr: https://github.com/consuelohq/opensaas/pull/1723
started: 2026-07-29

## Discovery

- Exact-head Codex found that the local MCP bridge forwards gateway responses for JSON-RPC notifications without an id.
- The transport boundary is packages/os/scripts/lib/local-agent-mcp-bridge.ts with focused coverage in the local MCP bridge and connectivity suites.

## Test-first contract

- Add success and failure notification cases proving requests without an id return no response messages.
- Preserve ordinary request and batch response behavior.
- Run the focused test red, then green, strict review, and full verification.

## acceptance criteria

- [x] Successful notifications emit no response.
- [x] Failed or unreachable notification forwards emit no response.
- [x] Requests with ids retain their existing response and retry behavior.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Focused red reproduced the unsolicited `id: null` response.
- Focused green passes 23 tests with 121 assertions, including the real local-agent handshake.
- Strict review reports zero issues.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-29 07:20:04 `review.run`: passed — OK
- 2026-07-29 07:20:30 `verify`: passed — OK

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

- 2026-07-29 07:18:38 apply-patch: `.task/os/suppress-local-mcp-notification-responses/workpad.md`
- 2026-07-29 07:19:04 apply-patch: `packages/os/tests/local-agent-mcp-bridge.test.ts`
- 2026-07-29 07:19:28 apply-patch: `packages/os/scripts/lib/local-agent-mcp-bridge.ts`

- 2026-07-29 07:20:16 apply-patch: `.task/os/suppress-local-mcp-notification-responses/workpad.md`

## workspace-owned: test selection

- changed files: `.task/os/suppress-local-mcp-notification-responses/current.json`, `.task/os/suppress-local-mcp-notification-responses/session.json`, `.task/os/suppress-local-mcp-notification-responses/workpad.md`, `.task/tasks/os/suppress-local-mcp-notification-responses.json`, `packages/os/scripts/lib/local-agent-mcp-bridge.ts`, `packages/os/tests/local-agent-mcp-bridge.test.ts`
- matched rules: `auto:@consuelo/os:package-test`
- selected suites: `@consuelo/os package test`
- run results: `@consuelo/os package test` passed
- failed suites: none

# fix central MCP proxy signing gate

branch: `task/security/fix-central-mcp-proxy-signing-gate`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1498/fix-central-mcp-proxy-signing-gate
github pr: https://github.com/consuelohq/opensaas/pull/1498
started: 2026-07-14

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-14 23:24:21 `review.run`: passed — OK
- 2026-07-14 23:25:48 `verify`: passed — OK
- 2026-07-14 23:39:02 `review.run`: passed — OK
- 2026-07-14 23:39:08 `verify`: passed — OK

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
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

## Discovery

- Live ChatGPT OAuth authorization and token exchange succeeded, then authenticated POST /mcp returned 503.
- The 503 was WORKSPACE_EDGE_AUTH_REQUIRED in mcp-proxy.ts.
- The private OS connector does not consume the edge HMAC; it validates the forwarded OAuth bearer through central introspection.
- Preserve spoofed-header stripping, trusted route metadata, OAuth scope/resource checks, and optional edge signing.

## Test-first contract

- Add table-driven coverage for both configured signing and absent signing.
- Without signing configuration, authenticated proxying must succeed and must not forward caller-supplied signature headers.
- Focused red result observed before implementation: expected 200, received 503.

## workspace-owned: test selection

- changed files: `.task/security/fix-central-mcp-proxy-signing-gate/current.json`, `.task/security/fix-central-mcp-proxy-signing-gate/session.json`, `.task/security/fix-central-mcp-proxy-signing-gate/verify.json`, `.task/security/fix-central-mcp-proxy-signing-gate/workpad.md`, `.task/tasks/security/fix-central-mcp-proxy-signing-gate.json`, `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`, `packages/os/tests/os-device-authority-worker.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

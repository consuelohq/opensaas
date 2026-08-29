# Reject routed nodes without registry records

branch: `task/os/reject-routed-nodes-without-registry-records`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2280
started: 2026-08-29

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: when D1 resolves a workspace node target but the authoritative workspace-node registry record is missing, central MCP routing fails closed before contacting the connector.
existing local pattern: central MCP already rejects known incompatible/not-ready nodes before proxying; missing authoritative records belong at the same fail-closed boundary.
new or changed tests: add a workspace-node-registry-routing regression that hides the selected node record while leaving its D1 route intact, expects structured `WORKSPACE_NODE_NOT_READY`, and proves upstream fetch is never invoked.
focused red command: `bun --cwd packages/os test tests/workspace-node-registry-routing.test.ts`
expected red failure: current proxy returns 200 because the missing record skips the compatibility/readiness block.
no-test waiver: not applicable.

red evidence: focused routing suite failed exactly at the new assertion (`expected 200 to be 409`).
green evidence:
- routing + Device Authority worker: 2 files / 80 tests passed.
- OS syntax gate passed.
- Device Authority Wrangler dry-run passed; no deployment performed.
- strict review passed with 0 blocking findings; only the existing non-blocking MCP docs opportunity was reported.

review context: this directly addresses Codex P1 on stream PR #2277 by rejecting a D1-resolved target when the authoritative workspace-node record is unavailable, before proxying upstream.

- 2026-08-29 04:32:45 append: `.task/os/reject-routed-nodes-without-registry-records/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-29 04:32:45 fs.write: `.task/os/reject-routed-nodes-without-registry-records/workpad.md`

- 2026-08-29 04:32:51 apply-patch: `packages/os/tests/workspace-node-registry-routing.test.ts`
- 2026-08-29 04:33:02 apply-patch: `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`

## workspace-owned: validation evidence

- 2026-08-29 04:33:41 `review.run`: passed — OK
- 2026-08-29 04:33:50 apply-patch: `.task/os/reject-routed-nodes-without-registry-records/workpad.md`
- 2026-08-29 04:34:07 `verify`: passed — OK

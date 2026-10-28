# hotfix lifecycle accept signed mcp proof

branch: `task/os/hotfix-lifecycle-accept-signed-mcp-proof`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2368
started: 2026-09-01

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

behavior under test: Lifecycle connector readiness accepts an already-routable connector when the cached signed public MCP probe succeeds, even if the subsequent authority heartbeat reconciliation returns 503.
existing local pattern: workspace-node-heartbeat performs a cached signed MCP probe before authority reconciliation; lifecycle connector readiness owns a bounded acceptance gate and must not change normal heartbeat failure reporting.
new or changed tests: Add a lifecycle-scoped heartbeat mode regression proving cached MCP success is sufficient while default heartbeat mode still surfaces authority reconciliation failure; extend the lifecycle connector-readiness test to request that mode.
focused red command: bun --cwd packages/os test tests/workspace-node-heartbeat-script.test.ts tests/lifecycle-connector-readiness.test.ts
expected red failure: lifecycle readiness still invokes the normal heartbeat path, so authority HTTP 503 overrides the successful signed MCP probe.
no-test waiver: not applicable

- 2026-09-01 17:55:32 append: `.task/os/hotfix-lifecycle-accept-signed-mcp-proof/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-01 17:55:32 fs.write: `.task/os/hotfix-lifecycle-accept-signed-mcp-proof/workpad.md`

## workspace-owned: validation evidence

- 2026-09-01 17:59:35 `verify`: passed — OK

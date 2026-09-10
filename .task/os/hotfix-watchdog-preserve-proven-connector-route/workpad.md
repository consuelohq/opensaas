# hotfix watchdog preserve proven connector route

branch: `task/os/hotfix-watchdog-preserve-proven-connector-route`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2370
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

behavior under test: The periodic watchdog must treat a successful signed public MCP probe as route-ready even when the subsequent authority heartbeat reconciliation returns 503, preventing restart churn on a working connector.
existing local pattern: Default heartbeat probes cached signed MCP first, then publishes readiness to authority; watchdog restarts after repeated non-zero heartbeat results. Lifecycle-scoped mode already accepts the signed proof without authority publication.
new or changed tests: Add a default-heartbeat regression that preserves routeReady/mcpReady after authority failure while marking authorityReady false; keep the lifecycle-scoped shortcut and authority-success behavior covered.
focused red command: bun --cwd packages/os test tests/workspace-node-heartbeat-script.test.ts
expected red failure: successful public health and signed MCP are followed by authority HTTP 503, causing the default heartbeat to throw and watchdog to count a route failure.
no-test waiver: not applicable

- 2026-09-01 18:21:05 append: `.task/os/hotfix-watchdog-preserve-proven-connector-route/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-01 18:21:05 fs.write: `.task/os/hotfix-watchdog-preserve-proven-connector-route/workpad.md`

## workspace-owned: validation evidence

- 2026-09-01 18:23:07 `verify`: passed — OK

# Harden watchdog and restart end-to-end readiness

branch: `task/os/harden-watchdog-and-restart-end-to-end-readiness`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2209/harden-watchdog-and-restart-end-to-end-readiness
github pr: https://github.com/consuelohq/opensaas/pull/2209
started: 2026-08-26

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-26 05:50:45 fs.write: `.task/os/harden-watchdog-and-restart-end-to-end-readiness/workpad.md`
- 2026-08-26 05:57:06 fs.write: `.task/os/harden-watchdog-and-restart-end-to-end-readiness/workpad.md`
- 2026-08-26 06:05:42 fs.write: `.task/os/harden-watchdog-and-restart-end-to-end-readiness/workpad.md`

## workspace-owned: validation evidence

- 2026-08-26 06:08:00 `review.run`: passed — OK

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

## Test-first contract

behavior under test: watchdog and restart must not declare success until the routed MCP path is actually ready; restart invoked by the watchdog must not synchronously tear down its own launchd job
existing local pattern: inspect current lifecycle, heartbeat, watchdog, and focused lifecycle tests before editing
new or changed tests: pending discovery
focused red command: pending discovery
expected red failure: current routeReady-only readiness and self-sidecar restart behavior are accepted
no-test waiver: not applicable

- 2026-08-26 05:50:45 append: `.task/os/harden-watchdog-and-restart-end-to-end-readiness/workpad.md`

## Focused red evidence

behavior under test: managed heartbeat must issue a signed tools/list request through its assigned public connector and fail routeReady closed when that MCP request fails; loaded sidecars restart with kickstart-first; the watchdog skips its own XPC label
existing local pattern: workspace-node-heartbeat.ts already reconciles the node-scoped edge secret; lifecycle service already has bounded launchd transition retries
new or changed tests: workspace-node-heartbeat-script.test.ts and lifecycle-restart-contract.test.ts
focused red command: packages/os/node_modules/.bin/vitest run tests/workspace-node-heartbeat-script.test.ts tests/lifecycle-restart-contract.test.ts
expected red failure: 3 assertions failed because no /mcp probe occurs, watchdog is booted out by its own restart, and loaded sidecars are torn down before kickstart
no-test waiver: not applicable

- 2026-08-26 05:57:06 append: `.task/os/harden-watchdog-and-restart-end-to-end-readiness/workpad.md`

## Green and live evidence

focused tests: 43/43 passed across heartbeat script, lifecycle restart, and watchdog reliability
broader tests: lifecycle engine, heartbeat client, edge auth, and MCP gateway passed; 140/141 passed in the combined security slice
syntax/typecheck: workspace script syntax checks passed
live probe: node_F3Wsfd-vJrKkYlfi returned presence=online, routeReady=true, mcpReady=true using the task implementation against the installed heartbeat config
unrelated failure: security-gateway.test.ts resolved worker ports 8999,46321,46322,46323 while its assertion expects 8999,9000,9001; it fails unchanged when rerun alone and no touched file owns Caddy port resolution

- 2026-08-26 06:05:42 append: `.task/os/harden-watchdog-and-restart-end-to-end-readiness/workpad.md`

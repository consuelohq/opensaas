# move os daemon off workspace mcp port

branch: `task/os/move-os-daemon-off-workspace-mcp-port`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1058/move-os-daemon-off-workspace-mcp-port
github pr: https://github.com/consuelohq/opensaas/pull/1058
started: 2026-06-15

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

- none yet

## workspace-owned: validation evidence

- 2026-06-15 02:15:19 `checkFiles`: failed — COMMAND_FAILED
- 2026-06-15 02:16:37 `checkFiles`: passed — OK
- 2026-06-15 02:17:05 `review.run`: passed — OK
- 2026-06-15 02:17:19 `verify`: passed — OK

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

## workspace-owned: files read

- `packages/os/scripts/install-system-daemons.sh`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/server.js`
- `packages/os/scripts/server.ts`
- `packages/os/scripts/start-brain.sh`
- `packages/os/scripts/start-consuelo-daemon.sh`
- `packages/os/scripts/workspace-watchdog.sh`
- `packages/os/tests/cloudflare-connector-transport-contract.test.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/security-gateway.test.ts`

## workspace-owned: test selection

- changed files: `.task/os/move-os-daemon-off-workspace-mcp-port/current.json`, `.task/os/move-os-daemon-off-workspace-mcp-port/evidence-log.json`, `.task/os/move-os-daemon-off-workspace-mcp-port/read-log.json`, `.task/os/move-os-daemon-off-workspace-mcp-port/session.json`, `.task/os/move-os-daemon-off-workspace-mcp-port/workpad.md`, `.task/tasks/os/move-os-daemon-off-workspace-mcp-port.json`, `packages/os/scripts/install-system-daemons.sh`, `packages/os/scripts/lib/install-state.ts`, `packages/os/scripts/lib/security-gateway.ts`, `packages/os/scripts/server.js`, `packages/os/scripts/server.ts`, `packages/os/scripts/start-brain-daemon.sh`, `packages/os/scripts/start-brain.sh`, `packages/os/scripts/start-consuelo-daemon.sh`, `packages/os/scripts/workspace-watchdog.sh`, `packages/os/tests/security-gateway.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

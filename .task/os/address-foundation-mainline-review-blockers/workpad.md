# address foundation mainline review blockers

branch: `task/os/address-foundation-mainline-review-blockers`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1717/address-foundation-mainline-review-blockers
github pr: https://github.com/consuelohq/opensaas/pull/1717
started: 2026-07-29

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

- 2026-07-29 04:08:54 `verify`: passed — OK

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

## Mainline P1 review discovery

- Review blocker: immutable runtime MCP wrapper must resolve runtime/current/scripts/mcp-stdio.ts.
- Review blocker: managed Linux systemd user units must be written under the actual user config home, not CONSUELO_HOME.
- Test-first contract: add focused failing regressions for both production install layouts before implementation.

## Test-first red contracts

- Added regression assertions for the immutable runtime MCP path.
- Added distinct runtime-home and user-home fixtures for Linux cloudflared and heartbeat systemd materialization.

## Red result

- Focused run: 3 files failed, with exactly one expected regression failure in each file.
- Implementation: corrected runtime/current MCP entrypoint and separated runtimeHome from userHome for Linux user units.

## workspace-owned: test selection

- changed files: `.task/os/address-foundation-mainline-review-blockers/current.json`, `.task/os/address-foundation-mainline-review-blockers/session.json`, `.task/os/address-foundation-mainline-review-blockers/workpad.md`, `.task/tasks/os/address-foundation-mainline-review-blockers.json`, `packages/os/scripts/lib/install-state.ts`, `packages/os/scripts/lib/local-agent-connectivity.ts`, `packages/os/scripts/lib/platforms/linux.ts`, `packages/os/tests/local-agent-connectivity.test.ts`, `packages/os/tests/managed-cloud-node-linux-connector.test.ts`, `packages/os/tests/managed-cloud-node-linux-heartbeat.test.ts`
- matched rules: `auto:@consuelo/os:package-test`
- selected suites: `@consuelo/os package test`
- run results: `@consuelo/os package test` passed
- failed suites: none

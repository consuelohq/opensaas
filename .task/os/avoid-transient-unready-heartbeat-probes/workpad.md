# Avoid transient unready heartbeat probes

branch: `task/os/avoid-transient-unready-heartbeat-probes`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2291
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

behavior under test: periodic heartbeat readiness probes must not publish `mcpReady:false` before every probe when existing edge-auth material can probe the connector first; healthy nodes stay continuously ready. Bootstrap/failure-recovery still fails closed when no reusable probe credentials exist.
existing local pattern: heartbeat sends a first authority update with `mcpReady:false`, receives edge signing material, probes `/mcp`, then sends the actual readiness result. That creates a recurring not-ready window every heartbeat cycle.
new or changed tests: extend heartbeat-script sequencing to distinguish bootstrap without reusable edge auth from steady-state with reusable edge auth. Steady-state should probe first then publish one heartbeat containing the actual readiness result; bootstrap may still publish false before acquiring auth and then publish the result.
focused red command: `bun --cwd packages/os test tests/workspace-node-heartbeat-script.test.ts`.
expected red failure: steady-state request sequence currently sends authority heartbeat with `mcpReady:false` before the MCP probe instead of probing first and publishing atomically.
no-test waiver: not applicable.

red evidence: steady-state cached-auth regression observed `health -> heartbeat(false) -> mcp -> heartbeat` instead of probing before the authority update.

green evidence:
- steady-state cached edge auth now performs `health -> mcp -> heartbeat(true)` with exactly one readiness heartbeat.
- bootstrap/failure recovery remains two-phase so missing or stale credentials still fail closed.
- heartbeat client/script: 2 files / 14 tests passed.
- workspace-node routing + Device Authority worker: 2 files / 81 tests passed.
- OS syntax gate passed.
- Device Authority Wrangler dry-run passed; no deployment performed.

review context: Codex P1 on stream PR #2277 head `98f0b8c8` identified a recurring 0-5 second not-ready window on every 30-second heartbeat. Healthy steady-state nodes now probe with their locally stored private edge credential before publishing readiness; `mcpReady:false` is limited to bootstrap or recovery after a cached probe failure.

- 2026-08-29 06:35:11 append: `.task/os/avoid-transient-unready-heartbeat-probes/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-29 06:35:11 fs.write: `.task/os/avoid-transient-unready-heartbeat-probes/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/workspace-node-heartbeat-client.ts`
- `packages/os/scripts/workspace-node-heartbeat.ts`
- `packages/os/tests/workspace-node-heartbeat-script.test.ts`

- 2026-08-29 06:36:03 apply-patch: `packages/os/tests/workspace-node-heartbeat-script.test.ts`
- 2026-08-29 06:36:59 apply-patch: `packages/os/scripts/workspace-node-heartbeat.ts`

- 2026-08-29 06:37:18 apply-patch: `.task/os/avoid-transient-unready-heartbeat-probes/workpad.md`

## workspace-owned: validation evidence

- 2026-08-29 06:37:43 `review.run`: passed — OK
- 2026-08-29 06:37:56 `verify`: passed — OK

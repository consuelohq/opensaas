# Clear stale readiness before heartbeat probe

branch: `task/os/clear-stale-readiness-before-heartbeat-probe`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2282
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

behavior under test: when a node requires the public MCP readiness probe, its first authority heartbeat must explicitly publish `mcpReady: false` before probing so previously stored ready state cannot survive during the probe window; the second heartbeat publishes the actual probe result.
existing local pattern: `workspace-node-heartbeat.ts` currently sends runtime identity first, probes `/mcp`, then sends a second heartbeat with `mcpReady`; Device Authority preserves omitted heartbeat fields, so an old `true` can survive the first send.
new or changed tests: update the heartbeat-script request sequence assertion to require `mcpReady:false` in the first heartbeat when `connectorHealthUrl` is configured, while retaining actual probe-result publication in the second heartbeat.
focused red command: `bun --cwd packages/os test tests/workspace-node-heartbeat-script.test.ts`
expected red failure: the first heartbeat body currently omits `mcpReady`, so the new assertion receives `undefined` instead of `false`.
no-test waiver: not applicable.

red evidence: heartbeat-script suite failed exactly because the first heartbeat body omitted `mcpReady` (`expected { ... } to match { mcpReady: false }`).
green evidence:
- heartbeat client + heartbeat script: 2 files / 13 tests passed.
- workspace node routing: 1 file / 47 tests passed.
- OS syntax gate passed.

review context: CodeRabbit major on stream PR #2277 identified a stale-ready window where an omitted first-heartbeat `mcpReady` preserves a previously stored `true` until the public MCP probe finishes. The implementation now sends `mcpReady:false` on the first heartbeat whenever readiness probing is required, then publishes the actual probe result on the second heartbeat.

publish-gate limitation:
- strict review and DB safety phases pass with 0 findings.
- the test-selection registry launches all five selected critical Vitest files from repository root with `--config packages/os/vitest.config.ts`; each exits before collecting tests because the config resolves `tests/test-environment.ts` from the wrong CWD.
- the selector's exact five critical files rerun from `packages/os` pass 91/91. The syntax contract also passes.
- this is the same previously identified registry CWD defect, not a heartbeat regression.

- 2026-08-29 04:36:14 append: `.task/os/clear-stale-readiness-before-heartbeat-probe/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-29 04:36:14 fs.write: `.task/os/clear-stale-readiness-before-heartbeat-probe/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/workspace-node-heartbeat.ts`
- `packages/os/tests/workspace-node-heartbeat-script.test.ts`

- 2026-08-29 04:36:40 apply-patch: `packages/os/scripts/workspace-node-heartbeat.ts`

- 2026-08-29 04:36:55 apply-patch: `.task/os/clear-stale-readiness-before-heartbeat-probe/workpad.md`

## workspace-owned: validation evidence

- 2026-08-29 04:37:26 `review.run`: passed — OK
- 2026-08-29 04:37:44 `verify`: failed — COMMAND_FAILED

- 2026-08-29 04:38:12 apply-patch: `.task/os/clear-stale-readiness-before-heartbeat-probe/workpad.md`
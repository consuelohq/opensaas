# Gate fallback defaults on execution readiness

branch: `task/os/gate-fallback-defaults-on-execution-readiness`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2294
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

behavior under test: automatic fallback default-node selection must choose only nodes that are execution-ready and protocol-compatible. Merely connected, incompatible, unknown, or `mcpReady:false` nodes may remain registered/targetable explicitly but must not be persisted as the workspace default.
existing local pattern: heartbeat reconciliation repairs missing/revoked defaults before the later readiness check and may pick the current or first connected node as fallback.
new or changed tests: seed a missing/revoked default plus a connected heartbeat node that is incompatible or not ready, run heartbeat reconciliation, and assert it does not become default; a compatible ready node remains eligible.
focused red command: `bun --cwd packages/os test tests/workspace-node-registry-routing.test.ts -t "fallback default"`.
expected red failure: current reconciliation persists the merely connected heartbeat node as default before readiness/compatibility is evaluated.
no-test waiver: not applicable.

red evidence: both `mcpReady:false` and protocol-incompatible current-node cases selected `node-member` instead of the ready `node-home` fallback.

green evidence:
- fallback-default focused cases pass for both not-ready and incompatible current nodes.
- legacy-default repair regression now makes the signed repair heartbeat explicitly modern/ready, preserving its intended semantics under the new invariant.
- workspace-node routing + Device Authority worker: 2 files / 83 tests passed.
- heartbeat client/script: 2 files / 14 tests passed.
- OS syntax gate passed.
- Device Authority Wrangler dry-run passed; no deployment performed.

review context: Codex P2 on stream PR #2277 head `45e40c68` identified that automatic fallback default selection preferred merely connected nodes. Reconciliation now preserves an active configured default, but any automatic replacement default is drawn only from execution-ready candidates; if no eligible replacement exists, no unusable node is promoted.

final validation: strict review reported 0 issues/0 blockers; formal verify passed with `publishValid: true` and DB safety clean. Local disk pressure was resolved by finalizing already-merged task worktrees via `task.finish`, recovering ~4 GiB without touching the current task or abandoned unmerged work.

- 2026-08-29 06:43:28 append: `.task/os/gate-fallback-defaults-on-execution-readiness/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-29 06:43:28 fs.write: `.task/os/gate-fallback-defaults-on-execution-readiness/workpad.md`

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/services/connectors.ts`
- `packages/os/cloudflare/os-device-authority/src/services/nodes.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`
- `packages/workspace/scripts/task-cleanup.js`

## workspace-owned: validation evidence

- 2026-08-29 06:45:18 `review.run`: failed — COMMAND_FAILED
- 2026-08-29 06:49:29 `review.run`: passed — OK
- 2026-08-29 06:49:41 `verify`: passed — OK

- 2026-08-29 06:49:46 apply-patch: `.task/os/gate-fallback-defaults-on-execution-readiness/workpad.md`
# Clear stale heartbeat compatibility claims

branch: `task/os/clear-stale-heartbeat-compatibility-claims`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2289
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

behavior under test: when a signed heartbeat omits the new runtime compatibility/readiness claims, authority must clear previously stored `osVersion`, `bundleId`, `mcpProtocolVersion`, and `mcpReady` claims so a rolled-back legacy runtime becomes compatibility/readiness `unknown` rather than inheriting stale `ready` state.
existing local pattern: heartbeat update spreads runtime claims only when present, so omission refreshes `lastSeenAt` while retaining prior claims from a newer runtime.
new or changed tests: seed a node with current version/protocol/ready claims, send a valid legacy-shaped heartbeat omitting those fields, then assert the stored/safe node no longer reports the stale claims and explicit routing fails closed as update-required/not-ready rather than proxying.
focused red command: `bun --cwd packages/os test tests/workspace-node-registry-routing.test.ts -t "should clear compatibility claims when heartbeat omits runtime metadata"`.
expected red failure: current update retains the seeded `mcpProtocolVersion` and `mcpReady:true`, so the stored node still appears compatible/ready after the legacy heartbeat.
no-test waiver: not applicable.

red evidence: existing signed-heartbeat regression received `osVersion: 0.1.85`, `bundleId: bundle-node-member`, `mcpProtocolVersion: 2026-07-28`, and `mcpReady: true` after a heartbeat that omitted all four claims.

green evidence:
- focused legacy-heartbeat regression passed after authority explicitly clears omitted runtime claims.
- workspace-node routing + Device Authority worker: 2 files / 81 tests passed.
- heartbeat client + heartbeat script: 2 files / 13 tests passed.
- OS syntax gate passed.
- Device Authority Wrangler dry-run passed; no deployment performed.

review context: Codex P1 on stream PR #2277 head `6d70d624` identified that a rollback to a legacy heartbeat sender could indefinitely inherit stale compatibility/readiness claims. Omitted runtime identity/readiness fields now become unknown instead of inheriting the prior modern heartbeat state.

- 2026-08-29 06:27:19 append: `.task/os/clear-stale-heartbeat-compatibility-claims/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-29 06:27:19 fs.write: `.task/os/clear-stale-heartbeat-compatibility-claims/workpad.md`

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`

- 2026-08-29 06:27:38 apply-patch: `packages/os/tests/workspace-node-registry-routing.test.ts`
- 2026-08-29 06:27:50 apply-patch: `packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts`

- 2026-08-29 06:28:16 apply-patch: `.task/os/clear-stale-heartbeat-compatibility-claims/workpad.md`

## workspace-owned: validation evidence

- 2026-08-29 06:28:43 `review.run`: passed — OK
- 2026-08-29 06:29:05 `verify`: passed — OK

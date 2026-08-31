# resolve Diffs workspace edge route seed merge conflict

branch: `task/workspace-agents/resolve-diffs-workspace-edge-route-seed-merge-conflict`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1882/resolve-diffs-workspace-edge-route-seed-merge-conflict
github pr: https://github.com/consuelohq/opensaas/pull/1882
started: 2026-08-12

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

- 2026-08-12 04:32:57 fs.write: `.task/workspace-agents/resolve-diffs-workspace-edge-route-seed-merge-conflict/workpad.md`
- 2026-08-12 04:34:03 fs.write: `.task/workspace-agents/resolve-diffs-workspace-edge-route-seed-merge-conflict/workpad.md`
- 2026-08-12 04:36:52 fs.write: `.task/workspace-agents/resolve-diffs-workspace-edge-route-seed-merge-conflict/workpad.md`

## workspace-owned: validation evidence

- 2026-08-12 04:37:15 `review.run`: passed — OK
- 2026-08-12 04:37:25 `verify`: passed — OK

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
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## discovery

- Conflict follow-up for stream PR #1879 after `task.merge` reported merge conflicts.
- Scope is limited to reconciling `workspace-edge-route-seed.ts` and its contract test with current `main`; preserve both current-main routing semantics and the Diffs/source-control route behavior already in `stream/workspace-agents`.
- Do not update or restart the installed Consuelo OS as part of this task.

- 2026-08-12 04:32:57 append: `.task/workspace-agents/resolve-diffs-workspace-edge-route-seed-merge-conflict/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/tests/workspace-edge-route-seed-contract.test.ts`
- `packages/os/tests/workspace-edge-sites-gateway-integration.test.ts`

## Test-first contract

- Behavior under test: the merged route seed must retain current `main` protections for private workspace Site snapshots and non-destructive hostname upserts while retaining the Diffs gateway (`/gateway/diffs/*` and authenticated `/diffs`) from `stream/workspace-agents`.
- Existing local pattern: `packages/os/tests/workspace-edge-route-seed-contract.test.ts` is the executable route-seed/D1 contract and already covers both snapshot auth and preservation of live connector/node routing on `main`.
- New/changed tests: reconcile the current-main contract assertions into the task test while keeping Diffs gateway expectations and removing `/diffs` from the static snapshot list.
- Focused red command: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun x vitest run tests/workspace-edge-route-seed-contract.test.ts` from `packages/os`.
- Expected red failure: current stream production code still marks traces/configuration/tools/environments/secrets snapshots public and uses the older destructive `INSERT OR REPLACE` route SQL, so the reconciled main assertions must fail before production reconciliation.

- 2026-08-12 04:34:03 append: `.task/workspace-agents/resolve-diffs-workspace-edge-route-seed-merge-conflict/workpad.md`

## validation evidence

- RED: `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun test tests/workspace-edge-route-seed-contract.test.ts` -> 6 pass / 3 fail. Failures proved stream lacked current-main private Site auth and non-destructive route-registry upsert behavior.
- GREEN: reconciled production route seed with current `main`, retained authenticated Diffs gateway routes, and reran the focused route-seed contract -> 9 pass / 0 fail / 72 assertions.
- Integration reconciliation: stale expectations still modeled Trace as public and Diffs as a static snapshot. Updated test-only expectations to current-main private Trace auth and gateway-backed Diffs.
- Focused combined packet: route seed + Sites/Gateway integration + Diffs Hono + source-control config + Diffs adapter -> 39 pass / 0 fail / 228 assertions.
- Installed Consuelo OS was not updated, restarted, or otherwise mutated.

- 2026-08-12 04:36:52 append: `.task/workspace-agents/resolve-diffs-workspace-edge-route-seed-merge-conflict/workpad.md`

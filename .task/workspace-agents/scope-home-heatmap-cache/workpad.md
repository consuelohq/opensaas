# scope Home heatmap cache

branch: `task/workspace-agents/scope-home-heatmap-cache`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/2393
started: 2026-09-05

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
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/scripts/lib/consuelo-sites-gateway-types.ts`
- `packages/os/scripts/lib/settings-gateway.ts`
- `packages/os/scripts/lib/settings-site.ts`
- `packages/os/scripts/lib/settings-sites-gateway-endpoints.ts`
- `packages/os/scripts/lib/settings-snapshot.ts`
- `packages/os/scripts/lib/trace-sites-gateway-live-endpoints.ts`
- `packages/os/scripts/server/routes/settings.ts`
- `packages/os/tests/settings-site.test.ts`
- `packages/os/tests/trace-sites-gateway-live-endpoints.test.ts`

## Test-first contract

behavior under test: Home may render a persisted heatmap snapshot only after the signed gateway confirms the current workspace + resolved node scope, and persisted rows must be keyed by that exact scope so a different workspace/node can never see the previous scope's cached activity.
existing local pattern: Home currently uses one global `localStorage` key (`consuelo:overview-heatmap:v3`) and renders it synchronously before any signed scope is known. Trace gateway scope already carries `workspaceId`, `workspaceHost`, and resolved `nodeId` and the aggregate response returns that scope.
new or changed tests: require a scope-only aggregate probe that returns workspace/node without touching the trace backend; require cache keys derived from the confirmed workspace/node; require Home to resolve scope before reading/rendering persistent rows and to persist refreshed rows under the response scope.
focused red command: `bun run --cwd packages/os test tests/settings-site.test.ts tests/trace-sites-gateway-live-endpoints.test.ts`
expected red failure: current Home reads a global cache immediately and the aggregate endpoint has no scope-only fast path.
no-test waiver: not applicable.

## Acceptance criteria

- [ ] A signed scope-only aggregate request returns workspace/node identity without reading SQLite/aggregate state.
- [ ] Home persistent cache keys include confirmed workspaceId + nodeId (with an explicit default-node sentinel only if the signed scope has no node).
- [ ] Cache is never painted before signed scope confirmation; a mismatched workspace/node key is ignored.
- [ ] Valid same-scope reload still gets the fast cached paint before the full aggregate refresh, with one entrance animation.
- [ ] Existing 15-minute local-hour accuracy, pricing parity, replacement invalidation, and no-raw-payload boundary remain unchanged.

- 2026-09-05 01:15:22 append: `.task/workspace-agents/scope-home-heatmap-cache/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-05 01:15:23 fs.write: `.task/workspace-agents/scope-home-heatmap-cache/workpad.md`
- 2026-09-05 01:15:40 apply-patch: `packages/os/tests/settings-site.test.ts`
- 2026-09-05 01:15:40 apply-patch: `packages/os/tests/trace-sites-gateway-live-endpoints.test.ts`
- 2026-09-05 01:16:32 fs.write: `.task/workspace-agents/scope-home-heatmap-cache/workpad.md`
- 2026-09-05 01:17:21 fs.write: `.task/workspace-agents/scope-home-heatmap-cache/workpad.md`
- 2026-09-05 01:18:23 fs.write: `.task/workspace-agents/scope-home-heatmap-cache/workpad.md`

## RED evidence

- canonical test-source safety preflight passed 1/1 (`trc_399afe938adb`).
- focused Home + aggregate suite failed exactly on the missing scope contract: 2 failed / 23 passed (`trc_a9c376dd572f`). Home still reads the global v3 localStorage key before signed scope resolution, and `scopeOnly=true` still fell through to a normal aggregate response instead of the no-storage fast path.

- 2026-09-05 01:16:32 append: `.task/workspace-agents/scope-home-heatmap-cache/workpad.md`

- 2026-09-05 01:16:44 apply-patch: `packages/os/scripts/lib/trace-sites-gateway-live-endpoints.ts`
- 2026-09-05 01:16:44 apply-patch: `packages/os/scripts/lib/settings-site.ts`
- 2026-09-05 01:16:56 apply-patch: `packages/os/scripts/lib/settings-site.ts`
## GREEN evidence

- scoped-cache implementation now passes the focused Home + gateway suite: 25/25 (`trc_5bf6ea1e5181`).
- syntax/typecheck passed (`trc_1baebc36eb69`).
- working diff is limited to the two Home/gateway product files and their two focused test files plus task metadata (`trc_0595a6401f68`).
- Home now performs a signed `scopeOnly=true` aggregate probe before reading persistent heatmap rows. The cache key is `v3:<workspaceId>:<resolvedNodeId>` (or an explicit `node-default` sentinel only when signed scope omits a node). A full refresh persists under the scope returned by that same signed aggregate response.
- the scope-only gateway fast path runs after normal workspace/site/source/bridge validation and before backend availability, health, or SQLite reads, so cache authorization adds only a lightweight signed gateway round trip.

- 2026-09-05 01:17:21 append: `.task/workspace-agents/scope-home-heatmap-cache/workpad.md`

## workspace-owned: validation evidence

- 2026-09-05 01:17:41 `review.run`: passed — OK
- 2026-09-05 01:18:20 `verify`: passed — OK

## Publish gate

- strict review passed with 0 blocking issues (`trc_dc68034eefce`).
- full verify against `origin/stream/workspace-agents` passed with `publishValid: true` and exactly the intended four product/test files (`trc_305d963df03f`).
- the non-blocking public-docs opportunity does not apply: `scopeOnly=true` and the scoped browser cache are private Home implementation details, not a user-facing trace collection/retention API contract.

- 2026-09-05 01:18:23 append: `.task/workspace-agents/scope-home-heatmap-cache/workpad.md`

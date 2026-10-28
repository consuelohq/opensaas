# invalidate heatmap cache on replaced traces

branch: `task/workspace-agents/invalidate-heatmap-cache-on-replaced-traces`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/2391
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

## Test-first contract

behavior under test: the warm hourly heatmap cache must stay correct when the canonical trace writer replaces an existing trace or backfills a trace into an older hour; no stale contribution or double-counting may remain after the next refresh.
existing local pattern: `readHourlyTraceAggregate` holds only bucket sums and refreshes the current-hour/rollover range every 30s. The canonical writer uses `INSERT OR REPLACE`, which creates a new rowid for a replaced trace, so a cached historical contribution can become stale or move hours.
new or changed tests: extend the hourly aggregate gateway/backend test with an injectable backend clock. Build the cache, replace the same trace id with changed tokens and a current-hour timestamp, advance past the 30s refresh, then assert the old contribution disappears and totals/buckets reflect exactly two traces rather than double-counting.
focused red command: `bun run --cwd packages/os test tests/trace-sites-gateway-live-endpoints.test.ts`
expected red failure: after replacement, the old historical bucket remains cached while the current-hour replacement is also included, so calls/tokens/cost or bucket count are stale/doubled.
no-test waiver: not applicable.

## Acceptance criteria

- [ ] Detect trace-store changes after a warm aggregate snapshot using rowid high-water evidence.
- [ ] A replacement of an already-cached trace invalidates enough history to remove the old contribution even if the trace moved hours.
- [ ] Ordinary new traces keep the cheap path; a historical/full rescan is reserved for replacement cases that can make cached buckets ambiguous.
- [ ] Tests, review, verify, stream promotion, release/update, and browser proof pass.

- 2026-09-05 00:55:32 append: `.task/workspace-agents/invalidate-heatmap-cache-on-replaced-traces/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-05 00:55:32 fs.write: `.task/workspace-agents/invalidate-heatmap-cache-on-replaced-traces/workpad.md`
- 2026-09-05 00:57:18 fs.write: `.task/workspace-agents/invalidate-heatmap-cache-on-replaced-traces/workpad.md`
- 2026-09-05 00:58:07 fs.write: `.task/workspace-agents/invalidate-heatmap-cache-on-replaced-traces/workpad.md`
- 2026-09-05 00:58:51 fs.write: `.task/workspace-agents/invalidate-heatmap-cache-on-replaced-traces/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/trace-persistence.ts`
- `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- `packages/os/tests/trace-sites-gateway-live-endpoints.test.ts`

- 2026-09-05 00:56:43 apply-patch: `packages/os/tests/trace-sites-gateway-live-endpoints.test.ts`
## RED evidence

- canonical test-source safety preflight passed 1/1 (`trc_5a83891e4ef2`).
- focused aggregate suite failed exactly on warm replacement invalidation: after replacing `row_history` and advancing the backend clock beyond 30s, cached totals stayed at 130 tokens instead of 1,030 (`trc_887271962fca`).

- 2026-09-05 00:57:18 append: `.task/workspace-agents/invalidate-heatmap-cache-on-replaced-traces/workpad.md`

- 2026-09-05 00:57:39 apply-patch: `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
## GREEN evidence

- replacement regression now passes: the cache keeps a rowid high-water plus trace-id → hour map, detects new/replaced rows after the high-water mark, and invalidates/recomputes only the affected old/new hours plus the open hour (`trc_c4c4fd6e70ec`).
- combined Home + aggregate tests: 23/23 passed (`trc_db478aa07b12`).
- typecheck/syntax passed (`trc_e4c94fb1563a`).
- efficiency improved from the original plan: replacements do not require an eight-day rescan. The cache knows the replaced trace's previous hour, so only the old hour and replacement hour are recomputed; ordinary appends/backfills likewise touch only affected hours.

- 2026-09-05 00:58:07 append: `.task/workspace-agents/invalidate-heatmap-cache-on-replaced-traces/workpad.md`

## workspace-owned: validation evidence

- 2026-09-05 00:58:28 `review.run`: passed — OK
- 2026-09-05 00:58:45 `verify`: passed — OK

## Publish gate

- strict review passed with 0 blocking issues (`trc_be7db78b9b17`).
- full verify passed with `publishValid: true` (`trc_993366d7f6aa`).
- the non-blocking docs opportunity is not user-facing trace collection behavior; it is private Home aggregate cache invalidation, so no public tracing docs change is needed.

- 2026-09-05 00:58:51 append: `.task/workspace-agents/invalidate-heatmap-cache-on-replaced-traces/workpad.md`

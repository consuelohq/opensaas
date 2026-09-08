# preserve local-hour heatmap accuracy

branch: `task/workspace-agents/preserve-local-hour-heatmap-accuracy`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/2392
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

behavior under test: the Home heatmap must place calls/tokens/cost into the viewer's true local clock-hour even in fractional-offset time zones such as UTC+05:30 and UTC+05:45, while keeping the compact cached aggregate architecture.
existing local pattern: the gateway currently aggregates into UTC 60-minute buckets and the browser maps each bucket's single `startedAt` into local day/hour. That is exact only for whole-hour UTC offsets; a UTC bucket can straddle two local hours when the viewer offset has :30 or :45 minutes.
new or changed tests: change the aggregate contract to a 15-minute server bucket, assert four compact quarter-hour buckets can represent one UTC hour, and add a browser-side aggregation regression under a fractional timezone that proves records on opposite sides of a local-hour boundary land in different heatmap cells.
focused red command: `bun run --cwd packages/os test tests/settings-site.test.ts tests/trace-sites-gateway-live-endpoints.test.ts`
expected red failure: current Home requests `bucket=hour`, the gateway only recognizes hourly aggregation, and the backend rounds every trace to `:00Z`, so quarter-hour timestamps/local-hour placement are unavailable.
no-test waiver: not applicable.

## Acceptance criteria

- [ ] Gateway returns at most 768 compact 15-minute buckets for the 8-day window; raw payloads remain local-only.
- [ ] Home groups those buckets using the browser's per-timestamp local timezone, preserving fractional offsets and DST transitions.
- [ ] Existing persistent browser cache, one-time entrance animation, 30s refresh, per-trace cost accuracy, and replacement invalidation remain intact.
- [ ] Focused tests, strict review, full verify, stream review, canary release/local update, and browser proof pass.

- 2026-09-05 01:05:01 append: `.task/workspace-agents/preserve-local-hour-heatmap-accuracy/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-05 01:05:01 fs.write: `.task/workspace-agents/preserve-local-hour-heatmap-accuracy/workpad.md`
- 2026-09-05 01:05:59 fs.write: `.task/workspace-agents/preserve-local-hour-heatmap-accuracy/workpad.md`
- 2026-09-05 01:07:57 fs.write: `.task/workspace-agents/preserve-local-hour-heatmap-accuracy/workpad.md`
- 2026-09-05 01:09:03 fs.write: `.task/workspace-agents/preserve-local-hour-heatmap-accuracy/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/settings-site.ts`
- `packages/os/scripts/lib/trace-sites-gateway-live-endpoints.ts`
- `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- `packages/os/tests/settings-site.test.ts`
- `packages/os/tests/trace-sites-gateway-live-endpoints.test.ts`

## RED evidence

- canonical test-source safety preflight passed 1/1 (`trc_d26daa6c96aa`).
- focused suite failed exactly on the missing 15-minute contract: Home still requests `bucket=hour`, and a `bucket=15m` gateway request returned no heatmap buckets (`trc_5bb7e9a19871`).

- 2026-09-05 01:05:59 append: `.task/workspace-agents/preserve-local-hour-heatmap-accuracy/workpad.md`

- 2026-09-05 01:06:05 apply-patch: `packages/os/scripts/lib/settings-site.ts`
- 2026-09-05 01:06:05 apply-patch: `packages/os/tests/settings-site.test.ts`
- 2026-09-05 01:06:05 apply-patch: `packages/os/tests/trace-sites-gateway-live-endpoints.test.ts`
- 2026-09-05 01:06:05 apply-patch: `packages/os/scripts/lib/trace-sites-gateway-live-endpoints.ts`

- 2026-09-05 01:06:28 apply-patch: `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
## GREEN evidence

- focused Home + gateway tests passed 24/24 after switching the compact transport to 15-minute buckets (`trc_015e816c7bfa`).
- syntax/typecheck passed (`trc_aeee1f5e06bb`).
- working-tree inspection is limited to the intended five product/test files plus this task's metadata (`trc_059631463563`, `trc_7b942ffbb91d`).
- fractional-zone runtime proof: in `Asia/Kathmandu` (+05:45), 01:00Z maps to 06:45 local and 01:15Z maps to 07:00; in `Asia/Kolkata` (+05:30), 01:15Z maps to 06:45 and 01:30Z maps to 07:00. A 15-minute transport bucket therefore never straddles those local-hour boundaries, and the existing browser `Date(...).getHours()` grouping selects the correct local cell per bucket (`trc_1f56b3b3f661`).
- transport remains compact: at most 8 days × 24 hours × 4 = 768 numeric buckets, which the browser reduces to the existing 168 visible hourly cells. The 30s server cache now refreshes only the current/affected 15-minute bucket(s), while exact per-trace pricing and replacement invalidation remain unchanged.

- 2026-09-05 01:07:57 append: `.task/workspace-agents/preserve-local-hour-heatmap-accuracy/workpad.md`

## workspace-owned: validation evidence

- 2026-09-05 01:08:18 `review.run`: passed — OK
- 2026-09-05 01:08:59 `verify`: passed — OK

## Publish gate

- strict review against the actual remote stream base passed with 0 blocking issues (`trc_99c9248c90d0`).
- full verify passed with `publishValid: true` and exactly the intended five product/test files (`trc_931c5d8c4980`).
- review's public-docs suggestion is non-blocking and does not apply: the 15-minute buckets are a private Home transport/cache implementation detail, not a user-facing trace collection or retention contract.

- 2026-09-05 01:09:03 append: `.task/workspace-agents/preserve-local-hour-heatmap-accuracy/workpad.md`

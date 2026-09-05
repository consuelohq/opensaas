# preserve heatmap aggregate cost accuracy

branch: `task/workspace-agents/preserve-heatmap-aggregate-cost-accuracy`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/2390
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

behavior under test: hourly heatmap aggregation must preserve the same per-trace cost semantics as existing history rows while still emitting only compact aggregate buckets and no raw payloads.
existing local pattern: the history path converts each trace row through `rowToDashboardEvent`, where `estimateTraceCost` can use model/cached-token/request metadata; the new aggregate SQL currently sums tokens first and estimates one synthetic bucket-level trace, losing that pricing information.
new or changed tests: extend the hourly aggregate gateway/backend test with traces whose model/cached-token metadata produces a known cost different from naive bucket-level token pricing; assert hourly cost equals the sum of existing per-trace estimator results while raw payload keys remain absent from the response.
focused red command: `bun run --cwd packages/os test tests/trace-sites-gateway-live-endpoints.test.ts`
expected red failure: current aggregate cost differs because `readHourlyAggregateBuckets` estimates once from bucket token totals with `tool: trace.aggregate` and no per-trace metadata.
no-test waiver: not applicable.

- 2026-09-05 00:39:43 append: `.task/workspace-agents/preserve-heatmap-aggregate-cost-accuracy/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-05 00:39:43 fs.write: `.task/workspace-agents/preserve-heatmap-aggregate-cost-accuracy/workpad.md`
- 2026-09-05 00:44:56 fs.write: `.task/workspace-agents/preserve-heatmap-aggregate-cost-accuracy/workpad.md`
- 2026-09-05 00:45:44 fs.write: `.task/workspace-agents/preserve-heatmap-aggregate-cost-accuracy/workpad.md`

## workspace-owned: files read

- `node_modules/bun-types/sqlite.d.ts`
- `packages/os/scripts/lib/trace-cost-estimator.ts`
- `packages/os/scripts/lib/trace-database-schema.ts`
- `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- `packages/os/tests/trace-sites-gateway-live-endpoints.test.ts`

- 2026-09-05 00:44:49 apply-patch: `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
## Acceptance criteria

- [x] Hourly heatmap aggregate prices each trace with the same estimator semantics as the history view, including cached-input/model/token allocation metadata.
- [x] Raw trace payloads remain local and are never added to the aggregate response/cache rows.
- [x] Aggregate reads stay bounded: 10k-row chunks cap transient payload memory; the existing 30s server cache refreshes only the open hour.
- [ ] Strict review, full verify, stream promotion, release/update, and browser proof pass.

## Evidence

- canonical test-source safety preflight passed: 1/1 (`trc_83c889cffd97`).
- RED: focused aggregate test failed exactly on cached-input cost parity, `0.00265` vs expected `0.002614` (`trc_0a0083df4017`).
- GREEN: focused trace gateway suite passed 15/15 after per-trace pricing (`trc_58d9b8760262`).
- typecheck/syntax passed (`trc_3a3c20bc4d31`).
- live read-only sizing: the active 192h window is ~64.5k traces. Exact per-trace pricing from local bounded raw payloads is much cheaper than pricing after full history redaction/materialization: ~0.94s for one full read vs ~4.96s through full history-row materialization. Current-hour exact pricing is ~28ms for ~638 traces. A 10k-row bounded page benchmark was ~1.74s cold over the whole window while limiting transient payload memory (`trc_099061f5cc4c`, `trc_cd8a1fc93102`, `trc_40d383a41876`).

## Key decision

Use original locally stored bounded payloads only inside the local cost estimator, then return/store only numeric hourly aggregates. This both fixes Codex's pricing-parity review and avoids the expensive sanitize/render path. The historical browser snapshot remains persistent in localStorage; server history is held in the existing 30s in-process aggregate cache and only the current hour is recomputed on refresh, so normal page traffic does not rescan seven days or touch Cloudflare storage.

- 2026-09-05 00:44:56 append: `.task/workspace-agents/preserve-heatmap-aggregate-cost-accuracy/workpad.md`

## workspace-owned: validation evidence

- 2026-09-05 00:45:22 `review.run`: passed — OK
- 2026-09-05 00:45:39 `verify`: passed — OK

## Publish gate

- focused Home + gateway tests: 23/23 passed (`trc_e819c430e6d0`).
- strict review: 0 blocking issues (`trc_7fe4b74deee8`).
- full verify: `publishValid: true` (`trc_38c9c378f583`).
- public docs opportunity is non-blocking; this changes private Home aggregate implementation/pricing consistency, not the documented trace collection contract.

- 2026-09-05 00:45:44 append: `.task/workspace-agents/preserve-heatmap-aggregate-cost-accuracy/workpad.md`

# preserve heatmap pricing for large trace payloads

branch: `task/workspace-agents/preserve-heatmap-pricing-for-large-trace-payloads`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/2394
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

- `packages/os/scripts/lib/trace-cost-estimator.ts`
- `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- `packages/os/tests/trace-sites-gateway-live-endpoints.test.ts`

## Test-first contract

behavior under test: heatmap aggregate pricing must use valid complete trace payload JSON when the cost estimator needs payload-derived model/cache/token-allocation metadata; a large payload must never be sliced into invalid JSON before pricing.
existing local pattern: `TRACE_HOURLY_AGGREGATE_ROWS_SQL` truncates input/resolved/result JSON to 200,000 characters, then `estimateTraceCost` parses those strings recursively. Truncation can both invalidate JSON and change payload-length token allocation. The aggregate is already cached in process for 30s and the browser has a persistent scoped snapshot, so full payloads are only needed during a cold/affected-bucket recomputation.
new or changed tests: add a trace with >200k valid resolved-input JSON whose model and cached-input-token metadata occur after the old truncation boundary, record only total tokens, and assert aggregate cost exactly matches `estimateTraceCost` on the complete payload.
focused red command: `bun run --cwd packages/os test tests/trace-sites-gateway-live-endpoints.test.ts`
expected red failure: current aggregate query slices the large JSON, so the estimator loses cached/model metadata and returns a materially different cost.
no-test waiver: not applicable.

## Performance evidence before edit

- live 8-day store: ~65k rows; 59 result payloads exceed 200k, input/resolved payloads currently do not; largest result is ~6.2MB (`trc_206b5099736e`).
- exact full-payload pricing benchmark with a bounded 250-row page: ~64.5k traces in ~2.6s cold, with max transient page payload ~17MB; 500/1000-row pages were slower and used more transient payload memory (`trc_aec7b3cbf268`).
- decision: preserve exact estimator semantics by reading complete JSON in small 250-row aggregate pages. This is local SQLite only, occurs on cold/affected-bucket rebuilds, and keeps the normal 30s warm-refresh path plus persistent browser cache. No Cloudflare/D1/R2 history scan is added.

- 2026-09-05 01:25:07 append: `.task/workspace-agents/preserve-heatmap-pricing-for-large-trace-payloads/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-05 01:25:07 fs.write: `.task/workspace-agents/preserve-heatmap-pricing-for-large-trace-payloads/workpad.md`
- 2026-09-05 01:25:16 apply-patch: `packages/os/tests/trace-sites-gateway-live-endpoints.test.ts`
- 2026-09-05 01:25:32 apply-patch: `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- 2026-09-05 01:25:40 fs.write: `.task/workspace-agents/preserve-heatmap-pricing-for-large-trace-payloads/workpad.md`
- 2026-09-05 01:26:33 fs.write: `.task/workspace-agents/preserve-heatmap-pricing-for-large-trace-payloads/workpad.md`

## RED / GREEN evidence

- canonical test-source safety preflight passed 1/1 (`trc_49a564b13d06`).
- RED: large valid JSON regression failed exactly as expected: aggregate cost was `0.005` vs full-payload estimator `0.00095` because the 200k slice lost cached-token/model metadata (`trc_7175817cfcf8`).
- GREEN: aggregate now reads complete payload JSON in 250-row pricing pages while delta/high-water scans remain 10k-row metadata pages; focused gateway suite passed 18/18 (`trc_04a3ab47cfa5`).

- 2026-09-05 01:25:40 append: `.task/workspace-agents/preserve-heatmap-pricing-for-large-trace-payloads/workpad.md`

## workspace-owned: validation evidence

- 2026-09-05 01:26:15 `review.run`: passed — OK
- 2026-09-05 01:26:29 `verify`: passed — OK

## Publish gate

- combined Home + aggregate tests passed 26/26 and typecheck passed (`trc_193683f81516`, `trc_28299db2eb84`).
- strict review passed with 0 blocking issues (`trc_b2ca551b9b42`).
- full verify passed with `publishValid: true` against `origin/stream/workspace-agents` (`trc_690ebb4a5d39`).
- public docs are unchanged because this is an internal pricing/cache correctness implementation detail; no trace collection, retention, or public API contract changed.

- 2026-09-05 01:26:33 append: `.task/workspace-agents/preserve-heatmap-pricing-for-large-trace-payloads/workpad.md`

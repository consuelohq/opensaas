# fix launcher heatmap hydration and history

branch: `task/workspace-agents/fix-launcher-heatmap-hydration-and-history`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/2386
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

## Acceptance criteria

- [ ] Home heatmap does not render/animate an empty zero-state before real trace data; the sequential entrance animation runs once on first meaningful hydration.
- [ ] Reload/open can render a persisted aggregate immediately when available, then refresh data without replaying the entrance animation.
- [ ] The last-seven-days heatmap covers the full retained trace window instead of silently truncating at 24 x 100 recent rows.
- [ ] Historical heatmap reads use the canonical aggregate gateway path and avoid repeated browser-side pagination over trace history.
- [ ] Aggregate data remains raw-payload-free and scoped to the signed workspace/node boundary.
- [ ] Focused UI/gateway tests, structured diff review, and browser verification pass before publish.

## Plan

1. Inspect the existing aggregate route/read backend and local trace schema to reuse the canonical materialized-aggregate boundary rather than invent another cache.
2. Add focused RED coverage for single meaningful hydration, persistent stale-while-revalidate cache behavior, and the aggregate endpoint contract.
3. Implement a compact seven-day hourly aggregate response behind `/gateway/traces/aggregates`, derived with a bounded server-side read/query and no raw payloads.
4. Change Home to hydrate from the persisted aggregate cache or the aggregate endpoint, animate only the first meaningful render, and refresh silently afterward.
5. Verify historical coverage against the local trace store, run focused tests/review/verify, then prove the real Home page behavior in the browser.

## Test-first contract

behavior under test: Home renders a complete seven-day calls/tokens/cost heatmap from the canonical aggregate gateway without an empty first animation, keeps a browser-persistent aggregate for instant reopen/reload, and refreshes subsequent data without replaying the entrance animation.
existing local pattern: `settings-site.ts` currently aggregates `/gateway/traces/recent` client-side, stores a 30s `sessionStorage` aggregate, renders an empty aggregate when that cache is absent/stale, and animates every render; the trace gateway already exposes `/gateway/traces/aggregates` as a signed materialized-window/aggregate-cache route.
new or changed tests: update `packages/os/tests/settings-site.test.ts` to require the aggregate route, persistent cache, no empty initial render, and explicit one-time animation semantics; add/extend trace gateway/backend tests for seven-day hourly aggregate output after the exact backend boundary is confirmed.
focused red command: run the narrow settings-site and aggregate gateway test files through the canonical package Vitest runner after preflighting them for destructive literals.
expected red failure: current Home HTML still contains `/gateway/traces/recent`, `OVERVIEW_HEATMAP_MAX_PAGES = 24`, 30s `sessionStorage`, and `renderOverviewHeatmap(cached || aggregateOverviewHeatmap([]));`; the aggregate route does not yet expose hourly heatmap buckets.
no-test waiver: not applicable.

- 2026-09-05 00:25:09 append: `.task/workspace-agents/fix-launcher-heatmap-hydration-and-history/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-05 00:25:09 fs.write: `.task/workspace-agents/fix-launcher-heatmap-hydration-and-history/workpad.md`
- 2026-09-05 00:28:22 fs.write: `.task/workspace-agents/fix-launcher-heatmap-hydration-and-history/workpad.md`
- 2026-09-05 00:30:03 fs.write: `.task/workspace-agents/fix-launcher-heatmap-hydration-and-history/workpad.md`
- 2026-09-05 00:31:44 fs.write: `.task/workspace-agents/fix-launcher-heatmap-hydration-and-history/workpad.md`
- 2026-09-05 00:36:19 fs.write: `.task/workspace-agents/fix-launcher-heatmap-hydration-and-history/workpad.md`

## workspace-owned: files read

- `packages/os/SCRIPTS.md`
- `packages/os/package.json`
- `packages/os/scripts/lib/settings-site.ts`
- `packages/os/scripts/lib/trace-cost-estimator.ts`
- `packages/os/scripts/lib/trace-sites-gateway-live-endpoints.ts`
- `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- `packages/os/tests/settings-site.test.ts`
- `packages/os/tests/test-source-safety.test.ts`
- `packages/os/tests/trace-sites-gateway-live-endpoints.test.ts`

## RED evidence

- command: `bun run --cwd packages/os test tests/settings-site.test.ts tests/trace-sites-gateway-live-endpoints.test.ts`
- result: expected RED, 2 failed / 21 passed.
- Home shell failure: production still renders heatmap cache v1/current raw-history pagination instead of the v2 aggregate/cache contract.
- Gateway failure: `/gateway/traces/aggregates?window=8d&bucket=hour` returns no `data.hourly`, so the new totals/buckets contract is absent.
- trace: `trc_aaa066d43395`

- 2026-09-05 00:28:22 append: `.task/workspace-agents/fix-launcher-heatmap-hydration-and-history/workpad.md`

- 2026-09-05 00:28:47 apply-patch: `packages/os/scripts/lib/trace-sites-gateway-read-layer.ts`
- 2026-09-05 00:28:54 apply-patch: `packages/os/scripts/lib/trace-sites-local-read-backend.ts`

- 2026-09-05 00:29:13 apply-patch: `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- 2026-09-05 00:29:28 apply-patch: `packages/os/scripts/lib/trace-sites-gateway-live-endpoints.ts`
- 2026-09-05 00:29:41 apply-patch: `packages/os/scripts/lib/settings-site.ts`
## GREEN evidence

- focused command: `bun run --cwd packages/os test tests/settings-site.test.ts tests/trace-sites-gateway-live-endpoints.test.ts`
- result: 2 files passed, 23 tests passed.
- trace: `trc_84b1a1648ef3`
- implementation now reads one hourly aggregate window, stores at most the compact bucket rows in browser localStorage, keeps a 30s in-process backend cache that refreshes only the open/current hour (or the rollover span), and animates only the first meaningful heatmap render.

- 2026-09-05 00:30:03 append: `.task/workspace-agents/fix-launcher-heatmap-hydration-and-history/workpad.md`

## workspace-owned: validation evidence

- 2026-09-05 00:31:17 `review.run`: passed — OK
- 2026-09-05 00:31:21 apply-patch: `packages/os/tests/trace-sites-gateway-live-endpoints.test.ts`
- 2026-09-05 00:31:36 `review.run`: passed — OK
- 2026-09-05 00:33:19 `verify`: failed — COMMAND_FAILED
- 2026-09-05 00:35:32 `verify`: passed — OK

## Validation and performance evidence

- task diff inspected with `git.diff`; implementation is limited to the Home heatmap client, trace aggregate gateway/read backend, focused tests, and task metadata.
- syntax/typecheck: `bun run --cwd packages/os typecheck` passed (`trc_a2c9118768b6`).
- live canonical trace DB read-only aggregate probe: 64,181 calls / 4,017,244 recorded tokens across 178 active hourly buckets in the 192-hour window; the full first aggregate query took ~963 ms (`trc_a728c7752e1f`).
- read-only current-hour probe: 378 calls / 42,935 tokens and ~0.73 ms (`trc_db65ac048d04`), which is the steady-state server refresh cost after the 30s aggregate cache is warm.
- strict review initially caught a test-only SQL literal style issue; replaced it with the repository's parameterized SQL constant pattern, reran focused tests green (23/23, `trc_4bc33cac2b47`), then strict review passed with 0 blocking issues (`trc_96d829224d41`).
- documentation review suggested the public trace docs because trace internals changed. No public trace collection/retention/API behavior is being documented here: this is a private Home visualization/read optimization, so no public docs edit is required for this task.

- 2026-09-05 00:31:44 append: `.task/workspace-agents/fix-launcher-heatmap-hydration-and-history/workpad.md`

- 2026-09-05 00:34:26 apply-patch: `packages/os/tests/facade/__snapshots__/facade.test.ts.snap`

## Final pre-publish state

- canonical destructive-literal preflight passed: `packages/os/tests/test-source-safety.test.ts` 1/1 (`trc_aa4ebceaf3ea`).
- full publish gate passed against the actual remote stream base `origin/stream/workspace-agents`: `publishValid: true`, DB guard passed, review passed, selected tests passed; stamp `.task/workspace-agents/fix-launcher-heatmap-hydration-and-history/verify.json` (`trc_adc859357986`).
- recovery note: validating against the stale local `stream/workspace-agents` selected unrelated prior-task changes and created one unrelated Vitest snapshot entry. I identified the base mismatch, removed only that generated snapshot entry, and reran the full gate against `origin/stream/workspace-agents`. Current working diff contains only the six intended source/test files plus this task's metadata/evidence.

- 2026-09-05 00:36:19 append: `.task/workspace-agents/fix-launcher-heatmap-hydration-and-history/workpad.md`

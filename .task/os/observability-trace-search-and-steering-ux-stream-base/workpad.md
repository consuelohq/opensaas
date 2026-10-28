# Observability trace search and steering UX — stream base

branch: `task/os/observability-trace-search-and-steering-ux-stream-base`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1932/observability-trace-search-and-steering-ux-stream-base
github pr: https://github.com/consuelohq/opensaas/pull/1932
started: 2026-08-14

## acceptance criteria

- [x] Steering/get_steering/refresh_steering appear in canonical trace history with safe decision metadata and estimated token counts, without steering body in browser-facing trace rows.
- [x] F toggles the filter side panel; J = down/next and K = up/previous while Arrow navigation continues to work.
- [x] `/` swaps the existing top-right clock slot for a thin search input; `×`/Escape restores the clock without changing chrome height.
- [x] Search supports free metadata plus structured tool/branch/status/node/route/trace/code/date terms and queries full canonical history, not only already-loaded rows.
- [x] Full-history search excludes raw payload blobs to avoid a secret-existence side channel.
- [x] Focused trace/steering tests and strict review pass; verify was attempted and is blocked only by documented unrelated stream/os baseline failures, with the approved publish override recorded.

## discovery

- This task supersedes mis-bootstrapped PR #1930, which started from `main` instead of `stream/os` and was 153 stream commits stale. #1930 must not be merged.
- Feature patch contains only 14 OS tracing runtime/test files; no old task metadata, baseline harness fixes, or generated facade snapshots are carried forward.
- Canonical shipped inspector remains `packages/os/scripts/lib/trace-site-inspector`; the older workspace copy remains intentionally untouched.
- Existing architecture already has 100k-row virtualization, infinite history pagination, live updates, filters, and Arrow navigation. Extend this stack rather than rebuild it.
- Existing steering execution metadata is recorded internally; canonical trace history needs a safe mirrored row so steering is visible in the tracing page.

## Test-first contract

- Behavior under test: steering calls persist into canonical `tool_traces` with safe decisions/token estimates; F toggles; J/K mirror ArrowDown/ArrowUp; slash search replaces the clock and searches canonical history by structured metadata/date.
- Original focused RED on the superseded worktree: 4 expected failures / 5 passes (structured/date search absent, J/K/slash/toggle absent, canonical steering rows absent).
- Search compiler RED: module absent before implementation.
- Gateway handoff RED: URL query parsed but dropped before backend; route-level test caught `observedQuery === ''` before fix.
- Re-run all relevant tests on this clean stream-based worktree after applying the exact feature patch; prior green evidence is informative but not sufficient for this replacement task.

## plan

1. Verify stream base and canonical ownership.
2. Apply the 14-file feature patch from superseded #1930.
3. Run focused trace/steering tests, direct SQLite search integration, package syntax/build checks, and full selected verification on the clean stream base.
4. Strict review + verify.
5. Push, merge task into `stream/os`, finish task. Leave #1930 unmerged/superseded.

## current status

- Feature patch applied cleanly on current stream/os. Core behavior, integration validation, and strict review are green. Verify is baseline-blocked only by unrelated current-stream tests; approved task promotion remains.

## files changed

- packages/os/scripts/lib/trace-search-query.ts
- packages/os/scripts/lib/trace-site-inspector/browser.ts
- packages/os/scripts/lib/trace-site-inspector/pagination-browser.ts
- packages/os/scripts/lib/trace-site-inspector/table-formatters.ts
- packages/os/scripts/lib/trace-site-inspector/virtual-list-browser.ts
- packages/os/scripts/lib/trace-sites-gateway-live-endpoints.ts
- packages/os/scripts/lib/trace-sites-gateway-read-layer.ts
- packages/os/scripts/lib/trace-sites-local-read-backend.ts
- packages/os/scripts/os.ts
- packages/os/tests/os-steering-tool-trace.test.ts
- packages/os/tests/trace-search-query.test.ts
- packages/os/tests/trace-site-inspector-interactions.test.ts
- packages/os/tests/trace-site-inspector-os-owned.test.ts
- packages/os/tests/trace-sites-gateway-live-endpoints.test.ts

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-14 01:21:05 fs.write: `.task/os/observability-trace-search-and-steering-ux-stream-base/workpad.md`

## workspace-owned: validation evidence

- 2026-08-14 01:24:23 `review.run`: passed — OK
- 2026-08-14 01:25:21 `verify`: failed — COMMAND_FAILED

## validation evidence

- Clean stream-base core suite: 4 files / 26 tests green.
- Package syntax/typecheck: green.
- Bun-native compile checks: trace browser bundle + OS entrypoint bundle green.
- Bun-native SQLite integration: tool+branch -> row_2; date+error -> row_3; trace-id -> row_2; raw payload phrase -> no match by design.
- New gateway query-forwarding test passes.
- Broader selected trace run reached 84 passing tests; 8 failures are pre-existing stream-base issues: the unchanged live-endpoint suite imports bun:sqlite under a Node Vitest worker and the unchanged renderer test expects an obsolete generated-sites string.
- Full OS package run is also red on unchanged facade tests (dry-run/schema expectation mismatches) and regenerated a facade snapshot; that generated snapshot was restored immediately and is not part of this task.
- Direct Bun-native backend coverage validates the new SQLite search path despite those unrelated harness failures.

- Final strict review against origin/stream/os: 14 feature files, 0 blocking issues, 0 must-fix.
- Final verify: review passed and DB-risk checks passed, but publishValid remained false because the current stream/os package test lane is already red in unrelated facade/live-endpoint/renderer tests. The verifier regenerated the facade snapshot; it was restored immediately.
- User explicitly approved moving forward with this scoped trace iteration; task promotion uses task.push approved override with the baseline failure documented rather than silently bypassed.

## key decisions

- Standard Vim navigation: j = down/next, k = up/previous.
- No fuzzy/PageRank dependency for this iteration; use deterministic structured metadata search on the existing virtualized history stack.
- Search raw trace payloads are excluded server-side; sanitized-content search can be a future dedicated index.

## notes for ko

- Search examples after implementation: `fs.read`, `branch:feature/search`, `tool:code.call status:error`, `date:2026-08-13`, or combinations.

## improvements noticed

- OS task bootstrap should default to `startFrom: stream` when a durable stream exists; #1930 demonstrated why.
- Stale duplicate `packages/workspace/scripts/trace-site-inspector` should eventually be retired or synchronized.

## issues and recovery

- PR #1930 was pushed but intentionally not merged after discovering its base would drag unrelated main-only security/Caddy/release commits into stream/os. PR #1932 is the clean replacement.
- Current stream/os has unrelated failing package tests in facade/live-endpoint/renderer areas. The task did not change those runtime/test areas except for adding one isolated gateway query-forwarding assertion.

---

## publish checklist

```bash
bun run task:push -- --message "feat(os): add trace search and steering observability" --changed
bun run task:pr
bun run task:finish
```

- 2026-08-14 01:21:05 write: `.task/os/observability-trace-search-and-steering-ux-stream-base/workpad.md`

## workspace-owned: files read

- none yet

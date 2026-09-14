# Restore tracing layout initial history and automatic infinite scroll

branch: `task/os/restore-tracing-layout-initial-history-and-automatic-infinite-scroll`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2465
started: 2026-09-13

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/os/assets/vendor/observability-traces-v38/inspector.js`
- `packages/os/scripts/lib/trace-site-inspector/live-browser.ts`
- `packages/os/scripts/lib/trace-site-inspector/virtual-list-browser.ts`
- `packages/os/scripts/lib/trace-sites-gateway-live-endpoints.ts`
- `packages/os/scripts/lib/trace-sites-gateway-read-layer.ts`
- `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- `packages/os/tests/trace-request-budget.test.ts`

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

Restore the existing tracing UX: opening shows last persisted traces even after a day of inactivity; column header stays at the top and rows occupy the viewport; history loads automatically near the bottom on user scrolling without a Load older button; filtering and live prepends never recursively drain history. Preserve bounded live requests, hidden pause, authentication and backoff. No subagents; one CI review-comments round. Use existing trace-request-budget rendered-browser tests, adding actual geometry and aged-history cases. Expected red: status grid child displaces table header; button remains; aged initial snapshot omits persisted traces. Focused red command: existing OS test target with trace-request-budget suite after inspecting package config. No waiver.

- 2026-09-13 15:58:14 append: `.task/os/restore-tracing-layout-initial-history-and-automatic-infinite-scroll/workpad.md`

## workspace-owned: files changed

- `packages/os/assets/vendor/observability-traces-v38/inspector.js`
- `packages/os/scripts/lib/trace-site-inspector/live-browser.ts`
- `packages/os/scripts/lib/trace-site-inspector/virtual-list-browser.ts`
- `packages/os/scripts/lib/trace-sites-gateway-live-endpoints.ts`
- `packages/os/scripts/lib/trace-sites-gateway-read-layer.ts`
- `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- `packages/os/tests/trace-request-budget.test.ts`

## workspace-owned: activity log

- 2026-09-13 15:58:14 fs.write: `.task/os/restore-tracing-layout-initial-history-and-automatic-infinite-scroll/workpad.md`
- 2026-09-13 16:07:52 fs.write: `.task/os/restore-tracing-layout-initial-history-and-automatic-infinite-scroll/workpad.md`
- 2026-09-13 16:22:31 fs.write: `.task/os/restore-tracing-layout-initial-history-and-automatic-infinite-scroll/workpad.md`

## Implementation and evidence

Confirmed production grid bug: live status took 497px of a 565px pane; scroller only42px. Confirmed default history returns100raw rows but hides successful authentication.mcp rows, starving visible history after inactivity. Red rendered idle-history regression failed with header584px below pane top. Fixed by keeping status in footer count, removing Load older button, handling user scroll gestures including underfilled lists with one in-flight history request, failed-history15s cooldown, and preserving filter/live no-fetch behavior. Apply existing hidden-auth visibility rule in local history SQL beforeLIMIT; provide snapshot liveCursor watermark to avoid replaying hidden authentication backlog. 11 browser/stream regressions pass (58 assertions), including real SQLite250idlechecks, agedtooltrace and authfailure retained, initial live watermark253, actual header/row geometry, no button, sparse-scroll single-flight, stale searches, hidden pause and backoff. Screenshot /tmp/tracing-idle-fixed.png. User contract: preserve optimized logic, no subagents, one CI review-comments round.

- 2026-09-13 16:07:52 append: `.task/os/restore-tracing-layout-initial-history-and-automatic-infinite-scroll/workpad.md`

## workspace-owned: validation evidence

- 2026-09-13 16:08:27 `verify`: passed — OK
First CI/review round: all 35 checks passed on PR #2466. Addressed both actionable comments: clear unhandled history aria-busy and mirror the UI's effective success/code visibility in SQLite before LIMIT. Added success override/fallback/error-code fixtures and unhandled-search coverage. Also discard scroll gestures received during an in-flight history/search request; browser test waits for actual wheel delivery before resolving the request. Follow-up focused validation: 40 tests passed, 202 assertions across request-budget, history contract, gateway and Hono/auth suites. Rebuilt shipped inspector asset. No second comment-review cycle requested; rerun required CI then release.
- 2026-09-13 16:22:31 append: `.task/os/restore-tracing-layout-initial-history-and-automatic-infinite-scroll/workpad.md`
- 2026-09-13 16:22:56 `verify`: passed — OK

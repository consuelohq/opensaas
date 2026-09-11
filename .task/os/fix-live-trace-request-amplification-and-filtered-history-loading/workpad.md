# fix live trace request amplification and filtered history loading

branch: `task/os/fix-live-trace-request-amplification-and-filtered-history-loading`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2461
started: 2026-09-11

## acceptance criteria

- [x] Preserve live tracing and history while bounding HTTP requests.
- [x] Prevent render/filter-driven history chains and reject stale searches.
- [x] Display unavailable/rate-limited state without discarding loaded rows.
- [x] Verify authenticated scope/redaction, browser behavior, generated artifact, and full task gate.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

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

## Test-first contract (2026-09-11)
- Preserve live newest-first traces, selected trace/scroll position, local filtering, and cursor-based infinite history.
- Rendering/filtering/live inserts must not trigger history reads. One in-flight history page; explicit load-more when sparse filters cannot scroll; stale query responses must not commit.
- One live owner per document; one authenticated SSE connection with cursor deltas; bounded fallback >=15 seconds, backoff and Retry-After, no hidden-page requests.
- Initial unavailable/auth/throttled state must be visible and keep already loaded rows.
- Stream uses existing scoped history validation and raw-payload policy, closes on disconnect, bounds connection lifetime and buffering. No shared cache of private traces.
- RED: browser regression for filter render amplification; endpoint regression for continuous correctly framed cursor SSE.
- GREEN: focused browser, live/history endpoint, stream and artifact regressions; regenerate canonical inspector asset; required verify/review.
- Release: canary then local/runtime + deployed trace artifact + authenticated route acceptance; inspect OS stable 0.1.86 -> canary 0.1.115 gap, then promote exact tested build. Billing unchanged.

- 2026-09-11 20:36:45 append: `.task/os/fix-live-trace-request-amplification-and-filtered-history-loading/workpad.md`

## workspace-owned: files changed

- `packages/os/tests/trace-request-budget.test.ts`

## workspace-owned: activity log

- 2026-09-11 20:36:45 fs.write: `.task/os/fix-live-trace-request-amplification-and-filtered-history-loading/workpad.md`
- 2026-09-11 20:37:20 write: `packages/os/tests/trace-request-budget.test.ts`
- 2026-09-11 20:37:20 fs.write: `packages/os/tests/trace-request-budget.test.ts`

## workspace-owned: validation evidence

- 2026-09-11 20:51:17 `verify`: failed — COMMAND_FAILED
- 2026-09-11 20:55:54 `verify`: failed — COMMAND_FAILED
- 2026-09-11 20:59:15 `verify`: passed — OK

## Validation and release preparation
- RED: one sparse filter produced 43 history requests in 600ms before repair.
- GREEN: 10 browser/stream regressions including native EventSource against the complete generated page; startup rows arriving before table mount are buffered.
- Full verify passed 2026-09-11T20:59:15Z; no blocking review issues, DB guard passed.
- Browser owns loaded-row cache/filtering; node reads SQLite over one bounded SSE connection; fallback >=15s with backoff, Retry-After and hidden-page pause.
- Live and history transport remain same-origin and authenticated; private responses use no-store.
- Stable 0.1.86 source ca84eb7 -> canary 0.1.115 source eb3615f: 231 OS files, no migration files. Includes installer/auth/recovery changes.
- Pending operational acceptance: immutable canary publication, local update, hosted site artifact publication, authenticated MCP/heartbeat checks, then exact stable promotion.

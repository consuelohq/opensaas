# Observability trace search and steering UX

branch: `task/os/observability-trace-search-and-steering-ux`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1930/observability-trace-search-and-steering-ux
github pr: https://github.com/consuelohq/opensaas/pull/1930
started: 2026-08-14

## acceptance criteria

- [x] `get_steering` calls appear in canonical trace history, including full/soft-guard/hard-guard/cooldown decisions.
- [x] Steering trace rows persist estimated token counts without persisting the steering body in browser-facing `tool_traces`.
- [x] `refresh_steering` is observable with safe reason/decision metadata and token estimate.
- [x] `F` toggles the filter side panel both directions.
- [x] Arrow Up/Down retain existing trace navigation; `K` moves up and `J` moves down using standard Vim convention.
- [x] `/` opens a thin search control in the existing top-right clock slot without changing chrome height; `Escape` or `×` closes it and restores the clock.
- [x] Search supports free metadata text and field-aware matching for tool, branch, status, trace id/code, node/route, and date/time; `tool:`, `branch:`, `status:`, and `date:` structured terms work and compose.
- [x] Search queries canonical SQLite history and paginates matching results instead of requiring users to infinite-scroll old rows into the browser first.
- [x] Search reuses the existing trace virtual-list/filter model; no fuzzy/PageRank dependency was added.
- [x] Full-history search deliberately excludes raw input/result/stderr payload blobs to avoid a secret-existence side channel.
- [x] Search/key handling does not hijack keystrokes while editing an input/textarea/contenteditable target.
- [x] Focused tests cover steering persistence/token metadata, F toggle, J/K direction, slash-search lifecycle, structured/date matching, URL forwarding, and server query compilation.
- [ ] Final strict review and safety verification recorded immediately before publish.

## plan

1. Reconcile the shipped OS trace inspector source with the older workspace copy and change only the canonical OS runtime path.
2. Add failing tests for canonical steering trace persistence, keyboard toggle/navigation, and structured/date search.
3. Mirror safe steering execution metadata into `tool_traces` using the existing chars/4 estimate; keep steering body only in the internal execution record.
4. Extend the trace matcher with structured terms and add a parameterized SQLite history query compiler.
5. Add a clock-slot search controller and `/` lifecycle, then page matching canonical history through the existing gateway transport.
6. Make F toggle filters and add J/K aliases for ArrowDown/ArrowUp.
7. Run focused + broader trace tests, syntax/build checks, strict review, verify, then push task and merge to stream.

## current status

- Feature implementation is complete in the task worktree.
- Canonical shipped implementation lives under `packages/os/scripts/lib/trace-site-inspector`; the older `packages/workspace/scripts/trace-site-inspector` copy is stale and intentionally untouched.
- Steering now writes a safe canonical trace row with decision/chars/token counts while existing internal `skill_executions` continues to retain the full steering result.
- `/` swaps the top-right clock for a thin search input with a small `×`; the clock returns on close. Search is backed by canonical SQLite history with pagination, not just loaded browser rows.
- The task was originally bootstrapped from `main` by mistake and is 153 commits behind `origin/stream/os`. Re-opening `task.start` with `startFrom: stream` correctly updated task metadata but does not rewrite an existing branch. Production feature files have zero overlap with those 153 stream commits; full-package failures on the stale task branch are therefore not valid merge-target failures.
- Temporary baseline-test edits made while diagnosing the stale full-suite gate were restored; the final task diff is feature-only plus task metadata.

## files changed

- `packages/os/scripts/lib/trace-search-query.ts`
- `packages/os/scripts/lib/trace-site-inspector/browser.ts`
- `packages/os/scripts/lib/trace-site-inspector/pagination-browser.ts`
- `packages/os/scripts/lib/trace-site-inspector/table-formatters.ts`
- `packages/os/scripts/lib/trace-site-inspector/virtual-list-browser.ts`
- `packages/os/scripts/lib/trace-sites-gateway-live-endpoints.ts`
- `packages/os/scripts/lib/trace-sites-gateway-read-layer.ts`
- `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- `packages/os/scripts/os.ts`
- `packages/os/tests/os-steering-tool-trace.test.ts`
- `packages/os/tests/trace-search-query.test.ts`
- `packages/os/tests/trace-site-inspector-interactions.test.ts`
- `packages/os/tests/trace-site-inspector-os-owned.test.ts`
- `packages/os/tests/trace-sites-gateway-live-endpoints.test.ts`

## workspace-owned: files changed

- `packages/os/scripts/lib/trace-search-query.ts`
- `packages/os/scripts/lib/trace-site-inspector/browser.ts`
- `packages/os/scripts/lib/trace-site-inspector/pagination-browser.ts`
- `packages/os/scripts/lib/trace-site-inspector/table-formatters.ts`
- `packages/os/scripts/lib/trace-site-inspector/virtual-list-browser.ts`
- `packages/os/scripts/lib/trace-sites-gateway-live-endpoints.ts`
- `packages/os/scripts/lib/trace-sites-gateway-read-layer.ts`
- `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- `packages/os/scripts/os.ts`
- `packages/os/tests/os-steering-tool-trace.test.ts`
- `packages/os/tests/trace-search-query.test.ts`
- `packages/os/tests/trace-site-inspector-interactions.test.ts`
- `packages/os/tests/trace-site-inspector-os-owned.test.ts`
- `packages/os/tests/trace-sites-gateway-live-endpoints.test.ts`

## workspace-owned: activity log

- 2026-08-14 01:17:35 fs.write: `.task/os/observability-trace-search-and-steering-ux/workpad.md`
- 2026-08-14 01:19:07 fs.write: `.task/os/observability-trace-search-and-steering-ux/workpad.md`
- managed automatically by the task workflow

## workspace-owned: validation evidence

- managed automatically by the task workflow
- 2026-08-14 01:17:39 `review.run`: passed — OK
- 2026-08-14 01:18:55 `verify`: failed — COMMAND_FAILED

## Test-first contract

- Behavior under test: steering calls persist into canonical `tool_traces` with safe decision metadata and output-token estimates; F toggles filters; J/K mirror ArrowDown/ArrowUp; slash search replaces the clock slot and filters traces by free metadata plus structured tool/branch/status/date terms.
- Existing local pattern: keep the shipped OS trace inspector/virtual-list stack and the existing chars/4 steering estimate. Continue using `recordToolTraceSafely` for canonical trace persistence and existing virtual-list state for browser filtering/pagination.
- Initial focused RED: 4 expected failures / 5 passes. Date/structured search did not match, J/K/slash/toggle wiring was absent, and no canonical steering trace DB existed because steering only recorded to `skill_executions`.
- Search compiler RED: `tests/trace-search-query.test.ts` initially failed because `trace-search-query` did not exist.
- Gateway handoff RED: route-level test observed an empty query even though URL parsing had it; `cursorPageResponse` was rebuilding the backend input and dropping `query`. The handoff was fixed and the route test is green.
- Expected privacy boundary: no steering body in `tool_traces`; safe reason/decision/chars plus estimated output tokens only. Full-history search is metadata-only and parameterized.

## validation evidence

- Focused core: `trace-site-inspector-interactions`, `trace-site-inspector-os-owned`, `trace-search-query`, `os-steering-tool-trace` => 4 files, 26/26 green.
- Broader trace surface: observability site, inspector, renderer, gateway read layer/contracts, history endpoint, browser client, runtime boundary, steering persistence => 11 files, 80/80 green.
- Gateway full-history query forwarding targeted test: green after intentional RED caught the dropped-query handoff.
- Direct Bun/SQLite integration against a temp canonical trace DB: `tool:fs.read branch:feature/search` => `row_2`; `date:2026-08-13 status:error` => `row_3`; trace id `trc_2` => `row_2`; raw payload phrase `history needle` => no result by design.
- Package syntax check (`bun run typecheck`, which maps to OS syntax validation): green.
- Bun compile checks: trace browser entrypoint bundled for browser; `scripts/os.ts` bundled for Bun; both green.
- Strict review before final task cleanup: 0 blockers / 0 must-fix. Final strict review still required after current workpad/task state.
- Full `packages/os` suite on the task checkout is not a valid gate because the task branch was mistakenly created from main and is 153 `stream/os` commits stale. Evidence: `git rev-list --left-right --count origin/stream/os...HEAD` => `153 3`. Facade files producing 50+ failures have no task diff. Current stream also already contains fixes for baseline operator-login/runtime-state/node-lock harness races that the stale branch lacks.

## key decisions

- Standard navigation follows Vim: `j` = next/down, `k` = previous/up.
- No fuzzy-search/PageRank dependency for this iteration. The existing virtualized list + structured query grammar is deterministic, fast, and easier to reason about.
- Search grammar supports free metadata terms and structured `tool:`, `branch:`, `status:`, `node:`, `route:`, `trace:`/`id:`, `code:`, and `date:`/`time:` terms. Quoted terms are supported.
- Exact `date:YYYY-MM-DD` is converted to America/New_York day bounds and compiled into parameterized SQLite timestamps.
- Full-history server search excludes `input_json`, `resolved_input_json`, `result_json`, and `stderr`. This avoids making legacy sensitive payload contents searchable through a side channel. A future sanitized-content index can add safe content search deliberately.
- Search results page through the existing authenticated `/gateway/traces/recent` history route; live trace updates continue through the existing live path.
- Steering body remains internal; user-facing traces contain safe summaries/token counts only.

## notes for ko

- The search input is intentionally thin and occupies the existing clock slot rather than adding another toolbar row.
- Search examples: `fs.read`, `branch:feature/search`, `tool:code.call status:error`, `date:2026-08-13`, or combined terms.

## improvements noticed

- The older `packages/workspace/scripts/trace-site-inspector` tree is behind the shipped OS copy and should be retired or explicitly synchronized in a later cleanup.
- Review identified a nonblocking documentation opportunity in `packages/documentation/src/content/docs/observe/traces.mdx` for the new keyboard/search behavior.
- Task bootstrap should default OS feature tasks to `startFrom: stream` when a durable `stream/os` exists; starting this task from main created an invalid full-suite gate against stale code.

## issues and recovery

- Two early `fs.patch` calls had transient MCP transport failures; subsequent task-scoped reads/writes were healthy.
- Two early `code.call` timeouts used second-like values in a millisecond timeout field; corrected to 120000/180000.
- An early steering persistence test inherited the parent `CONSUELO_TRACE_DB` and wrote exactly 8 synthetic `source='steering'` rows to the live canonical DB. Those exact 8 record IDs were queried and deleted (`removed: 8`), and the test helper now overrides `CONSUELO_TRACE_DB`, `TRACE_DB`, `CONSUELO_OS_HOME`, `CONSUELO_HOME`, and `CONSUELO_USER_HOME` to its temp DB.
- The `check-files` wrapper is broken in this worktree because it invokes a controller-only `code-call` script that is not installed there. Package syntax validation and Bun bundling were used as source checks instead.
- Initial `verify` failed because its integration lane ran the entire stale OS package. Investigation first exposed three unrelated async-test harness races; current `stream/os` already contains equivalent fixes. Temporary local fixes and an auto-generated facade snapshot were restored so they are not part of this task.
- Re-opening the existing task with `startFrom: stream` does not rewrite its already-created branch. There is no typed task-rebase tool, so the branch was not destructively rebased; publish will use the explicit approved path with this bootstrap defect documented.

---

## publish checklist

```bash
bun run task:push -- --message "feat(os): add trace search and steering observability" --changed
bun run task:pr
bun run task:finish
```

- 2026-08-14 01:17:35 write: `.task/os/observability-trace-search-and-steering-ux/workpad.md`

## final validation note

- Final strict `review.run --strict` completed against `origin/stream/os`: 0 blocking issues / 0 must-fix.
- Final `verify --base origin/stream/os` could not produce a publish stamp because the already-created task branch is main-based and 153 stream commits stale. The verifier therefore classified unrelated current-stream files (including security gateway and a Caddy migration) as task changes. Review and DB checks themselves passed; `publishValid` remained false because the branch topology makes the full gate invalid.
- This is a task-bootstrap/workflow defect, not a tracing feature failure. The user explicitly asked to move forward with this scoped iteration. Publish uses the supported `task.push --approved --reason ...` path, with the stale-base condition documented rather than silently bypassed.

- 2026-08-14 01:19:07 append: `.task/os/observability-trace-search-and-steering-ux/workpad.md`

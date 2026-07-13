# fix trace analytics month window

branch: `task/workspace-agents/fix-trace-analytics-month-window`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1014/fix-trace-analytics-month-window
github pr: https://github.com/consuelohq/opensaas/pull/1014
started: 2026-06-13

## acceptance criteria

- [x] Explain why `past_week` and `past_month` can legitimately match when the selected trace DB has no rows older than 7 days.
- [x] Add visible trace-history / retention-horizon signal before the cumulative window totals.
- [x] Preserve the existing token coverage, top tools, top branches, errors, slow calls, high-output calls, and active branch sections.
- [x] Document `trace:analytics` behavior in `packages/workspace/SCRIPTS.md`.
- [x] Validate the report against the live local trace DB.

## test-first contract

- Behavior under test: `bun scripts/operator/trace-analytics.ts` output must include a `Trace history` section with `rows_older_than_week` and a `window_note` explaining matching week/month windows when the DB has no rows before the 7-day cutoff.
- Existing pattern: operator scripts render SQLite aggregate tables directly against the local `tool_traces` DB; there are no formal unit tests for this report script.
- Focused red: a Python assertion around script output failed because `Trace history` was absent.
- Green validation: the same assertion passed after the patch and the output excerpt showed `rows_older_than_week = 0` plus the explanatory note.

## plan

1. Read repo standards, workspace script docs, previous trace analytics workpads, and the trace analytics script.
2. Reproduce the matching `past_week` / `past_month` output and query the trace DB horizon directly.
3. Add a compact `Trace history` table that makes the retention horizon explicit.
4. Document the expected behavior in `SCRIPTS.md`.
5. Run focused validation, review, verify, and publish.

## current status

- Implementation complete. Validation in progress.

## files changed

- `packages/workspace/SCRIPTS.md`
- `scripts/operator/trace-analytics.ts`

## workspace-owned: files read

- `AGENTS.md`
- `CODING-STANDARDS.md`
- `package.json`
- `packages/workspace/SCRIPTS.md`
- `scripts/operator/trace-analytics.ts`

## workspace-owned: activity log

- 2026-06-13 10:48 ET: started task branch from `stream/workspace-agents`.
- 2026-06-13 10:49 ET: reproduced matching week/month window totals.
- 2026-06-13 10:49 ET: direct DB query showed first row `2026-06-07T19:21:12Z` and `older_than_week = 0`.
- 2026-06-13 10:49 ET: focused red assertion failed because no `Trace history` section existed.
- 2026-06-13 10:50 ET: added `historySql` and a `Trace history` table to `trace-analytics.ts`.
- 2026-06-13 10:52 ET: documented `trace:analytics` window behavior in `SCRIPTS.md`.
- 2026-06-13 14:53:31 fs.write: `.task/workspace-agents/fix-trace-analytics-month-window/workpad.md`

## workspace-owned: validation evidence

- `sqlite3 -json ... "SELECT min(ts), max(ts), ..."`: passed; rows older than week were `0`, so week/month equality is expected for the current DB.
- Pre-patch focused assertion for `Trace history`: failed as expected with `AssertionError: expected trace history section explaining why cumulative windows can match`.
- Post-patch focused assertion: passed; output includes `Trace history`, `rows_older_than_week`, the explanatory `window_note`, and the existing `Token coverage by window` section.
- 2026-06-13 14:56:50 `review.run`: passed — OK
- 2026-06-13 14:56:50 `review.run`: passed — OK
- 2026-06-13 14:56:50 `review.run`: passed — OK
- 2026-06-13 15:01:18 `review.run`: passed — OK
- 2026-06-13 16:33:17 `verify`: failed — COMMAND_FAILED
- 2026-06-13 16:33:18 `verify`: failed — COMMAND_FAILED

## key decisions

- Do not change the cumulative window semantics: `past_month` should remain "last 30 days", not a separate week-excluding bucket.
- Fix the confusing output by exposing the trace DB horizon and an explicit note when `past_week` equals `past_month` because retention is shorter than a month.

## notes for ko

- The matching values are caused by trace retention/horizon, not by the SQL window condition being wrong.

## improvements noticed

- `stream.context` failed during initial discovery because fetching `origin/stream/os` reported an incorrect old value. This is unrelated to the trace analytics output.

## issues and recovery

- Initial `task.start` used an invalid `startFrom` value. Retried with `startFrom: stream`, which succeeded.

---

## publish checklist

```bash
bun run task:push -- --message "fix(workspace): explain trace analytics window horizon" --changed
bun run task:pr
bun run task:finish
```

- 2026-06-13 14:53:31 write: `.task/workspace-agents/fix-trace-analytics-month-window/workpad.md`

## workspace-owned: files changed

- `packages/workspace/SCRIPTS.md`
- `scripts/operator/trace-analytics.ts`

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/fix-trace-analytics-month-window.json`, `.task/workspace-agents/fix-trace-analytics-month-window/current.json`, `.task/workspace-agents/fix-trace-analytics-month-window/evidence-log.json`, `.task/workspace-agents/fix-trace-analytics-month-window/read-log.json`, `.task/workspace-agents/fix-trace-analytics-month-window/session.json`, `.task/workspace-agents/fix-trace-analytics-month-window/workpad.md`, `packages/workspace/SCRIPTS.md`, `scripts/operator/trace-analytics.ts`
- matched rules: `workspace-audit-docs`
- selected suites: `workspace audit tests`
- run results: `workspace audit tests` passed
- failed suites: none

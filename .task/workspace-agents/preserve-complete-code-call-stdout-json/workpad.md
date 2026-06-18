# preserve complete code.call stdout JSON

branch: `task/workspace-agents/preserve-complete-code-call-stdout-json`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1131/preserve-complete-code-call-stdout-json
github pr: https://github.com/consuelohq/opensaas/pull/1131
started: 2026-06-18

taskSession: `tsk_9b6bec5a6e32`

## acceptance criteria

- [ ] `trace:watch` preserves parseable code.call child command results when stdout JSON exceeds the displayed stdout preview size.
- [ ] Oversized code.call stdout packets still render nested `code.call step` rows.
- [ ] The visible row summary reports structured JSON shape rather than text when a compact parseable results packet exists.
- [ ] Runtime smoke uses `code.call` to produce a 50KB+ stdout JSON packet and verifies `trace:watch` renders nested rows.
- [ ] Focused tests, review, verify, push, promote, and cleanup complete.

## Test-first contract

Behavior under test:
- `trace:watch` must derive child code.call step rows from a compact parseable results packet even when `code_call_stdout` is sliced and cannot be parsed as JSON.
- `trace:watch` should avoid carrying full child stdout/stderr in the nested row packet; it only needs command, status, duration, message/detail, changed marker, and output sizes.
- `summarizeCodeCallForTraceWatch` should treat rows with compact parsed results as structured JSON output for intent/quality purposes.

Existing local pattern:
- `scripts/operator/trace-watch.ts` already extracts SQL-derived code.call columns from `result_json` and renders code.call nested rows from `results[]` stdout packets.
- `packages/workspace/tests/trace-watch.test.ts` already covers compacted `result_json` fallback for parseable `code_call_stdout`.

New/changed tests:
- Extend `packages/workspace/tests/trace-watch.test.ts` with an oversized/sliced stdout regression using a compact `code_call_results_json` column.
- Assert summary stdout shape remains `json` and nested operations preserve all child commands.

Focused red command:
- `bun --cwd packages/workspace test tests/trace-watch.test.ts`

Expected red failure:
- Current implementation only parses `data.stdout` / `code_call_stdout`; when that string is sliced before JSON close, `codeCallResults` returns no children and stdoutShape becomes `text`.

No-test waiver:
- None. This is operator-visible telemetry behavior.

## exploration notes

- Stream context shows PR #1129 added the first trace-watch code.call summary and SQL-derived fields.
- Live code.call smoke `trc_26b0e6137215` produced a 50KB+ JSON stdout packet.
- Live trace-watch smoke `trc_3579f382a0c9` showed the oversized row as a flat `code.call` row with no nested `code.call step` rows, reproducing the failure.
- SQLite can parse the full stdout string out of full `result_json` before `substr` is applied; `trc_3d918251c84d` confirmed `json_extract(json_extract(result_json, '$.data.stdout'), '$.results')` works on oversized stdout JSON.

- 2026-06-18 05:37:06 write: `.task/workspace-agents/preserve-complete-code-call-stdout-json/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-18 05:37:06 fs.write: `.task/workspace-agents/preserve-complete-code-call-stdout-json/workpad.md`
- 2026-06-18 05:37:24 apply-patch: `packages/workspace/tests/trace-watch.test.ts`
- 2026-06-18 05:37:52 apply-patch: `scripts/operator/trace-watch.ts`
- 2026-06-18 05:40:18 fs.write: `.task/workspace-agents/preserve-complete-code-call-stdout-json/workpad.md`

## workspace-owned: validation evidence

- 2026-06-18 05:39:43 `review.run`: passed — OK
- 2026-06-18 05:40:00 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/preserve-complete-code-call-stdout-json.json`, `.task/workspace-agents/preserve-complete-code-call-stdout-json/current.json`, `.task/workspace-agents/preserve-complete-code-call-stdout-json/evidence-log.json`, `.task/workspace-agents/preserve-complete-code-call-stdout-json/read-log.json`, `.task/workspace-agents/preserve-complete-code-call-stdout-json/session.json`, `.task/workspace-agents/preserve-complete-code-call-stdout-json/workpad.md`, `packages/workspace/tests/trace-watch.test.ts`, `scripts/operator/trace-watch.ts`
- matched rules: `trace-watch`
- selected suites: `trace watch build`
- run results: `trace watch build` passed
- failed suites: none

## implementation notes

- Updated `scripts/operator/trace-watch.ts` to derive `code_call_results_json` in SQL before the displayed stdout preview is sliced.
- The compact packet keeps command/status/duration/message/detail/changed plus stdout/stderr character counts, preserving nested step rendering without carrying full child output.
- `codeCallResults` now prefers the compact SQL packet and falls back to parsing stdout for older rows.
- `summarizeCodeCallForTraceWatch` treats rows with compact parsed results as structured JSON for stdout shape, intent, and quality classification.

## files changed

- `scripts/operator/trace-watch.ts`
- `packages/workspace/tests/trace-watch.test.ts`

## validation evidence

- Focused red failed as expected before implementation: `bun --cwd packages/workspace test tests/trace-watch.test.ts`, trace `trc_a4961e386d42`; failure was `stdoutShape` reported as `text` for sliced stdout JSON.
- Focused green passed after implementation: `bun --cwd packages/workspace test tests/trace-watch.test.ts`, trace `trc_cf2a760c6f91`; 6 tests passed.
- Live runtime smoke passed after implementation: `bun run trace:watch --tool code.call --limit 10 --once --no-color`, trace `trc_f5c82ed1f941`; checks confirmed the oversized row rendered nested `code.call step` rows through `fake epsilon`.
- Diff inspected with `git.diff`, trace `trc_70e80aa0efb0`.
- `review.run` passed against `origin/stream/workspace-agents` with 0 issues, trace `trc_852515071312`.
- `verify` passed against `origin/stream/workspace-agents` with `publishValid: true`, trace `trc_d66a35f901a7`; selected `trace watch build` passed.

## acceptance criteria final

- [x] `trace:watch` preserves parseable code.call child command results when stdout JSON exceeds the displayed stdout preview size.
- [x] Oversized code.call stdout packets still render nested `code.call step` rows.
- [x] The visible row summary reports structured JSON shape rather than text when a compact parseable results packet exists.
- [x] Runtime smoke uses `code.call` to produce a 50KB+ stdout JSON packet and verifies `trace:watch` renders nested rows.
- [x] Focused tests, review, and verify complete.
- [ ] Push, promote, and cleanup complete.

- 2026-06-18 05:40:18 append: `.task/workspace-agents/preserve-complete-code-call-stdout-json/workpad.md`

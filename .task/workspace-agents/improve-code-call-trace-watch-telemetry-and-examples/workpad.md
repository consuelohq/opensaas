# improve code.call trace-watch telemetry and examples

branch: `task/workspace-agents/improve-code-call-trace-watch-telemetry-and-examples`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1129/improve-code-call-trace-watch-telemetry-and-examples
github pr: https://github.com/consuelohq/opensaas/pull/1129
started: 2026-06-18

taskSession: `tsk_4e30f8674251`

## acceptance criteria

- [x] code.call trace-watch/trace-home rows display a useful derived summary: language, mode, intent, quality, changed count, truncation, and compact message.
- [x] code.call trace-watch/trace-home rows show child command rows when stdout contains a structured JSON results[] packet.
- [x] code.call trace-watch/trace-home flags language `bash` that only invokes Bun/Python/Node as suspect and suggests using the native runtime.
- [x] code.call trace-watch/trace-home keeps code.call output flexible and avoids a rigid fs-style output union.
- [x] OS and workspace source manifests include strong code.call examples.
- [x] OS and workspace examples show read, write/edit, verify/test orchestration, codegen, exact manifest verification, and Python transformation.
- [x] No code.call example uses Bash just to call Bun.
- [x] Regenerated full/core manifests, docs, and generated type stubs are consistent.
- [x] Tests cover trace-watch derivation and manifest example quality.
- [x] Review and verify pass.
- [ ] Task PR is pushed/promoted/finished.

## alignment notes

- Keep the existing locked code.call description unchanged.
- Put structured interpretation in `trace:watch` first. Ko uses the terminal watcher in `scripts/operator/trace-watch.ts`; trace-home is supporting context only.
- Do not change `code.run` in this task.
- Do not use Bash examples that only invoke Bun.
- Use `code.call` as the evidence runner for tests, generation, and exact verification.

## Test-first contract

Behavior under test:
- `trace:watch` derives a code.call summary from the trace row input/result without changing the runtime output contract.
- `trace:watch` extracts child rows from JSON stdout packets containing `results[]` with command/ok/exitCode fields.
- `trace:watch` classifies high-signal Bun verification packets as good focused-test or multi-command-verification.
- `trace:watch` classifies Bash transport that only invokes Bun/Python/Node as suspect and suggests the matching native runtime.
- `trace:watch` renders the code.call summary in the visible row/detail output Ko actually uses.
- Workspace and OS code.call manifests expose strong example sets, preserve aligned labels, cover read/edit/verify/codegen/Python transformation, and avoid Bash-as-transport examples.

Existing local pattern:
- `packages/workspace/tests/trace-home.test.ts` already builds fixture `TraceHomeRow` objects and asserts model children, renderer sections, raw shell quality, and inspect tabs.
- `packages/workspace/scripts/trace-home/model.ts` already derives children for `code.run` and `batch` from trace row JSON.
- `packages/workspace/scripts/trace-home/command-quality.ts` already holds command-quality heuristics for legacy shell tools.
- `packages/workspace/tests/tool-manifest.test.ts` and `packages/os/tests/tool-manifest.test.ts` already assert code.call description/example propagation.

New/changed tests:
- Add `packages/workspace/tests/trace-watch.test.ts` with code.call fixture rows for structured stdout results, Bun verification, Bash transport, file changes, truncation, and visible row rendering.
- Extend `packages/workspace/tests/tool-manifest.test.ts` and `packages/os/tests/tool-manifest.test.ts` to assert code.call examples are strong, aligned, mode-diverse, and free of Bash transport.
- Extend workspace/OS code-call parity tests only if source manifest example parity needs a dedicated source-level check beyond tool-manifest tests.

Focused red command:
- `bun --cwd packages/workspace test tests/trace-home.test.ts tests/tool-manifest.test.ts`
- `bun --cwd packages/os test tests/tool-manifest.test.ts`

Expected red failure:
- Trace-home has no code.call child extraction or derived code.call quality summary yet.
- Current code.call examples only expose a compact read `exampleInput` in workspace and stale weak examples in OS/source surfaces.
- Manifest tests do not yet enforce the strong example set.

No-test waiver:
- None. This changes operator-visible telemetry/model behavior and public tool examples.

## exploration notes

- Stream context shows recent code.call service split and intent wiring tasks are already merged into `stream/workspace-agents`; this task starts from that stream.
- `scripts/operator/trace-watch.ts` is the visible terminal watcher Ko uses. Extension points: `compactSuccessDetail`, `nestedOperationsForRow`, `renderNestedOperation`, `renderRow`.
- `packages/workspace/scripts/trace-home/types.ts` currently has one optional `commandQuality` field and raw shell aggregation limited to `task.call`/`task.exec`.
- Source manifests to edit: `packages/workspace/tooling/tool-manifest.json`, `packages/os/tooling/dev-tool-manifest.json`.

## validation evidence

- Focused red passed as expected after test additions. Trace: `trc_b02c985f5ea2`. Failures showed missing trace-watch exports/summary/children and missing strong manifest example sets.
- Focused green passed for workspace trace-watch + workspace manifest tests and OS manifest tests. Trace: `trc_647e63014fdf`.
- Exact generated manifest verification passed for workspace and OS source/full/core surfaces; strong labels and signals present, weak examples absent. Trace: `trc_cb2af9e7f2b2`.
- Runtime smoke of actual `bun run trace:watch` against a SQLite fixture passed and rendered `bun/verify · focused-test · good · changed 0` plus a `code.call step` child. Trace: `trc_a1fa64eb0d13`.
- Added a regression for compacted `result_json` and SQL-derived code.call fields. Red trace: `trc_7f5fb878578e`; green trace: `trc_8733c59101be`.
- Runtime smoke with a 9364-character code.call result payload passed through the live SQL fallback path. Trace: `trc_6d778441b37b`.
- Final focused packet passed: workspace trace-watch + manifest tests, OS manifest tests. Trace: `trc_a0e8e4c217a0`.


## Ko correction

Ko clarified with a screenshot that the target is `bun run trace:watch`, not the richer `trace:home` dashboard. The task now updates `scripts/operator/trace-watch.ts` directly and only touches trace-home if shared supporting logic becomes necessary.

## implementation notes

- Updated `scripts/operator/trace-watch.ts`, the terminal watcher Ko uses via `bun run trace:watch`.
- Added derived code.call summary fields from trace row input/result: language, mode, source kind, stdout/stderr shape, changed count, truncation, intent, quality, reason, and replacement.
- Added `code.call step` child extraction from JSON stdout packets with `results[]`.
- Added SQL-derived `code_call_*` columns so trace-watch still works when the displayed `result_json` column is compacted.
- Kept code.call runtime output flexible; the interpretation lives in trace-watch.
- Replaced weak OS examples and added aligned workspace examples in source manifests, then regenerated full/core/workflow manifests.
- Docs/type generators currently do not emit `examples[]`; regenerated outputs are consistent with current generator behavior and examples are present in source/full/core manifest surfaces.

## files changed

- `scripts/operator/trace-watch.ts`
- `packages/workspace/tests/trace-watch.test.ts`
- `packages/workspace/tests/tool-manifest.test.ts`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/workspace/tooling/tool-manifest.json`
- `packages/os/tooling/dev-tool-manifest.json`
- generated workspace/os manifest surfaces

## workspace-owned: validation evidence

- Focused red passed as expected after test additions. Trace: `trc_b02c985f5ea2`. Failures showed missing trace-watch exports/summary/children and missing strong manifest example sets.
- Focused green passed for workspace trace-watch + workspace manifest tests and OS manifest tests. Trace: `trc_647e63014fdf`.
- Exact generated manifest verification passed for workspace and OS source/full/core surfaces; strong labels and signals present, weak examples absent. Trace: `trc_cb2af9e7f2b2`.
- Runtime smoke of actual `bun run trace:watch` against a SQLite fixture passed and rendered `bun/verify · focused-test · good · changed 0` plus a `code.call step` child. Trace: `trc_a1fa64eb0d13`.
- Added a regression for compacted `result_json` and SQL-derived code.call fields. Red trace: `trc_7f5fb878578e`; green trace: `trc_8733c59101be`.
- Runtime smoke with a 9364-character code.call result payload passed through the live SQL fallback path. Trace: `trc_6d778441b37b`.
- Final focused packet passed: workspace trace-watch + manifest tests, OS manifest tests. Trace: `trc_a0e8e4c217a0`.
- 2026-06-18 05:19:58 `review.run`: passed — OK
- 2026-06-18 05:20:11 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/improve-code-call-trace-watch-telemetry-and-examples.json`, `.task/workspace-agents/improve-code-call-trace-watch-telemetry-and-examples/current.json`, `.task/workspace-agents/improve-code-call-trace-watch-telemetry-and-examples/session.json`, `.task/workspace-agents/improve-code-call-trace-watch-telemetry-and-examples/workpad.md`, `packages/os/manifests/core.manifest.json`, `packages/os/manifests/tool.manifest.json`, `packages/os/manifests/workflow-bundles.json`, `packages/os/tests/tool-manifest.test.ts`, `packages/os/tooling/dev-tool-manifest.json`, `packages/workspace/manifests/core-manifest.json`, `packages/workspace/manifests/tool-manifest.json`, `packages/workspace/manifests/workflow-bundles.json`, `packages/workspace/tests/tool-manifest.test.ts`, `packages/workspace/tests/trace-watch.test.ts`, `packages/workspace/tooling/tool-manifest.json`, `scripts/operator/trace-watch.ts`
- matched rules: `workspace-facade`, `trace-watch`
- selected suites: `workspace facade input contracts`, `trace watch build`
- run results: `workspace facade input contracts` passed, `trace watch build` passed
- failed suites: none

## review and verify evidence

- `review.run` passed with 0 own issues, 0 pre-existing issues, and 0 failed test suites. Trace: `trc_0b30b9f734e8`.
- `verify` passed with `publishValid: true`. Trace: `trc_b7679e89b4ea`.
- Verify-selected suites passed:
  - workspace facade input contracts: 125 tests passed
  - trace watch build: bundled `scripts/operator/trace-watch.ts` successfully

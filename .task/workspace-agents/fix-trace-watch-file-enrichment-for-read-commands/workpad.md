# fix trace watch file enrichment for read commands

branch: `task/workspace-agents/fix-trace-watch-file-enrichment-for-read-commands`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1139/fix-trace-watch-file-enrichment-for-read-commands
github pr: https://github.com/consuelohq/opensaas/pull/1139
started: 2026-06-18

taskSession: `tsk_7f45f2b1ad1b`

## acceptance criteria

- [ ] `trace:watch` shows useful file/path context for non-`code.call` rows, especially `fs.read`, `fs.write`, `verify`, and `review.run`.
- [ ] Failed file-operation rows keep the target path visible instead of being swallowed by verbose stderr/content previews.
- [ ] `verify` rows summarize changed-file count, selected test-suite count, run result count, and publish-valid/pass status in the main row.
- [ ] Existing `code.call` enriched summaries and nested command rows remain intact.
- [ ] Focused trace-watch tests, runtime build, review, verify, push, and PR promotion complete.

## Test-first contract

Behavior under test:

- Successful `fs.read` and `fs.write` rows render the target path from `resolved_input_json` / `input_json`.
- Failed `fs.write` rows render the target path first and include the concise failure message, not the beginning of the attempted file content.
- `verify` rows render a compact verification packet: files changed, selected suites, run results, publish-valid/pass status.
- `review.run` rows render review file count and issue counts when the summary schema is present.
- Existing `code.call` summary tests continue to pass.

Existing local pattern:

- `scripts/operator/trace-watch.ts` owns terminal watcher row rendering.
- `compactSuccessDetail`, `compactErrorDetail`, and `summarizeResultForTrace` already extract tool-specific summaries.
- `packages/workspace/tests/trace-watch.test.ts` captures rendered rows and asserts visible text.

New/changed tests:

- Extend `packages/workspace/tests/trace-watch.test.ts` with `fs.write` failure path visibility, `fs.read`/`fs.write` success path visibility, and `verify` changed-file/test summary assertions.
- Keep the existing `code.call` tests unchanged as regression coverage.

Focused red command:

```bash
bun --cwd packages/workspace test tests/trace-watch.test.ts
```

Expected red failure:

- The current error detail path uses `stderr` before input path, so failed `fs.write` rows show attempted content/error text and can hide the target path.
- The current verify success path usually resolves to generic message text and `because` lines rather than a main-row file/test summary.

## exploration notes

- `context.search trace-watch` found the recent code.call trace-watch tasks and confirmed `scripts/operator/trace-watch.ts` is the owner.
- `explore` surfaced `scripts/operator/trace-watch.ts` and `packages/workspace/tests/trace-watch.test.ts` as the implementation/test pair.
- Raw `fs.write` trace rows contain the target path in `input` and `resolvedInput`, but failed rows also carry large content in stderr.
- Raw `verify` trace rows contain `data.files`, `data.testSelection.data.selectedSuites`, `data.testSelection.data.runResults`, and `data.publishValid`.

## implementation notes

- Pending.

## validation evidence

- Pending.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-18 07:44:22 fs.write: `.task/workspace-agents/fix-trace-watch-file-enrichment-for-read-commands/workpad.md`
- 2026-06-18 07:45:40 apply-patch: `packages/workspace/tests/trace-watch.test.ts`
- 2026-06-18 07:48:53 fs.write: `.task/workspace-agents/fix-trace-watch-file-enrichment-for-read-commands/workpad.md`
- 2026-06-18 07:52:03 fs.write: `.task/workspace-agents/fix-trace-watch-file-enrichment-for-read-commands/workpad.md`
- 2026-06-18 07:52:48 fs.write: `.task/workspace-agents/fix-trace-watch-file-enrichment-for-read-commands/workpad.md`

## workspace-owned: files read

- `scripts/operator/trace-watch.ts`

- 2026-06-18 07:46:38 apply-patch: `scripts/operator/trace-watch.ts`
- 2026-06-18 07:46:52 apply-patch: `scripts/operator/trace-watch.ts`
- 2026-06-18 07:47:10 apply-patch: `scripts/operator/trace-watch.ts`
- 2026-06-18 07:48:12 apply-patch: `packages/workspace/tests/trace-watch.test.ts`

## implementation update 2026-06-18

- Added file/summary detail extraction in `scripts/operator/trace-watch.ts` for generic typed tool rows.
- `fs.read` / `fs.write` rows now prefer target path and structured result type/path over generic `command completed` text.
- Failed rows now keep concise detail on the main row; file failures show the target path before the extracted error line.
- `verify` rows now summarize pass/publish-valid, changed-file count, selected suite count, run result count, and failures.
- `review.run` rows now summarize review status, file count, owned issue count, pre-existing issue count, and failed suite count.
- Existing `code.call` detail and nested `code.call cmd` rendering remain unchanged.

## validation evidence

- Red focused test failed as expected before implementation: `bun --cwd packages/workspace test tests/trace-watch.test.ts`, trace `trc_6dab5f12d886`; failures showed missing `fs.write` path, missing `fs.read` path/type, and generic `verify` detail.
- Green focused packet passed after implementation: `bun --cwd packages/workspace test tests/trace-watch.test.ts` and `bun build scripts/operator/trace-watch.ts --target=bun`, trace `trc_f9c31795ba1f`; 14 tests passed.
- Runtime smoke passed for live trace rows: `trace:watch --tool fs.read` showed `scripts/operator/trace-watch.ts`, and `trace:watch --tool code.call` still showed `bun/verify · multi-command-verification · good · changed 0` plus nested command rows, trace `trc_4014f4745465`.
- Diff inspected with `git.diff`, trace `trc_e74e37d9065b`.

## files changed

- `scripts/operator/trace-watch.ts`
- `packages/workspace/tests/trace-watch.test.ts`

- 2026-06-18 07:48:53 append: `.task/workspace-agents/fix-trace-watch-file-enrichment-for-read-commands/workpad.md`

## workspace-owned: validation evidence

- Pending.
- 2026-06-18 07:49:17 `review.run`: passed — OK
- 2026-06-18 07:49:28 `verify`: passed — OK
- 2026-06-18 07:52:15 `review.run`: passed — OK
- 2026-06-18 07:52:25 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/fix-trace-watch-file-enrichment-for-read-commands.json`, `.task/workspace-agents/fix-trace-watch-file-enrichment-for-read-commands/current.json`, `.task/workspace-agents/fix-trace-watch-file-enrichment-for-read-commands/evidence-log.json`, `.task/workspace-agents/fix-trace-watch-file-enrichment-for-read-commands/read-log.json`, `.task/workspace-agents/fix-trace-watch-file-enrichment-for-read-commands/session.json`, `.task/workspace-agents/fix-trace-watch-file-enrichment-for-read-commands/verify.json`, `.task/workspace-agents/fix-trace-watch-file-enrichment-for-read-commands/workpad.md`, `packages/workspace/tests/trace-watch.test.ts`, `scripts/operator/trace-watch.ts`
- matched rules: `trace-watch`
- selected suites: `trace watch build`
- run results: `trace watch build` passed
- failed suites: none

## validation update 2026-06-18

- Added SQL-derived `verify_*` and `review_*` summary columns so details survive compacted/sliced `result_json` in the live watcher.
- Expanded focused coverage to 16 trace-watch tests, including compacted verify/review rows; focused test/build packet passed, trace `trc_ed74cafe09fa`.
- Live verify smoke now renders `verify passed · publish-valid · files 2 · suites 1 · runs 1` from the compact watcher query, trace `trc_f707fc2b8aef`.
- Review passed with 0 own issues and 0 pre-existing issues, trace `trc_19a079e1b1d4`.
- Verify passed with `publishValid: true`; registry-selected `trace watch build` passed, trace `trc_6d71b1d4756d`.

- 2026-06-18 07:52:03 append: `.task/workspace-agents/fix-trace-watch-file-enrichment-for-read-commands/workpad.md`


## final validation update 2026-06-18

- Final review passed with 0 own issues and 0 pre-existing issues, trace `trc_d6afa5e1c1d4`.
- Final verify passed with `publishValid: true`; registry-selected `trace watch build` passed, trace `trc_eb946c3ee101`.

- 2026-06-18 07:52:48 append: `.task/workspace-agents/fix-trace-watch-file-enrichment-for-read-commands/workpad.md`

# isolate test traces and clarify session observability

branch: `task/os/isolate-test-traces-and-clarify-session-observability`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2253
started: 2026-08-28

## acceptance criteria

- [x] OS Vitest workers must not inherit `CONSUELO_TRACE_DB` or `TRACE_DB` from the installed/operator runtime by default; default trace persistence is redirected to a test-owned temporary DB.
- [x] Tests that intentionally exercise explicit trace DB precedence can still opt into explicit trace paths.
- [x] Re-running work-session negative tests must not add their expected failures to the canonical installed trace DB.
- [x] Trace session identity must not collapse a work-session-only row to `no-branch`, even when a legacy/history row carries a `no-branch` sentinel.
- [x] A trace containing both task and work authority must make that conflict visible instead of silently showing only one authority.
- [x] Work-session table cells should show a compact human-readable path label while retaining the full path in tooltip/details and retaining the full session identity for filtering/coloring.
- [x] Existing task-session labels, work-session affinity, containment, and security behavior remain unchanged.
- [x] Rebuilt OS-owned Trace Burn runtime matches its maintained TypeScript source.
- [x] Focused tests, strict review, and canonical verify pass before promotion to `stream/os`.
- [x] Historical polluted rows are left untouched; cleanup is explicitly out of scope for this code change.

## plan

1. Add a global OS Vitest test-environment setup that replaces inherited operator trace DB overrides with a test-owned temporary DB, with an explicit helper contract that permits deliberate per-test overrides afterward.
2. Add RED coverage for test trace isolation and session-label edge cases before production/runtime edits.
3. Fix session identity/display in the maintained Trace Burn model + renderer, and make history fallback preserve work-session identity.
4. Rebuild the generated Trace Burn browser runtime from OS-owned source.
5. Run focused work-session/trace suites and prove the canonical operator DB does not gain the expected-negative fixture rows.
6. Run strict review + full verify, promote this task into `stream/os`, then continue the approved live task/work-session acceptance sweep.

## Test-first contract

- behavior under test: OS tests must be hermetic with respect to the installed trace DB, and tracing must present task/work session context without misleading `no-branch` or giant temporary path labels.
- existing local pattern: `trace-persistence.test.ts` and trace persistence fixtures already delete `CONSUELO_TRACE_DB` / `TRACE_DB` when creating isolated homes; Trace Burn already stores full `workSession` + `workPath` and supports cell tooltips.
- new or changed tests:
  - a test-environment contract proving inherited trace DB variables are stripped while explicit post-isolation overrides remain possible;
  - work-session FS/code-call suites run under the global isolated test setup;
  - inspector tests for work-session-only rows with `no-branch` sentinel, mixed task+work authority, compact work-path display, and full-path tooltip source;
  - history-backend coverage that work-session-only rows preserve a usable session identity.
- focused RED command: run the new test-environment contract plus `observability-traces-site.test.ts`, `trace-site-inspector-interactions.test.ts`, `trace-site-inspector-os-owned.test.ts`, and the relevant trace backend test before production/runtime changes.
- expected RED failures: no global test setup exists; mixed authority is hidden by the current workPath/branch-first resolver; work paths render in full in the table; history rows can manufacture `no-branch` before the work-session fallback.
- no-test waiver: not applicable.

## discovery

- Screenshot failures using `tsk_conflict`, `wrk_1234567812344234`, path escapes, symlink escapes, and managed-repo rejection map directly to intentional negative assertions in `packages/os/tests/work-session-fs.test.ts` / work-session Code Call tests.
- Installed runtime exports `CONSUELO_TRACE_DB=/Users/kokayi/.consuelo/node/db/traces.db`. Test helpers commonly spread `process.env`, so temporary `CONSUELO_HOME` values do not override that explicit DB path.
- `logMode: "silent"` suppresses stderr emission but still persists a trace.
- Trace persistence intentionally gives `CONSUELO_TRACE_DB` / `TRACE_DB` precedence over `CONSUELO_HOME`; production precedence is correct and should not be changed to accommodate tests.
- Existing trace tests already demonstrate the right test-side pattern by deleting explicit DB variables.
- Trace Burn row rendering already attaches the full session string as a tooltip, so compact display can be added without losing operator detail.
- `monitor.errors` manifest/runtime drift is a separate issue and remains out of scope unless it blocks validation.

## current status

- Approved repair task started from `stream/os` as PR #2253 / task session `tsk_679e8c531f39`.
- Repair implementation and test-selection ownership are complete. Canonical verify is publish-valid and final strict review is clean. Ready to push/promote to `stream/os`.

## files changed

- `.task/os/isolate-test-traces-and-clarify-session-observability/workpad.md`
- `packages/os/vitest.config.ts`
- `packages/os/tests/test-environment.ts`
- `packages/os/tests/test-environment-contract.test.ts`
- `packages/os/tests/work-session-fs.test.ts`
- `packages/os/tests/work-session-code-call.test.ts`
- `packages/os/scripts/lib/trace-site-inspector/model.ts`
- `packages/os/scripts/lib/trace-site-inspector/virtual-list-browser.ts`
- `packages/os/scripts/lib/observability-traces-site.ts`
- `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- `packages/os/tests/trace-site-inspector-interactions.test.ts`
- `packages/os/tests/observability-traces-site.test.ts`
- `packages/os/tests/trace-history-redaction.test.ts`
- `packages/os/assets/vendor/observability-traces-v38/inspector.js`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/tests/test-selection.test.js`
- `packages/os/tests/test-environment-contract.test.ts`
- `packages/os/tests/test-environment.ts`

## key decisions

- Fix trace leakage at the Vitest environment boundary rather than weakening production trace DB precedence. Redirect the default test trace sink instead of only deleting the explicit DB variables, because some facade tests do not override `CONSUELO_HOME` and would otherwise fall back to the installed home DB.
- Keep full work paths as trace data/tooltip/filter identity, but render a compact table label.
- Do not delete or rewrite existing historical traces in this task.

## validation evidence

- RED: `trc_fbaa58e26e92` — focused Vitest packet failed exactly on the new contracts: missing global test environment helper/setup, `no-branch` hiding a work session, mixed task/work authority not surfaced, missing compact session display helper, and rich history manufacturing `no-branch`. 28 existing assertions passed and 5 intended new assertions failed.
- GREEN core: `trc_e2ef154ee54f` — test-environment, trace-history redaction, inspector interaction, and observability site contracts passed.
- Generated Trace Burn runtime rebuilt from OS-owned source: `trc_41283ac15fe7`.
- Work-session FS + Code Call authority packet passed all executed tests: `trc_1234f9bc398b`; the two tests that later hit the default 5s timeout under machine load passed with the suite's legal 15s budget in `trc_00dd5d81c63b`.
- Bun-native Trace Sites gateway/live SQLite contracts: 14/14 passed in `trc_3fc74700d3df`.
- Pollution proof: a direct Bun-native work-session FS run produced zero canonical operator-DB rows for the expected-negative fixture IDs during its exact run window (`trc_fb9f7fe40bf1`). Aggregate fixture totals are not used because other concurrent agents were running the same tests.
- `checkFiles`: all changed code/test/generated assets passed in `trc_101e603f83dd`.
- Test-selection RED: `trc_df54fd5a192c` proved the new runner-config surface initially fell through to the broad OS package suite. Added explicit critical/exclusive ownership, regenerated the registry in `trc_7e563b2a5171`, then GREEN passed in `trc_1b170cdf2ca5`; selection proof `trc_f67eb4bb18d3` confirms the broad OS package suite is no longer selected for these files.
- Canonical full verify: `trc_908f49a07e52` — passed, publish-valid.
- Final strict review: `trc_3fd2a2fbd155` — 0 task-owned, pre-existing, or blocking issues. One nonblocking public-doc opportunity was reported for trace documentation.

## issues and recovery

- First `session.start` attempt incorrectly included facade `timeout` in the tool input and was rejected as an unknown key. Retried with canonical session input and succeeded.
- During final validation, the central MCP gateway began returning `TASK_WORKSPACE_MISMATCH` for the valid task affinity even though the durable local registry still pointed at the correct task worktree/node. Recovery used the documented `task.start` compatibility alias with existing PR #2253; because the task session handle is branch-stable and the owner node matched, Device Authority refreshed the affinity's workspace ID without creating a branch/worktree/PR. `task.start` rewrites the starter workpad, so the detailed workpad was backed up to `/tmp/isolate-test-traces-workpad.md` before recovery and restored afterward. Canonical task routing immediately recovered and verify passed. This exposes a separate live session-affinity self-healing gap to cover in the approved acceptance pass.

- 2026-08-28 23:41:46 write: `.task/os/isolate-test-traces-and-clarify-session-observability/workpad.md`

## workspace-owned: files changed

- `.task/os/isolate-test-traces-and-clarify-session-observability/workpad.md`
- `packages/os/tests/test-environment-contract.test.ts`
- `packages/os/tests/test-environment.ts`

## workspace-owned: activity log

- 2026-08-28 23:41:46 fs.write: `.task/os/isolate-test-traces-and-clarify-session-observability/workpad.md`
- 2026-08-28 23:42:15 fs.write: `packages/os/tests/test-environment-contract.test.ts`
- 2026-08-28 23:45:12 fs.write: `packages/os/tests/test-environment.ts`
- 2026-08-29 00:03:24 fs.write: `.task/os/isolate-test-traces-and-clarify-session-observability/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/observability-traces-site.ts`
- `packages/os/scripts/lib/trace-site-inspector/model.ts`
- `packages/os/scripts/lib/trace-sites-local-read-backend.ts`
- `packages/os/tests/test-environment.ts`
- `packages/os/tests/trace-history-redaction.test.ts`
- `packages/os/tests/work-session-code-call.test.ts`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

## workspace-owned: validation evidence

- RED: `trc_fbaa58e26e92` — focused Vitest packet failed exactly on the new contracts: missing global test environment helper/setup, `no-branch` hiding a work session, mixed task/work authority not surfaced, missing compact session display helper, and rich history manufacturing `no-branch`. 28 existing assertions passed and 5 intended new assertions failed.
- 2026-08-28 23:51:08 `checkFiles`: passed — OK
- 2026-08-28 23:52:06 `review.run`: passed — OK
- 2026-08-28 23:54:35 `verify`: failed — COMMAND_FAILED
- 2026-08-28 23:56:25 `verify`: failed — COMMAND_FAILED
- 2026-08-28 23:57:01 apply-patch: `packages/workspace/tests/test-selection.test.js`
- 2026-08-28 23:57:21 apply-patch: `packages/os/tests/test-environment-contract.test.ts`
- 2026-08-28 23:57:22 apply-patch: `packages/workspace/test-selection.rules.json`
- 2026-08-29 00:01:00 `verify`: failed — COMMAND_FAILED
- 2026-08-29 00:03:24 write: `.task/os/isolate-test-traces-and-clarify-session-observability/workpad.md`
- 2026-08-29 00:05:22 `verify`: passed — OK
- 2026-08-29 00:05:36 `review.run`: passed — OK

- 2026-08-29 00:05:49 apply-patch: `.task/os/isolate-test-traces-and-clarify-session-observability/workpad.md`
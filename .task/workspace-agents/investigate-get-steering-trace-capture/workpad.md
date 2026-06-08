# investigate get steering trace capture

branch: `task/workspace-agents/investigate-get-steering-trace-capture`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/829/investigate-get-steering-trace-capture
github pr: https://github.com/consuelohq/opensaas/pull/829
started: 2026-06-07

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/os/scripts/os.ts`
- `packages/os/server.py`
- `packages/os/tests/os_server_steering_test.py`
- `packages/os/tests/os-get-steering-trace.test.ts`
- `packages/workspace/server.py`
- `packages/workspace/tests/server_call_test.py`

## workspace-owned: files changed

- `packages/os/scripts/os.ts`
- `packages/os/server.py`
- `packages/os/tests/os_server_steering_test.py`
- `packages/os/tests/os-get-steering-trace.test.ts`
- `packages/workspace/server.py`
- `packages/workspace/tests/server_call_test.py`

## workspace-owned: activity log

- 2026-06-07 16:46:02 fs.write: `.task/workspace-agents/investigate-get-steering-trace-capture/workpad.md`
- 2026-06-07 16:48:42 fs.write: `packages/os/tests/os_server_steering_test.py`
- 2026-06-07 16:49:05 fs.write: `packages/os/tests/os-get-steering-trace.test.ts`
- 2026-06-07 16:50:11 fs.patch: `packages/workspace/tests/server_call_test.py`
- 2026-06-07 16:51:24 fs.patch: `packages/workspace/tests/server_call_test.py`
- 2026-06-07 16:52:26 fs.patch: `packages/workspace/server.py`
- 2026-06-07 16:52:42 fs.patch: `packages/workspace/server.py`
- 2026-06-07 16:53:09 fs.patch: `packages/os/server.py`
- 2026-06-07 16:54:04 fs.patch: `packages/os/server.py`
- 2026-06-07 16:54:13 fs.patch: `packages/os/server.py`
- 2026-06-07 16:54:45 fs.patch: `packages/os/server.py`
- 2026-06-07 16:56:22 fs.write: `packages/os/server.py`
- 2026-06-07 16:59:01 fs.patch: `packages/os/scripts/os.ts`
- 2026-06-07 16:59:50 fs.patch: `packages/os/scripts/os.ts`
- 2026-06-07 17:00:25 fs.patch: `packages/os/scripts/os.ts`
- 2026-06-07 17:00:35 fs.write: `packages/os/tests/os-get-steering-trace.test.ts`
- 2026-06-07 17:02:40 fs.patch: `packages/workspace/server.py`
- 2026-06-07 17:03:04 fs.patch: `packages/workspace/server.py`
- 2026-06-07 17:04:53 fs.patch: `packages/workspace/tests/server_call_test.py`
- 2026-06-07 17:05:10 fs.patch: `packages/workspace/tests/server_call_test.py`
- 2026-06-07 17:05:28 fs.patch: `packages/workspace/tests/server_call_test.py`
- 2026-06-07 17:06:04 fs.patch: `packages/workspace/tests/server_call_test.py`
- 2026-06-07 17:07:41 fs.patch: `packages/workspace/tests/server_call_test.py`
- 2026-06-07 17:08:15 fs.write: `.task/workspace-agents/investigate-get-steering-trace-capture/workpad.md`
- 2026-06-07 18:24:53 fs.write: `.task/workspace-agents/investigate-get-steering-trace-capture/workpad.md`

## workspace-owned: validation evidence

- 2026-06-07 17:08:55 `review.run`: passed — OK
- 2026-06-07 17:09:21 `verify`: passed — OK
- 2026-06-07 18:25:06 `review.run`: passed — OK
- 2026-06-07 18:25:21 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `CODING-STANDARDS.md`
- `packages/os/SCRIPTS.md`
- `packages/os/package.json`
- `packages/os/scripts/lib/runtime-state.ts`
- `packages/os/scripts/lib/types.ts`
- `packages/os/scripts/os.ts`
- `packages/os/server.py`
- `packages/os/tests/os-get-steering-trace.test.ts`
- `packages/os/tests/os-raw-steering.test.ts`
- `packages/os/tests/server_call_test.py`
- `packages/workspace/server.py`
- `packages/workspace/tests/server_call_test.py`
- `scripts/operator/trace-analytics.ts`
- `scripts/operator/trace-watch.ts`

## Test-first contract

Behavior under test:
- Workspace steering bootstrap returns full text and writes a compact local trace row.
- OS steering bootstrap returns full text and records a compact OS execution row.
- Trace payloads record estimated token columns without storing full steering text.

Existing pattern to follow:
- Workspace facade calls already write local trace rows in `packages/workspace/server.py`.
- OS calls already record execution rows through `packages/os/scripts/lib/runtime-state.ts`.

Intended tests:
- Extend workspace Python server tests for steering trace coverage.
- Extend OS Python server tests for steering execution coverage.
- Add OS Bun runtime coverage for steering execution recording.

Focused red command:
- Run the workspace and OS server tests plus the new OS Bun test before implementation.

Expected red failure:
- No steering bootstrap row exists before implementation.

Docs:
- No user-facing command changes expected; docs update only if validation shows an owning doc needs the diagnostic side effect documented.

- 2026-06-07 16:46:02 append: `.task/workspace-agents/investigate-get-steering-trace-capture/workpad.md`

- 2026-06-07 16:48:42 write: `packages/os/tests/os_server_steering_test.py`

- 2026-06-07 16:49:05 write: `packages/os/tests/os-get-steering-trace.test.ts`

- 2026-06-07 16:50:11 patch lines 783-784: `packages/workspace/tests/server_call_test.py`

- 2026-06-07 16:51:24 patch lines 782-782: `packages/workspace/tests/server_call_test.py`

- 2026-06-07 16:52:26 patch lines 462-518: `packages/workspace/server.py`

- 2026-06-07 16:52:42 patch lines 317-320: `packages/workspace/server.py`

- 2026-06-07 16:53:09 patch lines 21-21: `packages/os/server.py`

- 2026-06-07 16:54:04 patch lines 9-9: `packages/os/server.py`

- 2026-06-07 16:54:13 patch lines 21-21: `packages/os/server.py`

- 2026-06-07 16:54:45 patch lines 93-126: `packages/os/server.py`

- 2026-06-07 16:56:22 write: `packages/os/server.py`

- 2026-06-07 16:59:01 patch lines 247-247: `packages/os/scripts/os.ts`

- 2026-06-07 16:59:50 patch lines 288-288: `packages/os/scripts/os.ts`

- 2026-06-07 17:00:25 patch lines 556-556: `packages/os/scripts/os.ts`

- 2026-06-07 17:00:35 write: `packages/os/tests/os-get-steering-trace.test.ts`

- 2026-06-07 17:02:40 patch lines 317-317: `packages/workspace/server.py`

- 2026-06-07 17:03:04 patch lines 316-317: `packages/workspace/server.py`

- 2026-06-07 17:04:53 patch lines 230-230: `packages/workspace/tests/server_call_test.py`

- 2026-06-07 17:05:10 patch lines 810-816: `packages/workspace/tests/server_call_test.py`

- 2026-06-07 17:05:28 patch lines 808-840: `packages/workspace/tests/server_call_test.py`

- 2026-06-07 17:06:04 patch lines 230-274: `packages/workspace/tests/server_call_test.py`

- 2026-06-07 17:07:41 patch lines 228-277: `packages/workspace/tests/server_call_test.py`

## Implementation notes

- Workspace `get_steering()` now keeps returning the full steering string while also writing a compact `tool_traces` row named `get_steering`.
- Workspace trace output stores character/token metadata for steering, not the full steering body.
- OS Python `get_steering()` now records a compact `skill_executions` row and execution event while preserving the string return contract.
- OS Bun `get-steering` now routes through `executeGetSteering()`, recording the same compact runtime execution row used by the migration path.

## Validation evidence

- Red: `python3 packages/workspace/tests/server_call_test.py` failed before implementation because no `tool_traces` table/row was written for steering bootstrap, trace `trc_30bdc42942ef`.
- Red: `python3 packages/os/tests/os_server_steering_test.py` failed before implementation because OS Python `get_steering()` ignored the traced steering builder, trace `trc_9cc4d213b5bd`.
- Red/adjusted: `bun --cwd packages/os test tests/os-get-steering-trace.test.ts` used Vitest and could not resolve `bun:sqlite`; switched focused validation to Bun's built-in test runner for Bun runtime coverage, trace `trc_1d309a5a31b6`.
- Green: `python3 -m py_compile packages/workspace/server.py packages/os/server.py`, trace `trc_cd05bd668128`.
- Green: `python3 packages/workspace/tests/server_call_test.py`, 36 tests, trace `trc_2c82f627b43c`.
- Green: `python3 packages/os/tests/os_server_steering_test.py`, 1 test, trace `trc_4b7867336d70`.
- Green: `bun test packages/os/tests/os-get-steering-trace.test.ts`, 1 test, 9 expects, trace `trc_83e5bc681a1e`.
- Green: `node packages/os/scripts/check-syntax.js`, trace `trc_014352b2a88f`.

- 2026-06-07 17:08:15 append: `.task/workspace-agents/investigate-get-steering-trace-capture/workpad.md`

## workspace-owned: test selection

- changed files: `.task/design/add-page-versions-to-design-wiki-publish-archive/current.json`, `.task/design/add-page-versions-to-design-wiki-publish-archive/evidence-log.json`, `.task/design/add-page-versions-to-design-wiki-publish-archive/read-log.json`, `.task/design/add-page-versions-to-design-wiki-publish-archive/session.json`, `.task/design/add-page-versions-to-design-wiki-publish-archive/verify.json`, `.task/design/add-page-versions-to-design-wiki-publish-archive/workpad.md`, `.task/design/add-wiki-revision-guard/current.json`, `.task/design/add-wiki-revision-guard/evidence-log.json`, `.task/design/add-wiki-revision-guard/read-log.json`, `.task/design/add-wiki-revision-guard/session.json`, `.task/design/add-wiki-revision-guard/verify.json`, `.task/design/add-wiki-revision-guard/workpad.md`, `.task/design/build-hardcoded-typed-reader-shell-renderer/current.json`, `.task/design/build-hardcoded-typed-reader-shell-renderer/evidence-log.json`, `.task/design/build-hardcoded-typed-reader-shell-renderer/final-validation.md`, `.task/design/build-hardcoded-typed-reader-shell-renderer/read-log.json`, `.task/design/build-hardcoded-typed-reader-shell-renderer/reader-smoke.json`, `.task/design/build-hardcoded-typed-reader-shell-renderer/reader-smoke/index.html`, `.task/design/build-hardcoded-typed-reader-shell-renderer/session.json`, `.task/design/build-hardcoded-typed-reader-shell-renderer/verify.json`, `.task/design/build-hardcoded-typed-reader-shell-renderer/workpad.md`, `.task/design/recover-old-os-spec-and-document-shell-degradation/current.json`, `.task/design/recover-old-os-spec-and-document-shell-degradation/evidence-log.json`, `.task/design/recover-old-os-spec-and-document-shell-degradation/read-log.json`, `.task/design/recover-old-os-spec-and-document-shell-degradation/session.json`, `.task/design/recover-old-os-spec-and-document-shell-degradation/verify.json`, `.task/design/recover-old-os-spec-and-document-shell-degradation/workpad.md`, `.task/design/restore-rich-reader-typed-components/current.json`, `.task/design/restore-rich-reader-typed-components/direct-components-smoke.json`, `.task/design/restore-rich-reader-typed-components/direct-components-smoke/index.html`, `.task/design/restore-rich-reader-typed-components/evidence-log.json`, `.task/design/restore-rich-reader-typed-components/read-log.json`, `.task/design/restore-rich-reader-typed-components/session.json`, `.task/design/restore-rich-reader-typed-components/verify.json`, `.task/design/restore-rich-reader-typed-components/workpad.md`, `.task/tasks/design/add-page-versions-to-design-wiki-publish-archive.json`, `.task/tasks/design/add-wiki-revision-guard.json`, `.task/tasks/design/build-hardcoded-typed-reader-shell-renderer.json`, `.task/tasks/design/recover-old-os-spec-and-document-shell-degradation.json`, `.task/tasks/design/restore-rich-reader-typed-components.json`, `.task/tasks/workspace-agents/investigate-get-steering-trace-capture.json`, `.task/workspace-agents/investigate-get-steering-trace-capture/current.json`, `.task/workspace-agents/investigate-get-steering-trace-capture/evidence-log.json`, `.task/workspace-agents/investigate-get-steering-trace-capture/read-log.json`, `.task/workspace-agents/investigate-get-steering-trace-capture/session.json`, `.task/workspace-agents/investigate-get-steering-trace-capture/verify.json`, `.task/workspace-agents/investigate-get-steering-trace-capture/workpad.md`, `areas/consuelo-design/AGENTS.md`, `packages/consuelo-design/scripts/render-consuelo-reader.test.ts`, `packages/consuelo-design/scripts/render-consuelo-reader.ts`, `packages/consuelo-design/templates/digital-eguides/guide.md`, `packages/consuelo-design/templates/digital-eguides/plan.md`, `packages/consuelo-design/templates/digital-eguides/reader-shell.md`, `packages/consuelo-design/templates/digital-eguides/spec.md`, `packages/os/scripts/os.ts`, `packages/os/server.py`, `packages/os/tests/os-get-steering-trace.test.ts`, `packages/os/tests/os_server_steering_test.py`, `packages/workspace/scripts/consuelo-design.ts`, `packages/workspace/server.py`, `packages/workspace/tests/consuelo-design-theme.test.js`, `packages/workspace/tests/server_call_test.py`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## Full steering trace follow-up

User clarified that the compact metadata is useful for UI, but the trace also needs the full steering body for codebase-learning and longitudinal output-quality analysis.

Adjustment:
- Kept `chars` and `estimatedOutputTokens` metadata.
- Added full returned steering text under `data.content` for workspace traces.
- Added full returned steering text under `result.content` for OS Python and OS Bun execution traces.
- Updated regression tests to assert the full steering text is persisted in the trace/execution output.

Validation after adjustment:
- `python3 -m py_compile packages/workspace/server.py packages/os/server.py`, trace `trc_9ee36b53d902`.
- `python3 packages/workspace/tests/server_call_test.py`, trace `trc_9fb4e54b0372`.
- `python3 packages/os/tests/os_server_steering_test.py`, trace `trc_ae3f2de1e935`.
- `bun test packages/os/tests/os-get-steering-trace.test.ts`, trace `trc_ece602e7dd93`.
- `node packages/os/scripts/check-syntax.js`, trace `trc_e486a98fe7a1`.

- 2026-06-07 18:24:53 append: `.task/workspace-agents/investigate-get-steering-trace-capture/workpad.md`

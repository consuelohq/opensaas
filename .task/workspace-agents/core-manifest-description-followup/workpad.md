# core manifest description followup

branch: `task/workspace-agents/core-manifest-description-followup`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1120/core-manifest-description-followup
github pr: https://github.com/consuelohq/opensaas/pull/1120
started: 2026-06-18

taskSession: `tsk_eb548ca66aca`

## acceptance criteria

- [ ] Update `explore` description in workspace and OS source/full/core manifests to Ko's requested text.
- [ ] Update `fs.trash` description in workspace and OS source/full/core manifests to Ko's requested text.
- [ ] Update `intent` description in workspace and OS source/full/core manifests by replacing `It included` with `It dispatches`.
- [ ] Add `tmp` back to workspace and OS core manifests.
- [ ] Keep all other prior core removals intact.
- [ ] Preserve all tools in full manifests.
- [ ] Regenerate manifests/docs/types from source.
- [ ] Run focused red/green tests, exact generated verification, review, verify, push, promote, cleanup.

## requested descriptions

- `explore`: `a repo-aware decision search tool for coding agents. It answers where to spend attention and what files or paths are likely relevant to a given request.`
- `fs.trash`: `An agent safe file deletion path. Prefered over rm rf`
- `intent`: `Start a task workflow for scoped write access. It dispatches progressively disclosed tools, workflow hooks, validation steps, and rules that preserve user safety and alignment.`

## final expected core delta

Starting from the previous 17-tool core list, add `tmp` back. Final core count should be 18 in both packages.

## Test-first contract

Behavior under test:
- `explore`, `fs.trash`, and `intent` descriptions match Ko's requested text in generated full and core manifests for workspace and OS.
- `tmp` is present in generated core manifests for workspace and OS.
- All other removed core tools remain excluded.

Existing local pattern:
- `packages/workspace/tests/tool-manifest.test.ts` and `packages/os/tests/tool-manifest.test.ts` already assert core inclusion/exclusion and intent description propagation.
- Core surface is controlled by `packages/*/manifests/manifest.config.json`; source descriptions are controlled by `packages/workspace/tooling/tool-manifest.json` and `packages/os/tooling/dev-tool-manifest.json`.

New/changed tests:
- Replace intent-only description test with a core-description map for `explore`, `fs.trash`, and `intent`.
- Move `tmp` from removed core tool names to retained core tool names.

Focused red command:
- `bun --cwd packages/workspace test tests/tool-manifest.test.ts`
- `bun --cwd packages/os test tests/tool-manifest.test.ts`

Expected red failure:
- Current source manifests still have old descriptions.
- Current core config still excludes `tmp`.

No-test waiver:
- None. Manifest surface behavior has focused tests.


## red evidence

- Focused red tests failed as expected. Trace: `trc_921a46fa7cec`.
- Workspace failures: core expected 18 but got 17; `explore` description still old.
- OS failures: core expected 18 but got 17; `explore` description still old.

## implementation notes

- Updated source manifest descriptions for `explore`, `fs.trash`, and `intent` in:
  - `packages/workspace/tooling/tool-manifest.json`
  - `packages/os/tooling/dev-tool-manifest.json`
- Added `tmp` back to core config in:
  - `packages/workspace/manifests/manifest.config.json`
  - `packages/os/manifests/manifest.config.json`
- Regenerated workspace and OS full/core manifests, generated docs, and generated types.
- Regeneration trace: `trc_ce76f9bbd159`.

## green evidence

- Focused tests passed. Trace: `trc_862f7c28820d`.
  - Workspace manifest tests: 4 passed.
  - OS manifest tests: 12 passed.
- Exact generated verification passed. Trace: `trc_9e32a620c3af`.
  - Workspace core count: 18, exact expected list.
  - OS core count: 18, exact expected list.
  - `tmp` present in both core manifests.
  - Removed tools present in core: none.
  - Requested descriptions match in source/full/core for both packages.

## final core list after implementation

- `batch`
- `code.call`
- `code.run`
- `context.find`
- `context.get`
- `context.save`
- `context.search`
- `context.trace`
- `explore`
- `fs.apply_patch`
- `fs.trash`
- `github`
- `intent`
- `review.run`
- `stream.context`
- `stream.sync`
- `tmp`
- `tools.search`

## workspace-owned: validation evidence

- 2026-06-18 02:02:13 `review.run`: passed — OK
- 2026-06-18 02:02:27 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/core-manifest-description-followup.json`, `.task/workspace-agents/core-manifest-description-followup/current.json`, `.task/workspace-agents/core-manifest-description-followup/session.json`, `.task/workspace-agents/core-manifest-description-followup/workpad.md`, `packages/os/TOOLS.md`, `packages/os/manifests/core.manifest.json`, `packages/os/manifests/manifest.config.json`, `packages/os/manifests/tool.manifest.json`, `packages/os/tests/tool-manifest.test.ts`, `packages/os/tooling/dev-tool-manifest.json`, `packages/workspace/TOOLS.md`, `packages/workspace/manifests/core-manifest.json`, `packages/workspace/manifests/manifest.config.json`, `packages/workspace/manifests/tool-manifest.json`, `packages/workspace/tests/tool-manifest.test.ts`, `packages/workspace/tooling/tool-manifest.json`
- matched rules: `workspace-facade`, `workspace-audit-docs`
- selected suites: `workspace facade input contracts`, `workspace audit tests`
- run results: `workspace facade input contracts` passed, `workspace audit tests` passed
- failed suites: none


## review and verify evidence

- `review.run` passed against `origin/stream/workspace-agents` with 0 issues and 0 pre-existing issues. Trace: `trc_b02f5d90ca9f`.
- `verify` passed against `origin/stream/workspace-agents` with `publishValid: true`. Trace: `trc_74d7f03383d6`.
- Verify-selected suites passed:
  - `workspace facade input contracts`: 131 tests passed.
  - `workspace audit tests`: 1 test passed.
- DB guard passed with 0 risks and 0 findings.

## acceptance criteria final before publish

- [x] Updated `explore` description in workspace and OS source/full/core manifests.
- [x] Updated `fs.trash` description in workspace and OS source/full/core manifests.
- [x] Updated `intent` description to use `dispatches` in workspace and OS source/full/core manifests.
- [x] Added `tmp` back to workspace and OS core manifests.
- [x] Kept all other prior core removals intact.
- [x] Preserved all tools in full manifests.
- [x] Regenerated manifests/docs/types from source.
- [x] Ran focused red/green tests, exact generated verification, review, and verify.
- [ ] Push/promote/cleanup.

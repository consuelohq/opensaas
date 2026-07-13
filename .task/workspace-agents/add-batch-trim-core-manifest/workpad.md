# add batch trim core manifest

branch: `task/workspace-agents/add-batch-trim-core-manifest`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1118/add-batch-trim-core-manifest
github pr: https://github.com/consuelohq/opensaas/pull/1118
started: 2026-06-18

taskSession: `tsk_d6bf2739ca56`

## acceptance criteria

- [x] Expose `batch` as a facade tool in both workspace and OS full manifests.
- [x] Include `batch` in both workspace and OS core manifests.
- [x] Remove Ko's additional requested names from core: `fs.read`, `fs.search`, `tmp`, `git.diff`, `git.status`, `stream.list`, `checkFiles`, and `verify`.
- [x] Preserve removed tools in full manifests where they already exist.
- [x] Keep all remaining prior core tools in core.
- [x] Add schema/internal executor support so `executeTool("batch", ...)` works, not just manifest listing.
- [x] Update tests first and confirm red.
- [x] Regenerate manifests/docs/types and verify final core list.
- [x] Run focused tests.
- [ ] Run review/verify.
- [ ] Push/promote/cleanup.

## final expected core tools

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
- `tools.search`

## test-first contract

Behavior under test:
- Generated workspace and OS core manifests contain exactly the expected 17 tools above.
- `batch` is present in full and core manifests in both packages.
- Ko's requested removal set is absent from core but retained in full manifests.
- `executeTool("batch", { steps: [...] })` dispatches to the internal batch executor.
- `BatchInput` schema validates batch steps and supports synthetic dry-run behavior.

Existing local pattern followed:
- `packages/*/tests/tool-manifest.test.ts` for core/full manifest surface assertions.
- `packages/*/tests/facade/facade.test.ts` for facade executor and schema behavior.
- `packages/*/scripts/lib/facade/executor.ts` internal routing pattern for `code.call`, `worker.call`, and task internals.

Focused red command:
- `bun --cwd packages/workspace test tests/tool-manifest.test.ts tests/facade/facade.test.ts`
- `bun --cwd packages/os test tests/tool-manifest.test.ts tests/facade/facade.test.ts`

Red evidence:
- Trace: `trc_86daab9c644e`.
- Expected failures included missing `batch` in full/core manifests, `BatchInput` missing, and `executeTool("batch")` returning `NOT_FOUND`.
- The broad workspace facade file also had unrelated pre-existing failures when run wholesale; final validation uses focused batch facade tests plus manifest tests.

Implementation notes:
- Added `batch` to `packages/workspace/tooling/tool-manifest.json` and `packages/os/tooling/dev-tool-manifest.json`.
- Added `BatchInput` and `BatchOutput` type signatures to both facade schema registries.
- Added `internal: "batch"` executor routing in both packages to the existing `runBatch` implementation.
- Updated both core manifest configs to include `batch` and exclude the additional requested tools.
- Regenerated tool manifests, workflow bundles, generated types, and docs.

Implementation traces:
- Test edits: `trc_b19ae9dab6a6`, `trc_3cfc84513a5b`.
- Main implementation: `trc_7f870bfcfaa9`.
- Regeneration: `trc_f06e84a2f288`, `trc_059b9772020a`.
- BatchInput dry-run fix: `trc_c10a05436c16`.

Green evidence:
- Focused tests passed in trace `trc_735a67c399e1`:
  - Workspace manifest tests: 4 passed.
  - Workspace batch facade tests: 2 passed.
  - OS manifest tests: 12 passed.
  - OS batch facade + dry-run tests: 3 passed.
- Exact core verification passed in trace `trc_8b400a28fd8a`:
  - Workspace core count: 17, exact expected list.
  - OS core count: 17, exact expected list.
  - Removed tools present in core: none.
  - Retained tools missing from full manifests: none.
  - Removed tools missing from full manifests: none.

Files changed:
- `packages/workspace/tooling/tool-manifest.json`
- `packages/os/tooling/dev-tool-manifest.json`
- `packages/workspace/manifests/manifest.config.json`
- `packages/os/manifests/manifest.config.json`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/workspace/tests/tool-manifest.test.ts`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/os/tests/facade/facade.test.ts`
- generated manifests/docs/types for workspace and OS.

## workspace-owned: validation evidence

- 2026-06-18 01:10:42 `review.run`: passed — OK
- 2026-06-18 01:11:12 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/add-batch-trim-core-manifest.json`, `.task/workspace-agents/add-batch-trim-core-manifest/current.json`, `.task/workspace-agents/add-batch-trim-core-manifest/session.json`, `.task/workspace-agents/add-batch-trim-core-manifest/workpad.md`, `packages/os/TOOLS.md`, `packages/os/manifests/core.manifest.json`, `packages/os/manifests/manifest.config.json`, `packages/os/manifests/tool.manifest.json`, `packages/os/manifests/workflow-bundles.json`, `packages/os/scripts/lib/facade/executor.ts`, `packages/os/scripts/lib/facade/schemas.ts`, `packages/os/src/generated/workspace.d.ts`, `packages/os/tests/facade/facade.test.ts`, `packages/os/tests/tool-manifest.test.ts`, `packages/os/tooling/dev-tool-manifest.json`, `packages/workspace/TOOLS.md`, `packages/workspace/manifests/core-manifest.json`, `packages/workspace/manifests/manifest.config.json`, `packages/workspace/manifests/tool-manifest.json`, `packages/workspace/manifests/workflow-bundles.json`, `packages/workspace/scripts/lib/facade/executor.ts`, `packages/workspace/scripts/lib/facade/schemas.ts`, `packages/workspace/src/generated/workspace.d.ts`, `packages/workspace/tests/facade/facade.test.ts`, `packages/workspace/tests/tool-manifest.test.ts`, `packages/workspace/tooling/tool-manifest.json`
- matched rules: `workspace-facade`, `workspace-audit-docs`
- selected suites: `workspace facade input contracts`, `workspace audit tests`
- run results: `workspace facade input contracts` passed, `workspace audit tests` passed
- failed suites: none


## review and verify evidence

- `review.run` passed against `origin/stream/workspace-agents` with 0 issues and 0 pre-existing issues. Trace: `trc_479df8c8f155`.
- `verify` passed against `origin/stream/workspace-agents` with `publishValid: true`. Trace: `trc_e8d42fbca139`.
- Verify-selected suites passed:
  - `workspace facade input contracts`: 131 tests passed.
  - `workspace audit tests`: 1 test passed.
- DB guard passed with 0 risks and 0 findings.

## acceptance criteria status final before publish

- [x] Expose `batch` as a facade tool in both workspace and OS full manifests.
- [x] Include `batch` in both workspace and OS core manifests.
- [x] Remove Ko's additional requested names from core.
- [x] Preserve removed tools in full manifests.
- [x] Keep all remaining prior core tools in core.
- [x] Add schema/internal executor support for `executeTool("batch", ...)`.
- [x] Update tests first and confirm red.
- [x] Regenerate manifests/docs/types.
- [x] Verify exact final core list.
- [x] Run focused tests, review, and verify.
- [ ] Push/promote/cleanup.

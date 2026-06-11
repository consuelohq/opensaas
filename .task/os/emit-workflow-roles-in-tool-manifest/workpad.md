# emit workflow roles in tool manifest

branch: task/os/emit-workflow-roles-in-tool-manifest
stream: stream/os
source: stream/os
pr: https://github.com/consuelohq/opensaas/pull/974
started: 2026-06-11

## acceptance criteria

- [x] Generated OS dev tool manifest includes `workflowRole` for task workflow tools.
- [x] Generated OS core manifest preserves `workflowRole` for included role-bearing tools.
- [x] Dispatcher normal path resolves workflow roles from manifest entries instead of owning the canonical map.
- [x] Dispatcher keeps only a legacy fallback path for older manifests/tests.
- [x] Tests prove generated manifest roles drive hook output and changing a manifest role changes dispatcher output without editing dispatcher constants.
- [x] Existing task workflow, dispatcher, and legacy hook tests remain green.
- [x] Validate with focused tests, generation/syntax checks, review, verify, task.push, and task.pr into stream/os.

## plan

1. Explore source of truth for OS manifest generation, core manifest filtering, dispatcher role fallback, docs, and tests. Done.
2. Add focused red tests for manifest-generated workflow roles and dispatcher manifest-source behavior. Done.
3. Add `workflowRole` metadata to manifest generation/source, regenerate generated manifest surfaces. Done.
4. Update dispatcher so generated manifest is the normal path and fallback is explicitly legacy. Done.
5. Run focused tests, hook cluster, generation checks, syntax checks, review, verify, push, and promote. In progress.

## Test-first contract

behavior under test: OS tool manifest generation emits workflow roles for task workflow capabilities, and OS hook dispatch resolves tool contracts from generated manifest roles rather than a dispatcher-owned canonical map.

existing local pattern: `packages/os/tests/task-hook-dispatcher.test.ts` covers dispatcher integration; `packages/os/tests/task-hook-workflow-contract.test.ts` covers registry behavior; `packages/os/scripts/generate-tool-manifest.ts` and generated JSON manifests own manifest surfaces.

new or changed tests: `packages/os/tests/task-manifest-workflow-roles.test.ts`.

focused red command: `bun test packages/os/tests/task-manifest-workflow-roles.test.ts`.

expected red failure: generated manifest entries do not contain `workflowRole` and dispatcher still synthesizes workflow roles by default.

no-test waiver: not applicable.

## exploration notes

- Prior dispatcher workpad confirmed the gap: actual OS manifest did not expose `workflowRole`, so dispatcher had to enrich current manifest entries by canonical tool name.
- `packages/os/scripts/generate-tool-manifest.ts` reads source JSON arrays from `packages/os/tooling/*.json` and preserves each tool definition under generated full/core manifests.
- `packages/os/tooling/dev-tool-manifest.json` is the right source-of-truth surface for facade tool contracts.
- Generated `packages/os/manifests/tool.manifest.json` and `packages/os/manifests/core.manifest.json` preserve the source `definition` object, so adding `workflowRole` to source entries propagates via `generate-tool-manifest`.

## implementation notes

- Added `workflowRole` to 12 task workflow tool entries in `packages/os/tooling/dev-tool-manifest.json`:
  - `stream.context` -> `stream.context`
  - `task.start` -> `task.start`
  - `fs.write` -> `workpad.write`
  - `code.run` -> `decision.research`
  - `task.exec` -> `test.run`
  - `git.diff` -> `diff.inspect`
  - `review.run` -> `validation.review`
  - `verify` -> `validation.verify`
  - `task.push` -> `task.push`
  - `task.pr` -> `task.pr`
  - `task.finish` -> `task.finish`
  - `tools.search` -> `tool.search`
- Regenerated `packages/os/manifests/tool.manifest.json` and `packages/os/manifests/core.manifest.json` with `bun run --cwd packages/os generate-tool-manifest`.
- Updated `packages/os/hooks/dispatcher.js` so `normalizeManifest()` preserves explicit `workflowRole` by default and only applies the legacy name-to-role fallback when `{ legacyWorkflowRoleFallback: true }` is passed.
- Updated `packages/os/hooks/README.md` to document manifest roles and clarify that dispatcher fallback is legacy compatibility only.
- Added `packages/os/tests/task-manifest-workflow-roles.test.ts` to lock the behavior.

## validation evidence

- RED: `bun test packages/os/tests/task-manifest-workflow-roles.test.ts`
  - result: expected failure: source/generated manifests lacked `workflowRole`; dispatcher normalization synthesized by default.
  - trace: `trc_dd6183c0fbb1`.
- SOURCE UPDATE: added roles to 12 source manifest entries.
  - trace: `trc_564fbf51fbc6` / write operation inside `code.run`.
- GENERATE: `bun run --cwd packages/os generate-tool-manifest`
  - result: wrote `packages/os/manifests/tool.manifest.json` (134 tools) and `packages/os/manifests/core.manifest.json` (55 tools).
  - trace: `trc_b5c14a9e1e75`.
- GREEN focused: `bun test packages/os/tests/task-manifest-workflow-roles.test.ts`
  - result: 4 pass / 0 fail.
  - trace: `trc_4ab7a9d5cf13`.
- GREEN hook cluster: `bun test packages/os/tests/task-manifest-workflow-roles.test.ts packages/os/tests/task-hooks.test.ts packages/os/tests/task-hook-workflow-contract.test.ts packages/os/tests/task-hook-dispatcher.test.ts`
  - result: 18 pass / 0 fail.
  - trace: `trc_b6ab746bd69e`.
- ROLE VERIFY: read source/full/core manifests and confirmed all 12 roles match expected values and are present in core/full generated surfaces.
  - trace: `trc_cfafd4cc6ecd`.
- SYNTAX: `checkFiles` on `packages/os/hooks/dispatcher.js`
  - result: passed `node --check`.
  - trace: `trc_fe94561ad16a`.
- REVIEW: `review.run` base `origin/stream/os`, `noTests: true`
  - first run found one explicit-any issue in the test; fixed it.
  - second run result: 0 issues, 0 blocking.
  - trace: `trc_b89dad16631e`.
- VERIFY: `verify` base `origin/stream/os`, `noDb: true`
  - result: publishValid true.
  - note: automatic selector picked 0 suites; manual focused/hook tests above are the test proof.
  - trace: `trc_5bee3160135f`.

## files changed

- `.task/os/emit-workflow-roles-in-tool-manifest/*`
- `.task/tasks/os/emit-workflow-roles-in-tool-manifest.json`
- `packages/os/hooks/dispatcher.js`
- `packages/os/hooks/README.md`
- `packages/os/manifests/core.manifest.json`
- `packages/os/manifests/tool.manifest.json`
- `packages/os/tests/task-manifest-workflow-roles.test.ts`
- `packages/os/tooling/dev-tool-manifest.json`

## issues / notes

- A mistaken Bun invocation form, `bun --cwd packages/os run generate-tool-manifest`, only printed Bun run help; the correct command is `bun run --cwd packages/os generate-tool-manifest`.
- The dispatcher still contains a legacy fallback map, but the normal path no longer uses it. It is opt-in via `{ legacyWorkflowRoleFallback: true }` for older manifest fixtures.

- 2026-06-11 18:58:35 write: `.task/os/emit-workflow-roles-in-tool-manifest/workpad.md`

## workspace-owned: files changed

- `.task/os/emit-workflow-roles-in-tool-manifest/*`
- `.task/tasks/os/emit-workflow-roles-in-tool-manifest.json`
- `packages/os/hooks/dispatcher.js`
- `packages/os/hooks/README.md`
- `packages/os/manifests/core.manifest.json`
- `packages/os/manifests/tool.manifest.json`
- `packages/os/tests/task-manifest-workflow-roles.test.ts`
- `packages/os/tooling/dev-tool-manifest.json`

## workspace-owned: activity log

- 2026-06-11 18:58:35 fs.write: `.task/os/emit-workflow-roles-in-tool-manifest/workpad.md`

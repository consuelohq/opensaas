# add workspace apply patch tool

branch: `task/os/add-workspace-apply-patch-tool`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1031/add-workspace-apply-patch-tool
github pr: https://github.com/consuelohq/opensaas/pull/1031
started: 2026-06-13

## objective

Add or correct the workspace filesystem patching surface so agents can apply multiline/diff patches without routing source code through fragile inline shell or line-range replacements.

## acceptance criteria

- `fs.patch` remains the targeted line-range replacement primitive.
- A diff-style apply-patch primitive exists for multiline edits with embedded file paths and hunks.
- The tool accepts patch payloads through file transport so agents can avoid inline multiline patch arguments.
- The tool rejects unsafe paths and preserves task worktree scoping.
- Manifest, schemas, docs, generated surfaces, and tests match the new contract.

## test-first contract

Behavior under test:

- Applying a patch text can update, add, and delete files relative to the task worktree using OpenCode/Codex-style marker syntax.
- The patch payload can be supplied via a content file.
- Unsafe absolute or parent-traversal paths are rejected.

Existing pattern to follow:

- `fs.patch`/`fs.write` tool manifest and facade schema patterns.
- Workspace script tests under `packages/workspace/tests`.

Focused red command:

- TBD after reading the current fs implementation and tests.

Expected red failure:

- The desired apply-patch tool/schema is missing or rejects the new input shape.

## initial recommendation

The correct architecture is a separate `fs.applyPatch`/`apply_patch` tool, not expanding `fs.patch`. Line-range replacement and unified/apply patch semantics are different primitives.

## investigation notes

- OpenCode docs inspected: `apply_patch` uses `patchText` with embedded file marker lines such as `*** Update File:`, `*** Add File:`, `*** Move to:`, and `*** Delete File:`.
- Browser known-URL inspection timed out after opening the docs page, but built-in web retrieval captured the relevant public docs content.

## files changed

- `packages/workspace/STEERING.md`
- `packages/workspace/tests/fs-apply-patch.test.ts`

## validation evidence

- TBD

## issues and recovery

- none yet

- 2026-06-14 03:38:32 write: `.task/os/add-workspace-apply-patch-tool/workpad.md`

## workspace-owned: files changed

- `packages/workspace/STEERING.md`
- `packages/workspace/tests/fs-apply-patch.test.ts`

## workspace-owned: activity log

- 2026-06-14 03:38:32 fs.write: `.task/os/add-workspace-apply-patch-tool/workpad.md`
- 2026-06-14 04:20:06 fs.write: `packages/workspace/tests/fs-apply-patch.test.ts`
- 2026-06-14 04:31:46 fs.patch: `packages/workspace/STEERING.md`
- 2026-06-14 04:33:01 fs.patch: `packages/workspace/STEERING.md`
- 2026-06-14 04:33:30 fs.patch: `packages/workspace/STEERING.md`
- 2026-06-14 04:36:57 fs.write: `.task/os/add-workspace-apply-patch-tool/workpad.md`

## workspace-owned: files read

- `packages/workspace/STEERING.md`
- `packages/workspace/scripts/fs.js`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/src/generated/workspace.d.ts`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/tests/task-node-modules.test.js`
- `packages/workspace/tooling/tool-manifest.json`

## workspace-owned: TDD red evidence

- 2026-06-14 04:20:18 `bun x vitest run packages/workspace/tests/fs-apply-patch.test.ts`: failed exit 1 trace: `trc_0d0a2570c843`
  - output: -patch[27m[39m [31m+[39m [36m [2m❯[22m packages/workspace/tests/fs-apply-patch.test.ts:[2m68:25[22m[39m [90m 66| [39m [90m 67| [39m [34mexpect[39m(result[33m.[39mstatus)[33m.[39mnot[33m.[39m[34mtoBe[39m([34m0[39m)[33m;[39m [90m 68| [39m [34mexpect[39m(result[33m.[39mstderr)[33m.[39m[34mtoContain[39m([32m'unsafe patch path'[39m)[33m;[39m [90m | [39m [31m^[39m [90m 69| [39m})[33m;[39m [90m 70| [39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯[22m[39m error: script "task:exec" exited with code 1

## workspace-owned: TDD green evidence

- 2026-06-14 04:26:08 `bun x vitest run packages/workspace/tests/fs-apply-patch.test.ts`: passed exit 0 trace: `trc_7ab5fbd18e3c`
  - output: → tmux: opensaas-os-add-workspace-apply-patch-tool-6bd580e6

## workspace-owned: validation evidence

- TBD
- 2026-06-14 04:26:48 `checkFiles`: passed — OK
- 2026-06-14 04:35:41 `audit`: passed — OK
- 2026-06-14 04:36:14 `review.run`: passed — OK
- 2026-06-14 04:36:30 `verify`: passed — OK
- 2026-06-14 04:37:05 `verify`: passed — OK

## workspace-owned: TDD post evidence

- 2026-06-14 04:27:03 `bun x vitest run packages/workspace/tests/fs-apply-patch.test.ts packages/workspace/tests/facade/facade.test.ts`: passed exit 0 trace: `trc_7db2adf493bf`
  - output: --json --dry-run","durationMs":0,"exitCode":0,"traceId":"trc_abc123def456","ok":true,"code":"OK","capabilities":{"readOnly":false,"mutating":true},"event":"tool.executed","message":"tool.executed","ts":"2026-06-14T04:27:03.840Z"} {"level":"info","tool":"mac.exec","branch":"","command":"workspace mac.exec '{\"command\":\"pwd\"}'","implementationCommand":"bun run mac -- exec pwd --json","durationMs":0,"exitCode":0,"traceId":"trc_abc123def456","ok":true,"code":"OK","capabilities":{"readOnly":false,"mutating":true},"event":"tool.executed","message":"tool.executed","ts":"2026-06-14T04:27:03.842Z"}

- 2026-06-14 04:31:46 patch lines 492-492: `packages/workspace/STEERING.md`

- 2026-06-14 04:33:01 patch lines 1106-1118: `packages/workspace/STEERING.md`

- 2026-06-14 04:33:30 patch lines 1105-1106: `packages/workspace/STEERING.md`

## workspace-owned: test selection

- changed files: `.task/os/add-workspace-apply-patch-tool/current.json`, `.task/os/add-workspace-apply-patch-tool/evidence-log.json`, `.task/os/add-workspace-apply-patch-tool/explore-state.json`, `.task/os/add-workspace-apply-patch-tool/read-log.json`, `.task/os/add-workspace-apply-patch-tool/session.json`, `.task/os/add-workspace-apply-patch-tool/verify.json`, `.task/os/add-workspace-apply-patch-tool/workpad.md`, `.task/tasks/os/add-workspace-apply-patch-tool.json`, `packages/workspace/STEERING.md`, `packages/workspace/TOOLS.md`, `packages/workspace/scripts/fs.js`, `packages/workspace/scripts/lib/facade/schemas.ts`, `packages/workspace/src/generated/workspace.d.ts`, `packages/workspace/tests/fs-apply-patch.test.ts`, `packages/workspace/tooling/tool-manifest.json`
- matched rules: `workspace-facade`, `workspace-audit-docs`
- selected suites: `workspace facade input contracts`, `workspace audit tests`
- run results: `workspace facade input contracts` passed, `workspace audit tests` passed
- failed suites: none

## final implementation notes

Implemented a separate `fs.applyPatch` tool rather than widening `fs.patch`.

`fs.patch` remains the targeted line-range replacement primitive. `fs.applyPatch` is the anchored marker/diff primitive for multiline and multi-file edits. It accepts `patchFile` through the facade, supports `patchText` for short payloads, and applies marker patches with embedded task-worktree-relative paths.

Supported markers:

- `*** Begin Patch`
- `*** Update File: path`
- `@@`
- hunk lines prefixed with space, `-`, or `+`
- `*** Add File: path`
- `*** Move to: path`
- `*** Delete File: path`
- `*** End Patch`

Changed files:

- `packages/workspace/scripts/fs.js`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/tooling/tool-manifest.json`
- `packages/workspace/src/generated/workspace.d.ts`
- `packages/workspace/TOOLS.md`
- `packages/workspace/STEERING.md`
- `packages/workspace/tests/fs-apply-patch.test.ts`

Validation:

- Red: `bun x vitest run packages/workspace/tests/fs-apply-patch.test.ts` failed because `apply-patch` was unknown. trace `trc_0d0a2570c843`.
- Green: `bun x vitest run packages/workspace/tests/fs-apply-patch.test.ts` passed 2 tests. trace `trc_7ab5fbd18e3c`.
- Generated types: `bun run generate-types` passed. trace `trc_837a15a1222c`.
- Generated docs: `bun run generate-docs` passed. trace `trc_f2d70429260b`.
- Syntax checks: `checkFiles` passed for `fs.js`, `schemas.ts`, and `fs-apply-patch.test.ts`. trace `trc_4fb2a9347f25`.
- Post suite: `bun x vitest run packages/workspace/tests/fs-apply-patch.test.ts packages/workspace/tests/facade/facade.test.ts` passed 563 tests. trace `trc_7db2adf493bf`.
- Scripts audit: `audit --scripts` passed with documented_count 61 and actual_count 61. trace `trc_89333facadb8`.
- Review: `review.run --base stream/os --no-tests` passed with yourIssues 0, preExistingIssues 0, blockingIssues 0. trace `trc_c5bafc186337`.
- Verify: `verify --base stream/os` passed and wrote publish-valid stamp. trace `trc_172f7f46e9c5`.

Tooling gap:

- `code.call` edit mode still rejected the task-scoped temp script with `CODE_CALL_VALIDATION_ERROR`, so implementation used `task.call` with a temp Python file as the smallest task-scoped fallback. traces `trc_af4396255585`, `trc_012a3b2fc9fd`, fallback `trc_eb8e96f32f5f`.

- 2026-06-14 04:36:57 append: `.task/os/add-workspace-apply-patch-tool/workpad.md`

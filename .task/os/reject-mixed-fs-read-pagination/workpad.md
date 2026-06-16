# reject mixed fs read pagination

branch: `task/os/reject-mixed-fs-read-pagination`
stream: `stream/os`
taskSession: `tsk_8e1e99f9f7cd`
started: 2026-06-16

## acceptance criteria

- [ ] Verify the CodeRabbit comment against current OS stream code before editing.
- [ ] Reject `fs.read` inputs that combine `files[]` with top-level `offset`, `limit`, `from`, or `to`.
- [ ] Preserve valid modes: single `path` may use top-level pagination; `files[]` may use per-file pagination fields.
- [ ] Keep changes minimal to facade schema/tests/generated surfaces only unless current code proves more is needed.
- [ ] Validate with focused red/green facade input tests, generation, review, and verify.

## test-first contract

Behavior under test:

- `executeTool('fs.read', { taskSession, files: [{ path: 'a.ts', offset: 1 }], offset: 10 })` should fail validation.
- The same should fail for top-level `limit`, `from`, or `to` with `files[]`.
- `executeTool('fs.read', { taskSession, path: 'a.ts', offset: 10, limit: 5 })` remains valid.
- `executeTool('fs.read', { taskSession, files: [{ path: 'a.ts', offset: 1, limit: 2 }] })` remains valid.

Existing pattern:

- `packages/os/tests/facade/facade.test.ts` contains `fs.read` validation and transport tests.
- `packages/os/scripts/lib/facade/schemas.ts` defines `FsReadInput` and generated type signatures.

Focused red command:

- `bun x vitest run packages/os/tests/facade/facade.test.ts -t 'rejects mixed fs read pagination'`

Expected red failure:

- Current schema only enforces exactly one of `path` or `files`; it still allows `files[]` with top-level pagination fields.

- 2026-06-16 07:25:12 write: `.task/os/reject-mixed-fs-read-pagination/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-16 07:25:12 fs.write: `.task/os/reject-mixed-fs-read-pagination/workpad.md`
- 2026-06-16 07:36:47 fs.write: `.task/os/reject-mixed-fs-read-pagination/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/tests/facade/facade.test.ts`

## workspace-owned: TDD red evidence

- 2026-06-16 07:27:40 `bash -lc bun x vitest run packages/os/tests/facade/facade.test.ts --testNamePattern 'mixed fs read'`: failed exit 1 trace: `trc_f4b1324ee9aa`
  - output: /facade/facade.test.ts:[2m264:27[22m[39m [90m262| [39m })[33m;[39m [90m263| [39m [90m264| [39m [34mexpect[39m(result[33m.[39mok)[33m.[39m[34mtoBe[39m([35mfalse[39m)[33m;[39m [90m | [39m [31m^[39m [90m265| [39m [34mexpect[39m(result[33m.[39mcode)[33m.[39m[34mtoBe[39m([32m'VALIDATION_ERROR'[39m)[33m;[39m [90m266| [39m expect(result.message).toContain('top-level pagination fields … [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m error: script "task:exec" exited with code 1

## workspace-owned: TDD green evidence

- 2026-06-16 07:29:16 `bash -lc bun x vitest run packages/os/tests/facade/facade.test.ts --testNamePattern 'mixed fs read|offset and limit|files-json'`: passed exit 0 trace: `trc_a2d854a18c3e`
  - output: ationMs":0,"exitCode":1,"traceId":"trc_abc123def456","ok":false,"code":"VALIDATION_ERROR","capabilities":{"readOnly":true,"mutating":false},"event":"tool.executed","message":"tool.executed","ts":"2026-06-16T07:29:16.216Z"} {"level":"error","tool":"fs.read","command":"workspace fs.read","implementationCommand":"workspace fs read, or task:fs read when a branch is resolved","durationMs":0,"exitCode":1,"traceId":"trc_abc123def456","ok":false,"code":"VALIDATION_ERROR","capabilities":{"readOnly":true,"mutating":false},"event":"tool.executed","message":"tool.executed","ts":"2026-06-16T07:29:16.226Z"}

## workspace-owned: validation evidence

- 2026-06-16 07:34:48 `review.run`: passed — OK
- 2026-06-16 07:36:19 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os/reject-mixed-fs-read-pagination/current.json`, `.task/os/reject-mixed-fs-read-pagination/evidence-log.json`, `.task/os/reject-mixed-fs-read-pagination/read-log.json`, `.task/os/reject-mixed-fs-read-pagination/session.json`, `.task/os/reject-mixed-fs-read-pagination/workpad.md`, `.task/tasks/os/reject-mixed-fs-read-pagination.json`, `packages/os/TOOLS.md`, `packages/os/scripts/lib/facade/schemas.ts`, `packages/os/src/generated/workspace.d.ts`, `packages/os/tests/facade/facade.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## verification of CodeRabbit comment

Current OS stream code was still validly affected:

- `packages/os/scripts/lib/facade/schemas.ts` accepted `files[]` plus top-level `offset`, `limit`, `from`, or `to`.
- `packages/os/tests/facade/facade.test.ts` had valid single-file and multi-file transport coverage, but no mixed-mode rejection coverage.

## implementation

- Added a second `FsReadInput` refine that rejects top-level pagination fields when `files[]` is present.
- Kept valid modes unchanged: top-level paging with `path`, per-file paging inside `files[]`.
- Updated the `FsReadInput` signature string and regenerated `packages/os/src/generated/workspace.d.ts` and `packages/os/TOOLS.md`.
- Added a focused facade test covering mixed top-level `offset`, `limit`, `from`, and `to` with `files[]`.

## validation evidence

- Red: `bun x vitest run packages/os/tests/facade/facade.test.ts --testNamePattern 'mixed fs read'` failed because mixed `files[] + offset` was accepted; trace `trc_f4b1324ee9aa`.
- Green: `bun x vitest run packages/os/tests/facade/facade.test.ts --testNamePattern 'mixed fs read|offset and limit|files-json'` passed; trace `trc_a2d854a18c3e`.
- Generation: `cd packages/os && bun run generate-types && bun run generate-docs` passed; trace `trc_a7991b14a3c8`.
- Focused broader facade validation passed: `bun x vitest run packages/os/tests/facade/facade.test.ts --testNamePattern 'mixed fs read|offset and limit|files-json|validates input'`; trace `trc_c446bf4a2362`.
- Tool manifest validation passed: `bun x vitest run packages/os/tests/tool-manifest.test.ts`; trace `trc_1b257b7f0895`.
- Syntax checks passed for schemas, facade test, and generated d.ts; trace `trc_dd9306484b57`.
- `review.run --base origin/stream/os --no-tests` passed with 0 issues; trace `trc_585ca03f9305`.
- `verify --base origin/stream/os` passed and wrote publish-valid stamp; trace `trc_5cfecd446422`.
- Note: OS verify selected zero registry suites, so the focused facade/tool-manifest suites above are the behavioral validation for this task.

- 2026-06-16 07:36:47 append: `.task/os/reject-mixed-fs-read-pagination/workpad.md`

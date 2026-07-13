# reject mixed fs read pagination

branch: `task/workspace-agents/reject-mixed-fs-read-pagination`
stream: `stream/workspace-agents`
taskSession: `tsk_57bcf5c183bd`
started: 2026-06-16

## acceptance criteria

- [ ] Verify the CodeRabbit comment against current workspace-agent stream code before editing.
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

- `packages/workspace/tests/facade/facade.test.ts` contains `fs.read` validation and transport tests.
- `packages/workspace/scripts/lib/facade/schemas.ts` defines `FsReadInput` and generated type signatures.

Focused red command:

- `bun x vitest run packages/workspace/tests/facade/facade.test.ts -t 'rejects mixed fs read pagination'`

Expected red failure:

- Current schema only enforces exactly one of `path` or `files`; it still allows `files[]` with top-level pagination fields.

- 2026-06-16 07:25:04 write: `.task/workspace-agents/reject-mixed-fs-read-pagination/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-16 07:25:04 fs.write: `.task/workspace-agents/reject-mixed-fs-read-pagination/workpad.md`
- 2026-06-16 07:36:35 fs.write: `.task/workspace-agents/reject-mixed-fs-read-pagination/workpad.md`

## workspace-owned: files read

- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/tests/facade/facade.test.ts`

## workspace-owned: TDD red evidence

- 2026-06-16 07:27:27 `bash -lc bun x vitest run packages/workspace/tests/facade/facade.test.ts --testNamePattern 'mixed fs read'`: failed exit 1 trace: `trc_495731a8ebb7`
  - output: /facade/facade.test.ts:[2m472:27[22m[39m [90m470| [39m })[33m;[39m [90m471| [39m [90m472| [39m [34mexpect[39m(result[33m.[39mok)[33m.[39m[34mtoBe[39m([35mfalse[39m)[33m;[39m [90m | [39m [31m^[39m [90m473| [39m [34mexpect[39m(result[33m.[39mcode)[33m.[39m[34mtoBe[39m([32m'VALIDATION_ERROR'[39m)[33m;[39m [90m474| [39m expect(result.message).toContain('top-level pagination fields … [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯[22m[39m error: script "task:exec" exited with code 1

## workspace-owned: TDD green evidence

- 2026-06-16 07:29:08 `bash -lc bun x vitest run packages/workspace/tests/facade/facade.test.ts --testNamePattern 'mixed fs read|fs read page|fs read multi'`: passed exit 0 trace: `trc_8dd7cb64d62e`
  - output: ationMs":0,"exitCode":1,"traceId":"trc_abc123def456","ok":false,"code":"VALIDATION_ERROR","capabilities":{"readOnly":true,"mutating":false},"event":"tool.executed","message":"tool.executed","ts":"2026-06-16T07:29:08.388Z"} {"level":"error","tool":"fs.read","command":"workspace fs.read","implementationCommand":"workspace fs read, or task:fs read when a branch is resolved","durationMs":0,"exitCode":1,"traceId":"trc_abc123def456","ok":false,"code":"VALIDATION_ERROR","capabilities":{"readOnly":true,"mutating":false},"event":"tool.executed","message":"tool.executed","ts":"2026-06-16T07:29:08.397Z"}

## workspace-owned: validation evidence

- 2026-06-16 07:34:24 `review.run`: passed — OK
- 2026-06-16 07:36:00 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/reject-mixed-fs-read-pagination.json`, `.task/workspace-agents/reject-mixed-fs-read-pagination/current.json`, `.task/workspace-agents/reject-mixed-fs-read-pagination/evidence-log.json`, `.task/workspace-agents/reject-mixed-fs-read-pagination/read-log.json`, `.task/workspace-agents/reject-mixed-fs-read-pagination/session.json`, `.task/workspace-agents/reject-mixed-fs-read-pagination/workpad.md`, `packages/workspace/TOOLS.md`, `packages/workspace/scripts/lib/facade/schemas.ts`, `packages/workspace/src/generated/workspace.d.ts`, `packages/workspace/tests/facade/facade.test.ts`
- matched rules: `workspace-facade`, `workspace-audit-docs`
- selected suites: `workspace facade input contracts`, `workspace audit tests`
- run results: `workspace facade input contracts` passed, `workspace audit tests` passed
- failed suites: none

## verification of CodeRabbit comment

Current workspace-agent stream code was still validly affected:

- `packages/workspace/scripts/lib/facade/schemas.ts` accepted `files[]` plus top-level `offset`, `limit`, `from`, or `to`.
- `packages/workspace/tests/facade/facade.test.ts` had valid single-file and multi-file transport coverage, but no mixed-mode rejection coverage.

## implementation

- Added a second `FsReadInput` refine that rejects top-level pagination fields when `files[]` is present.
- Kept valid modes unchanged: top-level paging with `path`, per-file paging inside `files[]`.
- Updated the `FsReadInput` signature string and regenerated `packages/workspace/src/generated/workspace.d.ts` and `packages/workspace/TOOLS.md`.
- Added a focused facade test covering mixed top-level `offset`, `limit`, `from`, and `to` with `files[]`.

## validation evidence

- Red: `bun x vitest run packages/workspace/tests/facade/facade.test.ts --testNamePattern 'mixed fs read'` failed because mixed `files[] + offset` was accepted; trace `trc_495731a8ebb7`.
- Green: `bun x vitest run packages/workspace/tests/facade/facade.test.ts --testNamePattern 'mixed fs read|fs read page|fs read multi'` passed; trace `trc_8dd7cb64d62e`.
- Generation: `cd packages/workspace && bun run generate-types && bun run generate-docs` passed; trace `trc_f73799451bfd`.
- Focused + audit validation: `bun x vitest run packages/workspace/tests/facade/facade.test.ts --testNamePattern 'mixed fs read|fs read page|fs read multi|validates input for fs.read' && bun x vitest run packages/workspace/tests/audit/audit.test.ts` passed; trace `trc_848b7ace0d8c`.
- Syntax checks passed for schemas, facade test, and generated d.ts; traces `trc_0f9bb25771aa`, `trc_e385b255b0ef`.
- `review.run --base origin/stream/workspace-agents --no-tests` passed with 0 issues; trace `trc_c619793f320d`.
- `verify --base origin/stream/workspace-agents` passed and wrote publish-valid stamp; trace `trc_b7538e64024b`.

- 2026-06-16 07:36:34 append: `.task/workspace-agents/reject-mixed-fs-read-pagination/workpad.md`

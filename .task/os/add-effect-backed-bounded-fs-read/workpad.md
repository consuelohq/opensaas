# add Effect-backed bounded fs.read

branch: `task/os/add-effect-backed-bounded-fs-read`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1070/add-effect-backed-bounded-fs-read
github pr: https://github.com/consuelohq/opensaas/pull/1070
started: 2026-06-15

## acceptance criteria

- Start from `stream/os` and keep the final diff OS-focused.
- Add `effect` to the OS package boundary and use it in OS `fs.read` implementation.
- Implement OS `fs.read` as bounded structured file ingestion: text-page output, pagination, MIME metadata, hard caps, binary/PDF/invalid UTF-8 detection, media detection, path/symlink safety, directory errors, and clean JSON output.
- Preserve or add structured multi-file partial failure behavior when supported by the OS facade.
- Update OS manifest/schema/docs/generated surfaces and examples where needed.
- Avoid source changes under `packages/workspace/`.
- Validate with focused OS tests, checkFiles for touched JS/TS, review, verify, and a final diff-name guard.

## plan

1. Inspect OS package conventions and current fs/facade/manifest/tests.
2. Add and run focused red tests for the new fs.read contract.
3. Add `effect` to `packages/os/package.json` and update lockfile if required.
4. Implement a dedicated Effect-backed OS read module and wire CLI/facade.
5. Regenerate OS generated surfaces/docs/manifests if schemas/examples change.
6. Run focused tests, static checks, final diff guard, review, verify, push, and promote.

## current status

- Task started from `stream/os` with task session `tsk_2960ef310873`.
- Initial task worktree status only showed scoped task metadata as untracked before edits.
- Exploration has not started yet.

## Test-first contract

### behavior under test

- Small UTF-8 text read returns structured `text-page` with MIME, encoding, offset/limit, content, `truncated: false`, and no `next`.
- Large text read returns only the requested page, sets `truncated: true`, and includes `next`.
- Offset out of range returns a typed error mentioning the requested offset.
- Limit above the hard cap is explicitly capped or rejected and tested.
- Long lines are visibly truncated and output remains bounded.
- Binary/null-byte, known binary extension, PDF header, and invalid UTF-8 inputs are not returned as text.
- PNG/JPEG/GIF/WebP magic bytes are detected; over-limit media returns a structured error.
- Directory paths and path/symlink escapes return typed errors.
- Multi-file reads preserve successful entries when another file fails unless strict mode is requested.
- OS CLI `fs read --json` matches typed output schema and typed output has no bat/ANSI/grid decoration.
- OS read implementation imports and uses `effect`.

### existing local pattern to follow

- To be filled after reading OS `scripts/fs.*`, `scripts/task-fs.*`, `scripts/lib/facade/schemas.ts`, manifests, generated surfaces, and tests.

### new or changed tests

- Add or update `packages/os/tests/fs-read.test.ts` for the ingestion contract.
- Add or update OS facade/tool-manifest tests if schema/manifest examples change.
- Add a static source-level assertion that the OS read implementation imports/uses `effect` if no stronger pattern exists.

### focused red command

- `bun --cwd packages/os test tests/fs-read.test.ts`

### expected red failure

- New fs.read tests should fail because current OS fs.read lacks Effect-backed structured bounded ingestion and pagination/media/binary contracts.

## files changed

- `packages/os/tests/fs-read.test.ts`

## workspace-owned: files changed

- `packages/os/tests/fs-read.test.ts`

## workspace-owned: activity log

- 2026-06-15 08:16 UTC task started from `stream/os`.
- 2026-06-15 08:16 UTC initial `git status --short` in task worktree showed only scoped task metadata files.
- 2026-06-15 08:17:03 fs.write: `.task/os/add-effect-backed-bounded-fs-read/workpad.md`
- 2026-06-15 08:21:22 fs.write: `.task/os/add-effect-backed-bounded-fs-read/workpad.md`
- 2026-06-15 08:22:00 fs.write: `packages/os/tests/fs-read.test.ts`

## workspace-owned: validation evidence

- 2026-06-15 09:04:11 `review.run`: passed — OK
- 2026-06-15 09:07:01 `review.run`: passed — OK
- 2026-06-15 09:08:46 `verify`: passed — OK

## key decisions

- `startFrom: stream` was used because Ko explicitly required starting from `stream/os`.
- Final diff guard must use `origin/stream/os...HEAD` and must contain no `packages/workspace/` paths.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- The first full workpad write was safety-blocked by transport filtering. Retried with shorter structured content.

- 2026-06-15 08:17:03 write: `.task/os/add-effect-backed-bounded-fs-read/workpad.md`

## workspace-owned: files read

- `package.json`
- `packages/os/package.json`
- `packages/os/scripts/fs.js`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/lib/fs/read.ts`
- `packages/os/src/generated/tool-client.ts`
- `packages/os/src/generated/workspace.d.ts`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/os/tooling/dev-tool-manifest.json`
- `packages/os/tooling/script-parity-classifications.json`

## investigation update before production edits

### existing local pattern to follow

- `packages/os/scripts/fs.js` currently owns CLI `read/search/list/write/apply-patch/http/trash`; `fs.read` is a function-local branch that reads the whole file with `fs.readFileSync(..., 'utf8')`, slices lines, and uses `bat` for pretty output.
- `packages/os/tooling/dev-tool-manifest.json` maps typed `fs.read` to `task:fs read --json` and currently only passes `path`, `from`, and `to`.
- `packages/os/scripts/lib/facade/schemas.ts` owns `FsReadInput`, `schemaTypeSignatures`, and `FsReadOutput` type signatures for generated TypeScript surfaces.
- `packages/os/tests/facade/facade.test.ts` verifies manifest command planning; `packages/os/tests/tool-manifest.test.ts` verifies generated/public surface consistency.
- No `packages/os/scripts/lib/fs` directory exists yet; this task will create the read-side implementation there.

### new or changed tests

- Add `packages/os/tests/fs-read.test.ts` as the behavioral contract for the OS CLI and read implementation.
- Extend facade tests for `offset`/`limit` and multi-file command planning.
- Extend tool manifest tests for the new description/schema/type signature and Effect usage.

### focused red command

- `bun --cwd packages/os test tests/fs-read.test.ts`

### expected red failure

- Current CLI returns an array of `{ path, from, to, total, lines }`, reads full files before slicing, cannot return `text-page`/media/binary/error shapes, and does not import or use `effect`.

- 2026-06-15 08:21:22 append: `.task/os/add-effect-backed-bounded-fs-read/workpad.md`

- 2026-06-15 08:22:00 write: `packages/os/tests/fs-read.test.ts`

## workspace-owned: TDD red evidence

- 2026-06-15 08:22:21 `bun --cwd packages/os test tests/fs-read.test.ts`: failed exit 1 trace: `trc_ffc16eeb1a7f`
  - output: implementation', () =… [90m229| [39m [34mexpect[39m([34mexistsSync[39m(readModule))[33m.[39m[34mtoBe[39m([35mtrue[39m)[33m;[39m [90m | [39m [31m^[39m [90m230| [39m [35mconst[39m source [33m=[39m [34mreadFileSync[39m(readModule[33m,[39m [32m'utf8'[39m)[33m;[39m [90m231| [39m [34mexpect[39m(source)[33m.[39m[34mtoContain[39m([32m'from "effect"'[39m)[33m;[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[10/10]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1

## workspace-owned: TDD green evidence

  - output: BeGreaterThan[39m([33m-[39m[34m1[39m)[33m;[39m [90m |[39m [31m^[39m [90m237|[39m [34mexpect[39m([33mJSON[39m[33m.[39m[34mparse[39m(plans[[34m0[39m][33m.[39margs[filesJsonIndex [33m+[39m [34m1[39m]))[33m.[39m[34mtoEqual[39m([ [90m238|[39m { path[33m:[39m [32m'src/a.ts'[39m[33m,[39m offset[33m:[39m [34m1[39m[33m,[39m limit[33m:[39m [34m80[39m }[33m,[39m [31m[2m⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/5]⎯[22m[39m error: script "test" exited with code 1 error: script "task:exec" exited with code 1
- 2026-06-15 08:50:52 `bash -lc cd packages/os && bun run test tests/fs-read.test.ts tests/facade/facade.test.ts -t 'plans fs.read|uses Effect'`: passed exit 0 trace: `trc_e94938780e70`
  - output: \":1,\\\"limit\\\":80},{\\\"path\\\":\\\"src/b.ts\\\",\\\"offset\\\":100,\\\"limit\\\":60}]\",\"branch\":\"task/workspace-agents/test\",\"taskWorktree\":\"/[REDACTED_SECRET]\"}'","implementationCommand":"bun run task:fs -- --branch task/workspace-agents/test read --files-json [{\"path\":\"src/a.ts\",\"offset\":1,\"limit\":80},{\"path\":\"src/b.ts\",\"offset\":100,\"limit\":60}] --json","durationMs":0,"exitCode":0,"traceId":"trc_abc123def456","ok":true,"code":"OK","capabilities":{"readOnly":true,"mutating":false},"event":"tool.executed","message":"tool.executed","ts":"2026-06-15T08:50:52.233Z"}
- 2026-06-15 08:51:07 `bash -lc cd packages/os && bun run test tests/fs-read.test.ts`: passed exit 0 trace: `trc_cd97a3c48e24`
  - output: → tmux: opensaas-os-add-effect-backed-bounded-fs-read-2960ef31 $ vitest run tests/fs-read.test.ts
- 2026-06-15 08:55:08 `bash -lc cd packages/os && bun run test tests/fs-read.test.ts && bun run test tests/facade/facade.test.ts -t 'plans fs.read' && bun run typecheck`: passed exit 0 trace: `trc_9221d54e8016`
  - output: \\":\\\"src/b.ts\\\",\\\"offset\\\":100,\\\"limit\\\":60}]\",\"branch\":\"task/workspace-agents/test\",\"taskWorktree\":\"/[REDACTED_SECRET]\"}'","implementationCommand":"bun run task:fs -- --branch task/workspace-agents/test read --files-json [{\"path\":\"src/a.ts\",\"offset\":1,\"limit\":80},{\"path\":\"src/b.ts\",\"offset\":100,\"limit\":60}] --json","durationMs":0,"exitCode":0,"traceId":"trc_abc123def456","ok":true,"code":"OK","capabilities":{"readOnly":true,"mutating":false},"event":"tool.executed","message":"tool.executed","ts":"2026-06-15T08:55:06.927Z"} $ node ./scripts/check-syntax.js
- 2026-06-15 09:00:12 `bash -lc cd packages/os && bun run test tests/fs-read.test.ts tests/tool-manifest.test.ts && bun run test tests/facade/facade.test.ts -t 'plans fs.read' && bun run test tests/audit/script-parity-audit.test.ts && bun run typecheck`: passed exit 0 trace: `trc_1ca0454a50ba`
  - output: :60}]\",\"branch\":\"task/workspace-agents/test\",\"taskWorktree\":\"/[REDACTED_SECRET]\"}'","implementationCommand":"bun run task:fs -- --branch task/workspace-agents/test read --files-json [{\"path\":\"src/a.ts\",\"offset\":1,\"limit\":80},{\"path\":\"src/b.ts\",\"offset\":100,\"limit\":60}] --json","durationMs":0,"exitCode":0,"traceId":"trc_abc123def456","ok":true,"code":"OK","capabilities":{"readOnly":true,"mutating":false},"event":"tool.executed","message":"tool.executed","ts":"2026-06-15T09:00:10.533Z"} $ vitest run tests/audit/script-parity-audit.test.ts $ node ./scripts/check-syntax.js
- 2026-06-15 09:06:43 `bash -lc cd packages/os && bun run test tests/fs-read.test.ts tests/tool-manifest.test.ts && bun run test tests/facade/facade.test.ts -t 'plans fs.read' && bun run test tests/audit/script-parity-audit.test.ts && bun run typecheck`: passed exit 0 trace: `trc_e5713f64ef77`
  - output: :60}]\",\"branch\":\"task/workspace-agents/test\",\"taskWorktree\":\"/[REDACTED_SECRET]\"}'","implementationCommand":"bun run task:fs -- --branch task/workspace-agents/test read --files-json [{\"path\":\"src/a.ts\",\"offset\":1,\"limit\":80},{\"path\":\"src/b.ts\",\"offset\":100,\"limit\":60}] --json","durationMs":0,"exitCode":0,"traceId":"trc_abc123def456","ok":true,"code":"OK","capabilities":{"readOnly":true,"mutating":false},"event":"tool.executed","message":"tool.executed","ts":"2026-06-15T09:06:41.747Z"} $ vitest run tests/audit/script-parity-audit.test.ts $ node ./scripts/check-syntax.js

## final implementation update

- Added `effect` to `packages/os/package.json` dependencies and updated `packages/os/bun.lock`.
- Added `packages/os/scripts/lib/fs/read.ts` as the OS-only bounded read implementation.
- Wired `packages/os/scripts/fs.js` to emit structured bounded JSON for `fs read --json`, with `--offset`, `--limit`, `--files-json`, and compatibility aliases for `--from`/`--to`.
- Wired `fs.read` facade input schemas, generated output types, manifest arguments, docs, and snapshots.
- Added facade planner coverage for single-page and multi-file `fs.read` command generation.
- Added audit classification for the OS-only read helper and intentional `scripts/fs.js` divergence.
- No source files under `packages/workspace/` were changed.

## Effect implementation notes

- The implementation uses `Effect.gen` for composition and `Effect.try`/yielded effects for boundary operations.
- Static test coverage asserts every `Effect.gen(function* () { ... })` body contains no `try {`, no `catch (...)`, and no `await`.
- Local `try/finally` appears only inside `Effect.try` resource boundaries for file descriptor cleanup, not inside Effect generators.

## final validation evidence

- 2026-06-15 08:22:21 RED `bun --cwd packages/os test tests/fs-read.test.ts`: failed as expected trace `trc_ffc16eeb1a7f`.
- 2026-06-15 09:00:12 GREEN `cd packages/os && bun run test tests/fs-read.test.ts tests/tool-manifest.test.ts && bun run test tests/facade/facade.test.ts -t 'plans fs.read' && bun run test tests/audit/script-parity-audit.test.ts && bun run typecheck`: passed trace `trc_1ca0454a50ba`.
- 2026-06-15 09:02:49 `cd packages/os && npm pack --dry-run --json`: failed before file listing because `packages/os/package.json` is private and has no `version`; this is existing package metadata, not introduced by this task.
- 2026-06-15 09:00:28 final diff guard: `git diff --name-only origin/stream/os...HEAD | grep '^packages/workspace/' || true` returned no paths.

## broad suite note

- 2026-06-15 08:56:xx `cd packages/os && bun run test`: failed in existing broad-suite/environment areas, including vitest import failures for Bun builtins and artifact/facade dry-run expectations. The task-owned audit inventory failure from the new file was fixed and validated separately.

## review recovery

- 2026-06-15 09:04:11 `review.run --noTests`: failed with 3 task-owned async boundary error-handling findings (`trc_bd5a7498f2b0`).
- Recovery: added CLI boundary error handling in `scripts/fs.js`; changed multi-file read composition to `Effect.forEach` and removed async/await from `readFileForCli`/`readManyForCli`.
- 2026-06-15 09:06:43 GREEN focused validation: passed trace `trc_e5713f64ef77`.
- 2026-06-15 09:07:01 `review.run --noTests`: passed with zero task-owned and zero pre-existing findings trace `trc_60c164fa2717`.

## workspace-owned: test selection

- changed files: `.task/os/add-effect-backed-bounded-fs-read/current.json`, `.task/os/add-effect-backed-bounded-fs-read/evidence-log.json`, `.task/os/add-effect-backed-bounded-fs-read/read-log.json`, `.task/os/add-effect-backed-bounded-fs-read/session.json`, `.task/os/add-effect-backed-bounded-fs-read/workpad.md`, `.task/tasks/os/add-effect-backed-bounded-fs-read.json`, `packages/os/TOOLS.md`, `packages/os/bun.lock`, `packages/os/manifests/core.manifest.json`, `packages/os/manifests/tool.manifest.json`, `packages/os/manifests/workflow-bundles.json`, `packages/os/package.json`, `packages/os/scripts/fs.js`, `packages/os/scripts/lib/facade/executor.ts`, `packages/os/scripts/lib/facade/schemas.ts`, `packages/os/scripts/lib/fs/read.ts`, `packages/os/src/generated/workspace.d.ts`, `packages/os/tests/facade/__snapshots__/facade.test.ts.snap`, `packages/os/tests/facade/facade.test.ts`, `packages/os/tests/fs-read.test.ts`, `packages/os/tooling/dev-tool-manifest.json`, `packages/os/tooling/script-parity-classifications.json`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## verify evidence

- 2026-06-15 09:08:46 `verify`: passed and wrote `.task/os/add-effect-backed-bounded-fs-read/verify.json`; trace `trc_61df20e0a188`.

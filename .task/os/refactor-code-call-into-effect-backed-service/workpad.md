# refactor code call into effect backed service

branch: `task/os/refactor-code-call-into-effect-backed-service`
stream: `stream/os`
source: `stream/os`
taskSession: `tsk_23b6559b820d`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1122/refactor-code-call-into-effect-backed-service
github pr: https://github.com/consuelohq/opensaas/pull/1122
started: 2026-06-18

## acceptance criteria

- OS-only implementation diff under `packages/os/**` plus task workpad metadata.
- Preserve public `code.call` input/output contract and keep `executeCodeCall(input, context)` as the stable exported API.
- Move code-call internals from the monolithic runtime into Effect-backed service modules.
- Use `Effect.gen` for service orchestration; keep generator bodies free of `await` and broad `try/catch`.
- Wrap sync external boundaries with `Effect.try` and async external boundaries with `Effect.promise` or `Effect.tryPromise`.
- Keep expected operational failures typed and mapped into the existing tool-result envelope at the adapter boundary.
- Split service responsibilities for schema/input normalization, location safety, source/stdin staging, policy validation, runtime provider registry, process execution, mutation snapshots, and output/log handling.
- Preserve language support and aliases: Python, Bun, Bash, `node`, `javascript`, `typescript`, `py`, `sh`, and existing aliases.
- Preserve modes: `read`, `verify`, `edit`.
- Preserve behavior for unsupported language, invalid source/stdin shapes, path escape, edit gating, shell transport mistakes, destructive shell blocking, timeout, missing runtime, non-zero exit, mutation in read/verify mode, bounded output, log paths, `filesChanged`, `traceId`, `durationMs`, and `exitCode`.
- Add a proof test that `code.call` with Bun can call `packages/os/scripts/fs.js read ... --json`.
- Do not remove OS fs runtime modules.
- Do not change `packages/workspace/**` in this task branch.
- Do not change core manifest trimming or expand the public tool surface unless generation is required by source schema/manifest changes.

## source packet evidence

- `Writing Effect Code` was read with `context.get`; trace `trc_40ed856e2b5c`.
- The packet’s model: `code.call` is the agent syscall; Effect services are the standard-library architecture underneath it.
- Referenced bundles will be read with `context.get` only if source details are needed. `context.search` is intentionally unused per Ko’s instruction.

## stream/task evidence

- Initial stream context trace: `trc_cb6c08e379f3`.
- Initial `stream.sync` before Ko’s local merge hit conflicts: `trc_eccbe31ef1df`.
- Retry after Ko’s local merge still found the stream worktree dirty/conflicted outside this task: `trc_3cc5b96b2759`.
- Task start succeeded from `stream/os` source sha `6b9d18cd`; trace `trc_7de322fbaad4`.
- Note: the implementation task branch is isolated. The root `stream/os` worktree has pre-existing merge/conflict state that is outside this task branch.

## exploration summary

- Mandatory coding standards read completely; traces `trc_0cc3a310fec8` and `trc_76fe385c8212`.
- Current implementation is `packages/os/scripts/lib/code-call/runtime.ts`, a 797-line monolith owning language aliases, location checks, source staging, policy, spawning, snapshots, truncation, and envelope construction.
- Current public types live in `packages/os/scripts/lib/code-call/types.ts`; `executeCodeCall(input, context)` is imported by the facade executor and CLI.
- Current tests already cover core behavior in `packages/os/tests/code-call.test.ts` and parity checks in `packages/os/tests/code-call-parity.test.ts`.
- Facade tests cover task-session routing for `code.call`, including read without ambient task selection and edit inside explicit task worktree.
- OS fs service references (`read.ts`, `write.ts`, `search.ts`) use Effect at runtime boundaries and return typed result/error values.
- Manifest/docs/type surfaces already describe `code.call`; no schema/manifest changes are planned unless implementation forces regeneration.

## current ownership

- Implementation owner: OS package only.
- Stable API: `executeCodeCall(input, context)` from `packages/os/scripts/lib/code-call/runtime.ts`.
- Facade adapter: `packages/os/scripts/lib/facade/executor.ts` delegates internal `code.call` to `executeCodeCall`.
- Public schemas: `packages/os/scripts/lib/facade/schemas.ts` already validates `CodeCallInput` shape.

## target architecture

```text
packages/os/scripts/lib/code-call/
  types.ts
  errors.ts
  schema.ts
  location.ts
  source.ts
  policy.ts
  runtimes.ts
  process.ts
  snapshot.ts
  output.ts
  service.ts
  runtime.ts
```

`runtime.ts` should become a thin stable export/adapter. `service.ts` should orchestrate the modules with `Effect.gen`. Provider-specific details can live in `runtimes.ts` unless separate `runtimes/bun.ts`, `runtimes/python.ts`, and `runtimes/bash.ts` files become clearer during implementation.

## TDD red contract

Add tests before production edits:

1. Static architecture test requiring code-call service modules to exist and import/use `effect`.
2. Static Effect discipline test ensuring `Effect.gen(function* () { ... })` bodies in code-call modules contain no `await` and no broad `try/catch`.
3. Behavior characterization tests for additional public contracts: unsupported language, invalid source/stdin shape, file path escape, non-zero process exit, runtime missing, unsafe bash blocking, and OS fs script invocation through Bun.

Expected red failure:

- Static architecture tests fail before implementation because the service modules do not exist and `runtime.ts` is still the monolithic implementation.
- Behavior characterization tests should pass or expose current gaps; any exposed gap must be recorded before changing production code.

Focused red command:

```bash
bun --cwd packages/os test tests/code-call.test.ts tests/code-call-parity.test.ts tests/code-call-service-architecture.test.ts
```

## implementation notes

- Keep envelope construction compatible with the current `ToolResult<CodeCallData>` shape.
- Keep existing mistake-class strings stable.
- Use typed `CodeCallServiceError` values internally and map them once at the boundary.
- Keep stdout/stderr truncation bounded and preserve full log paths on truncation.
- Keep source stage cleanup behavior: preserve staged dir only when full logs need to remain available.
- Preserve task-routed edit-mode behavior from the prior code-call task.

## validation plan

- Focused code-call red command after test edits.
- Focused green command after implementation:

```bash
bun --cwd packages/os test tests/code-call.test.ts tests/code-call-parity.test.ts tests/code-call-service-architecture.test.ts tests/facade/facade.test.ts
bun --cwd packages/os run typecheck
```

- Final gates:
  - `review.run` against `origin/stream/os` with `noTests: true`.
  - `verify` against `origin/stream/os`.
  - Diff inspection confirming OS-only changes.

## validation evidence

- Focused red command after test edits: trace `trc_1940175916e1`. Result: 24 behavior/parity tests passed; architecture test failed because `errors.ts` and the service modules did not exist yet.
- Focused green code-call suite: trace `trc_33d47457e068`. Result: `bun --cwd packages/os test tests/code-call.test.ts tests/code-call-parity.test.ts tests/code-call-service-architecture.test.ts` passed 25 tests.
- Batch validation: trace `trc_09984ce77cb6`. Result: focused tests including `tests/facade/facade.test.ts` passed 580 tests. The batch typecheck step used a Bun form that printed help with exit 0, so it was treated as inconclusive.
- Valid typecheck: trace `trc_58347004145c`. Result: `bun --cwd packages/os typecheck` ran `node ./scripts/check-syntax.js` and passed.
- Task worktree diff check through `code.call`: trace `trc_76727f1b803b`. Result: changed files are OS code-call modules/tests plus task metadata; no `packages/workspace/**` files.

## red evidence

- `trc_1940175916e1`: expected red failure. `tests/code-call.test.ts` and `tests/code-call-parity.test.ts` passed, while `tests/code-call-service-architecture.test.ts` failed on missing service modules.

## green evidence

- `trc_33d47457e068`: focused code-call suite passed 25 tests.
- `trc_09984ce77cb6`: batch run passed focused code-call/parity/architecture/facade tests, 580 tests total.
- `trc_58347004145c`: OS typecheck passed.

## files changed

- `.task/os/refactor-code-call-into-effect-backed-service/workpad.md`
- `.task/tasks/os/refactor-code-call-into-effect-backed-service.json`
- `packages/os/scripts/lib/code-call/errors.ts`
- `packages/os/scripts/lib/code-call/location.ts`
- `packages/os/scripts/lib/code-call/output.ts`
- `packages/os/scripts/lib/code-call/policy.ts`
- `packages/os/scripts/lib/code-call/process.ts`
- `packages/os/scripts/lib/code-call/runtime.ts`
- `packages/os/scripts/lib/code-call/runtimes.ts`
- `packages/os/scripts/lib/code-call/schema.ts`
- `packages/os/scripts/lib/code-call/service.ts`
- `packages/os/scripts/lib/code-call/snapshot.ts`
- `packages/os/scripts/lib/code-call/source.ts`
- `packages/os/tests/code-call-parity.test.ts`
- `packages/os/tests/code-call-service-architecture.test.ts`
- `packages/os/tests/code-call.test.ts`

## remaining risks

- The root `stream/os` worktree has pre-existing merge conflicts from stream synchronization. This task branch is isolated from that dirty root state, but final promotion may still require stream-level cleanup.

---

## publish checklist

```bash
bun run task:push -- --message "refactor(os): move code call to effect service architecture" --changed
bun run task:pr -- --ready
bun run task:finish
```
- 2026-06-18 02:25:23 write: `.task/os/refactor-code-call-into-effect-backed-service/workpad.md`

## workspace-owned: files changed

- `.task/os/refactor-code-call-into-effect-backed-service/workpad.md`

## workspace-owned: activity log

- 2026-06-18 02:25:23 fs.write: `.task/os/refactor-code-call-into-effect-backed-service/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/fs.js`

## workspace-owned: validation evidence

- Focused red command after test edits: trace `trc_1940175916e1`. Result: 24 behavior/parity tests passed; architecture test failed because `errors.ts` and the service modules did not exist yet.
- Focused green code-call suite: trace `trc_33d47457e068`. Result: `bun --cwd packages/os test tests/code-call.test.ts tests/code-call-parity.test.ts tests/code-call-service-architecture.test.ts` passed 25 tests.
- Batch validation: trace `trc_09984ce77cb6`. Result: focused tests including `tests/facade/facade.test.ts` passed 580 tests. The batch typecheck step used a Bun form that printed help with exit 0, so it was treated as inconclusive.
- Valid typecheck: trace `trc_58347004145c`. Result: `bun --cwd packages/os typecheck` ran `node ./scripts/check-syntax.js` and passed.
- Task worktree diff check through `code.call`: trace `trc_76727f1b803b`. Result: changed files are OS code-call modules/tests plus task metadata; no `packages/workspace/**` files.
- 2026-06-18 02:40:27 `review.run`: passed — OK
- 2026-06-18 02:40:37 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os/refactor-code-call-into-effect-backed-service/current.json`, `.task/os/refactor-code-call-into-effect-backed-service/evidence-log.json`, `.task/os/refactor-code-call-into-effect-backed-service/read-log.json`, `.task/os/refactor-code-call-into-effect-backed-service/session.json`, `.task/os/refactor-code-call-into-effect-backed-service/workpad.md`, `.task/tasks/os/refactor-code-call-into-effect-backed-service.json`, `packages/os/scripts/lib/code-call/errors.ts`, `packages/os/scripts/lib/code-call/location.ts`, `packages/os/scripts/lib/code-call/output.ts`, `packages/os/scripts/lib/code-call/policy.ts`, `packages/os/scripts/lib/code-call/process.ts`, `packages/os/scripts/lib/code-call/runtime.ts`, `packages/os/scripts/lib/code-call/runtimes.ts`, `packages/os/scripts/lib/code-call/schema.ts`, `packages/os/scripts/lib/code-call/service.ts`, `packages/os/scripts/lib/code-call/snapshot.ts`, `packages/os/scripts/lib/code-call/source.ts`, `packages/os/tests/code-call-parity.test.ts`, `packages/os/tests/code-call-service-architecture.test.ts`, `packages/os/tests/code-call.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional


## review / verify evidence

- `trc_d44ac13be7e5`: `review.run --base origin/stream/os --no-tests` passed with 0 own issues, 0 pre-existing issues, 0 failed suites, and 0 blocking issues.
- `trc_cbf36f9872af`: `verify --base origin/stream/os` passed and wrote a publish-valid stamp to `.task/os/refactor-code-call-into-effect-backed-service/verify.json`.

## OS-only confirmation

- `trc_76727f1b803b`: task worktree status/diff showed only `packages/os/**` implementation/tests and `.task/**` metadata. No `packages/workspace/**` files changed in this task branch.

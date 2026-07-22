# port os fs search and code call parity

## Acceptance criteria

- Start from `stream/workspace-agents` because this task follows unshipped workspace-agent stream work.
- Port current OS `fs.search` behavior into workspace without modifying `packages/os/**`.
- Add workspace tests proving structured ripgrep JSON output, no-match output, include glob filtering, single-file targets, truncation, path alias support, path + paths rejection, `--then-read --json` composition with bounded `fs.read`, and absence of stale inline search read slicing.
- Update workspace facade contract, manifest, generated types, and docs for `fs.search`.
- Compare OS/workspace `code.call` runtime and tests, then port only still-valid parity changes while preserving workspace-specific task routing/server integration.
- Run focused red tests first, focused green tests, generation, syntax checks, audit/review/verify against `origin/stream/workspace-agents`, and confirm no `packages/os/**` changes.
- Push task branch and promote into the existing stream review PR.

## Initial assumptions

- OS implementation on this task branch is the behavior source because `stream/workspace-agents` already includes the latest OS merge.
- Workspace MCP tools are currently returning `CONSUELO_AUTH_REQUIRED`; local Consuelo OS workspace scripts are the scoped fallback for this task until MCP auth is restored.
- The fallback must stay scoped to the task worktree and avoid direct edits in the main checkout.

## Tooling gap

- `workspace.get_steering`, `workspace.refresh_steering`, and a minimal `workspace.call` probe failed over MCP with HTTP 401 `CONSUELO_AUTH_REQUIRED`.
- Local `bun run doctor` in `~/.consuelo/os` reported the portal could return steering, so steering was retrieved through the local OS portal fallback.
- Required `senior-engineer.md` and `task.md` full-read checks were run through the local `code-call` runner with `fullReadMatchesStat: true`.
- Task lifecycle is using local Consuelo OS scripts from the task worktree as the closest available workspace facade path.

## Test-first contract

Behavior under test:
- Workspace `fs.search` should match current OS structured ripgrep behavior, including typed JSON output shape `type: "search-results"`, path alias handling, max result truncation, and `--then-read` composed through bounded `fs.read`.
- Workspace facade should accept `path` as an alias for `paths`, reject `path` and `paths` together, and expose generated signatures/docs consistent with the manifest.
- Workspace `code.call` should retain workspace-specific routing while matching still-valid OS runtime behavior and tests.

Existing local pattern to follow:
- Copy/adapt `packages/os/scripts/lib/fs/search.ts` and `packages/os/tests/fs-search.test.ts` as the source of truth.
- Follow existing workspace facade schema/executor tests in `packages/workspace/tests/facade/facade.test.ts`.
- Compare `packages/os/scripts/lib/code-call/runtime.ts` and `packages/workspace/scripts/lib/code-call/runtime.ts` before editing workspace code-call.

New or changed tests:
- Add `packages/workspace/tests/fs-search.test.ts` first.
- Update `packages/workspace/tests/facade/facade.test.ts` for `fs.search` alias/rejection behavior.
- Update `packages/workspace/tests/code-call.test.ts` only if parity review proves code-call changes are needed.

Focused red command:
- `bun --cwd packages/workspace test tests/fs-search.test.ts tests/facade/facade.test.ts`

Expected red failure:
- `packages/workspace/scripts/lib/fs/search.ts` does not exist yet.
- `fs.search --json` still returns old shape/behavior.
- Facade lacks the OS `path` alias and `path + paths` rejection.
- `--then-read` still uses inline search-time slicing instead of bounded `fs.read`.

## Plan

1. Inspect OS source/tests and current workspace fs/code-call/facade registry files.
2. Add failing workspace fs-search and facade tests before production edits.
3. Run focused red command and record failure.
4. Port/adapt OS fs search module and make workspace CLI wrapper thin.
5. Update workspace facade schema/executor/manifest/generated docs/types.
6. Compare code.call deltas and port only still-valid changes/tests.
7. Run focused green tests, generation, stale checks, audit/review/verify.
8. Push task branch and promote stream PR.

## Files changed

- `packages/workspace/src/generated/workspace.d.ts`
- `packages/workspace/tests/facade/__snapshots__/facade.test.ts.snap`
- `packages/workspace/TOOLS.md`

## Validation

- Pending red run.

## Red run evidence

Command:
- `bun --cwd packages/workspace test tests/fs-search.test.ts tests/facade/facade.test.ts`

Result:
- Red as expected. `tests/fs-search.test.ts` failed because JSON output was old/non-object, no-match returned `no matches`, `--then-read --json` was not structured, and `packages/workspace/scripts/lib/fs/search.ts` was missing.
- Facade red failures covered the new `fs.search` path alias and path+paths rejection tests.
- Existing facade suite also showed preexisting path issues when run from this temp task worktree (`packages/workspace/packages/workspace/scripts/fs.js`) plus snapshot churn; the snapshot mutation was restored from HEAD before implementation.
- Local `code.call` verify reported mutation because Vitest touched snapshots; artifact was cleaned and status rechecked.

## workspace-owned: files read

- `packages/workspace/TOOLS.md`
- `packages/workspace/package.json`
- `packages/workspace/scripts/generate-docs.ts`
- `packages/workspace/scripts/generate-types.ts`
- `packages/workspace/scripts/lib/code-call/runtime.ts`
- `packages/workspace/src/generated/workspace.d.ts`
- `packages/workspace/tests/code-call.test.ts`
- `packages/workspace/tests/fs-apply-patch.test.ts`
- `packages/workspace/tooling/tool-manifest.json`

## workspace-owned: files changed

- `packages/workspace/src/generated/workspace.d.ts`
- `packages/workspace/tests/facade/__snapshots__/facade.test.ts.snap`
- `packages/workspace/TOOLS.md`

## workspace-owned: activity log

- 2026-06-17 03:55:05 fs.write: `packages/workspace/src/generated/workspace.d.ts`
- 2026-06-17 03:55:09 write: `packages/workspace/TOOLS.md`
- 2026-06-17 03:55:09 fs.write: `packages/workspace/TOOLS.md`
- 2026-06-17 03:56:30 fs.write: `packages/workspace/tests/facade/__snapshots__/facade.test.ts.snap`
- 2026-06-17 03:57:24 fs.write: `.task/workspace-agents/port-os-fs-search-and-code-call-parity/workpad.md`
- 2026-06-17 03:58:19 fs.write: `.task/workspace-agents/port-os-fs-search-and-code-call-parity/workpad.md`

## workspace-owned: validation evidence

- 2026-06-17 03:55:52 `checkFiles`: failed — COMMAND_FAILED
- 2026-06-17 03:56:30 write: `packages/workspace/tests/facade/__snapshots__/facade.test.ts.snap`
- 2026-06-17 03:56:38 `audit`: failed — COMMAND_FAILED
- 2026-06-17 03:57:55 `review.run`: passed — OK
- 2026-06-17 03:58:10 `verify`: passed — OK

## Final implementation notes

Implemented:
- Added `packages/workspace/scripts/lib/fs/search.ts` by adapting the current OS Effect-backed ripgrep structured search service.
- Replaced the legacy inline workspace `fs.js search` path with a thin async wrapper around `runSearchForCli` / `formatSearchOutput`.
- Updated the facade schema/executor so `fs.search` supports `path`, keeps `paths`, rejects both together, and caps `maxResults` at 200.
- Updated manifest examples plus generated `TOOLS.md` and `src/generated/workspace.d.ts` for the new `fs.search` / `code.call` signatures.
- Ported still-valid code.call parity: managed task worktree edit gating, task env propagation, non-task branch rejection, edit dry-run rejection, and edit-mode mutation allowance.
- Added focused tests for structured fs.search behavior and code.call parity.

Final files changed:
- `.task/tasks/workspace-agents/port-os-fs-search-and-code-call-parity.json`
- `.task/workspace-agents/port-os-fs-search-and-code-call-parity/evidence-log.json`
- `.task/workspace-agents/port-os-fs-search-and-code-call-parity/read-log.json`
- `.task/workspace-agents/port-os-fs-search-and-code-call-parity/workpad.md`
- `packages/workspace/TOOLS.md`
- `packages/workspace/scripts/fs.js`
- `packages/workspace/scripts/lib/code-call/runtime.ts`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/scripts/lib/fs/search.ts`
- `packages/workspace/src/generated/workspace.d.ts`
- `packages/workspace/tests/code-call.test.ts`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/tests/fs-search.test.ts`
- `packages/workspace/tooling/tool-manifest.json`

Green validation:
- `bun --cwd packages/workspace test tests/code-call.test.ts` passed: 14 tests.
- `CI=1 bun --cwd packages/workspace test tests/fs-search.test.ts tests/facade/facade.test.ts -t "workspace fs\.search|plans fs\.search|rejects fs\.search"` passed: 7 selected tests.
- `CI=1 bun --cwd packages/workspace test tests/fs-search.test.ts tests/code-call.test.ts tests/fs-apply-patch.test.ts tests/facade/facade.test.ts -t "workspace fs\.search|plans fs\.search|rejects fs\.search|code\.call runtime|code-call CLI|generated workspace surfaces|workspace tool manifest"` passed: 23 selected tests.
- Generated-surface readback confirmed `taskWorktree?: string`, `branch?: string`, `path?: string`, and `type: "search-results"` in `TOOLS.md` and `workspace.d.ts`.
- `git.diff --files` confirmed no `packages/os/**` changes.

Known validation/tooling failures:
- `checkFiles` failed for every file with `error: Script not found "task:exec"`; the current package has no `task:exec` script.
- `generate.types` / `generate.docs` via workspace facade reported success but did not update the task worktree. Workaround: rendered generated content in read mode to `/tmp` from task worktree sources, then wrote with `fs.write contentFile`.
- Full `CI=1 bun --cwd packages/workspace test` failed on unrelated existing issues: facade fs.write wrapper path assumptions, worker wrapper test, tools-search module path, test-selection registry, and snapshot obsolescence. Snapshot churn from the run was restored from `HEAD`.
- `audit scripts/docs` failed on existing drift: documented scripts include `task:exec` and `trace:analytics`; package scripts include `consuelo-design` as undocumented; docs audit reports broad stale paths.

- 2026-06-17 03:57:24 append: `.task/workspace-agents/port-os-fs-search-and-code-call-parity/workpad.md`

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/port-os-fs-search-and-code-call-parity.json`, `.task/workspace-agents/port-os-fs-search-and-code-call-parity/evidence-log.json`, `.task/workspace-agents/port-os-fs-search-and-code-call-parity/read-log.json`, `.task/workspace-agents/port-os-fs-search-and-code-call-parity/workpad.md`, `packages/workspace/TOOLS.md`, `packages/workspace/scripts/fs.js`, `packages/workspace/scripts/lib/code-call/runtime.ts`, `packages/workspace/scripts/lib/facade/executor.ts`, `packages/workspace/scripts/lib/facade/schemas.ts`, `packages/workspace/scripts/lib/fs/search.ts`, `packages/workspace/src/generated/workspace.d.ts`, `packages/workspace/tests/code-call.test.ts`, `packages/workspace/tests/facade/facade.test.ts`, `packages/workspace/tests/fs-search.test.ts`, `packages/workspace/tooling/tool-manifest.json`
- matched rules: `workspace-facade`, `workspace-audit-docs`
- selected suites: `workspace facade input contracts`, `workspace audit tests`
- run results: `workspace facade input contracts` passed, `workspace audit tests` passed
- failed suites: none

## Publish gate evidence

- `review.run` against `origin/stream/workspace-agents` passed: static rules, eslint, typecheck, and spec compliance; 0 issues.
- `verify` against `origin/stream/workspace-agents` passed with `publishValid: true` and wrote `.task/workspace-agents/port-os-fs-search-and-code-call-parity/verify.json`.
- Verify-selected suites passed: workspace facade input contracts (129 filtered contract tests) and workspace audit tests (1 test).

- 2026-06-17 03:58:19 append: `.task/workspace-agents/port-os-fs-search-and-code-call-parity/workpad.md`

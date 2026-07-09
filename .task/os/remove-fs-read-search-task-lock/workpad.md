# remove fs read search task lock

branch: `task/os/remove-fs-read-search-task-lock`
stream: `stream/os`
source: `stream/os`
taskSession: `tsk_a051c54274f8`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1108/remove-fs-read-search-task-lock

## acceptance criteria

- `fs.read` and `fs.search` are read-only commands that can run without `taskSession` in both `packages/os` and `packages/workspace`.
- Mutating fs commands remain task-scoped.
- No backwards-compatibility shim that treats read-only commands as task-required internally; the architecture should model them as branch-optional/session-optional at the manifest/executor contract.
- Generated docs/types/manifest surfaces are updated from source where needed.
- Focused tests prove the lock is removed for both OS and workspace.
- Push to task branch and promote to `stream/os` review PR.

## initial plan

1. Use context/explore to find the source of the `TASK_SESSION_REQUIRED` gate for fs tools.
2. Read existing OS and workspace facade/manifest/test patterns.
3. Add focused red tests showing `fs.read` and `fs.search` can execute without a task session while `fs.write` remains gated.
4. Change source manifest/executor contracts for OS and workspace in the same architectural pattern.
5. Regenerate generated surfaces.
6. Run focused green tests, review, verify, push, and promote.

## Test-first contract

Behavior under test:

- `workspace.call({ tool: "fs.search", input: ... })` and equivalent OS facade routing no longer returns `TASK_SESSION_REQUIRED` when no task session is supplied.
- `fs.read` follows the same read-only/session-optional contract.
- `fs.write`, `fs.apply_patch`, and other mutating fs commands remain task-session required.
- Manifest/docs/generated type surfaces represent read-only fs commands as `sessionRequired: false` or the package equivalent.

Existing pattern to follow:

- Recent fs/search and code.call task-scoping tests in `packages/os/tests` and `packages/workspace/tests/facade`.
- Tool manifest tests that assert `sessionRequired` and generated surface behavior.

Focused red command:

- Run package tests targeting fs/facade/tool-manifest for `packages/os` and `packages/workspace` after adding tests.

Expected red failure:

- New no-task-session `fs.read` / `fs.search` tests fail with `TASK_SESSION_REQUIRED` or manifest assertions still report read-only fs commands as session-required.

## evidence

- stream context trace: `trc_559bcfc7d009`
- stream sync trace: `trc_9bdef0a059ac`
- task start trace: `trc_38dd54a28b03`

## validation evidence

- pending

- 2026-06-17 05:06:19 write: `.task/os/remove-fs-read-search-task-lock/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-17 05:06:19 fs.write: `.task/os/remove-fs-read-search-task-lock/workpad.md`

## workspace-owned: files read

- `packages/os/manifests/tool.manifest.json`
- `packages/os/package.json`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/os/tooling/dev-tool-manifest.json`
- `packages/workspace/package.json`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/server.py`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/tests/server_call_test.py`
- `packages/workspace/tooling/tool-manifest.json`


## red evidence

- `trc_eea70b38cea9`: focused red tests failed before the manifest contract fix. `fs.read` and `fs.search` returned `TASK_SESSION_REQUIRED` in both workspace and OS facade tests; workspace server test saw `sessionRequired: true`; OS manifest test saw `sessionRequired: true`.

## implementation evidence

- `trc_3477134bde63`: source manifests updated so `fs.read` and `fs.search` are `sessionRequired: false` with `branchMode: optional` in both workspace and OS source manifests.
- `trc_3ddf8c10f724`: regenerated OS full/core manifests, OS docs/types, and workspace docs/types from source manifests.
- `trc_a82a08becc0d`: removed `fs.read` and `fs.search` from generic facade snapshot matrices after they became session-optional; explicit read-only tests now own this contract.

## validation evidence

- `trc_b1ff542709ca`: final targeted validation passed:
  - `bun --cwd packages/workspace test tests/fs-read.test.ts tests/fs-search.test.ts` — 20 tests passed.
  - `bun --cwd packages/workspace test tests/facade/facade.test.ts --testNamePattern "read-only fs tools|mutating task tools"` — read-only fs tools passed without task session; `fs.write` stayed task-session required.
  - `python3 -m unittest packages.workspace.tests.server_call_test.WorkspaceCallServerTest.test_task_scoped_tools_require_task_session packages.workspace.tests.server_call_test.WorkspaceCallServerTest.test_read_only_fs_tools_do_not_require_task_session packages.workspace.tests.server_call_test.WorkspaceCallServerTest.test_session_optional_tools_with_optional_branch_mode_do_not_require_task_session packages.workspace.tests.server_call_test.WorkspaceCallServerTest.test_branch_required_tools_still_require_task_session` — 4 tests passed.
  - `bun --cwd packages/os test tests/fs-read.test.ts tests/fs-search.test.ts tests/facade/facade.test.ts tests/tool-manifest.test.ts` — 586 tests passed.
  - `bun --cwd packages/os typecheck` — passed.

## note

- `trc_9ddfd3cb9ff0`: broader workspace facade run still has unrelated failures around package-cwd script resolution for `tools.search`, `fs.write`, and the worker wrapper. Those failures are outside this change; the targeted workspace read/search and server gating contracts pass.

## workspace-owned: validation evidence

- pending
- 2026-06-17 05:06:19 write: `.task/os/remove-fs-read-search-task-lock/workpad.md`
- 2026-06-17 05:18:01 `review.run`: passed — OK
- 2026-06-17 05:18:17 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/os/remove-fs-read-search-task-lock/current.json`, `.task/os/remove-fs-read-search-task-lock/evidence-log.json`, `.task/os/remove-fs-read-search-task-lock/read-log.json`, `.task/os/remove-fs-read-search-task-lock/session.json`, `.task/os/remove-fs-read-search-task-lock/workpad.md`, `.task/tasks/os/remove-fs-read-search-task-lock.json`, `packages/os/TOOLS.md`, `packages/os/manifests/core.manifest.json`, `packages/os/manifests/tool.manifest.json`, `packages/os/src/generated/workspace.d.ts`, `packages/os/tests/facade/facade.test.ts`, `packages/os/tests/tool-manifest.test.ts`, `packages/os/tooling/dev-tool-manifest.json`, `packages/workspace/TOOLS.md`, `packages/workspace/tests/facade/facade.test.ts`, `packages/workspace/tests/server_call_test.py`, `packages/workspace/tooling/tool-manifest.json`
- matched rules: `workspace-facade`, `workspace-audit-docs`
- selected suites: `workspace facade input contracts`, `workspace audit tests`
- run results: `workspace facade input contracts` passed, `workspace audit tests` passed
- failed suites: none


## review / verify evidence

- `trc_511b302d33bd`: `review.run --no-tests` against `origin/stream/os` passed with 0 issues.
- `trc_0d40cf62daad`: `verify` passed. Registry selected workspace facade input contracts and workspace audit tests, both passed; DB guard passed; publish-valid stamp written.

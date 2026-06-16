# remove task call and fix http no session execution

branch: `task/os/remove-task-call-and-fix-http-no-session-execution`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1063/remove-task-call-and-fix-http-no-session-execution
github pr: https://github.com/consuelohq/opensaas/pull/1063

## what changed

- Removed legacy public task execution entries from OS manifests and generated public surfaces.
- Removed the OS package script that exposed legacy task execution.
- Made `code.call` the canonical execution tool, including explicit task-scoped execution.
- Added task-worktree edit gating and task environment injection for `code.call`.
- Changed HTTP to no branch/session resolution so it cannot hit ambient task selection.
- Updated generated manifests, docs, workspace types, steering, skills, tests, and script parity metadata.
- Kept task lifecycle tools intact and left Mac tooling untouched.

## why

HTTP is top-level network IO and should not participate in task selection. Command execution belongs in `code.call`; task tools should remain lifecycle-only.

## validation

- `tests/code-call.test.ts`: passed, 13 tests.
- Focused facade regressions for HTTP no-session, code-call no implicit task selection, task env injection, edit gating, and mismatched task session: passed, 5 tests.
- Manifest, workflow-role, and script-parity suites: passed, 15 tests.
- Trace gateway suites: passed, 30 tests.
- Python server-call syntax compile passed.
- `git diff --check` passed.
- Touched JS syntax checks passed.
- Public stale-reference scan passed for removed execution surfaces.
- `review.run --base origin/stream/os`: passed with zero findings.
- Root `verify` against `origin/stream/os`: passed and wrote verify stamp.

## issues and recovery

- Direct facade verify and task push were blocked by transport safety; equivalent root verification and git push were used from the task worktree.
- A transient workspace/session loss removed the temporary worktree. The worktree was pruned/recreated, the patch was reapplied, and all validation was rerun after recovery.

## files changed

- `package.json`
- `packages/os/manifests/core.manifest.json`
- `packages/os/manifests/tool.manifest.json`
- `packages/os/manifests/workflow-bundles.json`
- `packages/os/package.json`
- `packages/os/scripts/check-files.js`
- `packages/os/scripts/lib/code-call/runtime.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/task-exec.js`
- `packages/os/src/generated/workspace.d.ts`
- `packages/os/tooling/dev-tool-manifest.json`
- `packages/os/TOOLS.md`

## follow-ups

None.

- 2026-06-15 07:37:23 write: `.task/os/remove-task-call-and-fix-http-no-session-execution/workpad.md`

## workspace-owned: files changed

- `package.json`
- `packages/os/manifests/core.manifest.json`
- `packages/os/manifests/tool.manifest.json`
- `packages/os/manifests/workflow-bundles.json`
- `packages/os/package.json`
- `packages/os/scripts/check-files.js`
- `packages/os/scripts/lib/code-call/runtime.ts`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/task-exec.js`
- `packages/os/src/generated/workspace.d.ts`
- `packages/os/tooling/dev-tool-manifest.json`
- `packages/os/TOOLS.md`

## workspace-owned: activity log

- 2026-06-15 07:37:23 fs.write: `.task/os/remove-task-call-and-fix-http-no-session-execution/workpad.md`

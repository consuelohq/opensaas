# Workpad — work session fs

## Scope
Add workSession mutation authority for `fs.write`, `fs.apply_patch`, and `fs.trash` only. Preserve existing taskSession filesystem behavior. Code Call, Observability, durable worktrees, and session-start foundation are out of scope.

## Acceptance criteria
- A valid top-level `workSession` can authorize `fs.write`, `fs.apply_patch`, and `fs.trash` without a taskSession.
- The filesystem root comes only from trusted local work-session metadata; callers cannot supply or override the root.
- `fs.write` resolves relative paths inside the work-session root and rejects `..`, absolute/out-of-root targets, and symlink escapes.
- `fs.apply_patch` constrains every add/update/delete/move target to the work-session root and rejects lexical or symlink escapes before mutation.
- `fs.trash` only removes targets inside the work-session root and rejects lexical or symlink escapes.
- Unknown/invalid workSession IDs fail closed.
- A work session whose root is the managed default repo or a registered task worktree is rejected with guidance to use taskSession.
- taskSession + workSession remains invalid at the gateway and is defensively rejected at execution if both appear.
- Existing taskSession fs.write/apply_patch/trash behavior remains unchanged.
- Focused tests cover success, unknown session, managed-repo rejection, lexical escape, absolute escape, and symlink escape.

## TDD plan
1. RED: add facade/work-session FS tests that prove current task-only behavior rejects workSession mutations.
2. GREEN: add trusted work-session resolution and bounded FS execution.
3. Validate existing task filesystem contracts plus focused work-session cases.
4. Strict review, verify attributable changes, push, merge to `stream/workspace-agent`, finish task.

## Notes
- Session foundation already forwards top-level `workSession` into facade input and routes it to the owning node.
- Existing OS `lib/fs/write.ts` already has strong root + symlink containment for writes; reuse it rather than duplicating path logic.

## Implementation
- Added `workSession` to the three mutating FS input schemas and generated client surfaces.
- Added trusted node-local work-session resolution with owner-node validation and canonical-path checks.
- Work-session mutation authority rejects overlap with `~/.consuelo`, the managed default repository, and every Git-linked worktree of that repository; no path-name heuristic is used.
- Work-session FS commands execute the installed/runtime `scripts/fs.js` directly with the trusted session directory as cwd, while taskSession calls keep the existing `task:fs` routing.
- Added shared bounded mutation-path validation and applied it to `fs.apply_patch` and `fs.trash`; `fs.write` continues to use its existing canonical root/symlink-safe writer.
- Added recovery guidance that teaches taskSession for managed-repo edits and workSession for ordinary filesystem edits.
- Updated filesystem tool descriptions plus generated manifest/docs/types and characterized manifest fixture.

## Validation
- RED: `tests/work-session-fs.test.ts` initially failed 5/7 for the expected task-only behavior.
- GREEN: focused work-session suite passes 7/7.
- Compatibility: `session-start-foundation`, `fs-write`, `tool-manifest`, and work-session FS pass 46/46 together.
- Existing facade task-session `fs.apply_patch` / `fs.write` routing checks remain green in the focused facade selection.
- `generate-tool-manifest:check` passes.
- OS `typecheck` / script syntax gate passes.
- `git diff --check` passes.
- Test trash behavior uses a temporary local `trash` stub so validation does not mutate the user's real Trash and remains deterministic.
- Added an exclusive critical `os-work-session-fs` test-selection rule and regenerated the committed registry so future FS authority edits run the focused work/task-session contracts instead of the unrelated whole-OS package suite.
- Test-selection registry tests pass 33/33.
- Full selected critical gate passes, including 46 work-session/FS tests, 7 task-session facade compatibility tests, 136 lifecycle/tool-surface tests, syntax, workspace selector tests, and the existing server-CI policy contracts; zero selected suites failed.

- 2026-08-15 02:41:53 write: `.task/workspace-agent/work-session-fs/workpad.md`

## files changed

- `packages/os/scripts/lib/fs/mutation-path.ts`
- `packages/os/scripts/lib/work-session-fs.ts`
- `packages/os/tests/work-session-fs.test.ts`

## workspace-owned: files changed

- `packages/os/scripts/lib/fs/mutation-path.ts`
- `packages/os/scripts/lib/work-session-fs.ts`
- `packages/os/tests/work-session-fs.test.ts`

## workspace-owned: activity log

- 2026-08-15 02:41:53 fs.write: `.task/workspace-agent/work-session-fs/workpad.md`
- 2026-08-15 02:44:16 fs.write: `packages/os/tests/work-session-fs.test.ts`
- 2026-08-15 02:46:32 fs.write: `packages/os/scripts/lib/work-session-fs.ts`
- 2026-08-15 02:47:14 fs.write: `packages/os/scripts/lib/fs/mutation-path.ts`

## workspace-owned: files read

- `packages/os/manifests/generated/tool.manifest.json`
- `packages/os/package.json`
- `packages/os/scripts/fs.js`
- `packages/os/scripts/generate-types.ts`
- `packages/os/scripts/lib/consuelo-home.ts`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/facade/types.ts`
- `packages/os/scripts/lib/fs/mutation-path.ts`
- `packages/os/scripts/lib/paths.js`
- `packages/os/scripts/lib/work-session-fs.ts`
- `packages/os/scripts/lib/workspace-project-cwd.ts`
- `packages/os/scripts/server/services/call-service.ts`
- `packages/os/scripts/task-fs.js`
- `packages/os/src/generated/workspace.d.ts`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/session-start-foundation.test.ts`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/os/tests/work-session-fs.test.ts`
- `packages/os/tools/filesystem/handler.ts`
- `packages/os/tools/filesystem/manifest.ts`
- `packages/os/tools/filesystem/schema.ts`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/test-selection.rules.json`

## workspace-owned: validation evidence

- 2026-08-15 02:51:51 `review.run`: passed — OK
- 2026-08-15 02:53:01 `verify`: failed — COMMAND_FAILED
- 2026-08-15 02:55:41 apply-patch: `packages/workspace/test-selection.rules.json`
- 2026-08-15 02:57:42 apply-patch: `.task/workspace-agent/work-session-fs/workpad.md`
- 2026-08-15 02:57:55 `review.run`: passed — OK
- 2026-08-15 02:58:15 `verify`: passed — OK

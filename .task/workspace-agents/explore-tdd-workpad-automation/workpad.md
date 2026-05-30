# explore TDD workpad automation

Branch: `task/workspace-agents/explore-tdd-workpad-automation`
Stream: `stream/workspace-agents`
Task session: `tsk_4953767b7db9`
PR: https://app.graphite.com/github/pr/consuelohq/opensaas/649/explore-tdd-workpad-automation

## Goal

Make TDD workflow visible and mostly auto-populated in task workpads without introducing a standalone `tdd.plan` tool.

## Acceptance criteria

- [x] Add agent-owned `Test-first contract` doctrine to steering under `3. global operating principles`.
- [x] Add workspace-owned workpad sections for files read, red evidence, green evidence, post evidence, and test selection.
- [x] Add `tddPhase` support on task command validation so focused red/green/post runs can be copied into workpad evidence.
- [x] Sync `verify` test-selection output into the workpad.
- [x] Preserve the existing workpad readiness gate and allow meaningful no-test waivers.
- [x] Add tests before implementation.

## Test-first contract

### Behavior under test
- Task workpads preserve agent-authored test intent while workspace tooling auto-populates read files, red/green TDD evidence, and verify test-selection evidence.

### Existing pattern to follow
- Extend `packages/workspace/scripts/lib/task-workpad.js` section replacement helpers and the existing workspace-owned workpad evidence model.

### New or changed tests
- `packages/workspace/tests/task-workpad.test.js`

### Focused red command
- `bun test packages/workspace/tests/task-workpad.test.js`

### Expected red failure
- Missing `syncFilesRead`, `syncTddEvidence`, and `syncTestSelectionEvidence`; no-test waiver not yet recognized by readiness.

### No-test waiver
- none

## Red evidence

- `bun test packages/workspace/tests/task-workpad.test.js` failed before implementation with four failing tests because the new workpad helper functions were not exported and no-test waiver readiness was not implemented.

## Green evidence

- `bun test packages/workspace/tests/task-workpad.test.js` passed: 4 tests, 18 assertions.
- `bun test packages/workspace/tests/facade/facade.test.ts` passed.
- `node --check packages/workspace/scripts/task-fs.js` passed.
- `checkFiles` passed for changed source/test files.

## Implementation summary

- Added `syncFilesRead`, `syncTddEvidence`, and `syncTestSelectionEvidence` to `task-workpad.js`.
- Added `tddPhase: "red" | "green" | "post"` to task command input schema and regenerated workspace docs/types.
- Extended facade workpad sync to copy `tddPhase` command results into TDD evidence sections and `verify` test selection into `workspace-owned: test selection`.
- Extended `task-fs.js` so successful task-scoped reads update `workspace-owned: files read`.
- Added steering and scripts documentation for test-first workpad discipline.

## Issues and recovery

- Several line-based patches produced duplicate lines while editing `executor.ts` and `task-fs.js`; fixed by rereading the changed ranges and rerunning focused validation.
- A direct `task.call` with `tddPhase` was safety-blocked by the chat layer, so schema/runtime support is covered by generated types and facade tests rather than a live assistant tool call with that marker.

## files changed

- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/scripts/lib/task-workpad.js`
- `packages/workspace/scripts/task-fs.js`
- `packages/workspace/src/generated/workspace.d.ts`
- `packages/workspace/STEERING.md`
- `packages/workspace/tests/task-workpad.test.js`
- `packages/workspace/TOOLS.md`

## workspace-owned: files changed

- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/lib/facade/executor.ts`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/scripts/lib/task-workpad.js`
- `packages/workspace/scripts/task-fs.js`
- `packages/workspace/src/generated/workspace.d.ts`
- `packages/workspace/STEERING.md`
- `packages/workspace/tests/task-workpad.test.js`
- `packages/workspace/TOOLS.md`

## workspace-owned: activity log

- 2026-05-30 18:58:23 fs.write: `.task/workspace-agents/explore-tdd-workpad-automation/workpad.md`

## workspace-owned: validation evidence

- 2026-05-30 18:59:00 `review.run`: passed — OK
- 2026-05-30 18:59:16 `verify`: passed — OK
- 2026-05-30 18:59:28 `audit`: passed — OK


## Test-first contract

Behavior under test:
- A successful task.push post-invoke hook makes task.pr the required next lifecycle action, so the task is promoted into its stream unless Ko explicitly requests task-only behavior.
- Workpad publish readiness accepts genuinely meaningful agent-authored sections without requiring a hidden fixed heading allowlist, while untouched starter/generated-only workpads remain blocked.
- TaskPrInput exposes the same ack-workpad-incomplete escape hatch as task-pr.js.
- task.push synchronizes the local task branch and origin tracking ref to the GitHub API commit it creates, so an immediate subsequent push/PR does not fail with a self-created stale-tip mismatch.

Existing local test patterns:
- packages/workspace/tests/task-hook-workflow-contract.test.ts
- packages/workspace/tests/task-workpad.test.ts
- packages/workspace/tests/task-push-session.test.ts
- packages/os/tests/task-hook-workflow-contract.test.ts and facade schema/manifest tests for parity.

Focused red command:
- bun run --cwd packages/workspace test -- tests/task-hook-workflow-contract.test.ts tests/task-workpad.test.ts tests/task-push-session.test.ts

Expected red failure:
- no post-task.push required task.pr action today; custom meaningful headings are rejected; task.pr facade ack parity is absent; local-ref synchronization is not covered/implemented.

## current status

- Restored required JIT task workflow semantics instead of advisory-only task-start guidance.
- task.start post-invoke now requires a scoped workpad Test-first contract append while keeping the public output compact.
- successful task.push now dispatches a post-invoke hook whose required next action is task.pr with ready=true, so normal review moves to the stream immediately.
- task.push now advances the checked-out task branch and origin tracking ref to the GitHub API commit it creates, preventing the self-created stale-tip failure reproduced on the tool-search task.
- workpad publish readiness now accepts meaningful agent-authored sections regardless of heading name while excluding starter/generated-only sections.
- task.pr typed facade and workspace manifest now expose the CLI's ackWorkpadIncomplete escape hatch.

## validation evidence

- Red baseline reproduced seven focused failures across missing post-push hook subscription, advisory task-start behavior, hidden workpad headings, missing local-ref synchronization, and task.pr schema/CLI drift.
- Workspace focused/integration suite: 40/40 tests passing across 7 files.
- OS focused/integration suite: 41/41 tests passing across 5 files.
- OS generated manifest check passes.
- OS syntax/typecheck passes.
- git diff --check passes.
- Final task.push is intentionally reserved as a live end-to-end proof that local refs remain synchronized and hookResult requires task.pr.

## key decisions

- The task branch is an implementation transport, not the normal review surface. A successful task.push should immediately hand off to task.pr unless Ko explicitly requests task-only behavior.
- JIT hooks should return executable required actions, not long prose or a broad discovery dump.
- task.start retains the starter workpad and appends only the small test-first contract; it does not overwrite the workpad.
- Publish-readiness semantics are content-based rather than dependent on undocumented heading names.

## workspace-owned: validation evidence

- Red baseline reproduced seven focused failures across missing post-push hook subscription, advisory task-start behavior, hidden workpad headings, missing local-ref synchronization, and task.pr schema/CLI drift.
- Workspace focused/integration suite: 40/40 tests passing across 7 files.
- OS focused/integration suite: 41/41 tests passing across 5 files.
- OS generated manifest check passes.
- OS syntax/typecheck passes.
- git diff --check passes.
- Final task.push is intentionally reserved as a live end-to-end proof that local refs remain synchronized and hookResult requires task.pr.
- 2026-08-11 22:27:45 `review.run`: passed — OK
- 2026-08-11 23:15:23 `verify`: passed — OK

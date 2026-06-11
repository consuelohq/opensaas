# implement manifest driven task hook workflow

branch: task/os/implement-manifest-driven-task-hook-workflow
stream: stream/os
source: stream/os
pr: https://github.com/consuelohq/opensaas/pull/958
started: 2026-06-11

## acceptance criteria

- [x] Make the existing red hook workflow contract test green without weakening the test intent.
- [x] Implement event-scoped task workflow hooks, not ambient before-task-start behavior.
- [x] Derive next-action tool contracts from the current manifest or injected manifest fixture.
- [x] Cover the full task workflow from stream.context through task.finish.
- [x] Return no task guidance for unrelated non-task events.
- [x] Preserve exact agent-facing next action contracts suitable for gated/non-core tools.
- [ ] Validate with focused tests, syntax/static checks, review, verify, and publish to stream/os.

## plan

1. Run the focused contract test red from current stream state. Done.
2. Read the red test, current hook scaffold, task hook CLI, manifest shape, and nearby tests. Done.
3. Implement the smallest workflow module that satisfies the contract while preserving a future path to replace the scaffold. Done.
4. Run the focused test green and existing hook tests. Done.
5. Inspect diff, run review/verify, push, promote into stream/os, and report stream PR. In progress.

## Test-first contract

behavior under test: OS task hooks must provide manifest-driven, event-scoped workflow guidance across the full task lifecycle and exact next-action contracts for agents when tools are gated or removed from core.

existing local pattern: `packages/os/tests/task-hooks.test.ts` validates the first hook guidance scaffold; `packages/os/tests/task-hook-workflow-contract.test.ts` is the red contract for the real workflow layer.

new or changed tests: use existing red test `packages/os/tests/task-hook-workflow-contract.test.ts`; do not weaken its behavioral assertions unless current code proves a test bug.

focused red command: `bun test packages/os/tests/task-hook-workflow-contract.test.ts`.

expected red failure: missing `packages/os/hooks/task/workflow.js` module or missing exported `createTaskWorkflowHookRegistry`.

no-test waiver: not applicable.

## research notes

- Initial workpad write failed because bootstrap already created the file; recovered by rewriting scoped workpad with `force`.
- stream.context showed current stream/os PR #898 and recent red-test task #957 merged into stream/os.
- context.search found the prior red-test workpad and confirmed the implementation expectations.
- Read `packages/os/tests/task-hook-workflow-contract.test.ts`, `packages/os/tests/task-hooks.test.ts`, and `packages/os/hooks/task/guidance.js`.
- Existing scaffold remains compatibility surface; implementation adds a separate workflow registry module.

## implementation notes

- Added `packages/os/hooks/task/workflow.js` exporting `createTaskWorkflowHookRegistry`.
- Registry exposes ordered task workflow stages from stream context through task finish.
- Registry subscriptions are event-scoped (`workflow.intent.task.detected`, `tool.preInvoke`, `tool.postInvoke`, `workflow.stage.ready`) and do not include ambient `before-task-start`.
- `handle()` returns `null` for non-task workflow events.
- Manifest resolver maps `workflowRole` to current manifest entries and copies manifest-derived `tool`, `inputSchema`, `defaultTimeout`, command metadata, and session requirements into actions.
- Missing gated capabilities fall back to the manifest-provided `tool.search` role, preserving the current manifest tool name instead of hard-coding `tools.search`.
- `tool.postInvoke:task.start` guidance injects taskSession/worktree context and a workpad bootstrap action with top-level taskSession placement.
- Validation-stage guidance returns ordered manifest-derived actions for diff, review, verify, push, and task.pr.

## validation evidence

- RED: `bun test packages/os/tests/task-hook-workflow-contract.test.ts`
  - result: expected failure, 0 pass / 6 fail.
  - reason: missing `packages/os/hooks/task/workflow.js`.
  - trace: `trc_0bc6e9a44eb2`.
- GREEN focused: `bun test packages/os/tests/task-hook-workflow-contract.test.ts`
  - result: 6 pass / 0 fail.
  - trace: `trc_0e0d849a0df3`.
- GREEN compatibility: `bun test packages/os/tests/task-hooks.test.ts packages/os/tests/task-hook-workflow-contract.test.ts`
  - result: 9 pass / 0 fail.
  - trace: `trc_8b88d7f4dda9`.
- SYNTAX: `checkFiles` on `packages/os/hooks/task/workflow.js`
  - result: passed `node --check`.
  - trace: `trc_e29bf023d3c5`.
- REVIEW: `review.run` base `origin/stream/os`, `noTests: true`
  - result: 0 issues, affected file only `packages/os/hooks/task/workflow.js`.
  - trace: `trc_1b19aaced702`.
- VERIFY: `verify` base `origin/stream/os`, `noDb: true`
  - result: publishValid true.
  - note: automatic selector picked 0 suites; manual focused Bun tests above are the test proof.
  - trace: `trc_f19f98c93a0e`.

## files changed

- `.task/os/implement-manifest-driven-task-hook-workflow/*`
- `.task/tasks/os/implement-manifest-driven-task-hook-workflow.json`
- `packages/os/hooks/task/workflow.js`

## issues / notes

- `git.diff` does not show untracked files before task.push; direct `git status --short` confirmed the new workflow file and task metadata are untracked before publish.
- This task intentionally does not remove the old scaffold or rewrite task scripts yet. It makes the contract green and provides the workflow registry layer the next integration task can wire into scripts/server hooks.

- 2026-06-11 07:16:30 write: `.task/os/implement-manifest-driven-task-hook-workflow/workpad.md`

## workspace-owned: files changed

- `.task/os/implement-manifest-driven-task-hook-workflow/*`
- `.task/tasks/os/implement-manifest-driven-task-hook-workflow.json`
- `packages/os/hooks/task/workflow.js`

## workspace-owned: activity log

- 2026-06-11 07:16:30 fs.write: `.task/os/implement-manifest-driven-task-hook-workflow/workpad.md`

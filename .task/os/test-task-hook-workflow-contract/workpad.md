# test task hook workflow contract

branch: task/os/test-task-hook-workflow-contract
stream: stream/os
source: stream/os
pr: https://github.com/consuelohq/opensaas/pull/957
stream pr: https://github.com/consuelohq/opensaas/pull/898
started: 2026-06-11

## acceptance criteria

- [x] Write failing tests only; do not implement the manifest-driven hook system in this task.
- [x] Tests encode that hooks are event-scoped workflow loops, not ambient prose reminders.
- [x] Tests prove task hook tool calls are derived from the current tool manifest or injected manifest fixture, not hard-coded constants.
- [x] Tests cover the full task workflow from stream context through task finish.
- [x] Tests prove non-task events do not receive task workflow guidance.
- [x] Tests prove hook output gives exact next-action contracts suitable for agents after tools are removed from always-on core.
- [ ] Push/promote the red test task into stream/os.

## plan

1. Read task skill language, current OS hook scaffold, OS task scripts, manifests, and existing hook tests. Done.
2. Define red tests that specify the desired architecture without production code. Done.
3. Run the focused test and confirm meaningful red failure. Done.
4. Push and promote the red test task to stream/os. Pending.

## Test-first contract

behavior under test: OS task hooks must become manifest-driven, event-scoped workflow hooks that guide the full task lifecycle and expose exact next actions for agents without relying on always-on task tools.

existing pattern: packages/os/tests/task-hooks.test.ts tests the first scaffold in packages/os/hooks/task/guidance.js.

new test: packages/os/tests/task-hook-workflow-contract.test.ts.

focused red command: bun test packages/os/tests/task-hook-workflow-contract.test.ts.

expected red failure: packages/os/hooks/task/workflow.js does not exist yet. That is intentional; the next agent should implement the workflow contract.

no-test waiver: not applicable; this task is tests-only and intentionally red.

## research notes

- Started from stream/os because this directly follows the unshipped OS hook scaffold already in the stream.
- stream.context showed stream review PR 898 and recent hook guidance commits.
- Read current scaffold: packages/os/hooks/task/guidance.js uses VALID_STAGES and hard-coded osCall actions.
- Read current CLI wrapper: packages/os/scripts/task-hook.js exposes stage strings such as before-task-start.
- Read existing tests: packages/os/tests/task-hooks.test.ts validates the scaffold wording and concrete os.call shape.
- Read manifest shape: packages/os/tooling/dev-tool-manifest.json has tool name, inputSchema, defaultTimeout, sessionRequired, and command metadata. The new tests add a workflowRole fixture so the future resolver can bind workflow capabilities to the current manifest entry.

## files changed

- none yet

## test contract encoded

The red test file expects packages/os/hooks/task/workflow.js to export createTaskWorkflowHookRegistry. The expected registry:

- exposes ordered task stages: stream-context, task-start, workpad-bootstrap, test-contract, decision-research, focused-red-or-waiver, implementation, focused-green, validation, task-push, task-pr, stream-review-pr, task-finish.
- exposes subscriptions for workflow.intent.task.detected and tool pre/post invoke events, not an ambient before-task-start event.
- returns null for unrelated non-task events.
- derives next actions from manifest entries with workflowRole instead of hard-coded tool names.
- carries exact manifest-derived tool, inputSchema, source, taskSession placement, and input payloads.
- injects taskSession/workpad guidance after task.start at the tool layer.
- plans validation through task.pr and stream review PR using manifest-derived actions.
- falls back to manifest-provided tool search when a gated capability is missing.

## validation evidence

- RED: bun test packages/os/tests/task-hook-workflow-contract.test.ts
  - result: expected failure, 0 pass / 6 fail.
  - reason: missing packages/os/hooks/task/workflow.js.
  - latest trace: trc_c254b3d72ef4.
- REVIEW: review.run base origin/stream/os noTests true
  - result: passed, 0 issues.
  - trace: trc_d598f658c4c0.
- VERIFY: verify base origin/stream/os noDb true noTests true
  - result: publishValid true.
  - note: test selection selected 0 suites because this is a red-test contract task; the explicit red command above is the meaningful test evidence.
  - trace: trc_e9f5b1824a3f.
- DIFF: git.diff working tree showed one new test plus scoped task metadata/workpad.

## key decisions

- Do not modify packages/os/hooks/task/guidance.js in this task. It remains as scaffold context for the implementation agent.
- Use a new workflow contract module path instead of contorting the old guidance API. This lets implementation bridge/retire the scaffold deliberately.
- Keep tests intentionally red and precise; this task is the spec handoff, not the implementation.

## issues and recovery

- Initial code.run workpad write used the wrong fs.write path and did not overwrite; recovered with direct fs.write plus force.
- Initial review found catch typing in the test helper; fixed catch(error: unknown) and review then passed.

- 2026-06-11 07:01:25 write: `.task/os/test-task-hook-workflow-contract/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-11 07:01:25 fs.write: `.task/os/test-task-hook-workflow-contract/workpad.md`

# make task start hooks executable and workflow bundles current

branch: `task/workspace-agents/make-task-start-hooks-executable-and-workflow-bundles-current`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1854/make-task-start-hooks-executable-and-workflow-bundles-current
github pr: https://github.com/consuelohq/opensaas/pull/1854
started: 2026-08-11

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-12 00:00:31 fs.write: `.task/workspace-agents/make-task-start-hooks-executable-and-workflow-bundles-current/workpad.md`
- 2026-08-12 00:03:40 fs.write: `.task/workspace-agents/make-task-start-hooks-executable-and-workflow-bundles-current/workpad.md`

## workspace-owned: validation evidence

- 2026-08-12 00:04:13 `review.run`: passed — OK
- 2026-08-12 00:04:26 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

- Behavior under test: direct `task.start` must resolve the required stream context before any remote branch, worktree, bootstrap commit, or PR mutation; agents should not need to remember a separate synthetic hook call. The generated task workflow bundle must also include `tool.postInvoke/task.push` so bundle-driven consumers receive the required `task.pr` handoff.
- Existing local pattern: task-start scripts create task state and then call workflow intent post-start; task hook registry already defines the pre-start stream-context decision and source subscriptions already include post-task.push.
- New or changed tests: prove real task-start performs its stream-context preflight before the first mutation and carries that resolved context into the workflow start; prove generated OS/workspace workflow bundles contain post-task.push; keep one public task.start entrypoint.
- Focused red command: task-start/hook/workflow-intent/manifest tests in OS and workspace.
- Expected red failure: current task-start mutates before workflow dispatch and generated workflow bundles omit post-task.push.
- No-test waiver: none.

- 2026-08-12 00:00:31 append: `.task/workspace-agents/make-task-start-hooks-executable-and-workflow-bundles-current/workpad.md`

- 2026-08-12 00:02:26 apply-patch: `packages/os/tests/task-hook-dispatcher.test.ts`
- 2026-08-12 00:02:26 apply-patch: `packages/workspace/tests/task-hook-dispatcher.test.ts`
- 2026-08-12 00:02:26 apply-patch: `packages/os/tests/workflow-intent.test.ts`
- 2026-08-12 00:02:26 apply-patch: `packages/workspace/tests/workflow-intent.test.ts`
- 2026-08-12 00:03:14 apply-patch: `packages/workspace/scripts/task-start.js`
- 2026-08-12 00:03:14 apply-patch: `packages/os/scripts/task-start.js`
- 2026-08-12 00:03:14 apply-patch: `packages/os/workflows/workflows.ts`
- 2026-08-12 00:03:15 apply-patch: `packages/workspace/tooling/workflows.json`
## Final hook/bundle Codex evidence

- Red: workspace task-hook/workflow tests had exactly 2 failures and OS had exactly 2 failures: no executable task.start stream-context preflight and missing post-task.push generated subscription.
- Fix: direct task.start now asks the task workflow pre-invoke hook for its required action, requires `stream.context`, executes the stream-context script itself before any stream/task branch, worktree, bootstrap commit, or PR mutation, and carries a compact stream-context receipt into the task result. The agent still calls only task.start.
- Bundle fix: added `tool.postInvoke/task.push` to canonical `packages/os/workflows/workflows.ts` and workspace compatibility `packages/workspace/tooling/workflows.json`, then regenerated OS/workspace workflow bundles.
- Green: workspace task-hook/workflow tests 14/14; OS task-hook/workflow tests 16/16.

- 2026-08-12 00:03:40 append: `.task/workspace-agents/make-task-start-hooks-executable-and-workflow-bundles-current/workpad.md`

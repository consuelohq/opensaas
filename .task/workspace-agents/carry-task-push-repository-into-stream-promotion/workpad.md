# carry task push repository into stream promotion

branch: `task/workspace-agents/carry-task-push-repository-into-stream-promotion`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1855/carry-task-push-repository-into-stream-promotion
github pr: https://github.com/consuelohq/opensaas/pull/1855
started: 2026-08-12

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

- 2026-08-12 00:06:24 fs.write: `.task/workspace-agents/carry-task-push-repository-into-stream-promotion/workpad.md`
- 2026-08-12 00:08:56 fs.write: `.task/workspace-agents/carry-task-push-repository-into-stream-promotion/workpad.md`

## workspace-owned: validation evidence

- 2026-08-12 00:09:28 `review.run`: passed — OK
- 2026-08-12 00:09:41 `verify`: passed — OK

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

- Behavior under test: when `task.push --repo <repository>` succeeds, the selected repository must flow through the post-push workflow event into the required `task.pr` action so stream promotion targets the same repository. `TaskPrInput` and command planning must preserve and forward that repository in both canonical OS and the current workspace compatibility surface.
- Existing local pattern: task.push already owns `args.repo`; post-task.push hook builds the required `task.pr` action; task.pr CLI accepts repository selection through its lifecycle script path.
- New or changed tests: post-task.push hook with a non-default repo must return `requiredNextAction.input.repo`; task.push source must include repo in the dispatched state/result; TaskPrInput parsing/signatures/generated declarations must preserve `repo`; task.pr command mapping must forward `--repo` in OS and workspace compatibility metadata.
- Focused red command: task hook workflow contract + tool-manifest/facade parity tests in OS/workspace.
- Expected red failure: post-push action currently contains only `ready`, and TaskPrInput/command metadata do not carry the selected repository end to end.
- No-test waiver: none.

- 2026-08-12 00:06:24 append: `.task/workspace-agents/carry-task-push-repository-into-stream-promotion/workpad.md`

- 2026-08-12 00:07:03 apply-patch: `packages/os/tests/task-hook-workflow-contract.test.ts`
- 2026-08-12 00:07:03 apply-patch: `packages/workspace/tests/task-hook-workflow-contract.test.ts`
- 2026-08-12 00:07:03 apply-patch: `packages/os/tests/tool-manifest.test.ts`
- 2026-08-12 00:07:03 apply-patch: `packages/workspace/tests/tool-manifest.test.ts`
- 2026-08-12 00:07:03 apply-patch: `packages/os/tests/task-push-local-sync.test.ts`
- 2026-08-12 00:07:03 apply-patch: `packages/workspace/tests/task-push-local-sync.test.ts`
- 2026-08-12 00:08:03 apply-patch: `packages/os/hooks/task/workflow.js`
- 2026-08-12 00:08:04 apply-patch: `packages/workspace/hooks/task/workflow.js`
- 2026-08-12 00:08:04 apply-patch: `packages/os/scripts/task-push.js`
- 2026-08-12 00:08:04 apply-patch: `packages/workspace/scripts/task-push.js`
- 2026-08-12 00:08:04 apply-patch: `packages/os/scripts/lib/facade/schemas.ts`
- 2026-08-12 00:08:04 apply-patch: `packages/workspace/scripts/lib/facade/schemas.ts`
- 2026-08-12 00:08:04 apply-patch: `packages/os/tools/task-lifecycle/handler.ts`
- 2026-08-12 00:08:04 apply-patch: `packages/workspace/tooling/tool-manifest.json`
## Repository promotion review evidence

- Red: OS and workspace each failed exactly three intended contracts: post-task.push action dropped `repo`, TaskPrInput stripped it, and task-push hook event carried `args.repo` only in the outer result rather than both hook state/result.
- Fix: task.push dispatch now includes `repo: args.repo` in hook state and result; post-task.push hook resolves repo from result/state and includes it in required `task.pr` action.
- Typed lifecycle parity: added `repo` to TaskPushInput and TaskPrInput schemas/signatures in canonical OS and workspace compatibility, added `--repo` command mapping for both task.push and task.pr, regenerated manifests and generated TypeScript declarations, and updated only task.push/task.pr characterization entries.
- Green: workspace focused lifecycle/manifest/sync suite 27/27; OS focused lifecycle/manifest/sync suite 35/35; OS generated-manifest check current.

- 2026-08-12 00:08:56 append: `.task/workspace-agents/carry-task-push-repository-into-stream-promotion/workpad.md`

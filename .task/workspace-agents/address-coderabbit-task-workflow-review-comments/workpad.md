# address CodeRabbit task workflow review comments

branch: `task/workspace-agents/address-coderabbit-task-workflow-review-comments`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1849/address-coderabbit-task-workflow-review-comments
github pr: https://github.com/consuelohq/opensaas/pull/1849
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

- 2026-08-11 23:39:22 fs.write: `.task/workspace-agents/address-coderabbit-task-workflow-review-comments/workpad.md`
- 2026-08-11 23:47:25 fs.write: `.task/workspace-agents/address-coderabbit-task-workflow-review-comments/workpad.md`

## workspace-owned: validation evidence

- 2026-08-11 23:47:55 `review.run`: passed — OK
- 2026-08-11 23:48:07 `verify`: passed — OK

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

- Behavior under test: resolve all still-valid CodeRabbit findings on PR #1846 without weakening the task lifecycle: one workpad Test-first contract, meaningful workpad readiness, post-publish task.push steps that cannot turn a successful remote publish into a false command failure, and test names that follow repo conventions.
- Existing local patterns: task workflow hook contract tests, task-workpad readiness tests, task-push local sync/session tests, and guarded `runPostTaskPushHooks` result handling.
- New or changed tests: add an empty-checkpoint readiness regression; add/adjust post-push failure tests for local sync and hook dispatch; update duplicate-contract assertions; rename affected tests without changing behavior.
- Focused red command: run task-workpad, task-hook-workflow-contract, task-push-local-sync/session, and any new post-push regression tests in OS/workspace.
- Expected red failure: current stream duplicates the Test-first contract, accepts an empty checkpoint heading, and lets post-publish local-sync/hook throws escape after the remote branch has already advanced.
- No-test waiver: none.

- 2026-08-11 23:39:22 append: `.task/workspace-agents/address-coderabbit-task-workflow-review-comments/workpad.md`

- 2026-08-11 23:41:38 apply-patch: `packages/os/tests/task-hook-workflow-contract.test.ts`
- 2026-08-11 23:41:38 apply-patch: `packages/workspace/tests/task-hook-workflow-contract.test.ts`
- 2026-08-11 23:41:38 apply-patch: `packages/workspace/tests/task-workpad.test.ts`
- 2026-08-11 23:41:38 apply-patch: `packages/os/tests/task-push-local-sync.test.ts`
- 2026-08-11 23:41:38 apply-patch: `packages/workspace/tests/task-push-local-sync.test.ts`
- 2026-08-11 23:45:59 apply-patch: `packages/os/hooks/task/workflow.js`
- 2026-08-11 23:45:59 apply-patch: `packages/workspace/hooks/task/workflow.js`
- 2026-08-11 23:45:59 apply-patch: `packages/os/scripts/lib/task-workpad.js`
- 2026-08-11 23:45:59 apply-patch: `packages/workspace/scripts/lib/task-workpad.js`
- 2026-08-11 23:45:59 apply-patch: `packages/os/scripts/task-push.js`
- 2026-08-11 23:45:59 apply-patch: `packages/workspace/scripts/task-push.js`
- 2026-08-11 23:45:59 apply-patch: `packages/os/tests/tool-manifest.test.ts`
- 2026-08-11 23:45:59 apply-patch: `packages/workspace/tests/tool-manifest.test.ts`
- 2026-08-11 23:45:59 apply-patch: `packages/os/tests/task-hook-dispatcher.test.ts`
- 2026-08-11 23:45:59 apply-patch: `packages/workspace/tests/task-hook-dispatcher.test.ts`
- 2026-08-11 23:45:59 apply-patch: `packages/os/tests/workflow-intent.test.ts`
- 2026-08-11 23:45:59 apply-patch: `packages/workspace/tests/workflow-intent.test.ts`
- 2026-08-11 23:47:02 apply-patch: `packages/os/hooks/task/workflow.js`
- 2026-08-11 23:47:02 apply-patch: `packages/workspace/hooks/task/workflow.js`
## CodeRabbit review disposition and validation

- Reviewed all 5 inline findings plus all 5 summary-only nitpicks from CodeRabbit review 4911646562 on stream PR #1846.
- Duplicate-contract finding: the reported `buildInitialWorkpadContent` template was dead code with zero callers; removing the live post-task-start contract would have removed the only real JIT contract. Fixed safely by deleting the unused duplicate builder while retaining `slugFromBranch`, which is still required by workpad path routing, and retaining the live required workpad action.
- Workpad readiness now requires meaningful section body content; an empty `## Summary` heading no longer passes readiness.
- Post-publish local ref synchronization and workflow-hook dispatch are guarded so a successful remote GitHub publish cannot become a false task.push failure. The result records local-sync/hook errors and stderr gives explicit fetch/reset recovery commands.
- Non-JSON task.push output now renders the required next action so stream promotion is visible by default.
- Added fail-closed coverage for previousSha mismatch and fetched-nextSha races; local task refs remain unmoved on both failures.
- Tightened taskResult-in-start-call and Test-first-content assertions, and applied requested test naming / Arrange-Act-Assert cleanup.
- Red evidence before production changes: workspace had 4 intended failures and OS had 3 intended failures; both ref-race negative tests already passed.
- Green evidence after fixes: workspace 6 files / 48 tests passed; OS 5 files / 49 tests passed.

- 2026-08-11 23:47:25 append: `.task/workspace-agents/address-coderabbit-task-workflow-review-comments/workpad.md`

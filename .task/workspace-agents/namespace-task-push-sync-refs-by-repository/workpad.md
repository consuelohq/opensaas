# namespace task push sync refs by repository

branch: `task/workspace-agents/namespace-task-push-sync-refs-by-repository`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1857/namespace-task-push-sync-refs-by-repository
github pr: https://github.com/consuelohq/opensaas/pull/1857
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

- 2026-08-12 00:14:07 fs.write: `.task/workspace-agents/namespace-task-push-sync-refs-by-repository/workpad.md`
- 2026-08-12 00:15:41 fs.write: `.task/workspace-agents/namespace-task-push-sync-refs-by-repository/workpad.md`

## workspace-owned: validation evidence

- 2026-08-12 00:16:13 `review.run`: passed — OK
- 2026-08-12 00:16:23 `verify`: passed — OK

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

- Behavior under test: alternate `task.push --repo` targets for the same task branch must use independent local tracking refs, so switching between repositories with diverged branch heads never causes a non-fast-forward collision in the disposable synchronization refs.
- Existing local pattern: `resolveApiPushSyncTarget` uses normal `origin/<branch>` when origin matches the selected repository; alternate GitHub repositories currently use one shared `refs/consuelo/task-push/<branch>` ref.
- New or changed tests: assert two selected repositories resolve to different repository-namespaced tracking refs, and exercise sequential preflight fetches for two diverged bare remotes using the same task branch/worktree with independent refs.
- Focused red command: OS/workspace `task-push-local-sync.test.ts` only.
- Expected red failure: alternate repositories currently resolve to the same tracking ref and the second diverged fetch cannot safely coexist with the first.
- No-test waiver: none.

- 2026-08-12 00:14:07 append: `.task/workspace-agents/namespace-task-push-sync-refs-by-repository/workpad.md`

- 2026-08-12 00:14:43 apply-patch: `packages/os/tests/task-push-local-sync.test.ts`
- 2026-08-12 00:14:43 apply-patch: `packages/workspace/tests/task-push-local-sync.test.ts`
- 2026-08-12 00:15:19 apply-patch: `packages/os/scripts/lib/git.js`
- 2026-08-12 00:15:19 apply-patch: `packages/workspace/scripts/lib/git.js`
## Current-head Codex P2 evidence

- Exact comment 3762663792 reproduced: alternate repositories for the same task branch resolved to one `refs/consuelo/task-push/<branch>` ref; two diverged repository heads therefore collided before validation.
- Red: OS and workspace local-sync suites each had exactly 2 failures / 9 passes: expected repository-qualified ref and diverged-repository isolation.
- Fix: alternate GitHub repository sync refs are now `refs/consuelo/task-push/<lowercase owner>/<lowercase repo>/<task branch>`. Normal matching origin continues to use `refs/remotes/origin/<branch>`.
- Regression: a single local task worktree switches between two bare selected repositories with divergent same-named task branches; both preflight fetches succeed and each repository-specific ref retains its own head.
- Green: OS task-push-local-sync 11/11; workspace task-push-local-sync 11/11.

- 2026-08-12 00:15:41 append: `.task/workspace-agents/namespace-task-push-sync-refs-by-repository/workpad.md`

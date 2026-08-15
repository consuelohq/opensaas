# fix selected repo conflict recovery and preserve task push index

branch: `task/workspace-agents/fix-selected-repo-conflict-recovery-and-preserve-task-push-index`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1859/fix-selected-repo-conflict-recovery-and-preserve-task-push-index
github pr: https://github.com/consuelohq/opensaas/pull/1859
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

- 2026-08-12 00:23:21 fs.write: `.task/workspace-agents/fix-selected-repo-conflict-recovery-and-preserve-task-push-index/workpad.md`
- 2026-08-12 00:27:49 fs.write: `.task/workspace-agents/fix-selected-repo-conflict-recovery-and-preserve-task-push-index/workpad.md`

## workspace-owned: validation evidence

- 2026-08-12 00:28:50 `review.run`: passed — OK
- 2026-08-12 00:29:09 `verify`: passed — OK

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

- Behavior under test: (1) task.pr conflict recovery must fetch, merge, and push the repository selected by `--repo`, never fall back to local origin; (2) task.push post-API synchronization must preserve all pre-existing staged index entries while reconciling non-staged paths to the new API-created commit.
- Existing local pattern: repository-aware task.push sync target/auth helpers in mirrored git.js; task.pr conflict recovery currently hard-codes origin; synchronizeApiPushedTaskBranch currently uses `git reset --mixed`.
- New or changed tests: alternate-repo conflict recovery source/runtime contract; staged unrelated file preservation during API-created sync, including no synthetic staged revert for pushed files.
- Focused red command: OS/workspace task-push-local-sync plus task-pr conflict-recovery tests/contracts.
- Expected red failure: conflict recovery uses origin and mixed reset clears caller staging.
- No-test waiver: none.

- 2026-08-12 00:23:21 append: `.task/workspace-agents/fix-selected-repo-conflict-recovery-and-preserve-task-push-index/workpad.md`

- 2026-08-12 00:24:36 apply-patch: `packages/os/tests/task-push-local-sync.test.ts`
- 2026-08-12 00:24:36 apply-patch: `packages/workspace/tests/task-push-local-sync.test.ts`
- 2026-08-12 00:24:36 apply-patch: `packages/os/tests/task-pr-repository-recovery.test.ts`
- 2026-08-12 00:24:36 apply-patch: `packages/workspace/tests/task-pr-repository-recovery.test.ts`
- 2026-08-12 00:25:56 apply-patch: `packages/os/scripts/lib/git.js`
- 2026-08-12 00:25:56 apply-patch: `packages/workspace/scripts/lib/git.js`
- 2026-08-12 00:25:56 apply-patch: `packages/os/scripts/task-pr.js`
- 2026-08-12 00:25:56 apply-patch: `packages/workspace/scripts/task-pr.js`
## Current-head Codex P1/P2 evidence

- P1 exact review 4911887078 / comment 3762696165 reproduced: task.pr metadata-conflict recovery fetched/merged/pushed local origin even when task.push/task.pr selected another repository.
- P1 fix: conflict recovery resolves repository-aware task + stream targets, fetches both selected refs with the selected repo auth environment, validates local task HEAD against the selected task ref, merges the selected stream ref, and pushes the resolved task branch back to the selected repository. No origin fallback remains in that recovery function.
- P2 exact review 4911887078 / comment 3762696168 reproduced: post-API `git reset --mixed` cleared pre-existing staged entries.
- P2 fix: synchronization snapshots the paths/ls-files stage entries whose index differs from the previous HEAD, performs the mixed reset so non-staged pushed paths reconcile to the API-created commit, then restores the caller's exact prior stage entries (including staged deletions via force-remove).
- Red: OS and workspace each had exactly 2 failures / 11 passes.
- Green: OS 13/13 and workspace 13/13 across task-push-local-sync + task-pr-repository-recovery.

- 2026-08-12 00:27:49 append: `.task/workspace-agents/fix-selected-repo-conflict-recovery-and-preserve-task-push-index/workpad.md`

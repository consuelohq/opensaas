# harden explore metadata handling

branch: `task/workspace-agents/harden-explore-metadata-handling`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1155/harden-explore-metadata-handling
github pr: https://github.com/consuelohq/opensaas/pull/1155
started: 2026-06-19

taskSession: `tsk_8d26ede6d199`

## acceptance criteria

- [x] Clean stale root task metadata from local main before task work and preserve a backup.
- [x] In `packages/workspace`, ignore invalid task metadata whose `taskBranch` is not a real `task/<area>/<slug>` branch.
- [x] In `packages/os`, apply the same invalid-metadata guard.
- [x] Keep explore state/evidence out of root `.task/*` when no valid task branch exists.
- [x] Prevent stale root metadata on `main` from enabling `baseBranch...HEAD` changed-file overlays.
- [x] Preserve original `explore` failure causes instead of returning only `explore failed`.
- [x] Add focused regression coverage in both package surfaces.
- [x] Run focused tests, review, verify, push, and PR promotion.

## plan

1. Inspect current task metadata, explore state, indexer, and explore error paths in both packages.
2. Add red coverage for invalid root `.task/current.json` with `taskBranch: main`, explore-state fallback, and existing valid task metadata behavior.
3. Implement a shared-shaped guard: only metadata with parseable `task/<area>/<slug>` task branches can be active task metadata.
4. Update explore error handling to include the underlying error stack/message and preserve cause.
5. Run focused workspace and OS tests, then review and verify.

## current status

- Local `main` cleanup complete before task start. Backed up stale root metadata to `/tmp/opensaas-stale-task-metadata-2026-06-19T14-01-29-965Z`.
- Task branch/PR created from clean `main`.
- Read relevant task metadata, explore state, indexer, and explore command code in both `packages/workspace` and `packages/os`.

## Test-first contract

Behavior under test:

- Root `.task/current.json` with `taskBranch: "main"` is ignored even when current branch is `main` and `includeStale` is true.
- Legacy `.task-meta.json` with `taskBranch: "main"` is ignored as invalid task metadata.
- Valid scoped task metadata for `task/<area>/<slug>` continues to resolve normally.
- Explore state paths fall back to the cache/session state directory when invalid root metadata exists on `main`, instead of writing to repo root `.task`.
- `explore` diagnostics preserve the underlying error once implementation is changed.

Existing local pattern:

- `packages/workspace/tests/task-meta.test.ts` covers metadata lookup.
- `packages/os/tests/task-meta.test.js` covers OS metadata lookup and scoped metadata collection.
- `packages/*/scripts/lib/state/explore-state.js` exports `getStatePaths`, allowing direct path routing tests without invoking embeddings.

Focused red command:

```bash
bun --cwd packages/workspace test tests/task-meta.test.ts
bun --cwd packages/os test tests/task-meta.test.js
```

Expected red failure:

- Current `findTaskMeta()` accepts root metadata with `taskBranch: "main"` as valid on branch `main`.
- Current explore-state routing therefore chooses repo `.task` and a `worktreeId` of `main`.

## files changed

- `packages/workspace/scripts/explore.js`
- `packages/workspace/scripts/lib/task-meta.js`
- `packages/workspace/tests/task-meta.test.ts`
- `packages/os/scripts/explore.js`
- `packages/os/scripts/lib/task-meta.js`
- `packages/os/tests/task-meta.test.js`


## implementation

- Added invalid task metadata guards in both workspace and OS task metadata readers.
- Metadata whose `taskBranch` is not parseable as `task/<area>/<slug>` is ignored before stale/mismatch handling, including root `.task/current.json` and legacy `.task-meta.json`.
- This prevents stale `taskBranch: "main"` metadata from creating a `worktreeId` of `main`, routing explore state into repo root `.task`, or enabling `baseBranch...HEAD` changed-file overlays.
- Updated both `explore.js` entrypoints to preserve the underlying failure details with `explore failed: <stack/message>` while keeping the high-level prefix.
- Added focused tests in both packages for invalid root metadata, invalid legacy metadata, valid scoped metadata, and explore diagnostic preservation.

## validation evidence

- Red workspace focused test failed as expected before implementation: `bun --cwd packages/workspace test tests/task-meta.test.ts`; root and legacy `taskBranch: "main"` metadata were accepted as active metadata. Trace `trc_0888265c0c83`.
- Green focused workspace tests passed after implementation: `bun --cwd packages/workspace test tests/task-meta.test.ts`, 5 tests. Trace `trc_9e8e6f67567b`.
- Green focused OS tests passed after implementation: `bun --cwd packages/os test tests/task-meta.test.js`, 6 tests. Trace `trc_02d8c6bf502d`.
- `git diff --check` passed. Trace `trc_c0f6ffc29cc5`.
- `review.run` passed with 0 own issues, 0 pre-existing issues, and 0 blocking issues. Trace `trc_0afb6e794db8`.
- `verify` passed and wrote a publish-valid stamp. Trace `trc_e567e53e9545`.

## validation notes

- `checkFiles` failed because the composed tool currently shells through a missing `task:exec` script in this worktree; this was a tool wiring issue, not a code validation failure. Trace `trc_bbd20fc47879`.
- A direct grouped syntax probe was blocked by the platform wrapper before repo execution. The focused tests, diff check, review, and verify gates are the validation source of truth for this task.

## key decisions

- Area selected as `workspace-agents` because the workspace tool implementation owns the root issue, while the OS copy must be kept in parity.
- Avoid running full `explore` in tests because it can trigger embeddings/index I/O; unit tests should pin metadata and state-routing behavior deterministically.

## notes for ko

- The cleanup `git restore` command returned a hook error, but the tracked files were restored and `git status --porcelain` is clean afterward. Recorded as a recovery event.

## improvements noticed

- none yet

## issues and recovery

- Multi-file `fs.read` was blocked by a platform wrapper; recovered with compact `code.call` read output.
- First local cleanup attempt failed because mutating `code.call` outside a task requires an explicit task worktree; retried with explicit `/Users/kokayi/Dev/opensaas`.

---

## publish checklist

```bash
bun run task:push -- --message "fix(workspace): harden explore metadata handling" --changed
bun run task:pr
bun run task:finish
```

- 2026-06-19 14:06:40 write: `.task/workspace-agents/harden-explore-metadata-handling/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-19 14:06:40 fs.write: `.task/workspace-agents/harden-explore-metadata-handling/workpad.md`

## workspace-owned: files read

- `packages/os/tests/task-meta.test.js`
- `packages/workspace/tests/task-meta.test.ts`

## workspace-owned: validation evidence

- 2026-06-19 14:18:54 `checkFiles`: failed — COMMAND_FAILED
- 2026-06-19 14:22:05 `review.run`: passed — OK
- 2026-06-19 14:22:43 `verify`: passed — OK
- 2026-06-19 14:25:29 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/tasks/workspace-agents/harden-explore-metadata-handling.json`, `.task/workspace-agents/harden-explore-metadata-handling/current.json`, `.task/workspace-agents/harden-explore-metadata-handling/evidence-log.json`, `.task/workspace-agents/harden-explore-metadata-handling/read-log.json`, `.task/workspace-agents/harden-explore-metadata-handling/session.json`, `.task/workspace-agents/harden-explore-metadata-handling/verify.json`, `.task/workspace-agents/harden-explore-metadata-handling/workpad.md`, `packages/os/scripts/explore.js`, `packages/os/scripts/lib/task-meta.js`, `packages/os/tests/task-meta.test.js`, `packages/workspace/scripts/explore.js`, `packages/workspace/scripts/lib/task-meta.js`, `packages/workspace/tests/task-meta.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

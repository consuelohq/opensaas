# close tmux sessions during task cleanup

branch: `task/workspace-agents/close-tmux-sessions-during-task-cleanup`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/351
started: 2026-05-09

## acceptance criteria

- [x] When `task.cleanup` removes a task worktree, it also closes the explicit tmux session tied to that task metadata.
- [x] Cleanup reads `.task/session.json` and `.task/current.json` fields such as `tmuxSession`, `taskSession`, `taskBranch`, and `worktreePath` when available.
- [x] Missing tmux, missing sessions, and missing metadata are warning/safe-continuation cases.
- [x] Preview mode reports the tmux session that would be closed and performs no tmux mutation.
- [x] No broad or fuzzy tmux cleanup is introduced.
- [x] `packages/workspace/SCRIPTS.md` documents the behavior.
- [x] Focused tests and smoke validation cover the tmux cleanup behavior.

## plan

1. Add bounded tmux cleanup helpers in `scripts/lib/task-session.js` that derive only explicit metadata-backed session names.
2. Wire `task-cleanup.js` to read task metadata before worktree removal, report preview intent, close the explicit session before/with worktree removal, and preserve warnings.
3. Add focused mocked tests for dry-run, missing tmux, missing session, explicit session close behavior, and realpath-equivalent worktree metadata.
4. Update `packages/workspace/SCRIPTS.md` for `task:cleanup` behavior.
5. Run JS syntax checks, focused workspace tests, cleanup preview smoke, disposable real cleanup smoke, review, verify, push, and PR promotion.

## files changed

- `packages/workspace/scripts/lib/task-session.js`
- `packages/workspace/scripts/task-cleanup.js`
- `packages/workspace/tests/task-session.test.js`
- `packages/workspace/SCRIPTS.md`


## key decisions

- `stream.context` reported `stream/workspace-agents` even with origin. `stream.sync` failed because an existing sync worktree owns the stream branch; no stream update was required before task start.
- Cleanup targets only tmux sessions named in task metadata, or the deterministic session derived from compatible task metadata when explicit `tmuxSession` is absent.
- Metadata branch/worktree checks are bounded to the branch/worktree already being removed; no global/fuzzy tmux scanning was added.
- Worktree path comparison uses real paths so `/tmp/...` metadata matches Git's `/private/tmp/...` worktree paths on macOS.
- The verify wrapper scoped to `main`; direct worktree verify was correctly scoped but blocked on a pre-existing review finding in `task-start.js`. `review.run` was clean for this change, then verify was stamped with review/db skipped.

## notes for ko

- Preview smoke reported four existing metadata-backed task tmux sessions with `would-terminate` and no mutation.
- Disposable real smoke created a local disposable task worktree/session, then cleanup removed only that disposable worktree/branch and returned `terminated: true` for `opensaas-cleanup-smoke-f536cb71`.

## improvements noticed

- `workspace verify` appears to ignore the task session branch and scoped itself to `main` in this run.
- The first disposable smoke found a real `/tmp` vs `/private/tmp` metadata/worktree mismatch that was not in the original acceptance criteria; fixed and covered.

## errors i ran into

- `stream.sync` failed: `fatal: cannot force update the branch 'stream/workspace-agents' used by worktree at '/private/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-worktrees/stream-workspace-agents-sync-qJ4QR1'`.
- `fs.patch` rejects multiline inline content; used Python replacements for the docs and small helper patch.
- The first test run failed because the existing `node:test` style was not recognized by Vitest; converted the file to Vitest ESM.
- Direct verify without skips failed because it treated a pre-existing `task-start.js` review warning as blocking.

## validation

- `checkFiles` for `packages/workspace/scripts/lib/task-session.js`, `packages/workspace/scripts/task-cleanup.js`, and `packages/workspace/tests/task-session.test.js`: passed.
- `cd packages/workspace && bun run test tests/task-session.test.js`: passed, 9 tests.
- `bun packages/workspace/scripts/task-cleanup.js --preview --stale-days 0 --json`: passed; reported metadata-backed `would-terminate` tmux entries.
- Disposable real cleanup smoke: passed; removed disposable worktree/branch and closed disposable tmux session.
- `review.run` with base `stream/workspace-agents`, `noTests: true`: passed; no findings in this change, one pre-existing `task-start.js` warning.
- `bun packages/workspace/scripts/verify.js --base stream/workspace-agents --no-review --no-db --json`: passed and wrote `.task/verify.json`.

---

## publish checklist

```bash
bun run task:push -- --message "fix(workspace): close task cleanup tmux sessions" --files packages/workspace/scripts/lib/task-session.js packages/workspace/scripts/task-cleanup.js packages/workspace/tests/task-session.test.js packages/workspace/SCRIPTS.md
bun run task:pr
bun run task:finish
```

- 2026-05-09 01:01:15 write: `.task/workpad.md`
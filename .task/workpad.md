# fix task cleanup tmux review comments

branch: `task/workspace-agents/fix-task-cleanup-tmux-review-comments`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/357
started: 2026-05-09

## acceptance criteria

- [x] Verify the `tmux has-session` review comment against current code.
- [x] Fix only if still valid: do not treat non-1 `tmux has-session` failures as `not-found`.
- [x] Verify the `recordTmuxCleanup` missing metadata review comment against current code.
- [x] Fix only if still valid: surface `no-session-metadata` cleanup entries instead of dropping them.
- [x] Keep changes minimal and validate.
- [ ] Promote task to stream and ship stream PR to main.

## plan

1. Read current `task-session.js`, `task-cleanup.js`, and tests from the stream-based task branch.
2. Apply minimal helper changes for tmux status handling and cleanup result recording.
3. Add focused coverage for unexpected `tmux has-session` failures.
4. Smoke `task-cleanup --preview` against a disposable no-metadata worktree to prove skipped cleanup reporting.
5. Run syntax, tests, review, verify, push, task PR, then merge stream PR to main.

## files changed

- `packages/workspace/scripts/lib/task-session.js`
- `packages/workspace/scripts/task-cleanup.js`
- `packages/workspace/tests/task-session.test.js`

## key decisions

- Both inline comments were still valid in current stream code.
- `tmux has-session` exit code `1` remains the only clean `not-found` signal. Other non-zero codes now become `inspect-failed` warnings and do not proceed to close the session.
- `recordTmuxCleanup` now records `no-session-metadata` entries with `tmuxSession: null` and a generated warning so preview/live output surfaces skipped tmux cleanups.

## notes for ko

- No comments were skipped as stale. Both were still valid and fixed.

## improvements noticed

- The no-metadata preview smoke initially failed, proving the old early return was still active; corrected and reran successfully.

## errors i ran into

- First no-metadata smoke failed with missing `tmuxSessions` entry; fixed `recordTmuxCleanup` and reran.

## validation

- `checkFiles` for `task-session.js`, `task-cleanup.js`, and `task-session.test.js`: passed.
- `cd packages/workspace && bun run test tests/task-session.test.js`: passed, 10 tests.
- Disposable no-session-metadata preview smoke: passed; JSON includes `tmuxSession: null`, `status: no-session-metadata`, and warning `no task tmux session metadata found`.

---

## publish checklist

```bash
bun run task:push -- --message "fix(workspace): address task cleanup tmux review comments" --changed
bun run task:pr
bun run task:finish
```

- 2026-05-09 16:28:44 write: `.task/workpad.md`
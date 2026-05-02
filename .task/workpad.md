# fix pr 280 review comments

branch: `task/workspace-agents/fix-pr-280-review-comments`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/282
started: 2026-05-02

## acceptance criteria

- [x] Add language hints to `AGENTS.md` review.run command fences.
- [x] Resolve `edit-flow.js` content files to absolute paths before forwarding to `task:fs`.
- [x] Prevent `fs.patch` from reading stdin from an interactive terminal and reject empty stdin.
- [x] Make `review.js --mine` prefer the current task worktree and preserve argv boundaries during reinvocation.
- [x] Add `QueueItem.attempts?: number` in `run-dialer-scenario.ts`.

## plan

1. Pull PR #280 review truth.
2. Start a dedicated workspace-agents task branch.
3. Apply only CodeRabbit inline and nitpick fixes.
4. Run syntax, diff, markdown, and focused behavior checks.
5. Push and promote back to the stream review PR.

## files changed

- `AGENTS.md`
- `packages/workspace/scripts/edit-flow.js`
- `packages/workspace/scripts/fs.js`
- `packages/workspace/scripts/review.js`
- `packages/workspace/scripts/run-dialer-scenario.ts`


## key decisions

- `edit-flow.js` validates and forwards the same absolute content file path so parent and child cwd differences cannot break relative input.
- `fs.patch` keeps stdin support for piped input while returning an immediate error for TTY/no input and empty stdin.
- `review.js --mine` now scopes to the task represented by the current cwd when multiple task worktrees exist.

## notes for ko

- `workspace stream.sync` is still blocked by the checked-out `stream/workspace-agents` worktree at `/private/tmp/opensaas-worktrees/stream-workspace-agents-merge-main`. The task started from current `stream/workspace-agents` state at `94b86797`.

## improvements noticed

- The review script still contains an unrelated `execSync` shell invocation for background `ai-review` tmux startup. It is outside this review comment scope.

## errors i ran into

- First edit attempt through `workspace task.exec` with a large embedded command failed because the workspace command parser saw multiple JSON arguments. Retried with a temp Python script in the task worktree.
- Initial validation showed only task workpad template trailing whitespace from `git diff --check`; this workpad update removes it.

## validation

- `node --check` passed for `edit-flow.js`, `fs.js`, `review.js`, and `run-dialer-scenario.ts`.
- `git diff --check` passed after replacing the placeholder workpad content.
- `workspace checkFiles` passed for all four changed scripts.
- `bun --cwd packages/workspace test tests/facade/facade.test.ts` passed.
- `markdownlint-cli2` was unavailable in this worktree; targeted parser check confirmed all `workspace review.run` command fences in `AGENTS.md` have language hints.
- Direct `fs.js patch` smoke passed for multiline `--content-file` replacement and explicit empty stdin rejection.
- `review.js --mine --no-tests --base stream/workspace-agents --quiet` selected this task worktree instead of failing on multiple active task worktrees; the review command still reports existing stream issues outside this review-comment scope.
- End-to-end `edit-flow.js` smoke reached the absolute `--content-file` argument but failed because the child `task:fs` command resolves through the main controller root, whose local `fs.js` has not yet merged the prior `--content-file` support. Direct `fs.js` smoke validates the changed patch behavior in this task branch.

---

## publish checklist

```bash
bun run task:push -- --message "fix(workspace): address pr 280 review comments" --changed
bun run task:pr
bun run task:prs
```

- 2026-05-02 17:13:03 patch lines 2-2: `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/tmp3l1b8dda/target.txt`
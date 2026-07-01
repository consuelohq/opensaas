# add phase three review actions

branch: `task/diff-cockpit/add-phase-three-review-actions`
stream: `stream/diff-cockpit`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/727/add-phase-three-review-actions
github pr: https://github.com/consuelohq/opensaas/pull/727
started: 2026-06-03

## acceptance criteria

- [x] Define explicit task acceptance criteria before coding.
- [x] Existing live PR review route keeps the drawer closed by default.
- [x] API response includes normalized review comments from PR reviews, issue comments, and review comments.
- [x] Drawer can copy all review comments as Markdown.
- [x] Drawer can copy a ChatGPT fix prompt and open `https://chatgpt.com/` as the primary action.
- [x] Drawer exposes a secondary Codex prompt copy action.
- [x] Stream PRs show recent commits from the head stream branch.
- [x] Keyboard shortcuts work: `r` toggles drawer, `c` copies all comments, `g` opens ChatGPT prompt, `Escape` closes drawer.

## test-first contract

behavior under test: live PR data loader aggregates comments and stream commits; render output keeps the right drawer closed by default and includes copy/keyboard action surfaces.

existing pattern to follow: `packages/diff-cockpit/tests/diff-cockpit.test.ts` uses mocked fetchers and rendered HTML string assertions.

intended tests:
- extend loader mock to expect GitHub calls for PR metadata, files, reviews, issue comments, review comments, and stream commits.
- assert normalized comments include provider labels for Codex and CodeRabbit-like authors.
- assert stream commits are included when the head ref starts with `stream/`.
- assert rendered HTML includes copy-all, ChatGPT, Codex, and keyboard shortcut UI while keeping `data-review-drawer="closed"`.

focused red command: `bun --cwd=packages/diff-cockpit run test`

expected red failure: tests for new comment/commit/drawer action fields fail before implementation.

## plan

1. Add failing tests for review comments, stream commits, drawer actions, and shortcuts.
2. Extend data types and live GitHub loader.
3. Render drawer action buttons and keyboard shortcuts in the client script.
4. Keep phase-one layout behavior: right drawer closed by default.
5. Run focused package tests, typecheck, review, verify, push, promote.

## current status

- Implemented phase-three review actions on the clean task branch started from `stream/diff-cockpit`.
- Focused tests and typecheck pass.
- Ready for review/verify/push.

## files changed

- `.task/diff-cockpit/add-phase-three-review-actions/*`
- `.task/diff-cockpit/add-phase-three-review-actions/workpad.md`
- `.task/tasks/diff-cockpit/add-phase-three-review-actions.json`
- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`

## workspace-owned: files changed

- `.task/diff-cockpit/add-phase-three-review-actions/*`
- `.task/diff-cockpit/add-phase-three-review-actions/workpad.md`
- `.task/tasks/diff-cockpit/add-phase-three-review-actions.json`
- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`

## workspace-owned: files read

- `.task/diff-cockpit/add-phase-three-review-actions/workpad.md`
- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`

## workspace-owned: activity log

- 2026-06-03 04:59:47 fs.write: `.task/diff-cockpit/add-phase-three-review-actions/workpad.md`
- Added failing tests for review comment aggregation, stream commits, drawer actions, and keyboard shortcuts.
- Fixed temp patch transport typo and newline escaping in `normalizeStreamCommits`.
- Implemented review comment normalization, provider detection, stream commit fetching, drawer actions, copy helpers, ChatGPT prompt opening, Codex prompt copying, file comment badges, and keyboard shortcuts.
- Started clean PR #727 from `stream/diff-cockpit` with task session `tsk_1ec8a67e1767`.
- Started incorrect PR #725 from `main`; closed it before code changes because it lacked phase-one files.
- Started PR #726 with reused bad branch/worktree; closed it before code changes.

## workspace-owned: validation evidence

- Red test: `bun --cwd=packages/diff-cockpit run test` failed before implementation because only PR/files were fetched and drawer actions were absent.
- Green test: `bun --cwd=packages/diff-cockpit run test` passed with 7 tests, 25 expectations, 0 failures.
- Typecheck: `bun --cwd=packages/diff-cockpit run typecheck` passed.
- Working-tree diff: 8 files changed, scoped to diff-cockpit source/tests plus task metadata.
- 2026-06-03 05:01:13 `review.run`: passed — OK
- 2026-06-03 05:03:51 `review.run`: passed — OK
- 2026-06-03 05:04:19 `verify`: passed — OK

## key decisions

- Primary agent handoff action copies a ChatGPT prompt and opens `https://chatgpt.com/`, leaving Ko to press send.
- Codex handoff is secondary and copies an `@codex` prompt instead of mutating GitHub comments in this task.
- Right review drawer remains closed by default.
- Recent stream commits are fetched only when the PR head branch starts with `stream/`.

## notes for ko

- PR #727 is the review PR for this task.
- The stream PR remains #722 after this task is promoted.

## improvements noticed

- `task.start` can reuse a previously closed branch/worktree if the same task title is started again; use a fresh slug after closing a bad task start.
- `task.call` with Bun requires the `--cwd=packages/...` form for this package test command.

## issues and recovery

- Multiline `fs.patch --content` was correctly rejected; switched to temp file plus `contentFile`.
- Initial temp Python patch had two stray quote characters at file start; removed them and reran the patch.
- Python source patch converted `split('\n')` into a real newline; patched to `split('\\n')`.

---

## publish checklist

```bash
bun run task:push -- --message "feat(diff-cockpit): add review action drawer" --changed
bun run task:pr
bun run task:finish
```

- 2026-06-03 04:59:47 write: `.task/diff-cockpit/add-phase-three-review-actions/workpad.md`

## workspace-owned: test selection

- changed files: `.task/diff-cockpit/add-phase-three-review-actions/current.json`, `.task/diff-cockpit/add-phase-three-review-actions/evidence-log.json`, `.task/diff-cockpit/add-phase-three-review-actions/read-log.json`, `.task/diff-cockpit/add-phase-three-review-actions/session.json`, `.task/diff-cockpit/add-phase-three-review-actions/workpad.md`, `.task/tasks/diff-cockpit/add-phase-three-review-actions.json`, `packages/diff-cockpit/src/index.ts`, `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

# ai review comments sidebar

branch: `task/diff-cockpit/ai-review-comments-sidebar`
stream: `stream/diff-cockpit`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/977/ai-review-comments-sidebar
github pr: https://github.com/consuelohq/opensaas/pull/977
started: 2026-06-11

## acceptance criteria

- [x] Branch is based on the compact review dashboard now merged into `stream/diff-cockpit`.
- [x] Review data exposes normalized AI review items for CodeRabbit and Codex/ChatGPT comments.
- [x] Review-thread items carry GitHub resolution state and can be resolved/unresolved through GraphQL when a thread id is present.
- [x] Top-level issue comments remain local-only resolution candidates and are labelled as local resolution.
- [x] The review page renders a second compact comments sidebar dedicated to AI review items.
- [x] Each AI item supports expand/collapse, copy link, copy body, copy agent prompt, jump to diff location when available, and resolve/unresolve when supported.
- [x] GitHub `pull_request_review_thread` webhook events invalidate the affected PR cache after signature verification.
- [x] Focused tests and typecheck pass.

## implementation summary

- Added `ReviewItem`, `ReviewThread`, and `ReviewThreadComment` models in `packages/diff-cockpit/src/index.ts`.
- Loads GitHub review threads through GraphQL when a token is available, then merges them with REST issue/review comments.
- Keeps GitHub review-thread state as the source of truth for resolvable inline review threads.
- Keeps top-level issue comments as local-only resolution candidates and labels them as local only in the UI.
- Added a second `AI comments` sidebar with compact expandable CodeRabbit/Codex cards, copy actions, jump actions, and resolve/unresolve actions.
- Added review-thread mutation endpoints under `/api/:owner/:repo/pull/:number/review-threads/:threadId/(resolve|unresolve)`.
- Added `/api/github/webhook` handling for signed `pull_request_review_thread` `resolved` and `unresolved` events to invalidate the affected PR cache.

## files changed

- `.task/diff-cockpit/ai-review-comments-sidebar/workpad.md`
- `.task/tasks/diff-cockpit/ai-review-comments-sidebar.json`
- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`

## workspace-owned: activity log

- 2026-06-11 19:31 synced `stream/diff-cockpit` and started branch two.
- 2026-06-11 19:34 merged `origin/stream/diff-cockpit` into the task worktree because the task bootstrap started from `main`.
- 2026-06-11 19:39 read rules, worker routes, loader, compact drawer, and client rendering code.
- 2026-06-11 19:42 added red coverage for normalized review items.
- 2026-06-11 19:44 implemented review item/thread models and GraphQL review-thread loading.
- 2026-06-11 19:46 implemented the dedicated AI comments sidebar shell, compact cards, copy/jump actions, and client-side resolve action wiring.
- 2026-06-11 19:52 added GitHub review-thread mutation and signed webhook cache invalidation routes.
- 2026-06-11 19:56 added tests for the sidebar shell, review-thread mutation endpoint, and webhook invalidation.
- 2026-06-11 19:59 fixed static review error-handling warning in webhook signature verification.
- 2026-06-11 20:02:28 fs.write: `.task/diff-cockpit/ai-review-comments-sidebar/workpad.md`

## workspace-owned: validation evidence

- PASS: `bun --cwd packages/diff-cockpit test tests/diff-cockpit.test.ts` — 33 pass, 0 fail, 315 expectations. Trace: `trc_f4261c9815a4`.
- PASS: `cd packages/diff-cockpit && bun run typecheck` — `tsc --noEmit -p tsconfig.json`. Trace: `trc_19f14fc0cf9a`.
- PARTIAL PASS: `bun run review` — all changed-file checks, eslint, spec compliance, and "YOUR CHANGES" passed; command exits non-zero only for pre-existing repo-level nx typecheck target discovery issue. Trace: `trc_f5936ac7db4c`.

## key decisions

- Keep the existing compact review drawer as the front-page dashboard; add AI comments as a separate sidebar.
- Prefer GitHub review-thread state where GraphQL thread ids are available; use local-only labels for issue-comment fallback.
- Validate GitHub webhook signatures with `x-hub-signature-256` before invalidating caches.

## issues and recovery

- Used raw `git merge origin/stream/diff-cockpit --no-edit` through `task.call` because no typed workspace tool surfaced a task-branch resync operation after `task.start` bootstrapped from `main`.
- `bun run review` still exits non-zero due a pre-existing workspace nx typecheck-target discovery issue, while this package's direct typecheck passes.

- 2026-06-11 20:02:28 write: `.task/diff-cockpit/ai-review-comments-sidebar/workpad.md`

## workspace-owned: files changed

- `.task/diff-cockpit/ai-review-comments-sidebar/workpad.md`
- `.task/tasks/diff-cockpit/ai-review-comments-sidebar.json`
- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`

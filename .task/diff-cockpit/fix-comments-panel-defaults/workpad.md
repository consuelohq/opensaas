# fix comments panel defaults

branch: `task/diff-cockpit/fix-comments-panel-defaults`
stream: `stream/diff-cockpit`
pr: #1044
started: 2026-06-14

## objective

Make the Diff Cockpit comments/commits panel match the review workflow: comments panel closed by default, user-facing copy says Comments, and commit lists show newest commits first.

## acceptance criteria

- [x] The right comments sidebar is closed on initial page load.
- [x] The top nav/comments sidebar user-facing labels say Comments instead of AI.
- [x] Commit popover and drawer commit lists render newest commits first.
- [x] Existing review drawer remains closed by default.
- [x] Behavior is covered by focused diff-cockpit tests.

## test-first contract

Behavior under test:

- `renderReviewPage()` should emit `data-ai-sidebar="closed"`, an inactive comments toggle, and hidden comments sidebar markup.
- User-facing comments panel labels should say Comments and should not show `AI comments`.
- The generated review client script should sort review/stream commits by `committedAt` descending before rendering commit lists.

Existing pattern to follow:

- `packages/diff-cockpit/tests/diff-cockpit.test.ts` asserts generated HTML/client script markers for the review page.
- `packages/diff-cockpit/src/index.ts` owns the Worker-rendered HTML string and embedded review client script.

Focused red command:

`bun --cwd packages/diff-cockpit test tests/diff-cockpit.test.ts`

Expected red failure before implementation:

- New assertions fail because the comments sidebar opens by default, user-facing text still says AI comments, and commit ordering is not explicitly newest-first.

## exploration

- Read root `AGENTS.md` and full `CODING-STANDARDS.md`.
- Read `packages/diff-cockpit/README.md`.
- Searched and read `packages/diff-cockpit/src/index.ts` around review page HTML, comments sidebar state, commit popover rendering, and drawer rendering.
- Read `packages/diff-cockpit/tests/diff-cockpit.test.ts` around existing review page assertions and commit loader tests.

## validation evidence

- Red: `bun --cwd packages/diff-cockpit test tests/diff-cockpit.test.ts` failed because rendered review HTML still loaded the comments sidebar open as `data-ai-sidebar="open"`.
- Green: `bun --cwd packages/diff-cockpit test tests/diff-cockpit.test.ts` passed: 34 pass, 0 fail, 355 expect calls.
- Typecheck: `bun run --cwd packages/diff-cockpit typecheck` passed.
- Review: `review.run --base origin/stream/diff-cockpit --noTests` passed for current changes; only a pre-existing project typecheck discovery note remained.
- Verify: `verify --base origin/stream/diff-cockpit` passed and wrote publish-valid `.task/diff-cockpit/fix-comments-panel-defaults/verify.json`.

## files changed

- `packages/diff-cockpit/tests/diff-cockpit.test.ts`

## workspace-owned: files changed

- `packages/diff-cockpit/tests/diff-cockpit.test.ts`

## workspace-owned: activity log

- 2026-06-14 22:38:17 fs.write: `.task/diff-cockpit/fix-comments-panel-defaults/workpad.md`
- 2026-06-14 22:39:33 patch lines 660-670: `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- 2026-06-14 22:39:33 fs.patch: `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- 2026-06-14 22:40:32 fs.patch: `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- 2026-06-14 22:41:14 fs.patch: `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- 2026-06-14 22:43:09 fs.patch: `packages/diff-cockpit/tests/diff-cockpit.test.ts`

## workspace-owned: files read

- `packages/diff-cockpit/tests/diff-cockpit.test.ts`

- 2026-06-14 22:41:14 patch lines 692-692: `packages/diff-cockpit/tests/diff-cockpit.test.ts`

## workspace-owned: TDD red evidence

- 2026-06-14 22:41:21 `bun --cwd packages/diff-cockpit test tests/diff-cockpit.test.ts`: failed exit 1 trace: `trc_0e2f95c0481e`
  - output: ed API cache [0.57ms] (pass) createWorker > refresh endpoint protects and prewarms homepage and PR API cache entries [0.68ms] (pass) createWorker > returns homepage API shared cache headers and 304 for unchanged ETags [0.19ms] (pass) createWorker > returns PR API cache headers and 304 for unchanged ETags [0.22ms] 1 tests failed: (fail) renderReviewPage > keeps the existing PR route and the right review panel closed by default [0.87ms] 33 pass 1 fail 215 expect() calls Ran 34 tests across 1 file. [41.00ms] error: script "test" exited with code 1 error: script "task:exec" exited with code 1

## workspace-owned: TDD green evidence

- 2026-06-14 22:42:49 `bun --cwd packages/diff-cockpit test tests/diff-cockpit.test.ts`: failed exit 1 trace: `trc_9c7521d32e0c`
  - output: ed API cache [0.54ms] (pass) createWorker > refresh endpoint protects and prewarms homepage and PR API cache entries [0.96ms] (pass) createWorker > returns homepage API shared cache headers and 304 for unchanged ETags [0.56ms] (pass) createWorker > returns PR API cache headers and 304 for unchanged ETags [0.48ms] 1 tests failed: (fail) renderReviewPage > keeps the existing PR route and the right review panel closed by default [0.65ms] 33 pass 1 fail 215 expect() calls Ran 34 tests across 1 file. [29.00ms] error: script "test" exited with code 1 error: script "task:exec" exited with code 1
- 2026-06-14 22:43:09 patch lines 665-665: `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- 2026-06-14 22:43:29 `bun --cwd packages/diff-cockpit test tests/diff-cockpit.test.ts`: passed exit 0 trace: `trc_917d07adeb4e`
  - output: packages and history [0.39ms] (pass) createWorker > refresh endpoint uses waitUntil so cron does not block on slow cache warming [0.84ms] (pass) createWorker > server-renders warmed inbox and PR pages from shared API cache [0.51ms] (pass) createWorker > refresh endpoint protects and prewarms homepage and PR API cache entries [0.60ms] (pass) createWorker > returns homepage API shared cache headers and 304 for unchanged ETags [0.44ms] (pass) createWorker > returns PR API cache headers and 304 for unchanged ETags [0.20ms] 34 pass 0 fail 355 expect() calls Ran 34 tests across 1 file. [31.00ms]

## workspace-owned: validation evidence

- pending
- 2026-06-14 22:44:43 `review.run`: passed — OK
- 2026-06-14 22:45:07 `review.run`: passed — OK
- 2026-06-14 22:45:21 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/diff-cockpit/fix-comments-panel-defaults/current.json`, `.task/diff-cockpit/fix-comments-panel-defaults/evidence-log.json`, `.task/diff-cockpit/fix-comments-panel-defaults/read-log.json`, `.task/diff-cockpit/fix-comments-panel-defaults/session.json`, `.task/diff-cockpit/fix-comments-panel-defaults/workpad.md`, `.task/tasks/diff-cockpit/fix-comments-panel-defaults.json`, `packages/diff-cockpit/src/index.ts`, `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

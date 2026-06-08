# main packages code browser

branch: `task/diff-cockpit/main-packages-code-browser`
stream: `stream/diff-cockpit`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/773/main-packages-code-browser
github pr: https://github.com/consuelohq/opensaas/pull/773
started: 2026-06-05

## acceptance criteria

- [ ] Add a visible `main` link on the homepage nav.
- [ ] Add a main-branch code browser focused on `packages/` by default.
- [ ] Use live GitHub data and avoid crawling the whole repo by default.
- [ ] Show file/folder rows with icons, latest commit message/date per entry, and commit count for the current path/ref.
- [ ] Add history view for the current path; clicking a commit opens the code browser at that commit SHA.
- [ ] Render markdown file contents for markdown files; render code/pre for other files.
- [ ] Deploy and promote to `stream/diff-cockpit`.

## test-first contract

Behavior under test:
- Homepage exposes a `main` link to `/consuelohq/opensaas/tree/main/packages` and no longer uses the old small square placeholder.
- Code browser shell exposes `data-code-browser-root`, `data-history-link`, and a live API path.
- Loader fetches only the requested path, enriches entries with latest commit data, and derives commit count from the GitHub Link header.
- History loader returns commits for a path; commit links target the tree page at the commit SHA.
- Worker routes tree/history pages and APIs.

Existing local pattern:
- `packages/diff-cockpit/tests/diff-cockpit.test.ts` uses deterministic fetcher stubs and string/route assertions.

New tests:
- code browser loader/history tests
- render tests for homepage main link and code/history shells
- worker route tests for code/history APIs/pages

Focused red command:
- `cd packages/diff-cockpit && bun test tests/diff-cockpit.test.ts`

Expected red failure:
- New functions/routes are missing and homepage still has the old placeholder.

## plan

1. Read current renderer/routes/tests.
2. Add red tests.
3. Implement loaders, routes, page shells, and client scripts.
4. Run focused tests and typecheck.
5. Deploy and smoke live pages/API.
6. Verify, push, promote, finish.

## current status

- Task started from `stream/diff-cockpit` in task session `tsk_fd77d8cfb25e`.
- Stream context shows `stream/diff-cockpit`; existing open task PR #742 is unrelated.
- Read `packages/diff-cockpit/src/index.ts` and tests around index/review routes.

## files changed

- `.task/diff-cockpit/main-packages-code-browser/workpad.md`

## key decisions

- Build an original GitHub-inspired file browser against live GitHub APIs instead of copying GitHub private HTML/assets.
- Default to `packages/` to reduce API fanout and focus on code.

## validation evidence

- none yet

## workspace-owned: TDD red evidence

- 2026-06-05 05:05:47 `bash -lc cd packages/diff-cockpit && bun test tests/diff-cockpit.test.ts`: failed exit 1 trace: `trc_20e158cb1f32`
  - output: → tmux: opensaas-diff-cockpit-main-packages-code-browser-fd77d8cf tests/diff-cockpit.test.ts: # Unhandled error between tests ------------------------------- SyntaxError: Export named 'renderCodeBrowserPage' not found in module '/private/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-worktrees/task-diff-cockpit-main-packages-code-browser/packages/diff-cockpit/src/index.ts'. ------------------------------- 0 pass 1 fail 1 error Ran 1 test across 1 file. [13.00ms] error: script "task:exec" exited with code 1

## workspace-owned: files read

- `packages/diff-cockpit/src/index.ts`

## workspace-owned: TDD green evidence

- 2026-06-05 05:08:12 `bash -lc cd packages/diff-cockpit && bun test tests/diff-cockpit.test.ts`: passed exit 0 trace: `trc_7a1347578b1f`
  - output: ute and the right review panel closed by default [2.78ms] (pass) createWorker > routes the homepage to the live PR index shell [0.47ms] (pass) createWorker > routes code browser pages and APIs for main packages and history [0.77ms] (pass) createWorker > refresh endpoint protects and prewarms homepage and PR API cache entries [1.11ms] (pass) createWorker > returns homepage API shared cache headers and 304 for unchanged ETags [0.26ms] (pass) createWorker > returns PR API cache headers and 304 for unchanged ETags [0.27ms] 25 pass 0 fail 200 expect() calls Ran 25 tests across 1 file. [28.00ms]
- 2026-06-05 05:11:47 `bash -lc cd packages/diff-cockpit && bun test tests/diff-cockpit.test.ts && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json`: passed exit 0 trace: `trc_f1cc7fd2047e`
  - output: ute and the right review panel closed by default [0.87ms] (pass) createWorker > routes the homepage to the live PR index shell [0.25ms] (pass) createWorker > routes code browser pages and APIs for main packages and history [0.39ms] (pass) createWorker > refresh endpoint protects and prewarms homepage and PR API cache entries [0.57ms] (pass) createWorker > returns homepage API shared cache headers and 304 for unchanged ETags [0.20ms] (pass) createWorker > returns PR API cache headers and 304 for unchanged ETags [0.28ms] 25 pass 0 fail 200 expect() calls Ran 25 tests across 1 file. [17.00ms]
- 2026-06-05 05:13:08 `bash -lc cd packages/diff-cockpit && bun test tests/diff-cockpit.test.ts && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json`: passed exit 0 trace: `trc_a71a495f1d54`
  - output: ute and the right review panel closed by default [0.83ms] (pass) createWorker > routes the homepage to the live PR index shell [0.25ms] (pass) createWorker > routes code browser pages and APIs for main packages and history [0.37ms] (pass) createWorker > refresh endpoint protects and prewarms homepage and PR API cache entries [0.52ms] (pass) createWorker > returns homepage API shared cache headers and 304 for unchanged ETags [0.18ms] (pass) createWorker > returns PR API cache headers and 304 for unchanged ETags [0.21ms] 25 pass 0 fail 200 expect() calls Ran 25 tests across 1 file. [19.00ms]

## update 2026-06-05 01:10

Implemented main branch `packages/` code browser for diff cockpit.

Implementation:
- Homepage nav now shows a visible `main` link to `/consuelohq/opensaas/tree/main/packages` instead of the old square placeholder.
- Added code browser routes:
  - `/consuelohq/opensaas/tree/main/packages`
  - `/consuelohq/opensaas/tree/<commit-sha>/packages`
  - `/consuelohq/opensaas/history/main/packages`
- Added APIs:
  - `/api/consuelohq/opensaas/code?ref=main&path=packages`
  - `/api/consuelohq/opensaas/history?ref=main&path=packages`
- Code browser pulls live GitHub contents for only the requested path, defaults to `packages`, enriches rows with latest commit metadata, and parses commit count from GitHub's Link header.
- History view lists commits for the path; commit links open the same path at that commit SHA.
- Markdown files render as simple HTML; other files render as escaped code/pre.

Validation evidence:
- Red test first: focused test failed because `renderCodeBrowserPage` was not exported yet.
- Green focused test: `cd packages/diff-cockpit && bun test tests/diff-cockpit.test.ts` passed with 25 tests and 200 expectations.
- Typecheck: `cd packages/diff-cockpit && ../../node_modules/.bin/tsc --noEmit -p tsconfig.json` passed.
- Local live GitHub smoke: tree page returned 200, code API returned packages entries, history API returned commits, and package JSON file rendered.
- Markdown smoke: `packages/diff-cockpit/README.md` returned 200 with markdown rendering.
- Cloudflare deploy: Worker version `ae7d6590-12b5-4504-9067-9e546a685033` deployed to `diffs.consuelohq.com`.
- Live smoke against `diffs.consuelohq.com` passed for page, code API, history API, and markdown rendering.

Key decisions:
- Keep first version scoped to packages rather than root repo tree to avoid large/high-noise API traversal.
- Build an original GitHub-inspired UI instead of copying GitHub HTML/assets.

## workspace-owned: validation evidence

- 2026-06-05 05:11:22 `verify`: failed — COMMAND_FAILED
- 2026-06-05 05:12:46 `verify`: failed — COMMAND_FAILED
- 2026-06-05 05:13:28 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/diff-cockpit/main-packages-code-browser/current.json`, `.task/diff-cockpit/main-packages-code-browser/evidence-log.json`, `.task/diff-cockpit/main-packages-code-browser/read-log.json`, `.task/diff-cockpit/main-packages-code-browser/session.json`, `.task/diff-cockpit/main-packages-code-browser/workpad.md`, `.task/tasks/diff-cockpit/main-packages-code-browser.json`, `packages/diff-cockpit/src/index.ts`, `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## update 2026-06-05 01:12

Verify initially failed on static review because the embedded browser client script used bare `catch (error)` blocks. Rewrote those script snippets to use promise `.catch(...)` handlers.

Additional validation:
- Focused tests + typecheck passed after the static-rule patch.
- Redeployed Cloudflare Worker version `d8262c19-c709-40b9-a3a4-410cd458382b`.
- Reran live smoke after redeploy: page/code API/history API/markdown all returned expected results.

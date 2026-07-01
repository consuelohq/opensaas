# polish main code browser search and cache

branch: `task/diff-cockpit/polish-main-code-browser-search-and-cache`
stream: `stream/diff-cockpit`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/777/polish-main-code-browser-search-and-cache
github pr: https://github.com/consuelohq/opensaas/pull/777
started: 2026-06-05

## acceptance criteria

- [ ] Add a visible search bar on the main code browser page.
- [ ] `/` focuses the code browser search input without breaking typing in inputs.
- [ ] Search filters directory rows by name/path/commit message and provides useful empty state.
- [ ] File pages expose a copy-path control to the far right of the file header; clicking copies the file path.
- [ ] Reduce oversized/bold text on the code browser/file page.
- [ ] Extend the existing cache refresh endpoint and workspace hook result shape so code/history API entries are prewarmed using the same edge-cache strategy as homepage/PR details.
- [ ] Deploy to Cloudflare and promote to `stream/diff-cockpit`.

## test-first contract

Behavior under test:
- `renderCodeBrowserPage` contains a search input with `/` keyboard hint and client script support for `focusSearch`, `state.search`, row filtering, and empty state.
- `renderCodeBrowserPage` client script includes a copy path button/action for file pages.
- CSS reflects smaller/lighter code-browser typography.
- `handleCacheRefresh` prewarms code and history API entries for `packages` by default and reports them in the refresh payload.
- Workspace refresh hook accepts/returns code path refresh data.

Existing local pattern:
- `packages/diff-cockpit/tests/diff-cockpit.test.ts` uses deterministic fetcher stubs and string/route assertions.
- `packages/workspace/hooks/diff-cockpit/cache-refresh.ts` validates the internal refresh response payload shape.

New/changed tests:
- Extend code-browser render test with search/copy/typography assertions.
- Extend cache refresh endpoint test to assert code/history entries are warmed and then hit cache without additional fetch calls.
- Add or update workspace hook tests if a matching test file exists; otherwise rely on focused typecheck plus package test.

Focused red command:
- `cd packages/diff-cockpit && bun test tests/diff-cockpit.test.ts`

Expected red failure:
- Assertions fail because search/copy strings and refreshed code/history payloads are not implemented yet.

## plan

1. Read current code browser rendering, cache refresh endpoint, tests, and workspace hook.
2. Add red tests first.
3. Implement search/copy/typography and cache refresh prewarming.
4. Run focused tests, typecheck, verify.
5. Deploy and live smoke.
6. Push, promote, finish.

## current status

- Task started from `stream/diff-cockpit` with task session `tsk_6bfd748c86cc`.
- Stream context shows existing unrelated open PR #742 and recent main code browser task landed on stream.
- Read `packages/diff-cockpit/src/index.ts`, refresh endpoint, code browser renderers, existing tests, and workspace cache refresh hook.

## files changed

- `.task/diff-cockpit/polish-main-code-browser-search-and-cache/workpad.md`

## key decisions

- Keep the search client-side over the currently loaded directory/file data for this pass; do not add a whole-repo code search API yet.
- Prewarm `packages` code/history by default on cache refresh, with optional `codePaths` for future expansion.

## validation evidence

- none yet

## workspace-owned: TDD red evidence

- 2026-06-05 05:35:23 `bash -lc bun --cwd=packages/diff-cockpit test tests/diff-cockpit.test.ts`: failed exit 1 trace: `trc_e13e397f9356`
  - output: dpoint protects and prewarms homepage and PR API cache entries [0.94ms] (pass) createWorker > returns homepage API shared cache headers and 304 for unchanged ETags [0.19ms] (pass) createWorker > returns PR API cache headers and 304 for unchanged ETags [0.21ms] 2 tests failed: (fail) renderCodeBrowserPage > renders the main packages browser shell and history shell [0.47ms] (fail) createWorker > refresh endpoint protects and prewarms homepage and PR API cache entries [0.94ms] 23 pass 2 fail 195 expect() calls Ran 25 tests across 1 file. [27.00ms] error: script "task:exec" exited with code 1

## workspace-owned: files read

- `packages/diff-cockpit/src/index.ts`
- `packages/workspace/scripts/task-push.js`

## workspace-owned: TDD green evidence

- 2026-06-05 05:38:17 `bash -lc bun --cwd=packages/diff-cockpit test tests/diff-cockpit.test.ts`: passed exit 0 trace: `trc_d581227ab3e2`
  - output: ute and the right review panel closed by default [0.80ms] (pass) createWorker > routes the homepage to the live PR index shell [0.24ms] (pass) createWorker > routes code browser pages and APIs for main packages and history [0.35ms] (pass) createWorker > refresh endpoint protects and prewarms homepage and PR API cache entries [0.74ms] (pass) createWorker > returns homepage API shared cache headers and 304 for unchanged ETags [0.20ms] (pass) createWorker > returns PR API cache headers and 304 for unchanged ETags [0.21ms] 25 pass 0 fail 213 expect() calls Ran 25 tests across 1 file. [19.00ms]
- 2026-06-05 05:41:15 `bash -lc bun --cwd=packages/diff-cockpit test tests/diff-cockpit.test.ts && bun --cwd=packages/diff-cockpit run typecheck`: failed exit 1 trace: `trc_24f9eed82e18`
  - output: nd-cache/packages/diff-cockpit/tests/diff-cockpit.test.ts:697:38) (fail) createWorker > refresh endpoint protects and prewarms homepage and PR API cache entries [1.54ms] (pass) createWorker > returns homepage API shared cache headers and 304 for unchanged ETags [0.22ms] (pass) createWorker > returns PR API cache headers and 304 for unchanged ETags [0.24ms] 1 tests failed: (fail) createWorker > refresh endpoint protects and prewarms homepage and PR API cache entries [1.54ms] 24 pass 1 fail 207 expect() calls Ran 25 tests across 1 file. [37.00ms] error: script "task:exec" exited with code 1
- 2026-06-05 05:41:34 `bash -lc bun --cwd=packages/diff-cockpit test tests/diff-cockpit.test.ts && bun --cwd=packages/diff-cockpit run typecheck`: passed exit 0 trace: `trc_b965dc580711`
  - output: losed by default [0.91ms] (pass) createWorker > routes the homepage to the live PR index shell [0.34ms] (pass) createWorker > routes code browser pages and APIs for main packages and history [0.43ms] (pass) createWorker > refresh endpoint protects and prewarms homepage and PR API cache entries [0.88ms] (pass) createWorker > returns homepage API shared cache headers and 304 for unchanged ETags [1.02ms] (pass) createWorker > returns PR API cache headers and 304 for unchanged ETags [0.48ms] 25 pass 0 fail 213 expect() calls Ran 25 tests across 1 file. [23.00ms] $ tsc --noEmit -p tsconfig.json

## workspace-owned: validation evidence

- 2026-06-05 05:39:53 `checkFiles`: passed — OK
- 2026-06-05 05:41:46 `checkFiles`: passed — OK
- 2026-06-05 05:44:01 `verify`: passed — OK

## update 2026-06-05 01:43

Implemented code browser polish and cache refresh expansion.

Implementation:
- Added visible search input on code browser pages with `/` keyboard shortcut via `focusSearch`.
- Directory pages now filter loaded rows by name/path/latest commit message/latest commit author and show a `No files match` empty state.
- File pages now show a copy-path button in the file header next to History; it uses `navigator.clipboard.writeText` and falls back to showing the path.
- Reduced code browser hero and row typography: smaller `main` heading and lighter file row names.
- Extended internal cache refresh endpoint to prewarm `/api/:owner/:repo/code?ref=main&path=packages` and `/api/:owner/:repo/history?ref=main&path=packages` by default, plus optional future `codePaths`.
- Updated workspace diff-cockpit cache refresh hook result shape to accept/report `code` and `history` warmed paths.

Validation evidence:
- Red focused test failed first because `id="code-search"` did not exist.
- Green focused test: `bun --cwd=packages/diff-cockpit test tests/diff-cockpit.test.ts` passed with 25 tests and 213 expectations.
- Typecheck: `bun --cwd=packages/diff-cockpit run typecheck` passed.
- Syntax checks: `checkFiles` passed for diff-cockpit source/test and workspace cache refresh hook.
- Hook import smoke: `bun -e "import('./packages/workspace/hooks/diff-cockpit/cache-refresh.ts')"` returned `function`.
- Cloudflare deploy: Worker version `5a31b5c3-ce9e-4b2c-8087-a85a4caf03ea` deployed to `diffs.consuelohq.com`.
- Live smoke passed: page contains search/copy/typography markers, code API returns packages entries, file page contains search/copy markers, history API returns commits.

Cache strategy:
- Code and history APIs already use the shared Worker Cache API on normal GET.
- Refresh endpoint now explicitly replaces the shared edge cache for homepage, requested PRs, main packages code, and main packages history.
- The workspace hook sends `codePaths: ['packages']` by default, so task pushes can prewarm those entries for everyone once `DIFF_COCKPIT_REFRESH_TOKEN` is configured.

## workspace-owned: test selection

- changed files: `.task/diff-cockpit/polish-main-code-browser-search-and-cache/current.json`, `.task/diff-cockpit/polish-main-code-browser-search-and-cache/evidence-log.json`, `.task/diff-cockpit/polish-main-code-browser-search-and-cache/read-log.json`, `.task/diff-cockpit/polish-main-code-browser-search-and-cache/session.json`, `.task/diff-cockpit/polish-main-code-browser-search-and-cache/workpad.md`, `.task/tasks/diff-cockpit/polish-main-code-browser-search-and-cache.json`, `packages/diff-cockpit/src/index.ts`, `packages/diff-cockpit/tests/diff-cockpit.test.ts`, `packages/workspace/hooks/diff-cockpit/cache-refresh.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

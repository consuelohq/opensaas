# add wiki inspired diff cockpit index

## acceptance criteria

- [x] Define explicit task acceptance criteria before coding.
- [ ] Clone the Consuelo Wiki visual language into Diff Cockpit: mono typography, light/dark variables, text-only cards, filter row, search toggle, and no mobile zoom on search input.
- [ ] Keep the existing PR route shape working: `/owner/repo/pull/number` remains the diff review page.
- [ ] Add a live PR index/home route that loads open GitHub PRs from live API data.
- [ ] Card primary links open the Diff Cockpit diff route.
- [ ] Add collapsible index sections for easy navigation.
- [ ] Keep the review drawer closed by default.
- [ ] Use browser verification against the built site.
- [ ] Address relevant CodeRabbit reliability comments after the main UI/index work.

## test-first contract

behavior under test: Diff Cockpit index and review pages preserve the Consuelo Wiki shell behavior while using live PR data and existing diff route behavior.

existing pattern to follow: `packages/diff-cockpit/tests/diff-cockpit.test.ts` renders HTML strings and mocks live GitHub fetchers. `packages/workspace/scripts/consuelo-design.ts` owns the Consuelo Wiki shell, filter row, search toggle, local/Pagefind search fallback, pagination, mono typography, and light/dark theme variables.

intended tests:
- `renderIndexPage` includes the wiki shell markers, theme variables, search toggle, filters, collapsible section, no-border text-card class, and 16px search input behavior.
- `createGithubPullRequestIndexLoader` fetches live open PR data from GitHub and normalizes PR rows for the index.
- `renderIndexPage` cards/routes target `/owner/repo/pull/number`, not GitHub as the primary route.
- `renderReviewPage` keeps the same PR route and keeps the right drawer closed by default.
- loader edge tests cover GitHub API errors, non-stream PRs, empty arrays, and paginated arrays.

focused red command: `bun --cwd=packages/diff-cockpit run test`

expected red failure: new index renderer/loader/wiki-shell assertions fail before implementation because no homepage route or index renderer exists yet.

## plan

1. Add failing tests for the index route, wiki shell UI, route preservation, and live index loader.
2. Implement the index/home route and wiki-inspired shell in `packages/diff-cockpit/src/index.ts`.
3. Keep the diff review route intact and drawer closed by default.
4. Run focused tests and typecheck.
5. Use browser verification against local/worker route.
6. Address CodeRabbit reliability comments that remain in scope.
7. Run review, verify, push, and promote.

## current status

Task started from `stream/diff-cockpit` after Ko approval.

- 2026-06-03 05:47:37 write: `.task/diff-cockpit/add-wiki-inspired-diff-cockpit-index/workpad.md`

## files changed

- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/bun-test.d.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- `packages/diff-cockpit/tsconfig.json`

## workspace-owned: files changed

- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/bun-test.d.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- `packages/diff-cockpit/tsconfig.json`

## workspace-owned: activity log

- 2026-06-03 05:47:37 fs.write: `.task/diff-cockpit/add-wiki-inspired-diff-cockpit-index/workpad.md`
- 2026-06-03 05:48:40 write: `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- 2026-06-03 05:48:40 fs.write: `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- 2026-06-03 05:52:12 fs.write: `packages/diff-cockpit/src/index.ts`
- 2026-06-03 05:54:59 fs.write: `.task/diff-cockpit/add-wiki-inspired-diff-cockpit-index/calls-expectation.patch.txt`
- 2026-06-03 05:59:10 fs.patch: `packages/diff-cockpit/tsconfig.json`
- 2026-06-03 06:01:20 fs.write: `packages/diff-cockpit/tsconfig.json`
- 2026-06-03 06:02:24 fs.write: `packages/diff-cockpit/tsconfig.json`
- 2026-06-03 06:02:47 fs.write: `packages/diff-cockpit/tests/bun-test.d.ts`
- 2026-06-03 06:05:07 fs.write: `.task/diff-cockpit/add-wiki-inspired-diff-cockpit-index/local-server.mjs`
- 2026-06-03 06:05:43 fs.write: `.task/diff-cockpit/add-wiki-inspired-diff-cockpit-index/render-static.mjs`

## workspace-owned: validation evidence

- 2026-06-03 05:49:13 `checkFiles`: passed — OK
- 2026-06-03 05:52:12 write: `packages/diff-cockpit/src/index.ts`
- 2026-06-03 05:52:51 `checkFiles`: passed — OK
- 2026-06-03 06:10:14 `review.run`: passed — OK
- 2026-06-03 06:11:29 `verify`: passed — OK

## workspace-owned: files read

- `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- `packages/diff-cockpit/tsconfig.json`

- 2026-06-03 06:01:20 write: `packages/diff-cockpit/tsconfig.json`

- 2026-06-03 06:02:24 write: `packages/diff-cockpit/tsconfig.json`

- 2026-06-03 06:02:47 write: `packages/diff-cockpit/tests/bun-test.d.ts`

- 2026-06-03 06:05:07 write: `.task/diff-cockpit/add-wiki-inspired-diff-cockpit-index/local-server.mjs`

- 2026-06-03 06:05:43 write: `.task/diff-cockpit/add-wiki-inspired-diff-cockpit-index/render-static.mjs`

## workspace-owned: test selection

- changed files: `.task/diff-cockpit/add-wiki-inspired-diff-cockpit-index/calls-expectation.patch.txt`, `.task/diff-cockpit/add-wiki-inspired-diff-cockpit-index/current.json`, `.task/diff-cockpit/add-wiki-inspired-diff-cockpit-index/evidence-log.json`, `.task/diff-cockpit/add-wiki-inspired-diff-cockpit-index/local-server.mjs`, `.task/diff-cockpit/add-wiki-inspired-diff-cockpit-index/read-log.json`, `.task/diff-cockpit/add-wiki-inspired-diff-cockpit-index/render-static.mjs`, `.task/diff-cockpit/add-wiki-inspired-diff-cockpit-index/session.json`, `.task/diff-cockpit/add-wiki-inspired-diff-cockpit-index/workpad.md`, `.task/tasks/diff-cockpit/add-wiki-inspired-diff-cockpit-index.json`, `packages/diff-cockpit/src/index.ts`, `packages/diff-cockpit/tests/bun-test.d.ts`, `packages/diff-cockpit/tests/diff-cockpit.test.ts`, `packages/diff-cockpit/tsconfig.json`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

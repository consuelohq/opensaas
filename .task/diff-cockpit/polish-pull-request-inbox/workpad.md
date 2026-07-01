# polish pull request inbox

branch: `task/diff-cockpit/polish-pull-request-inbox`
stream: `stream/diff-cockpit`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/737/polish-pull-request-inbox
github pr: https://github.com/consuelohq/opensaas/pull/737
started: 2026-06-03

## acceptance criteria

- [x] Top Streams section shows only open streams by default.
- [x] Clicking the Streams count toggles all streams, including closed streams.
- [x] Reorder homepage sections: Streams, Merging and recently merged, Open, Closed.
- [x] Add per-section pagination with 10 PRs per section.
- [x] Use more horizontal space on desktop.
- [x] Move author and PR number onto the title row.
- [x] Merge stream, branch, delta, changed-file count, and relative updated time into the second row.
- [x] Avoid the blue default focus/tap bar on mouse/touch clicks while retaining focus-visible keyboard affordance.
- [x] Replace dash unknown status icons with explicit unknown/none symbols.
- [x] Add cached-first client behavior using localStorage, then refresh live data with no-cache fetch.
- [x] Add API cache-control headers for short HTTP caching and stale-while-revalidate behavior.
- [x] Validate with focused TDD tests, typecheck, review, and verify.

## test-first contract

behavior under test: stream-count toggle, section ordering, per-section paging affordances, dense row layout, focus/tap behavior, cached-first load, and existing homepage regressions.

focused red command: `bun --cwd=packages/diff-cockpit run test`

red evidence: tests initially failed because section order was still Streams/Open/Merged/Closed, streams included closed streams by default, and the client lacked section paging/cache/toggle/dense-layout code.

## current status

- Implemented polish pass.
- Tests pass: 16 tests, 87 assertions.
- Typecheck passes.
- Review and verify pass with publish-valid stamp.
- Ready to push/promote/deploy.

## files changed

- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- `.task/diff-cockpit/polish-pull-request-inbox/*`
- `.task/tasks/diff-cockpit/polish-pull-request-inbox.json`

## workspace-owned: files changed

- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- `.task/diff-cockpit/polish-pull-request-inbox/workpad.md`

## workspace-owned: files read

- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`

## workspace-owned: activity log

- Started from `stream/diff-cockpit` in task session `tsk_be4a4abbebc5`.
- Added TDD assertions for open-stream default, all-stream toggle, section ordering, section pagination, local cache, focus behavior, and dense rows.
- Implemented `showAllStreams` option in `groupPullRequestSummaries`.
- Reordered helper and client sections.
- Rebuilt homepage client row rendering and per-section pagination.
- Added localStorage cached-first load and no-cache network refresh.
- Added JSON cache-control headers.
- Added focus/tap CSS to stop the blue default click bar from persisting on mouse/touch interactions.

## workspace-owned: validation evidence

- Focused test: `bun --cwd=packages/diff-cockpit run test` passed with 16 tests, 87 expectations, 0 failures.
- Typecheck: `./node_modules/.bin/tsc --noEmit -p packages/diff-cockpit/tsconfig.json` passed.
- Review: no issues from this change; only pre-existing project typecheck metadata note.
- Verify: publish-valid stamp written.
- 2026-06-03 08:32:02 `verify`: passed — OK

## key decisions

- Local cache is client-side first: render cached PR data immediately, then refresh from the live API.
- API sends short-lived HTTP cache headers: `public, max-age=45, stale-while-revalidate=300`.
- Push-triggered hard invalidation is left as a future operator-script hook; this task gives the browser/server behavior needed for fast loads now.
- Unknown check/review states now render as `?` or `○`, not a dash.

## notes for ko

- The checks/review dash issue is partly data availability: Cloudflare deploy output only shows `DIFF_COCKPIT_DEFAULT_REPO` as a binding, so if GitHub check/review APIs need auth/rate-limit relief, we may still need to set a Cloudflare secret for `GITHUB_TOKEN` next.

---

## publish checklist

```bash
bun run task:push -- --message "feat(diff-cockpit): polish pull request inbox" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: test selection

- changed files: `.task/diff-cockpit/polish-pull-request-inbox/current.json`, `.task/diff-cockpit/polish-pull-request-inbox/evidence-log.json`, `.task/diff-cockpit/polish-pull-request-inbox/read-log.json`, `.task/diff-cockpit/polish-pull-request-inbox/session.json`, `.task/diff-cockpit/polish-pull-request-inbox/verify.json`, `.task/diff-cockpit/polish-pull-request-inbox/workpad.md`, `.task/tasks/diff-cockpit/polish-pull-request-inbox.json`, `packages/diff-cockpit/src/index.ts`, `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

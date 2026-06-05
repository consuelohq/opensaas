# polish status rows

branch: `task/diff-cockpit/polish-status-rows`
stream: `stream/diff-cockpit`
pr: https://github.com/consuelohq/opensaas/pull/738
started: 2026-06-03

## acceptance criteria

- [x] Diagnose why checks/reviews stayed unknown after adding `GITHUB_TOKEN`.
- [x] Prevent homepage index from exceeding Cloudflare Worker subrequest limits.
- [x] Keep homepage status enrichment useful for recent visible PRs.
- [x] Move plus/minus delta to the far-right row position.
- [x] Move check/review icons inward before the delta.
- [x] Keep changed-file count on the metadata row.
- [x] Remove the extra bottom separator line below the last stream row when no pager is present.
- [x] Add focused assertions for the layout and subrequest-limit behavior.
- [x] Run tests, typecheck, review, and verify.

## root cause

The Worker was not mainly failing because the token was missing. The deployed endpoint was trying to enrich hundreds of PRs in a single request. Cloudflare returned `Too many subrequests by single Worker invocation`, so check/review enrichment degraded to `unknown`/`none` and sometimes surfaced as 502.

## implementation

- Index loading now fetches only the first recently updated PR page for the homepage.
- Index enrichment is capped to `INDEX_ENRICH_LIMIT = 40` PRs per request.
- Full multi-page fetching remains available for PR-detail routes where the request scope is one PR.
- Row layout now renders status icons first and the delta as right-aligned `.pr-delta` at the far right.
- Metadata row now keeps stream, branch, changed-file count, and relative update time.
- Last row in a section no longer draws an extra bottom separator.

## validation evidence

- Focused tests: `bun test tests/diff-cockpit.test.ts` passed with 17 tests and 124 expectations.
- Typecheck: `tsc --noEmit -p packages/diff-cockpit/tsconfig.json` passed.
- Review: 0 issues from this change; only pre-existing project typecheck metadata note.
- Verify: publish-valid stamp written.

## notes

The `GITHUB_TOKEN` secret is still useful for GitHub rate limits/private visibility, but this task fixes the Cloudflare subrequest-limit problem that was preventing status enrichment on the homepage.

## workspace-owned: validation evidence

- Focused tests: `bun test tests/diff-cockpit.test.ts` passed with 17 tests and 124 expectations.
- Typecheck: `tsc --noEmit -p packages/diff-cockpit/tsconfig.json` passed.
- Review: 0 issues from this change; only pre-existing project typecheck metadata note.
- Verify: publish-valid stamp written.
- 2026-06-03 08:57:45 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/diff-cockpit/polish-status-rows/current.json`, `.task/diff-cockpit/polish-status-rows/evidence-log.json`, `.task/diff-cockpit/polish-status-rows/read-log.json`, `.task/diff-cockpit/polish-status-rows/session.json`, `.task/diff-cockpit/polish-status-rows/verify.json`, `.task/diff-cockpit/polish-status-rows/workpad.md`, `.task/tasks/diff-cockpit/polish-status-rows.json`, `packages/diff-cockpit/src/index.ts`, `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

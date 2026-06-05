# rework home screen

branch: `task/diff-cockpit/rework-home-screen`
stream: `stream/diff-cockpit`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/734/rework-home-screen
github pr: https://github.com/consuelohq/opensaas/pull/734
started: 2026-06-03

## acceptance criteria

- [x] Define explicit task acceptance criteria before coding.
- [x] Complete read-only orientation before editing.
- [x] Replace the wiki-style flat index with a Graphite-inspired pull request inbox layout.
- [x] Rename user-facing `Recently Updated` copy to `Pull Requests`.
- [x] Remove bottom pagination and use collapsible sections instead.
- [x] Add sections for `Streams`, `Open`, `Merging and recently merged`, and `Closed`.
- [x] Show PR title, author, repo, PR number, associated stream, line delta, changed-file count, relative updated time, check status, review status, and lifecycle status.
- [x] Make the title link open the PR review page while associated stream text filters the index to that stream.
- [x] Use real live GitHub status signals for failing/success/pending filters instead of fake `state !== open` logic.
- [x] Preserve mobile usability with compact row wrapping.
- [x] Address overlapping CodeRabbit comments: real failing filter, surfaced partial fetch warnings, and narrow 404 fallback catch.
- [x] Validate with TDD assertions, package tests, typecheck/review/verify, then push and promote.

## test-first contract

behavior under test: live all-state pull request index loading, enriched status metadata, stream derivation, section grouping, stream filter UI affordances, no pagination, Pull Requests copy, and CodeRabbit regression fixes.

focused red command: `bun --cwd=packages/diff-cockpit run test`

red evidence: new tests initially failed because `groupPullRequestSummaries` was not exported and the homepage loader did not yet support enriched all-state PR data.

## current status

- Implemented homepage/index rework.
- Focused package tests pass.
- Typecheck passed through direct `tsc` and verify/review.
- Verify wrote a publish-valid stamp.
- Ready for task push/promote/deploy.

## files changed

- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- `.task/diff-cockpit/rework-home-screen/*`
- `.task/tasks/diff-cockpit/rework-home-screen.json`

## workspace-owned: files changed

- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- `.task/diff-cockpit/rework-home-screen/workpad.md`

## workspace-owned: files read

- `packages/diff-cockpit/package.json`
- `packages/diff-cockpit/src/index.ts`
- `packages/diff-cockpit/tests/diff-cockpit.test.ts`

## workspace-owned: activity log

- Started task from `stream/diff-cockpit` at `7b9bff39`.
- Confirmed current homepage fetched open PRs only, used `Recently Updated`, flat pagination, and fake failing filter.
- Confirmed active CodeRabbit comments overlapped with this task.
- Added TDD assertions for all-state PR loading, enriched metadata, stream derivation, section grouping, stream filter UI, no pagination, Pull Requests copy, and real failing filter.
- Implemented all-state index loader with detail/check-run/review enrichment.
- Added `deriveAssociatedStream` and `groupPullRequestSummaries`.
- Reworked homepage into collapsible sections with Graphite-style rows and stream filtering.
- Added partial warning surfacing for optional review/check enrichment failures.
- Narrowed fallback route catch so only locator parse failures return 404.
- Fixed review blocker by wrapping PR summary enrichment with local error handling and fallback summary behavior.

## workspace-owned: validation evidence

- Red test: `bun --cwd=packages/diff-cockpit run test` failed before implementation because `groupPullRequestSummaries` was missing.
- Green test: `bun --cwd=packages/diff-cockpit run test` passed with 15 tests, 74 expectations, 0 failures.
- Typecheck: direct `tsc --noEmit -p packages/diff-cockpit/tsconfig.json` passed.
- Review/verify: verify ran static rules, eslint, typecheck, spec compliance, DB guard; publish-valid stamp written.
- 2026-06-03 08:05:52 `verify`: passed — OK

## key decisions

- Keep homepage duplication-free in data fetch but allow Graphite-style section duplication: stream PRs appear in both Streams and Open.
- Derive associated stream from head branch first, then base branch, then `task/<area>/...` mapping to `stream/<area>`.
- Keep stream filter behavior on the smaller stream text/button, not on the PR title.
- Use warnings array for partial enrichment failures instead of silently discarding context.

## notes for ko

- The task PR is #734. After `task:pr`, the stream PR remains #722.
- Homepage deploy target remains `diffs.consuelohq.com`.

## improvements noticed

- `fs.patch` line ranges behaved unexpectedly on the test import block; direct task-scoped Python/Node edits were more reliable for this file.
- The lower-level typecheck command was intermittently blocked by the safety layer, but verify still ran typecheck through the repo review path.

## issues and recovery

- A first import patch corrupted the test file; recovered with `git checkout -- packages/diff-cockpit/tests/diff-cockpit.test.ts` before applying tests safely.
- Review flagged async enrichment without local try/catch; added a warning-producing fallback.

---

## publish checklist

```bash
bun run task:push -- --message "feat(diff-cockpit): rework home screen" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: test selection

- changed files: `.task/diff-cockpit/rework-home-screen/current.json`, `.task/diff-cockpit/rework-home-screen/evidence-log.json`, `.task/diff-cockpit/rework-home-screen/read-log.json`, `.task/diff-cockpit/rework-home-screen/session.json`, `.task/diff-cockpit/rework-home-screen/verify.json`, `.task/diff-cockpit/rework-home-screen/workpad.md`, `.task/tasks/diff-cockpit/rework-home-screen.json`, `packages/diff-cockpit/src/index.ts`, `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

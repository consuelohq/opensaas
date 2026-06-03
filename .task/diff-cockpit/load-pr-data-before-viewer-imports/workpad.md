# load pr data before viewer imports

## problem

The public PR route loaded the shell but stayed stuck on `Loading...` in the file pane. The live API route returned PR data quickly, so the failure was client boot order, not GitHub or Cloudflare.

Root cause: `renderReviewClientScript` waited for external viewer imports from `@pierre/diffs` and `@pierre/trees` before calling `loadLiveData()`. If either CDN import hung or stalled, the PR data fetch never started.

## fix

- Call `loadLiveData()` immediately.
- Start `loadViewerLibraries()` separately as progressive enhancement.
- If viewer imports finish after PR data is already loaded, rerender the selected file to upgrade from fallback patch rendering.
- Add a regression test asserting `loadLiveData();` appears before `loadViewerLibraries();` and the old `finally(loadLiveData)` pattern is gone.

## validation

- `curl https://diffs.consuelohq.com/api/consuelohq/opensaas/pull/722` returns live PR data.
- `bun run --cwd packages/diff-cockpit test` passes.
- `bun run --cwd packages/diff-cockpit typecheck` passes.

- 2026-06-03 06:49:01 write: `.task/diff-cockpit/load-pr-data-before-viewer-imports/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-03 06:49:01 fs.write: `.task/diff-cockpit/load-pr-data-before-viewer-imports/workpad.md`

## workspace-owned: validation evidence

- 2026-06-03 06:49:23 `review.run`: passed — OK
- 2026-06-03 06:49:36 `verify`: passed — OK
- 2026-06-03 06:50:06 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/diff-cockpit/load-pr-data-before-viewer-imports/current.json`, `.task/diff-cockpit/load-pr-data-before-viewer-imports/evidence-log.json`, `.task/diff-cockpit/load-pr-data-before-viewer-imports/read-log.json`, `.task/diff-cockpit/load-pr-data-before-viewer-imports/session.json`, `.task/diff-cockpit/load-pr-data-before-viewer-imports/verify.json`, `.task/diff-cockpit/load-pr-data-before-viewer-imports/workpad.md`, `.task/tasks/diff-cockpit/load-pr-data-before-viewer-imports.json`, `packages/diff-cockpit/src/index.ts`, `packages/diff-cockpit/tests/bun-test.d.ts`, `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

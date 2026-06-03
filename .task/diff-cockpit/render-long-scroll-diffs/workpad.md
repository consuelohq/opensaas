# render long scroll diffs

## problem

The PR page now loaded live data and the file tree, but the main diff body stayed blank. The selected file header updated, which proved the API and state were healthy. The blank body came from the optional `@pierre/diffs` renderer path taking over and not producing visible content.

Ko also clarified the desired behavior: the PR page should feel like DiffsHub, with one long scrollable diff document instead of a single selected-file pane.

## fix

- Render all changed files in the right pane as one long scrollable document.
- Keep the left tree as navigation/selection; clicking a file scrolls the long diff to that file.
- Render the built-in patch fallback immediately for every file.
- Stop the optional Pierre renderer from taking over the visible diff body.
- Add sticky per-file headers and line classes for additions, deletions, and hunk headers.
- Add regression checks that the review page script includes `renderLongDiffs()`, scroll navigation, `.diff-file` sections, and no longer instantiates `state.diffModule.FileDiff`.

## validation

- `bun run --cwd packages/diff-cockpit test` passes: 13 pass, 0 fail, 69 expectations.
- `bun run --cwd packages/diff-cockpit typecheck` passes.

## deploy note

Promote this into `stream/diff-cockpit`, redeploy `packages/diff-cockpit`, then verify PR #722 shows 54 file sections and visible diff lines in the review pane.

- 2026-06-03 07:09:29 write: `.task/diff-cockpit/render-long-scroll-diffs/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-03 07:09:29 fs.write: `.task/diff-cockpit/render-long-scroll-diffs/workpad.md`

## workspace-owned: validation evidence

- 2026-06-03 07:10:02 `review.run`: passed — OK
- 2026-06-03 07:10:23 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/diff-cockpit/render-long-scroll-diffs/current.json`, `.task/diff-cockpit/render-long-scroll-diffs/evidence-log.json`, `.task/diff-cockpit/render-long-scroll-diffs/read-log.json`, `.task/diff-cockpit/render-long-scroll-diffs/session.json`, `.task/diff-cockpit/render-long-scroll-diffs/workpad.md`, `.task/tasks/diff-cockpit/render-long-scroll-diffs.json`, `packages/diff-cockpit/src/index.ts`, `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

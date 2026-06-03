# add graphite inspired review ux

## requested behavior implemented

- Comments are clickable and can navigate to their file/line target.
- Review/comment bodies render through a Markdown pass instead of raw escaped text only.
- Drawer shortcut changed from `r` to `d`.
- Drawer now contains status, checks, review summary, comments, and stream commits.
- Drawer title is exactly `review notes`; header is sticky while drawer scrolls.
- Clicking `Review notes` while the drawer is already open scrolls the drawer content to the top.
- PR API responses now include weak ETags and `cache-control: private, max-age=30, stale-while-revalidate=120`; conditional requests return 304 when unchanged.
- File tree includes file-type hints and per-file change stats.
- File tree pane is resizable and collapsible with keyboard shortcut `f`.
- Active file sync uses `IntersectionObserver`; the visible diff section updates/highlights the tree and auto-scrolls the matching tree entry.
- Current-file view shortcut `v` hides deleted/red lines while preserving additions.
- Inline comments render in the diff by default and can be toggled with shortcut `i`.
- Page font changed to an Inter/system stack; diff font is larger than tree text.
- Diff rows now include old/new line-number gutters.

## tests added

- Render-level assertions for drawer state, shortcuts, status/check sections, Markdown renderer, inline comments, file-pane resize/collapse, active-scroll sync, current-only view, line gutters, and sticky drawer header.
- Worker test for ETag/cache-control behavior and 304 responses.

## validation

- Focused package tests: `bun run --cwd packages/diff-cockpit test` passed: 14 pass, 0 fail, 101 expectations.
- Typecheck: `tsc --noEmit -p packages/diff-cockpit/tsconfig.json` passed.
- Review: `bun packages/workspace/scripts/review.js --base origin/stream/diff-cockpit --summary-json --quiet` passed with 0 issues in this change; only pre-existing project-level Nx typecheck target warning remains.

## notes

The workspace `verify` facade was filtered by the runtime on this pass, so focused test/typecheck/review evidence is recorded here before push.

- 2026-06-03 08:15:05 write: `.task/diff-cockpit/add-graphite-inspired-review-ux/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-03 08:15:05 fs.write: `.task/diff-cockpit/add-graphite-inspired-review-ux/workpad.md`

# add graphite inspired review ux

## requested behavior implemented

- Comments are clickable and can navigate to their file/line target.
- Review/comment bodies render through a Markdown pass instead of raw escaped text only.
- Drawer shortcut changed from `r` to `d`.
- Drawer now contains status, checks, review summary, comments, stream commits, and warnings.
- Drawer title is exactly `review notes`; header is sticky while drawer scrolls.
- Clicking `Review notes` while the drawer is already open scrolls the drawer content to the top.
- PR API responses now include weak ETags and cache-control with stale-while-revalidate; conditional requests return 304 when unchanged.
- File tree includes file-type hints and per-file change stats.
- File tree pane is resizable and collapsible with keyboard shortcut `f`.
- Active file sync uses IntersectionObserver; the visible diff section updates/highlights the tree and auto-scrolls the matching tree entry.
- Current-file view shortcut `v` hides deleted/red lines while preserving additions.
- Inline comments render in the diff by default and can be toggled with shortcut `i`.
- Page font changed to an Inter/system stack; diff font is larger than tree text.
- Diff rows now include old/new line-number gutters.
- Rebased back onto the newer stream/diff-cockpit home-screen work and preserved its warnings field/API behavior.

## tests added

- Render-level assertions for drawer state, shortcuts, status/check sections, Markdown renderer, inline comments, file-pane resize/collapse, active-scroll sync, current-only view, line gutters, and sticky drawer header.
- Worker test for ETag/cache-control behavior and 304 responses.

## validation

- Focused package tests passed: 15 pass, 0 fail, 94 expectations.
- Typecheck passed.
- Review passed with 0 issues in this change; only pre-existing project-level Nx typecheck target warning remains.
- Verify passed and wrote a publish-valid stamp.

## deploy note

After this task is promoted to stream/diff-cockpit, redeploy packages/diff-cockpit and verify the live PR route with keyboard shortcuts d, f, v, and i plus drawer status/checks.

- 2026-06-03 08:31:52 write: `.task/diff-cockpit/add-graphite-inspired-review-ux/workpad.md`

## files changed

- `packages/diff-cockpit/src/index.ts`

## workspace-owned: files changed

- `packages/diff-cockpit/src/index.ts`

## workspace-owned: activity log

- 2026-06-03 08:31:52 fs.write: `.task/diff-cockpit/add-graphite-inspired-review-ux/workpad.md`
- 2026-06-03 08:39:16 fs.write: `.task/diff-cockpit/add-graphite-inspired-review-ux/src-style-resolution.txt`
- 2026-06-03 08:39:24 fs.patch: `packages/diff-cockpit/src/index.ts`
- 2026-06-03 08:40:27 fs.write: `.task/diff-cockpit/add-graphite-inspired-review-ux/src-style-resolution.txt`
- 2026-06-03 08:40:38 fs.patch: `packages/diff-cockpit/src/index.ts`

## workspace-owned: validation evidence

- 2026-06-03 08:32:02 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/diff-cockpit/add-graphite-inspired-review-ux/current.json`, `.task/diff-cockpit/add-graphite-inspired-review-ux/evidence-log.json`, `.task/diff-cockpit/add-graphite-inspired-review-ux/read-log.json`, `.task/diff-cockpit/add-graphite-inspired-review-ux/session.json`, `.task/diff-cockpit/add-graphite-inspired-review-ux/verify.json`, `.task/diff-cockpit/add-graphite-inspired-review-ux/workpad.md`, `.task/diff-cockpit/rework-home-screen/current.json`, `.task/diff-cockpit/rework-home-screen/evidence-log.json`, `.task/diff-cockpit/rework-home-screen/read-log.json`, `.task/diff-cockpit/rework-home-screen/session.json`, `.task/diff-cockpit/rework-home-screen/verify.json`, `.task/diff-cockpit/rework-home-screen/workpad.md`, `.task/tasks/diff-cockpit/add-graphite-inspired-review-ux.json`, `.task/tasks/diff-cockpit/rework-home-screen.json`, `packages/diff-cockpit/src/index.ts`, `packages/diff-cockpit/tests/diff-cockpit.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

- 2026-06-03 08:39:16 write: `.task/diff-cockpit/add-graphite-inspired-review-ux/src-style-resolution.txt`

- 2026-06-03 08:39:24 patch lines 1055-1061: `packages/diff-cockpit/src/index.ts`

## workspace-owned: files read

- `packages/diff-cockpit/tests/diff-cockpit.test.ts`

- 2026-06-03 08:40:27 write: `.task/diff-cockpit/add-graphite-inspired-review-ux/src-style-resolution.txt`

- 2026-06-03 08:40:38 patch lines 1055-1056: `packages/diff-cockpit/src/index.ts`

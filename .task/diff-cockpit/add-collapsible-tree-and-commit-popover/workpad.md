# add collapsible tree and commit popover

## requested behavior

- Drawer comments should be clickable and jump to the actual diff/file/location they refer to.
- The file tree should support folder-level collapse/expand, separate from collapsing the entire file drawer.
- Collapsing a folder such as `.task` should hide that subtree while keeping the rest of the sidebar usable.
- The file tree should visually read more like DiffsHub with connector/indent structure showing nested hierarchy.
- The current scroll-sync highlight should still update the tree, but folder collapse should not destroy the whole file drawer.
- In the review drawer summary, clicking the stream commits count should open a popover/list with commit metadata: title, relative time, and added/subtracted line totals where available.

## implementation

- Added folder-level state via `collapsedFolders` and `toggleFolder(folderPath)`.
- Rendered directory rows as buttons with `data-folder-path` and `aria-expanded`.
- Added connector/indent styling through `tree-branch`, `tree-children`, and `tree-depth-*` classes.
- Kept full file drawer collapse on the existing `f` shortcut through `toggleFilePane`, separate from folder collapse.
- Kept drawer comment jumps targeted at actual diff file/comment locations via `data-comment-jump`, `data-comment-file`, and `data-comment-line`.
- Added a stream commits summary chip with `data-open-commits`.
- Added a `commit-popover` dialog with commit title/message, author, relative time, and added/deleted line totals.
- Extended stream commit normalization with `additions` and `deletions`; detail fetches enrich those stats when GitHub returns them.

## validation

- `bun --cwd=packages/diff-cockpit run test` passed: 17 pass, 0 fail, 136 expectations.
- `bun --cwd=packages/diff-cockpit run typecheck` passed.

## deploy note

Promote to `stream/diff-cockpit`, merge into `main`, then redeploy `packages/diff-cockpit` Worker. Browser validation should check: folder collapse, full drawer collapse remains separate, `d` opens review notes, drawer comment jump targets diff, and stream commits popover opens from Review summary.

- 2026-06-03 09:20:41 write: `.task/diff-cockpit/add-collapsible-tree-and-commit-popover/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-03 09:20:41 fs.write: `.task/diff-cockpit/add-collapsible-tree-and-commit-popover/workpad.md`

## workspace-owned: validation evidence

- 2026-06-03 09:21:18 `review.run`: passed — OK
- 2026-06-03 09:23:24 `review.run`: passed — OK

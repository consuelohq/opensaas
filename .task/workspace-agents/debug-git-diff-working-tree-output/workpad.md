# debug git diff working tree output

branch: `task/workspace-agents/debug-git-diff-working-tree-output`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/475/debug-git-diff-working-tree-output
github pr: https://github.com/consuelohq/opensaas/pull/475
started: 2026-05-23

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/workspace/scripts/git-diff.js`
- `packages/workspace/tests/git-diff.test.ts`


## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## implementation checkpoint — initial task setup

### acceptance criteria

- Reproduce `git.diff` on a task with a real uncommitted working-tree change.
- Explain trace `trc_0f0adba96993` and whether `base: "HEAD"` caused zero output.
- If working-tree output is broken, fix `git.diff` and validate.
- If only base semantics are confusing, update docs/tests/behavior to make agent usage harder to misuse.

### plan before editing

1. Create a harmless temporary file change.
2. Run `git.diff` with no base and with `base: "HEAD"`.
3. Compare to expected `git diff` semantics.
4. Patch if needed.

### initial assumptions

- `base: "HEAD"` currently compares `HEAD...HEAD`, so zero output is expected for committed branch comparisons and wrong for working-tree inspection.
- No-base `git.diff` should report uncommitted working-tree changes.

- 2026-05-23 03:03:42 append: `.task/workspace-agents/debug-git-diff-working-tree-output/workpad.md`
- 2026-05-23 03:03:46 write: `tmp/git-diff-smoke.txt`
## implementation checkpoint — before fix

Findings:

- Trace `trc_0f0adba96993` passed `base: "HEAD"`, which produced a `HEAD...HEAD` revision comparison and correctly returned zero.
- Fresh repro created `tmp/git-diff-smoke.txt` through `fs.write`.
- `git.diff` with no base still returned zero because raw `git diff` does not include untracked files.

Planned fix:

- In working-tree mode, include untracked files in `summary`, `files`, `nameOnly`, `hunks`, and `patch` output.
- Keep revision mode unchanged.
- Add tests for untracked working-tree output.

- 2026-05-23 03:04:16 append: `.task/workspace-agents/debug-git-diff-working-tree-output/workpad.md`
- 2026-05-23 03:05:37 patch lines 140-199: `packages/workspace/scripts/git-diff.js`
- 2026-05-23 03:06:07 patch lines 328-347: `packages/workspace/scripts/git-diff.js`
- 2026-05-23 03:06:46 patch lines 311-359: `packages/workspace/scripts/git-diff.js`
- 2026-05-23 03:07:12 patch lines 198-204: `packages/workspace/scripts/git-diff.js`
- 2026-05-23 03:10:36 write: `packages/workspace/git-diff-live-smoke.txt`
## final validation before publish

Findings:

- Trace `trc_0f0adba96993` used `base: "HEAD"`, so the tool ran a `HEAD...HEAD` revision comparison and correctly returned zero.
- Fresh working-tree repro exposed a real bug: no-base `git.diff` missed untracked files because raw `git diff` excludes them.
- Ignored files remain excluded by design through `git ls-files --others --exclude-standard`.

Files changed:

- `packages/workspace/scripts/git-diff.js`
- `packages/workspace/tests/git-diff.test.ts`

Fix:

- Working-tree mode now adds untracked non-ignored files to `summary`, `files`, `nameOnly`, `hunks`, and `patch` output.
- Revision mode still excludes untracked files; `base: "HEAD"` continues to return zero for `HEAD...HEAD`.

Validation evidence:

- `node --check packages/workspace/scripts/git-diff.js`: passed.
- `bun --cwd packages/workspace test tests/git-diff.test.ts`: passed, 5 tests.
- Direct task script smoke found an untracked non-ignored smoke file as `status: "A"` with 2 insertions.
- Direct task script revision smoke with `base: "HEAD"`: returned zero as expected.
- Smoke files removed with `fs.trash` before publish.
- `git.diff` inspected final task diff after cleanup: only script and test changes remained.
- `bun --cwd packages/workspace test`: passed.
- `audit --scripts`: passed, 51 documented / 51 actual.
- `review.run --base origin/stream/workspace-agents --no-tests`: passed.
- `verify --base origin/stream/workspace-agents --no-db`: passed.

- 2026-05-23 03:13:28 append: `.task/workspace-agents/debug-git-diff-working-tree-output/workpad.md`
## review checkpoint — empty untracked file hunk fix

Review finding:

- The first untracked-file fix forced a minimum hunk length of 1 for empty new files.
- That made an empty file patch advertise `@@ -0,0 +1,1 @@` while summary/files reported zero insertions.

Planned fix:

- Empty untracked files should keep the file-level synthetic patch header but produce no hunk.
- Non-empty untracked files should keep the synthetic hunk with the actual line count.
- Add a regression test for zero-byte untracked files.

- 2026-05-23 03:43:10 append: `.task/workspace-agents/debug-git-diff-working-tree-output/workpad.md`
- 2026-05-23 03:43:53 patch lines 172-185: `packages/workspace/scripts/git-diff.js`
- 2026-05-23 03:44:05 patch lines 170-189: `packages/workspace/scripts/git-diff.js`
## review fix validation

Review fix:

- Empty untracked files now produce the file-level synthetic patch header without a fake `+1,1` hunk.
- Non-empty untracked files still produce a hunk with the real content line count.

Validation evidence:

- `node --check packages/workspace/scripts/git-diff.js`: passed.
- `bun --cwd packages/workspace test tests/git-diff.test.ts`: passed, 6 tests.

- 2026-05-23 03:45:05 append: `.task/workspace-agents/debug-git-diff-working-tree-output/workpad.md`
## final review fix validation

Files changed for review fix:

- `packages/workspace/scripts/git-diff.js`
- `packages/workspace/tests/git-diff.test.ts`

Validation evidence:

- `node --check packages/workspace/scripts/git-diff.js`: passed.
- `bun --cwd packages/workspace test tests/git-diff.test.ts`: passed, 6 tests.
- `git.diff` working-tree inspection showed only expected script/test changes plus task metadata before publish.
- `review.run --base origin/stream/workspace-agents --no-tests`: passed.
- `verify --base origin/stream/workspace-agents --no-db`: passed.

Ready to update the task and stream PRs.

- 2026-05-23 03:46:12 append: `.task/workspace-agents/debug-git-diff-working-tree-output/workpad.md`
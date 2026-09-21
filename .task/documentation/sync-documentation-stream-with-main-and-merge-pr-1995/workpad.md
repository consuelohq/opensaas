# Sync documentation stream with main and merge PR 1995

branch: `task/documentation/sync-documentation-stream-with-main-and-merge-pr-1995`
stream: `stream/documentation`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2003/sync-documentation-stream-with-main-and-merge-pr-1995
github pr: https://github.com/consuelohq/opensaas/pull/2003
started: 2026-08-15

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-15 03:27:04 fs.write: `.task/documentation/sync-documentation-stream-with-main-and-merge-pr-1995/workpad.md`
- 2026-08-15 03:29:04 fs.write: `.task/documentation/sync-documentation-stream-with-main-and-merge-pr-1995/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 03:29:26 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(documentation): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/documentation/README.md`

## Execution update

### Acceptance criteria

- Merge current `main` into the documentation stream lineage without losing the approved desktop docs homepage behavior from PR #1995.
- Resolve the two known content conflicts in `packages/documentation/scripts/test-foundation-browser.mjs` and `packages/documentation/src/components/PageTitle.astro` by preserving the stream behavior while retaining non-conflicting main changes.
- Pass focused documentation foundation/browser validation and the full publish safety gate.
- Promote this task into `stream/documentation`, then merge stream PR #1995 into `main` and verify the resulting merge state/SHA.

### Plan

1. Merge `origin/main` into this task branch and reproduce the same conflicts reported by `stream.sync`.
2. Resolve only the conflicting blocks: keep the visible install-command locator and the desktop `docs-home-copy`/quick-start structure; preserve all automatically merged main changes around them.
3. Run docs foundation, validate/build/browser checks, then workspace review + verify.
4. Push and promote the task into `stream/documentation`; confirm #1995 is clean, then merge it to `main` through the task merge tool.

### Test-first contract

behavior under test: conflict resolution must preserve the already-approved desktop docs geometry/duplicate quick-start behavior while incorporating current main.
existing local pattern: `packages/documentation/tests/foundation.test.ts` protects source/CSS contracts and `packages/documentation/scripts/test-foundation-browser.mjs` protects rendered responsive behavior.
new or changed tests: none; this is a merge-conflict reconciliation with no intended new behavior. Existing focused tests are the executable contract.
focused red command: not applicable because the desired behavior is already covered and the branch currently passes before the main merge; the merge conflict itself is the failing integration condition.
expected red failure: `git merge origin/main` stops on the two known content conflicts before validation can run.
no-test waiver: no new test is added because no new behavior is introduced; validation will rerun the existing foundation and browser contracts after resolution plus full verify.

### Current status

- PR #1995 is `DIRTY` against main; CodeRabbit/checks are otherwise non-blocking.
- `stream.sync` reproduced exactly two conflicts: `test-foundation-browser.mjs` and `PageTitle.astro`.

- 2026-08-15 03:27:04 append: `.task/documentation/sync-documentation-stream-with-main-and-merge-pr-1995/workpad.md`

### Conflict resolution and validation

- Local merge commit: `23a72851fe9676d484a1acc361baced4d4789d1d` with parents task/stream lineage `1055b755...` and current main `a159ca11...`.
- `test-foundation-browser.mjs`: kept the stream's `[data-home-install-command]:visible` locator. The desktop implementation intentionally renders a second quick-start variant, so responsive checks must target the visible command.
- `PageTitle.astro`: kept the stream's `docs-home-copy` wrapper and desktop-only `docs-home-quick-start`; all non-conflicting main changes were accepted automatically. After resolution, both conflicting files are byte-identical to the stream parent, confirming the conflict was main carrying older variants rather than an independent new change to preserve.
- Focused foundation test passed: 16/16, 453 expectations.
- Docs validation passed: 105 selected pages.
- Initial Astro build failed because the task worktree inherited a symlinked `packages/documentation/node_modules` whose cached absolute paths pointed at the main worktree. Replaced that symlink locally with `bun install --frozen-lockfile`; no manifests/lockfiles changed.
- Build then passed; browser regression passed with tablet/mobile horizontal overflow 0 and automatic translation check `es`.
- Publish note: `task.push` creates single-parent API commits and cannot preserve the two-parent merge ancestry needed to make stream PR #1995 clean against main. The merge commit will therefore be pushed to the task branch with scoped git push after full verify, then task metadata will use the normal task publish/promote path.

- 2026-08-15 03:29:04 append: `.task/documentation/sync-documentation-stream-with-main-and-merge-pr-1995/workpad.md`

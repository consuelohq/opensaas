# sync documentation stream with current main

branch: `task/documentation/sync-documentation-stream-with-current-main`
stream: `stream/documentation`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1955/sync-documentation-stream-with-current-main
github pr: https://github.com/consuelohq/opensaas/pull/1955
started: 2026-08-14

## acceptance criteria

- [ ] Reconcile `stream/documentation` with current `main` without dropping either the reviewed docs UI work or newer mainline documentation/OS changes.
- [ ] Resolve every real documentation merge conflict deliberately; do not choose ours/theirs wholesale.
- [ ] Preserve the just-shipped docs hero (`Digital workers` / `built on Consuelo`) and prior responsive docs shell behavior.
- [ ] Validate the reconciled docs package and confirm the stream PR is mergeable against `main`.

## plan

1. Inspect the exact stream/main divergence and conflict set without mutating source.
2. Because the canonical `stream.sync` is blocked by its stale conflicted sync worktree, reproduce the merge inside this isolated task branch, resolve documentation conflicts file-by-file, and preserve main ancestry.
3. Run documentation validation/browser/build plus review/verify, then publish the merge commit through the task branch and promote it into the documentation stream.

## Test-first contract

- Behavior under test: integration preserves both current mainline contracts and the reviewed documentation UI, including the latest home hero.
- Existing local pattern: documentation package validation + foundation/browser tests are the integration contract.
- No-test waiver: this is branch reconciliation rather than a new product behavior. Instead of manufacturing a red unit test, use the merge conflict set as the failing precondition and run the full affected documentation validation after resolution.

## current status

- GitHub comparison shows the stream is 21 commits ahead and only 1 commit behind `main`. The single main commit is `c5ed3e0a6acbea45e6b5c061e62d4149fdfac945`, the squash merge of the earlier `stream/documentation` PR #1950. The stream's newer commits contain the follow-up hero work.
- A read-only `git merge-tree` predicted conflicts in the latest hero surfaces. Reproducing the merge in this isolated task confirmed only three conflicts: `test-foundation-browser.mjs`, `PageTitle.astro`, and `foundation.test.ts`; `index.mdx` auto-merged.
- Each conflict is main's pre-hero version versus the stream's reviewed follow-up. The conflict diffs show main has no additional lines in those regions; keeping the stream side preserves the #1950 content plus the newer hero behavior. The three files were therefore resolved to the stream versions deliberately, not by a blanket repository ours/theirs policy.
- After resolution, the merge result has no source-tree delta from the current stream head. That is expected: `main` is the squash of the prior stream state, while the stream already contains that content plus newer docs work. The remaining integration job is to record main ancestry with a merge commit.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- none yet

## key decisions

- Treat `c5ed3e0a` as an ancestry reconciliation commit, not a competing product implementation: it is the squash of the same documentation stream that preceded the latest hero task.
- Preserve the stream versions of the three conflict files because their conflict hunks consist exclusively of the newer hero tests/markup/styles that do not exist in the squash commit.

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

- 2026-08-14 09:39:22 apply-patch: `.task/documentation/sync-documentation-stream-with-current-main/workpad.md`
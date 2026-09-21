# Align Explore regression test names with review convention

branch: `task/explore/align-explore-regression-test-names-with-review-convention`
stream: `stream/explore`
pr: https://github.com/consuelohq/opensaas/pull/2422
started: 2026-09-08

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

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
bun run task:push -- --message "type(explore): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: no product behavior changes; rename the two review-flagged regression cases to the repository's `should [behavior] when [condition]` convention without changing assertions or implementation.
existing local pattern: neighboring Explore tests use `should ... when ...` behavior/condition naming.
new or changed tests: names only in `explore-index-hydration-fallback.test.ts` and `semantic-embedding-gateway.test.ts`; assertions remain byte-for-byte unchanged.
focused red command: not applicable because this is test metadata only and there is no product behavior to make red.
expected red failure: none.
no-test waiver: mechanical review cleanup only; validate by running both affected test files, strict review, and full verify.

- 2026-09-08 15:08:14 append: `.task/explore/align-explore-regression-test-names-with-review-convention/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-08 15:08:14 fs.write: `.task/explore/align-explore-regression-test-names-with-review-convention/workpad.md`
- 2026-09-08 15:08:22 apply-patch: `packages/os/tests/explore-index-hydration-fallback.test.ts`
- 2026-09-08 15:08:22 apply-patch: `packages/os/tests/semantic-embedding-gateway.test.ts`
- 2026-09-08 15:09:51 fs.write: `.task/explore/align-explore-regression-test-names-with-review-convention/workpad.md`

## workspace-owned: validation evidence

- 2026-09-08 15:09:18 `review.run`: passed — OK
- 2026-09-08 15:09:43 `verify`: passed — OK

## validation

- setup-only false failure `trc_4f96903213bc`: the task worktree lacked package-local tree-sitter/sqlite-vec links; no product/test regression. Dependency links repaired in ignored node_modules.
- focused affected tests `trc_f2a04c6b8f6c`: 2 files / 18 tests passed; only test names changed.
- strict review `trc_879b19f15251`: zero findings.
- full verify `trc_bbd07666b468`: publish-valid, zero review findings and zero DB risks.

## publish checklist

- [x] no-test waiver recorded for mechanical test metadata cleanup
- [x] affected tests green
- [x] strict review green
- [x] full verify green
- [ ] task pushed/promoted to stream
- [ ] stream PR current-head checks/reviews green
- [ ] stream merged to main
- [ ] Canary release + local update + live acceptance complete

- 2026-09-08 15:09:51 append: `.task/explore/align-explore-regression-test-names-with-review-convention/workpad.md`

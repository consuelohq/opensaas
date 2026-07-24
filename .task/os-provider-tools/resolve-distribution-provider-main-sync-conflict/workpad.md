# resolve distribution provider main sync conflict

branch: `task/os-provider-tools/resolve-distribution-provider-main-sync-conflict`
stream: `stream/os-provider-tools`
pr: https://github.com/consuelohq/opensaas/pull/1620
started: 2026-07-24

## goal

Reconcile the provider cutover with the distribution stream now merged to `main`, preserving both runtime-bundle contracts and promoting the provider stream only after combined validation.

## acceptance criteria

- [ ] Merge current `origin/main` into this task branch through the scoped task worktree.
- [ ] Resolve only verified conflicts, preserving distribution and provider assertions.
- [ ] Run runtime-bundle, provider-cutover, deployment-provider, manifest, and documentation tests.
- [ ] Run task verification with zero task-owned findings.
- [ ] Do not invoke external AI reviews.

## test-first contract

This is conflict reconciliation rather than new behavior. The existing distribution runtime-bundle and provider-cutover tests are the behavioral contracts. No assertion may be deleted merely to make the merge pass; both source-only legacy wrapper exclusion and the distribution runtime input/fixture invariants must remain proven.

## current status

- Direct `stream.sync` found one content conflict in `packages/os/tests/distribution/runtime-bundle.test.ts`.
- No production conflict was reported; shared implementation files auto-merged.

- 2026-07-24 04:43:05 write: `.task/os-provider-tools/resolve-distribution-provider-main-sync-conflict/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-07-24 04:43:05 fs.write: `.task/os-provider-tools/resolve-distribution-provider-main-sync-conflict/workpad.md`

## workspace-owned: files read

- `packages/os/tests/distribution/runtime-bundle.test.ts`

- 2026-07-24 04:43:24 apply-patch: `packages/os/tests/distribution/runtime-bundle.test.ts`
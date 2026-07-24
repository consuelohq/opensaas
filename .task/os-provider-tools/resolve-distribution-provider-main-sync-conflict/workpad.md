# resolve distribution provider main sync conflict

branch: `task/os-provider-tools/resolve-distribution-provider-main-sync-conflict`
stream: `stream/os-provider-tools`
pr: https://github.com/consuelohq/opensaas/pull/1620
started: 2026-07-24

## goal

Reconcile the provider cutover with the distribution stream now merged to `main`, preserving both runtime-bundle contracts and promoting the provider stream only after combined validation.

## acceptance criteria

- [x] Merge current `origin/main` into this task branch through the scoped task worktree.
- [x] Resolve only verified conflicts, preserving distribution and provider assertions.
- [x] Run runtime-bundle, provider-cutover, deployment-provider, manifest, and lifecycle/managed-component tests.
- [ ] Run task verification with zero task-owned findings.
- [ ] Do not invoke external AI reviews.

## test-first contract

This is conflict reconciliation rather than new behavior. The existing distribution runtime-bundle and provider-cutover tests are the behavioral contracts. No assertion may be deleted merely to make the merge pass; both source-only legacy wrapper exclusion and the distribution runtime input/fixture invariants must remain proven.

## current status

- Direct `stream.sync` found one content conflict in `packages/os/tests/distribution/runtime-bundle.test.ts`.
- No production conflict was reported; shared implementation files auto-merged.
- The conflict combined two valid expectations: distribution requires the three managed-component runtime files, while provider integration classifies the deployment-provider implementation and Railway adapter as `customer-provider` and excludes the old Railway wrappers.
- Resolved without deleting either contract. `tools/deployment-provider/service.ts` remains `customer-provider`; the prior `managed-tool` expectation was superseded by the approved provider boundary.

## validation evidence

- 6 focused files / 87 tests passed: runtime bundle, provider cutover, provider facade/handler, lifecycle retention/uninstall, and managed components.
- Generated tool-manifest drift check passed.
- No external model review invoked.

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

- 2026-07-24 04:43:41 apply-patch: `.task/os-provider-tools/resolve-distribution-provider-main-sync-conflict/workpad.md`

## workspace-owned: validation evidence

- 6 focused files / 87 tests passed: runtime bundle, provider cutover, provider facade/handler, lifecycle retention/uninstall, and managed components.
- Generated tool-manifest drift check passed.
- No external model review invoked.
- 2026-07-24 04:43:05 write: `.task/os-provider-tools/resolve-distribution-provider-main-sync-conflict/workpad.md`
- 2026-07-24 04:44:03 `verify`: passed — OK

## stream ancestry repair

- `task.merge` created stream commit `d361397d79` as a single-parent squash despite `squash:false`, so the tested content landed but `main` was not an ancestor and GitHub still reported the stream PR as dirty.
- Re-entered the interrupted `stream.sync` merge, reused the already-tested conflict resolution, and will push the resulting two-parent merge commit directly to `stream/os-provider-tools` after focused validation.
- This preserves both content and Git ancestry; no external review is invoked.

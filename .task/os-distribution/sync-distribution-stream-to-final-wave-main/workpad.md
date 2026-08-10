# sync distribution stream to final wave main

branch: `task/os-distribution/sync-distribution-stream-to-final-wave-main`
stream: `stream/os-distribution`
pr: https://github.com/consuelohq/opensaas/pull/1623
started: 2026-07-24

## goal

Advance the completed distribution stream to the final wave `main` so the next wave starts from one shared baseline.

## acceptance criteria

- [x] Merge current `origin/main` into the scoped task branch.
- [x] Resolve the known runtime-bundle contract conflict to the exact final `main` behavior.
- [x] Preserve distribution, provider, and web code; do not introduce new product behavior.
- [x] Run runtime-bundle, lifecycle, managed-component, provider-cutover, web, manifest, and typecheck gates.
- [x] Fast-forward `stream/os-distribution` with a real two-parent merge commit.
- [x] Do not invoke external reviews.

## test-first contract

This is ancestry reconciliation, not a behavioral change. Existing tests are the contract. The final runtime-bundle test must preserve all of these simultaneously:

- managed-component runtime files are required;
- provider adapters are customer-provider files;
- legacy Railway wrappers are source-only and absent from bundles;
- lifecycle rollback/retention/uninstall remains green.

No assertion may be removed solely to resolve the conflict.

## current status

- `stream.sync` found one conflict in `packages/os/tests/distribution/runtime-bundle.test.ts`.
- Final `main` already contains the tested combined resolution from distribution PR #1603, provider PR #1616, and web PR #1615.
- No external review will be requested.

## reconciliation result

- Merged final `main` in commit `8114fef83c`; parents are the scoped task/stream lineage and `3cdf66743b` (`main`).
- Resolved the sole runtime-bundle conflict to the exact final `main` version, preserving managed components, provider classification, and wrapper exclusion.
- The combined test pass exposed one stale web assertion introduced by the CodeRabbit dead-constant cleanup: the route test searched generated JavaScript for literal serialized query strings even though production now builds them through `URLSearchParams`.
- Replaced that brittle source-string assertion with checks for the actual `URLSearchParams` contract (`direction` plus `includeRawPayload: 'true'`). No runtime behavior changed.

## validation evidence

- RED: combined focused run failed 1/75 on the stale trace asset source assertion.
- GREEN: 7 focused files / 75 tests passed across runtime bundles, lifecycle retention/uninstall, managed components, provider cutover/facade, universal login, and trace routes.
- Generated tool-manifest drift check passed.
- OS package typecheck/syntax gate passed.
- Full task verify passed in publish-valid mode with static rules, ESLint, typecheck, spec compliance, and DB safety all clean.
- No external review invoked.
- Fast-forwarded `stream/os-distribution` to `101d420c6d`, whose ancestry includes the real two-parent merge `8114fef83c` with final `main` as its second parent.

- 2026-07-24 05:19:59 write: `.task/os-distribution/sync-distribution-stream-to-final-wave-main/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-07-24 05:19:59 fs.write: `.task/os-distribution/sync-distribution-stream-to-final-wave-main/workpad.md`

- 2026-07-24 05:20:29 apply-patch: `packages/os/tests/traces-hono-routes.test.ts`

- 2026-07-24 05:20:51 apply-patch: `.task/os-distribution/sync-distribution-stream-to-final-wave-main/workpad.md`

## workspace-owned: validation evidence

- RED: combined focused run failed 1/75 on the stale trace asset source assertion.
- GREEN: 7 focused files / 75 tests passed across runtime bundles, lifecycle retention/uninstall, managed components, provider cutover/facade, universal login, and trace routes.
- Generated tool-manifest drift check passed.
- OS package typecheck/syntax gate passed.
- No external review invoked.
- 2026-07-24 05:19:59 write: `.task/os-distribution/sync-distribution-stream-to-final-wave-main/workpad.md`
- 2026-07-24 05:21:20 `verify`: passed — OK

- 2026-07-24 05:21:32 apply-patch: `.task/os-distribution/sync-distribution-stream-to-final-wave-main/workpad.md`

- 2026-07-24 05:21:51 apply-patch: `.task/os-distribution/sync-distribution-stream-to-final-wave-main/workpad.md`
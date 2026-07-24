# sync distribution stream to final wave main

branch: `task/os-distribution/sync-distribution-stream-to-final-wave-main`
stream: `stream/os-distribution`
pr: https://github.com/consuelohq/opensaas/pull/1623
started: 2026-07-24

## goal

Advance the completed distribution stream to the final wave `main` so the next wave starts from one shared baseline.

## acceptance criteria

- [ ] Merge current `origin/main` into the scoped task branch.
- [ ] Resolve the known runtime-bundle contract conflict to the exact final `main` behavior.
- [ ] Preserve distribution, provider, and web code; do not introduce new product behavior.
- [ ] Run runtime-bundle, lifecycle, managed-component, provider-cutover, manifest, and typecheck gates.
- [ ] Fast-forward `stream/os-distribution` with a real two-parent merge commit.
- [ ] Do not invoke external reviews.

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

- 2026-07-24 05:19:59 write: `.task/os-distribution/sync-distribution-stream-to-final-wave-main/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-07-24 05:19:59 fs.write: `.task/os-distribution/sync-distribution-stream-to-final-wave-main/workpad.md`

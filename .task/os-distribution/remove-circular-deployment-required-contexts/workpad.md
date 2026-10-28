# remove circular deployment required contexts

## goal

Allow the verified runtime publication job to create its GitHub Deployment without inheriting its own in-progress status as a required context.

## test-first contract

- Behavior: deployment requests send `auto_merge=false` and an explicit empty `required_contexts` array while preserving the exact ref, environment, and bundle payload.
- Existing pattern: provider command runner assertions in `release-channel-provider-retries.test.ts`.
- Focused test: `creates a deployment without inheriting the currently running publication status`.
- Expected red: current command omits `required_contexts[]`.

## evidence

- Live run `30076562516` reached R2/GitHub release publication and failed with HTTP 409 because `Publish immutable release and dev pointer` was still in progress.
- The prior task’s validated edits were left in a deleted task branch working tree, so this fresh task reapplies them through a publishable branch.

- 2026-07-24 15:05:22 write: `.task/os-distribution/remove-circular-deployment-required-contexts/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-07-24 15:05:22 fs.write: `.task/os-distribution/remove-circular-deployment-required-contexts/workpad.md`

- 2026-07-24 15:05:33 apply-patch: `packages/os/tests/distribution/release-channel-provider-retries.test.ts`
- 2026-07-24 15:05:44 apply-patch: `packages/os/scripts/lib/distribution/release-channel-provider.ts`

## workspace-owned: validation evidence

- 2026-07-24 15:06:16 `review.run`: passed — OK
- 2026-07-24 15:06:26 `verify`: passed — OK

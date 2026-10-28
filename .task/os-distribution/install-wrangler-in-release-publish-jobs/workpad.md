# install wrangler in release publish jobs

branch: `task/os-distribution/install-wrangler-in-release-publish-jobs`
stream: `stream/os-distribution`
pr: https://github.com/consuelohq/opensaas/pull/1634
started: 2026-07-24

## goal

Fix live OS publication failure where credentialed release jobs invoke `wrangler` without installing or exposing the CLI.

## acceptance criteria

- [x] Reproduce the missing-Wrangler workflow contract with a focused red test.
- [x] Install a pinned Wrangler CLI in every credentialed release job that invokes the provider.
- [x] Preserve package-lock authority, channel gates, signing, no-rebuild promotion, and rollback behavior.
- [x] Focused release workflow tests, full distribution suite, typecheck, and task verify pass.
- [ ] Merge through stream to main without manually requesting/retrying external reviews.
- [ ] Observe successful live `0.1.0` dev publication and verify release evidence.
- [ ] Sync distribution/provider/web streams and report next worker briefs.

## live failure

- Workflow run `30075528042` passed planning, all three platform builds, cross-platform publication preparation, and signing.
- Provider publication failed on the first R2 write: `Executable not found in $PATH: "wrangler"`.

## test-first contract

Before workflow edits, extend the structured workflow contract to prove every job that runs release provider mutation or R2 restore includes a Wrangler setup step before those commands. The focused contract must fail first.

## constraints

- Do not add a persistent host install or unpinned curl installer.
- Use the repository's existing pinned ephemeral CI pattern.
- Do not manually request/retry external AI reviews.
- Do not alter Ko's Macs.

## discovery

- `packages/os` does not declare or lock Wrangler.
- Existing production CI pins the ephemeral CLI as `bun install --global wrangler@4.105.0`.
- Release jobs use both `bunx wrangler` and a provider subprocess that spawns `wrangler` directly, so a PATH-visible pinned CLI is required.

## files changed

- `.github/workflows/consuelo-os-runtime-publish.yaml`
- `.github/workflows/consuelo-os-runtime-promote.yaml`
- `.github/workflows/consuelo-os-runtime-rollback.yaml`
- `packages/os/tests/distribution/release-channel-workflows.test.ts`

## issues and recovery

- none

## test-first and validation evidence

- RED: structured workflow contract found no Wrangler setup in the publish plan job.
- GREEN: release workflow suite passed 8/8.
- GREEN: full distribution suite passed 75 tests with 7 existing TODO contracts.
- GREEN: OS typecheck/syntax gate passed.
- GREEN: full task verify passed in publish-valid mode with zero findings.

- 2026-07-24 07:31:36 write: `.task/os-distribution/install-wrangler-in-release-publish-jobs/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-07-24 07:31:36 fs.write: `.task/os-distribution/install-wrangler-in-release-publish-jobs/workpad.md`

- 2026-07-24 07:31:55 apply-patch: `packages/os/tests/distribution/release-channel-workflows.test.ts`
- 2026-07-24 07:32:11 apply-patch: `.github/workflows/consuelo-os-runtime-publish.yaml`
- 2026-07-24 07:32:11 apply-patch: `.github/workflows/consuelo-os-runtime-promote.yaml`
- 2026-07-24 07:32:11 apply-patch: `.github/workflows/consuelo-os-runtime-rollback.yaml`

## workspace-owned: validation evidence

- 2026-07-24 07:32:39 `verify`: passed — OK

## workspace-owned: files read

- none yet

- 2026-07-24 07:33:02 apply-patch: `.task/os-distribution/install-wrangler-in-release-publish-jobs/workpad.md`
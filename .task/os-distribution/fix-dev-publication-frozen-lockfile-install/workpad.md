# fix dev publication frozen lockfile install

branch: `task/os-distribution/fix-dev-publication-frozen-lockfile-install`
stream: `stream/os-distribution`
pr: https://github.com/consuelohq/opensaas/pull/1626
started: 2026-07-24

## goal

Restore the automatic Consuelo OS dev-publication workflow on `main` by replacing the invalid root `bun install --frozen-lockfile` step with the repository-approved dependency installation contract.

## observed failure

- Workflow: `Consuelo OS runtime publish`
- Run: `30069510912`
- Job: `Plan dev publication`
- Failed step: `Install dependencies`
- Command: `bun install --frozen-lockfile`
- Error: `UnsupportedYarnLockfileVersion: failed to migrate lockfile: 'yarn.lock'`; Bun then rejected the frozen lockfile because migration would change it.

## acceptance criteria

- [x] Identify the repository-authoritative dependency setup used by current GitHub Actions.
- [x] Add a failing workflow contract test that rejects root `bun install --frozen-lockfile` in the runtime publication workflow.
- [x] Patch the workflow minimally to use the approved install/setup contract.
- [x] Run the focused workflow test, relevant distribution/release suites, action/workflow validation, and task verify.
- [ ] Merge through the distribution stream to `main` without manually requesting any external review.
- [ ] Observe a new `main` runtime-publication run through `Plan dev publication` without the lockfile failure.
- [ ] Re-sync distribution, provider, and web streams to the final green `main` baseline.

## test-first contract

The repository has a Yarn lockfile and existing CI dependency setup conventions. The release workflow must use that same authority rather than asking Bun to migrate the root Yarn lockfile under frozen mode. The regression test must inspect the workflow source and prove:

- the invalid `bun install --frozen-lockfile` command is absent;
- the approved repository dependency setup is present;
- release planning/build commands remain otherwise unchanged.

No workflow edit before a focused red test reproduces the invalid install contract.

## constraints

- Do not regenerate or replace the repository lockfile as part of this fix.
- Do not change release/version/channel behavior.
- Do not request or retry CodeRabbit, Codex, Grok, or Qodo reviews.
- Do not install, update, restart, or reset OS on Ko's Macs.

## discovery and decision

- The root repository is Yarn-owned and uses `.github/actions/yarn-install` for monorepo dependencies.
- Consuelo OS is independently Bun-owned: `packages/os/bun.lock` is the OS package authority, and existing OS CI lanes run `bun install --frozen-lockfile` with `working-directory: packages/os`.
- Runtime publish, promotion, and rollback accidentally ran the same Bun command from the repository root. That forced Bun to attempt migration of the root Yarn lockfile and fail under frozen mode.
- The minimal cross-platform fix is to add `working-directory: packages/os` to every release-lifecycle dependency install. No root dependency installation is required by the release commands; all executable release code and dependencies are under `packages/os`.
- The same defect was corrected proactively in manual promotion and rollback so those channel operations cannot fail later for the identical reason.

## test-first evidence

- RED: `release-channel-workflows.test.ts` failed on the first publish install block because it lacked `working-directory: packages/os`.
- GREEN: workflow contract suite passed 6/6 after all five release install steps were pinned to the OS package directory.
- GREEN: release channels and publication preparation passed 19/19.
- GREEN: full distribution suite passed 72 tests with 7 existing TODO contracts.
- GREEN: OS typecheck/syntax gate passed.
- GREEN: GitHub workflow permission/structure guard returned zero findings.
- GREEN: full task verify passed in publish-valid mode with static rules, ESLint, typecheck, spec compliance, and DB safety clean.

## files changed

- `.github/workflows/consuelo-os-runtime-publish.yaml`
- `.github/workflows/consuelo-os-runtime-promote.yaml`
- `.github/workflows/consuelo-os-runtime-rollback.yaml`
- `packages/os/tests/distribution/release-channel-workflows.test.ts`

- 2026-07-24 05:30:34 write: `.task/os-distribution/fix-dev-publication-frozen-lockfile-install/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-07-24 05:30:34 fs.write: `.task/os-distribution/fix-dev-publication-frozen-lockfile-install/workpad.md`

## workspace-owned: files read

- `packages/os/tests/distribution/release-channel-workflows.test.ts`

## workspace-owned: validation evidence

- 2026-07-24 05:32:28 `verify`: passed — OK

- 2026-07-24 05:32:40 apply-patch: `.task/os-distribution/fix-dev-publication-frozen-lockfile-install/workpad.md`
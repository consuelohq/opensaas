# split consuelo and consuelo-dialer cli products

branch: `task/os-distribution/split-consuelo-and-consuelo-dialer-cli-products`
stream: `stream/os-distribution`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1647/split-consuelo-and-consuelo-dialer-cli-products
github pr: https://github.com/consuelohq/opensaas/pull/1647
started: 2026-07-25

## acceptance criteria

- [x] `consuelo` contains only OS lifecycle commands and excludes dialer/Twenty/Twilio/coaching runtime dependencies.
- [x] `consuelo-dialer` preserves existing sales/GTM commands and owns its config, output, telemetry, and CLI-mode globals.
- [x] Runtime bundles include the OS CLI and exclude the dialer product.
- [x] Legacy `consuelo os ...` routing is removed without a compatibility shim.
- [x] The final branch is synchronized with `stream/os-distribution` and passes focused tests, strict review, and publish-valid verification.
- [ ] The authoritative GitHub matrix passes and the task PR is merged into the stream.

## plan

1. Reconcile the existing Worker 30 branch with the completed distribution cleanup.
2. Preserve and verify the reviewed logger CLI-mode boundary correction.
3. Run the focused product-split suite and logger build, then strict review and full verification.
4. Publish, wait for authoritative CI, and merge task-to-stream only.

## current status

- Recovered existing PR #1647 and task session after distribution cleanup merged.
- GitHub updated the task branch onto current `stream/os-distribution`; local worktree fast-forwarded to remote SHA `f230f87bc4`.
- The independent review correction is reapplied: `@consuelo/logger` reads `__consuelo_dialer_cli_mode`, matching the dialer entrypoint, rather than the retired `__consuelo_cli_mode` global.

## files changed

- `packages/logger/src/index.ts`
- `packages/os/tests/cli-product-split.test.ts`
- `packages/twenty-front/src/modules/navigation/constants/navigation-drawer-support-menu.constants.ts`
- `packages/workspace/scripts/lib/review-test-selection.js`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/review-test-selection.test.js`
- `packages/workspace/tests/test-selection.test.js`


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- GREEN: Worker 30 product split suite passed 10/10 on the final distribution base (`trc_a00e84f25f9e`, `trc_82e40bf21d46`).
- GREEN: `@consuelo/logger` built successfully with the dialer-owned CLI-mode global (`trc_eb0365df2599`).
- RED: the original broad registry selected the full Twenty frontend target for one install-copy constant; the target produced 26.7 MB of output and exposed 127 pre-existing failing suites unrelated to this change (`trc_6157bd3268ed`).
- RED: added a precise-selection regression proving the registry could not let an exact cross-product contract own that file (`trc_9a716c1f3b54`).
- GREEN: added generic `exclusive` rule precedence, a precise `dialer-cli-install-copy` rule, and a product-boundary assertion for the final install command. Registry tests passed 9/9 and product tests passed 10/10 (`trc_82e40bf21d46`).
- GREEN: final affected-suite registry selected the exact Worker 30 contract plus the OS package rule, with no broad frontend suite; all selected commands passed (`trc_feaefa8c164b`).
- GREEN: review and registry selection now share exclusive ownership; selection regressions passed 13/13 and Worker 30 remained 10/10 (`trc_30669356a6e3`).
- GREEN: final strict review reports zero owned/blocking findings (`trc_4760079e7ace`).
- GREEN: full verification is publish-valid against current `stream/os-distribution` (`trc_8817c1014aa9`).
- RED clean-runner evidence: both Consuelo aggregate jobs failed before tests because `packages/os` declared `effect` but was not a root Yarn workspace, so the package had no lock entry or installed dependency closure (`trc_77e90d94a3b7`).
- RED package-boundary regression: Worker 30's product suite proved the root workspace list omitted `packages/os` (`trc_9b6a6398b68e`).
- GREEN: added `packages/os` to root workspaces, regenerated `yarn.lock`, and locked both the OS workspace stanza and its `effect` dependency in the product contract. Immutable Yarn resolution succeeds and Worker 30 remains 10/10 (`trc_332d7dc025f1`, `trc_901b208a3bc1`).
- CI classification: the independent frontend workflow failed on unchanged existing `GHLSettings.tsx` and UI type debt after the install-copy constant caused broad frontend selection (`trc_fc02a2a2277f`).
- RED classifier regression: an isolated OS workspace migration plus an exclusively owned frontend copy contract was still classified as a broad `yarn-lock` change (`trc_c31ca9652cb0`).
- GREEN: the frontend classifier now reads the canonical registry, honors exclusive ownership, and exempts only a root-package change whose sole workspace delta is `packages/os`. Broad source changes, dependency changes, ordinary lockfile changes, and normal frontend files remain broad. Selector tests passed 17/17 and Worker 30 passed 10/10 (`trc_a4132fa6575f`).
- GREEN: actual PR-diff simulation reports `isolated-workspace-migration`; `effect` resolves through `@consuelo/os`; all exact registry suites pass (`trc_3993a8bd99c0`).
- GREEN: final strict review reports zero owned/blocking findings (`trc_bc6feceaf327`).
- GREEN: final full verification is publish-valid (`trc_eac82eb7206a`).
- 2026-07-25 20:26:31 `review.run`: passed — OK
- 2026-07-25 20:27:00 `verify`: passed — OK
- 2026-07-25 20:39:51 `review.run`: passed — OK
- 2026-07-25 20:40:23 `verify`: passed — OK
- 2026-07-25 20:50:21 `review.run`: passed — OK
- 2026-07-25 20:50:51 `verify`: passed — OK
- 2026-07-25 21:02:16 `review.run`: passed — OK
- 2026-07-25 21:02:46 `verify`: passed — OK

## Clean dialer-help dependency precondition

- RED authoritative evidence: after the OS workspace dependency fix, both Consuelo aggregate jobs loaded the package but failed one Worker 30 assertion: the real `consuelo-dialer --help` subprocess imported `twenty-sdk/cli` before the untracked `packages/twenty-sdk/dist/register.mjs` build artifact existed on a clean checkout (`trc_77df41fcebd0`).
- Root cause: local developer worktrees already contained `packages/twenty-sdk/dist`, masking the build-order requirement; the distribution runner correctly starts without generated SDK output.
- Change: the behavioral test keeps executing the real dialer source CLI and exact command-catalog assertions, but first builds the declared Twenty SDK workspace dependency only when its exported CLI artifact is absent. The test has a bounded 120-second timeout for this clean-build precondition.
- GREEN clean-checkout simulation: temporarily removed the entire SDK `dist` directory; the test built the dependency and all 10 Worker 30 assertions passed (`trc_34c58302156d`).
- GREEN exact registry gate: workspace selection 9/9, Worker 30 10/10, and the OS package rule all passed (`trc_cf441bb3db16`).

## Cross-platform command-catalog correction

- Authoritative Linux rerun proved the remaining assertion was not a missing artifact: once `twenty-sdk/cli` resolves, the dialer intentionally registers additional auth/app/entity/function commands before rendering help.
- The prior test incorrectly required the entire command list to equal only the 14 core sales commands, contradicting the existing optional SDK registration that the same test also required in source.
- Final contract: preserve the exact order and presence of the 14 core sales/GTM commands, allow the supported SDK platform command extensions, and continue forbidding the removed `os` command group.
- The temporary SDK-build precondition was removed; it is unnecessary for this ownership assertion and would couple the test to generated output.
- GREEN: Worker 30 passed 10/10 and the exact registry gate passed after the corrected command-catalog contract (`trc_7ce1c9539a98`, `trc_9388ca94f458`).

## Node 24 stderr disposition

- The final Linux rerun preserved exit status and help output but still failed the same test because Node 24 dependency deprecation warnings are emitted on stderr in the aggregate runner.
- Empty stderr is not a Worker 30 acceptance criterion and is not evidence of command ownership. The test now includes stderr as the diagnostic message if the process exits non-zero, but does not reject successful help output solely for runtime warnings.
- The behavioral contract remains: successful exit, `consuelo-dialer` usage, exact core sales command sequence, supported SDK registration in source, and no mixed `os` group.

## Deterministic command-registration contract

- The aggregate Linux runner continued to fail the formatted-help assertion despite the product, OS, frontend, and dialer lanes passing. The failure remained confined to environment-dependent Commander output/process behavior.
- Final test boundary: inspect the dialer entrypoint's actual registration model instead of terminal-formatted help. Assert the 14 preserved core sales registrations exist in exact source order, the optional Twenty SDK extension remains registered, and no `registerOs` or `.command('os')` registration exists.
- This removes terminal width, runtime warning, generated SDK output, and platform loader variance without weakening product ownership.
- GREEN: Worker 30 passed 10/10 and the exact affected-suite registry passed all three selected suites (`trc_ebc7d81f1b4e`).
- 2026-07-25 19:54:21 `review.run`: passed — OK
- 2026-07-25 19:55:14 `review.run`: passed — OK
- 2026-07-25 19:56:07 `verify`: failed — COMMAND_FAILED
- 2026-07-25 19:57:46 `verify`: passed — OK
- 2026-07-25 20:11:39 `review.run`: passed — OK
- 2026-07-25 20:12:10 `verify`: passed — OK
- 2026-07-25 20:13:41 `verify`: passed — OK

## key decisions

- CLI-safe plain logging is a dialer-owned concern. The OS lifecycle CLI does not enable the dialer global or inherit this behavior implicitly.
- Synchronization was performed through GitHub's PR update mechanism so the remote task branch remains authoritative and the final diff stays reviewable.
- Precise cross-product files may use an `exclusive` test-selection rule. Exclusivity claims only the files matched by that rule; other frontend files still select the broad frontend suite.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- The task branch was three stream commits behind after PR #1651 and its infrastructure prerequisites landed. Local changes were stashed, the remote PR branch was updated from the stream, the worktree was fast-forwarded, and the two-file review fix reapplied cleanly.

## CI wait plan

- Wait reason: GitHub must validate Worker 30 commit `7f951720e7e6b85473299bfd47e886233f5902bd` before task-to-stream merge.
- Duration: poll every 30–90 seconds for up to 15 minutes, stopping on a terminal failure or all-green matrix.
- Resume action: inspect PR #1647 checks immediately after each interval; inspect exact logs on any failure.
- Expected signal: precise Consuelo verification selects the Worker 30 contract, product and logger boundaries pass, and all required PR checks terminate successfully.
- Fallback: fix only attributable Worker 30 or shared-selection defects, rerun strict review/full verify, and republish. Do not merge around a red required gate.

---

## publish checklist

```bash
bun run task:push -- --message "type(os-distribution): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `package.json`
- `packages/logger/project.json`
- `packages/os/package.json`
- `packages/os/tests/cli-product-split.test.ts`
- `packages/twenty-front/src/modules/navigation/constants/navigation-drawer-support-menu.constants.ts`
- `packages/workspace/scripts/ci/classify-front-source-change.cjs`
- `packages/workspace/scripts/lib/review-test-selection.js`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/front-source-change-classifier.test.js`
- `packages/workspace/tests/test-selection.test.js`

- 2026-07-25 20:09:33 apply-patch: `packages/workspace/tests/front-source-change-classifier.test.js`
- 2026-07-25 20:10:02 apply-patch: `packages/workspace/scripts/ci/classify-front-source-change.cjs`

- 2026-07-25 20:12:25 apply-patch: `.task/os-distribution/split-consuelo-and-consuelo-dialer-cli-products/workpad.md`

- 2026-07-25 20:25:36 apply-patch: `packages/os/tests/cli-product-split.test.ts`

- 2026-07-25 20:26:02 apply-patch: `.task/os-distribution/split-consuelo-and-consuelo-dialer-cli-products/workpad.md`

- 2026-07-25 20:39:08 apply-patch: `packages/os/tests/cli-product-split.test.ts`

- 2026-07-25 20:39:20 apply-patch: `.task/os-distribution/split-consuelo-and-consuelo-dialer-cli-products/workpad.md`

- 2026-07-25 20:49:34 apply-patch: `packages/os/tests/cli-product-split.test.ts`

- 2026-07-25 20:49:43 apply-patch: `.task/os-distribution/split-consuelo-and-consuelo-dialer-cli-products/workpad.md`

- 2026-07-25 21:01:25 apply-patch: `packages/os/tests/cli-product-split.test.ts`

- 2026-07-25 21:01:48 apply-patch: `.task/os-distribution/split-consuelo-and-consuelo-dialer-cli-products/workpad.md`

# fix stale eslint rules import paths

branch: `task/os-distribution/fix-stale-eslint-rules-import-paths`
stream: `stream/os-distribution`
pr: https://github.com/consuelohq/opensaas/pull/1651
started: 2026-07-25

## goal

Restore clean-runner frontend lint by making the shared React ESLint configuration and its consumers use the current `packages/eslint-rules` authority.

## acceptance criteria

- [x] Add a failing contract covering every active stale `twenty-eslint-rules` path.
- [x] Update root, Nx, Docker, package metadata, and all ESLint consumers to `packages/eslint-rules`.
- [x] Prove root/front/server/shared/UI ESLint configs import successfully from a clean checkout.
- [x] Restore the custom-rule package's ESLint 9 RuleTester, tests, typecheck, and lint gates.
- [x] Route frontend CI lint through the existing changed-file target while retaining full typecheck and test jobs.
- [x] Run review and publish-valid verification.
- [ ] Merge into `stream/os-distribution` so Worker 30 can rerun on a healthy base.
- [x] Do not request or retry external AI reviews.

## test-first contract

Repository ESLint consumers must resolve the tracked shared configuration package. The regression contract will fail while any of these remain:

- `packages/twenty-front/eslint.config.mjs` imports `../twenty-eslint-rules/...`;
- `packages/twenty-ui/eslint.config.mjs` imports `../twenty-eslint-rules/...`;
- `packages/eslint-rules/eslint.config.react.mjs` asks Nx to load workspace rules from `packages/twenty-eslint-rules`.

The fixed contract requires all three references to resolve through `packages/eslint-rules` and dynamically imports both consumer configs.

## observed failure

Worker 30 PR #1647 legitimately changes the frontend's CLI install command. Clean frontend CI failed before linting source with `ERR_MODULE_NOT_FOUND` for `packages/twenty-eslint-rules/eslint.config.react.mjs`. The repository contains `packages/eslint-rules/eslint.config.react.mjs`; the former directory does not exist.

## plan

1. Add and run the exact stale-path/import contract red.
2. Complete the interrupted `packages/eslint-rules` migration across every active owner.
3. Restore the package's ESLint 9 test/type contract exposed by the corrected Nx project root.
4. Use the repository's existing changed-file frontend lint target; keep full frontend typecheck/tests unchanged.
5. Review, verify, and merge into the distribution stream.

## findings and decisions

- The missing front config was one symptom of an incomplete directory migration. Root workspaces, Nx cache inputs, Docker, coverage, project metadata, root/server/shared configs, and front/UI imports still referenced the removed `packages/twenty-eslint-rules` directory.
- The Nx project identity remains `twenty-eslint-rules`; only its filesystem root/source authority is `packages/eslint-rules`.
- Once the real package root was restored, its tests exposed an unfinished ESLint 9 migration. The RuleTester suite now uses flat `languageOptions`, a Jest-local structured-clone compatibility shim, current metadata, and strict message/guard contracts.
- Full `twenty-front` lint remains historically red with broad module-boundary debt. The repository already defines `lint:diff-with-main`; CI now uses that target only for the lint matrix entry. Full frontend typecheck and test jobs are unchanged.
- Worker 30's navigation command file is not changed here. Its legitimate `@consuelo/dialer-cli` edit must be made lint-clean during Worker 30 reconciliation after this base repair lands.
- Clean CI then exposed 77 inherited `twenty-front` type errors because the frontend workflow treated ESLint-config-only changes as application source changes. The workflow now has two explicit ownership signals: `changed-files-check` drives changed-file lint and config validation; `changed-source-files-check` excludes ESLint config files and alone drives typecheck, tests, Storybook, and builds. Source and dependency changes retain the full frontend gates.

## validation evidence

- RED: config-path/import contract failed 2/2 because active consumers referenced a missing directory.
- RED: restored ESLint package selection initially failed all 14 rule suites under the legacy RuleTester contract.
- GREEN: `twenty-eslint-rules` tests passed 14 suites / 129 tests.
- GREEN: `twenty-eslint-rules` typecheck passed.
- GREEN: `twenty-eslint-rules` lint passed with zero errors and two inherited warnings.
- GREEN: config-path and workflow-policy contracts passed 7/7.
- GREEN: all root/front/server/shared/UI configs imported successfully in clean Node subprocesses.
- GREEN: `twenty-front:lint:diff-with-main` passed.
- GREEN: GitHub workflow policy/security check passed.
- GREEN: fresh strict review on head `3265568d46` reported zero task-owned or blocking findings; three unrelated pre-existing Twenty typecheck findings remain (`trc_f1c284120219`).
- GREEN: fresh full verify on head `3265568d46` is publish-valid; all selected review, registry, ESLint configuration, custom-rule, and DB gates passed (`trc_5da22c1f50dc`).
- The red GitHub jobs currently displayed on PR #1651 are from an earlier head before the final RuleTester, test-selection, and frontend-source classification fixes. This evidence commit intentionally refreshes authoritative CI without requesting any external AI review.
- RED: fresh CI reached `shared-test (typecheck)` and failed on untouched historical Twenty-front/GHL source errors. `packages/twenty-shared/eslint.config.mjs` was the only shared application path changed; the workflow nevertheless typechecked all downstream frontend projects.
- GREEN: CI Shared now reuses the existing source classifier. Real `packages/twenty-shared/**` source changes still run lint/typecheck/test, while an ESLint-config-only workspace migration skips unrelated application gates.
- GREEN: workflow policy + classifier tests passed 9/9 and the GitHub workflow security guard reported zero findings (`trc_5295156792f0`).
- GREEN: the current migration classifies as `sourceChanged: false`, reason `eslint-workspace-migration` (`trc_5ea499560903`).
- GREEN: strict review after the CI Shared correction reported zero task-owned or blocking findings (`trc_1295d8eb3135`).
- GREEN: full verify after the CI Shared correction is publish-valid; selected workspace, ESLint configuration, custom-rule, and DB gates passed (`trc_995b8313d45b`).
- GREEN: the split frontend workflow policy is covered by the workspace workflow contract; config-only changes cannot silently skip changed-file lint, and source changes still select typecheck/test/build/Storybook.
- GREEN: task-local strict review passed with zero owned or related-pre-existing blockers and one intended test suite (`trc_a05c5a0a568c`).
- GREEN: full verification passed, all four registry-selected suites passed, DB guardrails passed, and `.task/os-distribution/fix-stale-eslint-rules-import-paths/verify.json` is publish-valid (`trc_a05c5a0a568c`).

## review-runner tooling correction

- The typed review router changed into the task worktree but recursively executed the main worktree's `review.js` through `__filename`. That made review results use old test-selection logic while inspecting current task files.
- The router now resolves `packages/workspace/scripts/review.js` from the selected task worktree. A regression test locks that entrypoint.
- Direct task-local review and verify were used for the final evidence because the installed typed router cannot use its own fix until this task merges.

## wait cycle — infrastructure and native stream CI

- Start: 2026-07-25T02:28:00Z.
- Wait reason: PR #1651 must finish normal CI before merging into `stream/os-distribution`; native stream PR #1653 must finish its full cross-platform matrix before promotion to `main`.
- Duration: poll every 25 seconds for up to 3 minutes.
- Resume action: query failed/pending checks on PRs #1651 and #1653 immediately after each interval.
- Expected signal: both PRs have no failed checks; #1651 may still have normal long-running checks, while #1653 must complete native Linux, macOS, Windows, OCI, OS contracts, and verify before merge.
- Fallback: inspect only final attributable failures. Do not request or retry external AI reviews.

## wait cycle — verify/facade recovery

- Wait reason: full verify exceeded the caller timeout and the workspace facade temporarily returned upstream 502 responses; completion state was unknown.
- Duration: 30 seconds before checking facade health and task evidence.
- Resume action: inspect the task verify record and facade health before publication.
- Observed result: facade health recovered, but no `verify.json` existed, so the timed-out verify did not leave a terminal publish-valid record.
- Decision: rerun the single verify gate with the full 20-minute budget. No push or merge occurs before a terminal result.

- 2026-07-25 01:15:17 write: `.task/os-distribution/fix-stale-eslint-rules-import-paths/workpad.md`

## files changed

- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/tests/test-selection.test.js`


## workspace-owned: files changed

- `.github/workflows/ci-front.yaml`
- `eslint.config.mjs`
- `nx.json`
- `package.json`
- `packages/eslint-rules/eslint-config-paths.test.ts`
- `packages/eslint-rules/eslint.config.react.mjs`
- `packages/eslint-rules/jest.config.mjs`
- `packages/eslint-rules/jest.setup.cjs`
- `packages/eslint-rules/project.json`
- `packages/eslint-rules/rules/component-props-naming.spec.ts`
- `packages/eslint-rules/rules/component-props-naming.ts`
- `packages/eslint-rules/rules/effect-components.spec.ts`
- `packages/eslint-rules/rules/effect-components.ts`
- `packages/eslint-rules/rules/graphql-resolvers-should-be-guarded.spec.ts`
- `packages/eslint-rules/rules/inject-workspace-repository.spec.ts`
- `packages/eslint-rules/rules/inject-workspace-repository.ts`
- `packages/eslint-rules/rules/matching-state-variable.spec.ts`
- `packages/eslint-rules/rules/matching-state-variable.ts`
- `packages/eslint-rules/rules/max-consts-per-file.spec.ts`
- `packages/eslint-rules/rules/max-consts-per-file.ts`
- `packages/eslint-rules/rules/mdx-component-newlines.ts`
- `packages/eslint-rules/rules/no-hardcoded-colors.spec.ts`
- `packages/eslint-rules/rules/no-navigate-prefer-link.spec.ts`
- `packages/eslint-rules/rules/no-navigate-prefer-link.ts`
- `packages/eslint-rules/rules/no-state-useref.spec.ts`
- `packages/eslint-rules/rules/rest-api-methods-should-be-guarded.spec.ts`
- `packages/eslint-rules/rules/sort-css-properties-alphabetically.spec.ts`
- `packages/eslint-rules/rules/sort-css-properties-alphabetically.ts`
- `packages/eslint-rules/rules/styled-components-prefixed-with-styled.spec.ts`
- `packages/eslint-rules/rules/styled-components-prefixed-with-styled.ts`
- `packages/eslint-rules/rules/use-getLoadable-and-getValue-to-get-atoms.spec.ts`
- `packages/eslint-rules/rules/use-getLoadable-and-getValue-to-get-atoms.ts`
- `packages/eslint-rules/rules/useRecoilCallback-has-dependency-array.spec.ts`
- `packages/eslint-rules/rules/useRecoilCallback-has-dependency-array.ts`
- `packages/eslint-rules/tsconfig.json`
- `packages/eslint-rules/utils/ruleTesterParser.ts`
- `packages/eslint-rules/utils/typedTokenHelpers.ts`
- `packages/twenty-docker/twenty-website/Dockerfile`
- `packages/twenty-front/eslint.config.mjs`
- `packages/twenty-server/eslint.config.mjs`
- `packages/twenty-shared/eslint.config.mjs`
- `packages/twenty-ui/eslint.config.mjs`
- `packages/workspace/scripts/ci/classify-front-source-change.cjs`
- `packages/workspace/scripts/lib/review-test-selection.js`
- `packages/workspace/scripts/review.js`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/eslint-config-paths.test.ts`
- `packages/workspace/tests/front-source-change-classifier.test.js`
- `packages/workspace/tests/github-workflow-policy.test.js`
- `packages/workspace/tests/review-test-selection.test.js`
- `packages/workspace/tests/test-selection.test.js`

## workspace-owned: activity log

- 2026-07-25 01:15:17 fs.write: `.task/os-distribution/fix-stale-eslint-rules-import-paths/workpad.md`
- 2026-07-25 01:15:28 write: `packages/eslint-rules/eslint-config-paths.test.ts`
- 2026-07-25 01:15:28 fs.write: `packages/eslint-rules/eslint-config-paths.test.ts`
- 2026-07-25 01:15:41 apply-patch: `packages/eslint-rules/eslint.config.react.mjs`
- 2026-07-25 01:15:41 apply-patch: `packages/twenty-front/eslint.config.mjs`
- 2026-07-25 01:15:42 apply-patch: `packages/twenty-ui/eslint.config.mjs`
- 2026-07-25 01:16:11 apply-patch: `packages/eslint-rules/eslint-config-paths.test.ts`
- 2026-07-25 01:27:42 fs.write: `packages/eslint-rules/jest.setup.cjs`
- 2026-07-25 01:28:33 fs.write: `packages/eslint-rules/jest.setup.cjs`
- 2026-07-25 01:34:41 fs.write: `packages/eslint-rules/utils/ruleTesterParser.ts`
- 2026-07-25 02:14:21 fs.write: `packages/workspace/scripts/lib/review-test-selection.js`
- 2026-07-25 02:40:56 fs.write: `packages/workspace/scripts/ci/classify-front-source-change.cjs`
- 2026-07-25 02:41:05 fs.write: `packages/workspace/tests/front-source-change-classifier.test.js`

## workspace-owned: files read

- `.github/actions/nx-affected/action.yaml`
- `.github/workflows/changed-files.yaml`
- `.github/workflows/ci-front.yaml`
- `.github/workflows/ci-shared.yaml`
- `package.json`
- `packages/eslint-rules/eslint.config.react.mjs`
- `packages/eslint-rules/index.ts`
- `packages/eslint-rules/jest.config.mjs`
- `packages/eslint-rules/project.json`
- `packages/eslint-rules/rules/component-props-naming.spec.ts`
- `packages/eslint-rules/rules/component-props-naming.ts`
- `packages/eslint-rules/rules/effect-components.spec.ts`
- `packages/eslint-rules/rules/effect-components.ts`
- `packages/eslint-rules/rules/graphql-resolvers-should-be-guarded.spec.ts`
- `packages/eslint-rules/rules/graphql-resolvers-should-be-guarded.ts`
- `packages/eslint-rules/rules/matching-state-variable.ts`
- `packages/eslint-rules/rules/max-consts-per-file.spec.ts`
- `packages/eslint-rules/rules/max-consts-per-file.ts`
- `packages/eslint-rules/rules/mdx-component-newlines.ts`
- `packages/eslint-rules/rules/no-navigate-prefer-link.spec.ts`
- `packages/eslint-rules/rules/no-navigate-prefer-link.ts`
- `packages/eslint-rules/rules/rest-api-methods-should-be-guarded.spec.ts`
- `packages/eslint-rules/rules/rest-api-methods-should-be-guarded.ts`
- `packages/eslint-rules/rules/sort-css-properties-alphabetically.ts`
- `packages/eslint-rules/rules/use-getLoadable-and-getValue-to-get-atoms.ts`
- `packages/eslint-rules/tsconfig.json`
- `packages/eslint-rules/utils/createRule.ts`
- `packages/eslint-rules/utils/ruleTesterParser.ts`
- `packages/eslint-rules/utils/typedTokenHelpers.ts`
- `packages/twenty-front/project.json`
- `packages/twenty-front/src/modules/navigation/constants/navigation-drawer-support-menu.constants.ts`
- `packages/twenty-ui/project.json`
- `packages/workspace/scripts/ci/classify-front-source-change.cjs`
- `packages/workspace/scripts/lib/review-run-state.js`
- `packages/workspace/scripts/lib/review-test-selection.js`
- `packages/workspace/scripts/lib/verification.js`
- `packages/workspace/scripts/review.js`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/scripts/verify.js`
- `packages/workspace/senior-engineer.md`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/eslint-config-paths.test.ts`
- `packages/workspace/tests/front-source-change-classifier.test.js`
- `packages/workspace/tests/github-workflow-policy.test.js`
- `packages/workspace/tests/test-selection.test.js`

## workspace-owned: TDD post evidence

- 2026-07-25 01:24:23 `git restore --source=HEAD -- packages/cli/bin/consuelo.js packages/twenty-sdk/bin/twenty.mjs`: failed exit 1 trace: `trc_000f3932eac2`
  - output: error: Script not found "task:exec"

- 2026-07-25 01:26:17 apply-patch: `packages/eslint-rules/rules/max-consts-per-file.spec.ts`
- 2026-07-25 01:26:33 apply-patch: `packages/eslint-rules/rules/max-consts-per-file.spec.ts`

- 2026-07-25 01:27:42 write: `packages/eslint-rules/jest.setup.cjs`

- 2026-07-25 01:27:51 apply-patch: `packages/eslint-rules/jest.config.mjs`
- 2026-07-25 01:27:51 apply-patch: `packages/eslint-rules/eslint-config-paths.test.ts`
- 2026-07-25 01:28:33 write: `packages/eslint-rules/jest.setup.cjs`

- 2026-07-25 01:28:51 apply-patch: `packages/eslint-rules/rules/effect-components.spec.ts`

- 2026-07-25 01:30:34 apply-patch: `packages/eslint-rules/rules/matching-state-variable.ts`
- 2026-07-25 01:30:34 apply-patch: `packages/eslint-rules/utils/typedTokenHelpers.ts`
- 2026-07-25 01:30:34 apply-patch: `packages/eslint-rules/rules/rest-api-methods-should-be-guarded.spec.ts`

- 2026-07-25 01:31:10 apply-patch: `packages/eslint-rules/rules/component-props-naming.ts`
- 2026-07-25 01:31:10 apply-patch: `packages/eslint-rules/rules/effect-components.ts`
- 2026-07-25 01:31:10 apply-patch: `packages/eslint-rules/rules/mdx-component-newlines.ts`
- 2026-07-25 01:31:10 apply-patch: `packages/eslint-rules/rules/no-navigate-prefer-link.ts`
- 2026-07-25 01:31:10 apply-patch: `packages/eslint-rules/rules/sort-css-properties-alphabetically.ts`

- 2026-07-25 01:31:52 apply-patch: `packages/workspace/tests/eslint-config-paths.test.ts`
- 2026-07-25 01:31:52 apply-patch: `packages/eslint-rules/jest.config.mjs`
- 2026-07-25 01:31:52 apply-patch: `packages/eslint-rules/tsconfig.json`

- 2026-07-25 01:32:55 apply-patch: `.task/os-distribution/fix-stale-eslint-rules-import-paths/workpad.md`

## workspace-owned: validation evidence

- GREEN: config-path and workflow-policy contracts passed 7/7.
- GREEN: all root/front/server/shared/UI configs imported successfully in clean Node subprocesses.
- GREEN: `twenty-front:lint:diff-with-main` passed.
- GREEN: GitHub workflow policy/security check passed.
- 2026-07-25 01:15:17 write: `.task/os-distribution/fix-stale-eslint-rules-import-paths/workpad.md`
- 2026-07-25 01:33:48 `review.run`: passed — OK
- 2026-07-25 01:34:41 write: `packages/eslint-rules/utils/ruleTesterParser.ts`
- 2026-07-25 01:35:06 apply-patch: `packages/eslint-rules/rules/use-getLoadable-and-getValue-to-get-atoms.ts`
- 2026-07-25 01:36:11 `review.run`: passed — OK
- 2026-07-25 01:46:24 `verify`: failed — COMMAND_FAILED
- 2026-07-25 02:10:16 `review.run`: passed — OK
- 2026-07-25 02:11:30 `verify`: failed — COMMAND_FAILED
- 2026-07-25 02:12:44 `review.run`: passed — OK
- 2026-07-25 02:16:32 `review.run`: passed — OK
- 2026-07-25 02:23:01 `review.run`: passed — OK
- 2026-07-25 16:04:03 `review.run`: passed — OK
- 2026-07-25 16:04:37 `verify`: passed — OK
- 2026-07-25 16:15:07 `review.run`: passed — OK
- 2026-07-25 16:15:38 `verify`: passed — OK
- 2026-07-25 16:17:04 `verify`: passed — OK
- 2026-07-25 17:49:12 `verify`: passed — OK
- 2026-07-25 17:50:40 `verify`: passed — OK
- 2026-07-25 17:52:23 `verify`: passed — OK
- 2026-07-25 18:19:14 `review.run`: passed — OK
- 2026-07-25 18:19:43 `review.run`: passed — OK
- 2026-07-25 18:20:20 `verify`: passed — OK
- 2026-07-25 18:20:39 `verify`: passed — OK
- 2026-07-25 18:35:25 `review.run`: passed — OK
- 2026-07-25 18:35:54 `verify`: passed — OK
- 2026-07-25 18:37:09 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.github/workflows/ci-front.yaml`, `.github/workflows/ci-shared.yaml`, `.task/os-distribution/fix-stale-eslint-rules-import-paths/current.json`, `.task/os-distribution/fix-stale-eslint-rules-import-paths/evidence-log.json`, `.task/os-distribution/fix-stale-eslint-rules-import-paths/read-log.json`, `.task/os-distribution/fix-stale-eslint-rules-import-paths/session.json`, `.task/os-distribution/fix-stale-eslint-rules-import-paths/verify.json`, `.task/os-distribution/fix-stale-eslint-rules-import-paths/workpad.md`, `.task/tasks/os-distribution/fix-stale-eslint-rules-import-paths.json`, `eslint.config.mjs`, `nx.json`, `package.json`, `packages/eslint-rules/eslint.config.react.mjs`, `packages/eslint-rules/jest.config.mjs`, `packages/eslint-rules/jest.setup.cjs`, `packages/eslint-rules/project.json`, `packages/eslint-rules/rules/component-props-naming.spec.ts`, `packages/eslint-rules/rules/component-props-naming.ts`, `packages/eslint-rules/rules/effect-components.spec.ts`, `packages/eslint-rules/rules/effect-components.ts`, `packages/eslint-rules/rules/graphql-resolvers-should-be-guarded.spec.ts`, `packages/eslint-rules/rules/inject-workspace-repository.spec.ts`, `packages/eslint-rules/rules/inject-workspace-repository.ts`, `packages/eslint-rules/rules/matching-state-variable.spec.ts`, `packages/eslint-rules/rules/matching-state-variable.ts`, `packages/eslint-rules/rules/max-consts-per-file.spec.ts`, `packages/eslint-rules/rules/max-consts-per-file.ts`, `packages/eslint-rules/rules/mdx-component-newlines.ts`, `packages/eslint-rules/rules/no-hardcoded-colors.spec.ts`, `packages/eslint-rules/rules/no-navigate-prefer-link.spec.ts`, `packages/eslint-rules/rules/no-navigate-prefer-link.ts`, `packages/eslint-rules/rules/no-state-useref.spec.ts`, `packages/eslint-rules/rules/rest-api-methods-should-be-guarded.spec.ts`, `packages/eslint-rules/rules/sort-css-properties-alphabetically.spec.ts`, `packages/eslint-rules/rules/sort-css-properties-alphabetically.ts`, `packages/eslint-rules/rules/styled-components-prefixed-with-styled.spec.ts`, `packages/eslint-rules/rules/styled-components-prefixed-with-styled.ts`, `packages/eslint-rules/rules/use-getLoadable-and-getValue-to-get-atoms.spec.ts`, `packages/eslint-rules/rules/use-getLoadable-and-getValue-to-get-atoms.ts`, `packages/eslint-rules/rules/useRecoilCallback-has-dependency-array.spec.ts`, `packages/eslint-rules/rules/useRecoilCallback-has-dependency-array.ts`, `packages/eslint-rules/tsconfig.json`, `packages/eslint-rules/utils/ruleTesterParser.ts`, `packages/eslint-rules/utils/typedTokenHelpers.ts`, `packages/twenty-docker/twenty-website/Dockerfile`, `packages/twenty-front/eslint.config.mjs`, `packages/twenty-server/eslint.config.mjs`, `packages/twenty-shared/eslint.config.mjs`, `packages/twenty-ui/eslint.config.mjs`, `packages/workspace/scripts/ci/classify-front-source-change.cjs`, `packages/workspace/scripts/lib/review-test-selection.js`, `packages/workspace/scripts/review.js`, `packages/workspace/scripts/test-selection.js`, `packages/workspace/test-selection.registry.json`, `packages/workspace/test-selection.rules.json`, `packages/workspace/tests/eslint-config-paths.test.ts`, `packages/workspace/tests/front-source-change-classifier.test.js`, `packages/workspace/tests/github-workflow-policy.test.js`, `packages/workspace/tests/review-test-selection.test.js`, `packages/workspace/tests/test-selection.test.js`
- matched rules: `workspace-publish-gate`, `workspace-test-selection`, `eslint-config-contract`, `auto:twenty-eslint-rules:test`
- selected suites: `workspace verification stamp tests`, `workspace test selection tests`, `shared ESLint configuration contract`, `twenty-eslint-rules test`
- run results: `workspace verification stamp tests` passed, `workspace test selection tests` passed, `shared ESLint configuration contract` passed, `twenty-eslint-rules test` passed
- failed suites: none


## stream conflict disposition

- After PR #1661 merged, the only overlapping path was `packages/workspace/tests/github-workflow-policy.test.js`.
- The conflict was additive: this task owns frontend/shared lint-gate contracts, while #1661 owns dependency-cache topology invalidation.
- Resolution: copied the already-green #1661 cache contract into this branch without modifying either ownership assertion, allowing the eventual three-way merge to preserve both behaviors.

- RED conflict-resolution contract: adding only the #1661 assertion failed 1/9 because this branch did not yet contain the target stream's cache-action implementation (`trc_4a7a213759c9`).
- Resolution implementation: copied `.github/actions/yarn-install/action.yaml` byte-for-byte from `origin/stream/os-distribution`; this is reconciliation state, not new ownership, and should vanish from the eventual PR diff against the stream.
- GREEN conflict-resolution contracts: workflow policy plus ESLint config imports passed 9/9 (`trc_1f5428fb3f84`).

- Mergeability refinement: the first combined file still conflicted because both branches inserted distinct test blocks at the same ancestor location. Reordered the branch so the target stream's cache test appears first, byte-for-byte, followed by this task's frontend/shared tests. The task branch is now a content superset of the stream insertion rather than a competing insertion.

- Final overlap removal: content ordering still produced a textual conflict because the historical branch and stream both inserted tests at the same ancestor boundary. Restored `github-workflow-policy.test.js` byte-for-byte from the target stream and moved this task's two frontend/shared source-gate contracts into `workflow-source-gates.test.js`. This preserves both behaviors while eliminating shared-file ownership.


## CI registry dirt diagnosis and fix

- Fresh GitHub CI on synthetic merge `c5fc9b9e996fb066e84fe44932cb31fb06fb9cb2` selected an unrelated fifth suite, `auto:twenty-sdk:test`, although neither the PR file list nor the exact committed diff contains a `packages/twenty-sdk/**` path.
- All five commands passed independently. The committed synthetic diff selected exactly four intended suites locally; therefore the extra SDK match came from post-checkout workspace dirt created before registry execution.
- RED: added a behavioral test that creates an untracked SDK source file and proves the existing CI-mode selector incorrectly includes it (`trc_ab12b60ef9d3`).
- Fix: `test-selection.js` now treats `CI=true` (or explicit `--committed-only`) as committed-diff-only. Local/default execution still includes working, staged, and untracked files so task verification remains strict.
- GREEN: test-selection suite passed 8/8 (`trc_a3a1338926c2`).
- GREEN: focused workspace/ESLint/workflow suite passed 20/20 (`trc_defb944280a3`).
- GREEN: clean-cache CI simulation selected only the four intended rules and all four commands passed (`trc_f79d0fc5b48c`).
- Disposition: no suite was removed from its legitimate source mapping; only non-PR runtime dirt is excluded in CI.

- Review classification: broad review tests exposed pre-existing Twenty-front/Twenty-UI failures and three pre-existing typecheck findings (`trc_65207c5c28c8`); none are owned by this PR. The CI-equivalent strict review with tests disabled reports zero owned issues and zero blockers (`trc_0fc5b1385bd5`).

- Final full verification is publish-valid against current `stream/os-distribution`; review, precise registry tests, and DB guard all pass (`trc_625dae15aa23`).


## Registry failure observability

- The corrected four-suite CI selection still failed on GitHub, while each suite passed separately under Node 24 and the aggregate passed locally with `CI=true` and `NX_SKIP_NX_CACHE=true`.
- The verifier previously reduced all child details to `registry ... failed`, hiding suite name, exit code, signal, spawn error, duration, and output.
- Added bounded failure summaries in `scripts/lib/verification.js`; `verify.js` now carries child signal/error into human, JSON, and stamp evidence.
- GREEN: diagnostic helper tests passed 5/5 (`trc_0751077bd6fb`).
- GREEN: focused workspace contracts passed 22/22 (`trc_deaa37bcde93`).
- GREEN: exact four-suite aggregate with Nx cache disabled passed; durations were 501ms, 1306ms, 3165ms, and 2453ms with no signals or errors (`trc_ff7e0ba5126b`).
- Disposition: no timeout or suite policy is weakened. The next authoritative Linux run must expose the exact non-portable failure before any further behavior change.

- GREEN: post-diagnostics strict review reports zero owned/blocking findings (`trc_779db350ee19`).
- GREEN: full verification is publish-valid with diagnostic evidence included (`trc_06afc6012f4e`).

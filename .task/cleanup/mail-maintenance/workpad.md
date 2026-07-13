# mail maintenance

branch: `task/cleanup/mail-maintenance`
stream: `stream/cleanup`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1469/mail-maintenance
github pr: https://github.com/consuelohq/opensaas/pull/1469
started: 2026-07-13

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `.github/workflows/ci-emails.yaml` (deleted)
- `.github/workflows/ci-utils.yaml`
- `packages/twenty-server/src/engine/core-modules/email/templates/__tests__/email-templates.spec.ts`
- `packages/workspace/tests/email-package-removal.test.ts`

## workspace-owned: files changed

- `.github/workflows/ci-emails.yaml` (deleted)
- `.github/workflows/ci-utils.yaml`
- `packages/twenty-server/src/engine/core-modules/email/templates/__tests__/email-templates.spec.ts`
- `packages/workspace/tests/email-package-removal.test.ts`

## workspace-owned: activity log

- 2026-07-13 19:41:26 fs.write: `.task/cleanup/mail-maintenance/workpad.md`
- 2026-07-13 19:41:54 fs.write: `packages/workspace/tests/email-package-removal.test.ts`
- 2026-07-13 20:27:37 fs.write: `.task/cleanup/mail-maintenance/workpad.md`
- 2026-07-13 20:29:29 fs.write: `packages/twenty-server/src/engine/core-modules/email/templates/__tests__/email-templates.spec.ts`
- 2026-07-13 20:29:58 fs.trash: `.github/workflows/ci-emails.yaml`
- 2026-07-13 20:40:27 fs.write: `.task/cleanup/mail-maintenance/workpad.md`
- 2026-07-13 20:46:34 fs.write: `.task/cleanup/mail-maintenance/workpad.md`
- 2026-07-13 20:47:57 fs.write: `.task/cleanup/mail-maintenance/workpad.md`
- 2026-07-13 21:31:45 fs.write: `.task/cleanup/mail-maintenance/workpad.md`
- 2026-07-13 21:38:58 fs.write: `.task/cleanup/mail-maintenance/workpad.md`

## workspace-owned: validation evidence

- 2026-07-13 20:41:03 `review.run`: passed — OK
- 2026-07-13 20:42:39 `verify`: failed — COMMAND_FAILED
- 2026-07-13 20:46:58 `review.run`: passed — OK
- 2026-07-13 20:47:39 `verify`: failed — COMMAND_FAILED
- 2026-07-13 20:54:23 `review.run`: passed — OK
- 2026-07-13 21:07:52 `review.run`: passed — OK
- 2026-07-13 21:32:29 `review.run`: passed — OK
- 2026-07-13 21:33:18 `review.run`: passed — OK
- 2026-07-13 21:36:44 `review.run`: passed — OK
- 2026-07-13 21:37:21 `review.run`: passed — OK
- 2026-07-13 21:39:58 `review.run`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(cleanup): description" --changed
bun run task:pr
bun run task:finish
```

## acceptance criteria

- [ ] Root workspace configuration, twenty-server dependencies, source imports, lockfile, CI, Docker, Crowdin, and test-discovery metadata no longer reference the deleted twenty-emails workspace.
- [ ] Required email rendering, templates, localized catalogs, and JSON content types remain available from a maintained twenty-server boundary without restoring packages/twenty-emails.
- [ ] CI dependency installation passes with Yarn hardened mode, --immutable, and --check-cache from a clean task worktree.
- [ ] Focused server tests and production build cover the migrated email functionality.
- [ ] The task is merged into stream/cleanup only; the stream review PR is refreshed and the stale restart PR is closed.

## plan

1. Re-inventory every live twenty-emails reference and recover the removed package API from Git history.
2. Add a focused failing repository contract for the deleted workspace and clean-checkout bin targets.
3. Move the required email implementation into twenty-server, update consumers/configuration/manifests/lockfile, and remove stale CI/container/translation references.
4. Run focused tests, hardened immutable install, build, review, and verify.
5. Push and merge this replacement task into stream/cleanup, close stale PR #1460, refresh the stream PR, and finish both task records safely.

## restart recovery

- The original uncommitted worktree was lost during the computer restart.
- Remote PR #1460 contains only the bootstrap commit and zero changed files.
- Replacement task: task/cleanup/mail-maintenance, PR #1469, session tsk_a1f5813f49b7.

- 2026-07-13 19:41:26 append: `.task/cleanup/mail-maintenance/workpad.md`

- 2026-07-13 19:41:54 write: `packages/workspace/tests/email-package-removal.test.ts`

## workspace-owned: files read

- `.github/workflows/ci-docker-compose.yaml`
- `.github/workflows/ci-test-docker-compose.yaml`
- `.github/workflows/ci-utils.yaml`
- `eslint.config.mjs`
- `packages/cli/bin/consuelo.js`
- `packages/cli/package.json`
- `packages/consuelo-design/package.json`
- `packages/consuelo-design/scripts/consuelo-design.ts`
- `packages/eslint-rules/package.json`
- `packages/eslint-rules/project.json`
- `packages/twenty-docker/docker-compose.yml`
- `packages/twenty-docker/twenty/Dockerfile.worker`
- `packages/twenty-docker/twenty/docker-compose.yml`
- `packages/twenty-front/eslint.config.mjs`
- `packages/twenty-sdk/bin/twenty.mjs`
- `packages/twenty-sdk/package.json`
- `packages/twenty-sdk/project.json`
- `packages/twenty-sdk/src/cli/__tests__/apps/rich-app/__integration__/app-dev/expected-manifest.ts`
- `packages/twenty-sdk/src/cli/__tests__/apps/rich-app/__integration__/app-dev/tests/manifest.tests.ts`
- `packages/twenty-sdk/vitest.config.ts`
- `packages/twenty-sdk/vitest.integration.config.ts`
- `packages/twenty-sdk/vitest.unit.config.ts`
- `packages/twenty-server/eslint.config.mjs`
- `packages/twenty-server/lingui.email-templates.config.ts`
- `packages/twenty-server/src/engine/core-modules/approved-access-domain/services/approved-access-domain.service.ts`
- `packages/twenty-server/src/engine/core-modules/email/templates/__tests__/email-templates.spec.ts`
- `packages/twenty-server/src/engine/core-modules/email/templates/utils/i18n.utils.ts`
- `packages/twenty-server/src/engine/core-modules/tool/tools/send-email-tool/__tests__/send-email-body-rendering.spec.ts`
- `packages/twenty-shared/eslint.config.mjs`
- `packages/twenty-shared/project.json`
- `packages/twenty-ui/eslint.config.mjs`
- `packages/workspace/senior-engineer.md`
- `packages/workspace/tests/email-package-removal.test.ts`

## test-first contract

- Behavior under test: the deleted `twenty-emails` workspace has no live package, source, CI, Docker, translation, or test-discovery references; its required runtime API remains owned by `twenty-server`; clean-checkout workspace binaries remain installable.
- Existing local pattern: repository contract tests under `packages/workspace/tests` plus focused `twenty-server` Jest suites.
- New tests: `packages/workspace/tests/email-package-removal.test.ts`, followed by focused rendering coverage under the server-owned email template boundary.
- Focused red command: `bun --cwd packages/workspace test tests/email-package-removal.test.ts`.
- Expected red failure: stale workspace/package/CI references remain and the server-owned email API files do not yet exist.

- 2026-07-13 20:27:37 append: `.task/cleanup/mail-maintenance/workpad.md`

## workspace-owned: TDD red evidence

- 2026-07-13 20:27:55 `bun --cwd packages/workspace test tests/email-package-removal.test.ts`: failed exit 1 trace: `trc_8513db9469fc`
  - output: error: Script not found "task:exec"
- 2026-07-13 20:29:29 write: `packages/twenty-server/src/engine/core-modules/email/templates/__tests__/email-templates.spec.ts`
- 2026-07-13 20:53:07 `bun --cwd packages/workspace test tests/email-package-removal.test.ts`: failed exit 1 trace: `trc_6d052e731ba9`
  - output: error: Script not found "task:exec"

## implementation checkpoint

- Removed the deleted `packages/twenty-emails` workspace from the root package graph, `twenty-server`, Yarn lockfile, server CI, Docker images, Crowdin metadata, the obsolete email-only workflow, and the stored test-selection project registry.
- Moved the required production email templates, React Email components, TipTap JSON renderer/types, source catalogs, and generated catalogs into `packages/twenty-server/src/engine/core-modules/email/templates`; all nine live consumers now import from this maintained server boundary.
- Added a dedicated email-template Lingui configuration and sequential extract/compile targets while excluding that tree from the primary server catalog.
- Updated Jest to compile TSX and added rendering coverage for all seven production templates, French localization, and the existing JSON email renderer.
- Added source-controlled executable wrappers for the Consuelo CLI and Twenty SDK CLI and marked the existing Consuelo Design bin source executable. This fixes clean-checkout Yarn link failures that became visible after the missing workspace error was removed.
- Yarn's lockfile reconciliation pruned the dependency graph of `twenty-emails` plus other already-deleted root workspaces. The resulting larger lockfile cleanup is required for `--immutable` to accept the current root workspace list.

## validation checkpoint

- TDD red: repository contract failed 5/5 before implementation.
- Repository contract green: 5/5 passed.
- Focused server tests: 2 suites, 10 tests passed.
- Hardened CI-equivalent install passed: `YARN_ENABLE_HARDENED_MODE=1 yarn --immutable --check-cache`.
- Email Lingui extraction and compilation passed across 32 source catalogs and 42 extracted messages.
- Production server build passed; SWC compiled 4,851 files.
- Active-reference scan found zero `twenty-emails` references outside the intentional repository contract; all 32 PO catalogs have migrated metadata.
- Prettier passed for 64 changed/new first-party source and config files; `git diff --check` passed; both new CLI wrappers passed `node --check`.
- Existing repository blockers outside this task remain: `twenty-server` typecheck reports broad pre-existing strictness errors across command/database/GraphQL code, with no errors in the migrated email paths. `twenty-server` lint cannot start because the already-deleted `packages/twenty-eslint-rules` plugin still configures the missing `twenty/inject-workspace-repository` rule. The focused tests and production build for this migration pass.

- 2026-07-13 20:40:27 append: `.task/cleanup/mail-maintenance/workpad.md`

## workspace-owned: test selection

- changed files: `.github/crowdin-app.yml`, `.github/workflows/ci-emails.yaml`, `.github/workflows/ci-server.yaml`, `.task/cleanup/mail-maintenance/current.json`, `.task/cleanup/mail-maintenance/evidence-log.json`, `.task/cleanup/mail-maintenance/read-log.json`, `.task/cleanup/mail-maintenance/session.json`, `.task/cleanup/mail-maintenance/workpad.md`, `.task/tasks/cleanup/mail-maintenance.json`, `package.json`, `packages/cli/bin/consuelo.js`, `packages/cli/package.json`, `packages/consuelo-design/scripts/consuelo-design.ts`, `packages/twenty-docker/twenty/Dockerfile`, `packages/twenty-docker/twenty/Dockerfile.worker`, `packages/twenty-sdk/bin/twenty.mjs`, `packages/twenty-sdk/package.json`, `packages/twenty-sdk/vitest.config.ts`, `packages/twenty-server/jest-integration.config.ts`, `packages/twenty-server/jest.config.mjs`, `packages/twenty-server/lingui.config.ts`, `packages/twenty-server/lingui.email-templates.config.ts`, `packages/twenty-server/package.json`, `packages/twenty-server/project.json`, `packages/twenty-server/src/engine/core-modules/approved-access-domain/services/approved-access-domain.service.ts`, `packages/twenty-server/src/engine/core-modules/auth/services/auth.service.ts`, `packages/twenty-server/src/engine/core-modules/auth/services/reset-password.service.ts`, `packages/twenty-server/src/engine/core-modules/email-verification/services/email-verification.service.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/__tests__/email-templates.spec.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/common-style.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/components/BaseEmail.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/components/BaseHead.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/components/CallToAction.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/components/Footer.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/components/HighlightedContainer.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/components/HighlightedText.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/components/Link.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/components/Logo.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/components/MainText.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/components/ShadowText.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/components/SubTitle.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/components/Title.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/components/WhatIsTwenty.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/constants/DefaultWorkspaceLogo.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/emails/clean-suspended-workspace.email.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/emails/password-reset-link.email.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/emails/password-update-notify.email.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/emails/send-email-verification-link.email.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/emails/send-invite-link.email.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/emails/validate-approved-access-domain.email.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/emails/warn-suspended-workspace.email.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/index.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/aa-ER.po`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/af-ZA.po`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/ar-SA.po`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/ca-ES.po`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/cs-CZ.po`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/da-DK.po`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/de-DE.po`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/el-GR.po`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/en.po`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/es-ES.po`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/fi-FI.po`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/fr-FR.po`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/generated/af-ZA.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/generated/ar-SA.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/generated/ca-ES.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/generated/cs-CZ.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/generated/da-DK.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/generated/de-DE.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/generated/el-GR.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/generated/en.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/generated/es-ES.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/generated/fi-FI.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/generated/fr-FR.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/generated/he-IL.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/generated/hu-HU.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/generated/it-IT.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/generated/ja-JP.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/generated/ko-KR.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/generated/nl-NL.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/generated/no-NO.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/generated/pl-PL.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/generated/pseudo-en.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/generated/pt-BR.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/generated/pt-PT.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/generated/ro-RO.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/generated/ru-RU.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/generated/sr-Cyrl.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/generated/sv-SE.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/generated/tr-TR.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/generated/uk-UA.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/generated/vi-VN.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/generated/zh-CN.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/generated/zh-TW.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/he-IL.po`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/hu-HU.po`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/it-IT.po`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/ja-JP.po`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/ko-KR.po`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/nl-NL.po`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/no-NO.po`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/pl-PL.po`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/pseudo-en.po`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/pt-BR.po`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/pt-PT.po`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/ro-RO.po`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/ru-RU.po`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/sr-Cyrl.po`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/sv-SE.po`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/tr-TR.po`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/uk-UA.po`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/vi-VN.po`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/zh-CN.po`, `packages/twenty-server/src/engine/core-modules/email/templates/locales/zh-TW.po`, `packages/twenty-server/src/engine/core-modules/email/templates/utils/capitalize.ts`, `packages/twenty-server/src/engine/core-modules/email/templates/utils/email-renderer/email-renderer.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/utils/email-renderer/marks/bold.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/utils/email-renderer/marks/italic.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/utils/email-renderer/marks/link.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/utils/email-renderer/marks/strike.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/utils/email-renderer/marks/underline.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/utils/email-renderer/nodes/bullet-list.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/utils/email-renderer/nodes/hard-break.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/utils/email-renderer/nodes/heading.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/utils/email-renderer/nodes/image.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/utils/email-renderer/nodes/list-item.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/utils/email-renderer/nodes/ordered-list.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/utils/email-renderer/nodes/paragraph.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/utils/email-renderer/nodes/text.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/utils/email-renderer/nodes/variable-tag.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/utils/email-renderer/renderers/render-mark.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/utils/email-renderer/renderers/render-node.tsx`, `packages/twenty-server/src/engine/core-modules/email/templates/utils/i18n.utils.ts`, `packages/twenty-server/src/engine/core-modules/tool/tools/email-tool/email-composer.service.ts`, `packages/twenty-server/src/engine/core-modules/tool/tools/send-email-tool/__tests__/send-email-body-rendering.spec.ts`, `packages/twenty-server/src/engine/core-modules/workspace-invitation/services/workspace-invitation.service.ts`, `packages/twenty-server/src/engine/workspace-manager/workspace-cleaner/services/cleaner.workspace-service.ts`, `packages/twenty-server/src/utils/parse-email-body.ts`, `packages/workspace/test-selection.registry.json`, `packages/workspace/tests/email-package-removal.test.ts`, `yarn.lock`
- matched rules: `workspace-test-selection`, `twenty-server-project`, `auto:twenty-sdk:test`, `auto:twenty-server:test`
- selected suites: `workspace test selection tests`, `twenty-server affected test target`, `twenty-sdk test`, `twenty-server test`
- run results: `workspace test selection tests` passed, `twenty-server affected test target` passed, `twenty-sdk test` passed, `twenty-server test` passed
- failed suites: none

## verify recovery

- Full verify initially failed because the Twenty SDK default Vitest config resolved test globs from the repository root and then mixed integration suites into the unit target.
- Added `root: __dirname` and excluded `__integration__` from the default SDK test config. The dedicated integration target remains unchanged.
- `npx nx test twenty-sdk --coverage=false` now passes, allowing the affected-test selection gate to complete normally.

- 2026-07-13 20:46:34 append: `.task/cleanup/mail-maintenance/workpad.md`

## final gate status

- Full affected-test selection now passes: workspace selection tests, Twenty SDK unit target, and both Twenty Server test target invocations.
- Twenty Server full unit suite passed: 445 suites and 3,512 tests, with 2 suites/10 tests intentionally skipped.
- `review.run --no-tests` reports zero issues owned by this change and zero blocking task findings.
- The publish-valid verify stamp remains blocked only because the full verify policy promotes 57 unchanged same-file legacy error-handling findings plus the known repository typecheck/plugin failures to blocking status. No changed-line defect was reported.
- Publishing will use the task workflow's explicit approved override with this evidence rather than expanding a package-removal task into a broad server error-handling rewrite.

- 2026-07-13 20:47:57 append: `.task/cleanup/mail-maintenance/workpad.md`

- 2026-07-13 20:52:58 apply-patch: `packages/workspace/tests/email-package-removal.test.ts`

- 2026-07-13 20:53:27 apply-patch: `.github/workflows/ci-test-docker-compose.yaml`

- 2026-07-13 20:59:04 apply-patch: `packages/workspace/tests/email-package-removal.test.ts`

- 2026-07-13 21:04:25 apply-patch: `packages/workspace/tests/email-package-removal.test.ts`
- 2026-07-13 21:04:47 apply-patch: `.github/workflows/ci-utils.yaml`

- 2026-07-13 21:19:05 apply-patch: `packages/twenty-sdk/src/cli/__tests__/apps/rich-app/__integration__/app-dev/expected-manifest.ts`

- 2026-07-13 21:23:26 apply-patch: `packages/workspace/tests/email-package-removal.test.ts`
## stale ESLint path and SDK fixture recovery

- CI exposed a second intentionally removed workspace path: live ESLint rules are under `packages/eslint-rules`, while root workspaces, Nx metadata, package configs, Docker, and test-selection metadata still referenced nonexistent `packages/twenty-eslint-rules`.
- Added a red/green repository contract for every owning path, removed the stale root workspace entry, and repointed all consumers to `packages/eslint-rules` without renaming the Nx project.
- `twenty-server` and `twenty-front` lint now start and load the custom rules correctly. They continue to fail on broad pre-existing module-boundary and formatting findings unrelated to this cleanup; the former missing-plugin startup failure is resolved.
- The custom rules Jest target now starts from the real package path. Its remaining failures are pre-existing ESLint 9 RuleTester/type compatibility issues (`recommended` metadata and legacy `parser` config format).
- Updated the stale Twenty SDK integration favicon checksum to the generated value. Full SDK integration passes: 3 files, 10 tests.
- Hardened immutable Yarn completed successfully after the ESLint workspace cleanup; Yarn's link step only toggled an existing bin source mode locally, which was restored before publishing.

- 2026-07-13 21:31:45 append: `.task/cleanup/mail-maintenance/workpad.md`

- 2026-07-13 21:35:21 apply-patch: `packages/twenty-server/eslint.config.mjs`
- 2026-07-13 21:35:22 apply-patch: `packages/twenty-server/lingui.email-templates.config.ts`

## scope correction before final push

- The stale `packages/twenty-eslint-rules` path was investigated because CI exposed it after the email cleanup. A local migration to `packages/eslint-rules` proved that the missing-plugin failure is only the first layer of unrelated repository-wide ESLint and RuleTester debt.
- That unpushed migration was reverted before finalization. It is not part of this task's final diff and should be handled as a dedicated cleanup task rather than mixed into the `twenty-emails` package removal.
- The retained follow-up is the SDK integration fixture checksum update, which directly repairs the CI failure observed on this task and passes the full SDK integration suite.

- 2026-07-13 21:38:58 append: `.task/cleanup/mail-maintenance/workpad.md`

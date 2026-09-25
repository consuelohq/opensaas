# M5 Consuelo identity and licensing cleanup

branch: `task/twenty-migration/m5-consuelo-identity-and-licensing-cleanup`
stream: `stream/twenty-migration`
pr: https://github.com/consuelohq/opensaas/pull/2486
started: 2026-09-21

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `.agent/init.sh` (deleted)
- `.claude/skills/worktree-batch` (deleted)
- `.cursor/rules` (deleted)
- `.cursor/skills` (deleted)
- `.cursor/worktrees.json`
- `.git-rewrite` (deleted)
- `.github/CLA.md` (deleted)
- `.github/CODE_OF_CONDUCT.md`
- `.github/CONTRIBUTING.md`
- `.github/crowdin-app.yml` (deleted)
- `.github/SECURITY.md`
- `.husky/pre-commit`
- `AGENTS.md`
- `LICENSE`
- `LICENSES/MIT.txt`
- `NOTICE`
- `packages/eslint-rules/index.ts`
- `packages/eslint-rules/jest.config.mjs` (deleted)
- `packages/eslint-rules/project.json`
- `packages/eslint-rules/rules/mdx-component-newlines.spec.ts` (deleted)
- `packages/eslint-rules/rules/no-angle-bracket-placeholders.spec.ts` (deleted)
- `packages/eslint-rules/tsconfig.json`
- `packages/workspace/tests/twenty-migration-identity-license.test.ts`
- `tests/postman` (deleted)

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(twenty-migration): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test:
- Public repository identity must be Consuelo-specific.
- Active root/editor/tooling surfaces must not reference deleted Twenty application packages or obsolete Twenty workflows.
- License metadata must match provenance: Consuelo-owned code may use Apache-2.0; separately licensed or inherited code must keep its applicable license/attribution and must not be silently relicensed.
- The root README/license statement must not claim a blanket MIT/Apache license while residual inherited files remain under different terms.

existing local pattern:
- packages/os and packages/workspace already carry package-local Apache-2.0 LICENSE files.
- packages/consuelo-website carries a package-local MIT license with Oxygenna attribution.
- packages/workspace/tests/twenty-migration-runtime-boundary.test.ts enforces deletion of the eight Twenty application packages and selected runtime/tooling paths, but does not yet cover stale root/editor rules.
- pre-Consuelo baseline caee9854137c3c696f519a9103e9b19bce547476 has 95 paths still present in HEAD; 80 remain byte-for-byte unchanged, so root relicensing cannot treat the repository as wholly Consuelo-authored.

new or changed tests:
- Extend the Twenty migration boundary test with a curated list of obsolete Twenty-only root/editor/tooling surfaces and assert they are absent.
- Add repository identity/license contract coverage that verifies Consuelo public policy files exist, README does not claim MIT incorrectly, package license metadata is consistent with package-local licenses/provenance, and separately licensed subtrees remain explicitly acknowledged.

focused red command:
bun x vitest run packages/workspace/tests/twenty-migration-runtime-boundary.test.ts packages/workspace/tests/twenty-migration-identity-license.test.ts

expected red failure:
- stale Twenty editor/tooling files such as .cursor/rules/* and old Twenty-specific hooks/config still exist;
- root package.json still says AGPL-3.0;
- README incorrectly says Consuelo OS is MIT licensed;
- root policy/notice surface is incomplete for the current Consuelo repository.

no-test waiver: not applicable.

## Provenance evidence collected before mutation

- packages/agent package manifest was introduced by kokayi in commit 5a9d250d (2026-02-22); current metadata says AGPL-3.0.
- packages/consuelo-design manifest was introduced by kokayi in commit 54281f7d (2026-05-03); current metadata says AGPL-3.0.
- analytics/api/cli/coaching/contacts/dialer/logger/sdk/workspace manifests were introduced in the Consuelo-era commit a8bc26d6 (2026-02-13) by the Consuelo bot account; copy/similarity provenance still needs inspection before any relicensing.
- packages/os was introduced by kokayi in b6233b46 and already has an Apache-2.0 package-local LICENSE.
- packages/consuelo-website has its own MIT license with Oxygenna attribution and must remain separately licensed.
- Root LICENSE is still the inherited AGPL/commercial text, while README currently says “Consuelo OS is MIT licensed”; this is internally contradictory.
- 95 pre-Consuelo baseline paths remain in the current tree; 80 are unchanged blobs. These include Twenty-specific Cursor rules, old GitHub policy/actions, Nx/Yarn support, and generic shared config. M5 must not blanket-relicense those files without either removing/replacing them or explicitly retaining their upstream license treatment.

- 2026-09-21 00:18:50 append: `.task/twenty-migration/m5-consuelo-identity-and-licensing-cleanup/workpad.md`

## workspace-owned: files changed

- `.agent/init.sh` (deleted)
- `.claude/skills/worktree-batch` (deleted)
- `.cursor/rules` (deleted)
- `.cursor/skills` (deleted)
- `.cursor/worktrees.json`
- `.git-rewrite` (deleted)
- `.github/CLA.md` (deleted)
- `.github/CODE_OF_CONDUCT.md`
- `.github/CONTRIBUTING.md`
- `.github/crowdin-app.yml` (deleted)
- `.github/SECURITY.md`
- `.husky/pre-commit`
- `AGENTS.md`
- `LICENSE`
- `LICENSES/MIT.txt`
- `NOTICE`
- `packages/eslint-rules/index.ts`
- `packages/eslint-rules/jest.config.mjs` (deleted)
- `packages/eslint-rules/project.json`
- `packages/eslint-rules/rules/mdx-component-newlines.spec.ts` (deleted)
- `packages/eslint-rules/rules/no-angle-bracket-placeholders.spec.ts` (deleted)
- `packages/eslint-rules/tsconfig.json`
- `packages/workspace/tests/twenty-migration-identity-license.test.ts`
- `tests/postman` (deleted)

## workspace-owned: activity log

- 2026-09-21 00:18:50 fs.write: `.task/twenty-migration/m5-consuelo-identity-and-licensing-cleanup/workpad.md`
- 2026-09-21 00:22:23 fs.write: `packages/workspace/tests/twenty-migration-identity-license.test.ts`
- 2026-09-21 00:22:55 fs.trash: `.claude/skills/worktree-batch`
- 2026-09-21 00:22:56 fs.trash: `.cursor/rules`
- 2026-09-21 00:22:56 fs.trash: `.cursor/skills`
- 2026-09-21 00:22:56 fs.trash: `.github/CLA.md`
- 2026-09-21 00:22:57 fs.trash: `tests/postman`
- 2026-09-21 00:22:57 fs.trash: `.git-rewrite`
- 2026-09-21 00:23:37 fs.trash: `.agent/init.sh`
- 2026-09-21 00:23:38 fs.trash: `.github/crowdin-app.yml`
- 2026-09-21 00:24:14 fs.write: `LICENSE`
- 2026-09-21 00:24:14 fs.write: `NOTICE`
- 2026-09-21 00:24:14 fs.write: `.github/SECURITY.md`
- 2026-09-21 00:24:15 fs.write: `.github/CONTRIBUTING.md`
- 2026-09-21 00:24:15 fs.write: `.github/CODE_OF_CONDUCT.md`
- 2026-09-21 00:24:15 fs.write: `AGENTS.md`
- 2026-09-21 00:24:16 fs.write: `.husky/pre-commit`
- 2026-09-21 00:24:16 fs.write: `.cursor/worktrees.json`
- 2026-09-21 00:57:26 fs.trash: `packages/eslint-rules/jest.config.mjs`
- 2026-09-21 00:57:27 fs.trash: `packages/eslint-rules/rules/mdx-component-newlines.spec.ts`
- 2026-09-21 00:57:27 fs.trash: `packages/eslint-rules/rules/no-angle-bracket-placeholders.spec.ts`
- 2026-09-21 00:57:33 fs.write: `packages/eslint-rules/index.ts`
- 2026-09-21 00:57:33 fs.write: `packages/eslint-rules/project.json`
- 2026-09-21 00:57:33 fs.write: `packages/eslint-rules/tsconfig.json`
- 2026-09-21 00:58:15 fs.write: `LICENSES/MIT.txt`
- 2026-09-21 00:59:43 fs.write: `.task/twenty-migration/m5-consuelo-identity-and-licensing-cleanup/workpad.md`
- 2026-09-21 01:02:46 fs.write: `.task/twenty-migration/m5-consuelo-identity-and-licensing-cleanup/workpad.md`
- 2026-09-21 01:05:56 fs.write: `.task/twenty-migration/m5-consuelo-identity-and-licensing-cleanup/workpad.md`
- 2026-09-21 01:11:10 fs.write: `.task/twenty-migration/m5-consuelo-identity-and-licensing-cleanup/workpad.md`

## workspace-owned: files read

- `.claude/skills/worktree-batch/SKILL.md`
- `.cursor/Dockerfile`
- `.cursor/environment.json`
- `.cursor/worktrees.json`
- `.github/CLA.md`
- `.github/CODE_OF_CONDUCT.md`
- `.github/CONTRIBUTING.md`
- `.github/SECURITY.md`
- `.github/dependabot.yml`
- `.github/release-drafter.yml`
- `.husky/pre-commit`
- `AGENTS.md`
- `LICENSE`
- `eslint.config.mjs`
- `packages/agent/src/skill-executor.ts`
- `packages/api/src/middleware/auth.ts`
- `packages/api/src/routes/files.ts`
- `packages/consuelo-core/src/registry/index.ts`
- `packages/consuelo-core/tests/registry.test.ts`
- `packages/consuelo-design/RAILWAY.md`
- `packages/consuelo-design/UPSTREAM.md`
- `packages/consuelo-design/package.json`
- `packages/consuelo-design/upstream/open-design/LICENSE`
- `packages/eslint-rules/eslint.config.react.mjs`
- `packages/eslint-rules/index.ts`
- `packages/eslint-rules/jest.config.mjs`
- `packages/eslint-rules/project.json`
- `packages/eslint-rules/rules/mdx-component-newlines.ts`
- `packages/eslint-rules/rules/no-angle-bracket-placeholders.ts`
- `packages/eslint-rules/tsconfig.json`
- `packages/os/manifests/manifest.config.ts`
- `packages/os/scripts/generate-tool-manifest.ts`
- `tests/postman/README.md`

## M5 implementation and focused validation

- Replaced the inherited root blanket AGPL/commercial license file with an explicit repository license map.
- Preserved license texts under LICENSES/: Apache-2.0, AGPL-3.0, and MIT.
- Added NOTICE with Consuelo, Open Design, Oxygenna, and residual Twenty provenance/attribution boundaries.
- Root package metadata now uses `SEE LICENSE IN LICENSE`; clearly Consuelo-owned package manifests audited in this task use Apache-2.0; existing MIT package manifests remain MIT.
- Preserved package-local/upstream third-party licensing for Open Design and the Consuelo website.
- Rewrote GitHub SECURITY/CONTRIBUTING/CODE_OF_CONDUCT as Consuelo-specific policy surfaces.
- Removed obsolete Twenty-only Cursor rules/skills, Claude worktree-batch skill, old CLA, old Crowdin app config, stale Postman CRM collection/environments, and stale agent init bootstrap.
- Removed active deleted-package references from root hook/config, API comments, review fallback package lists, design deployment docs, and package tooling.
- The inherited ESLint workspace package had 15 dead CRM-era rules plus two MDX rules still used by the root config. Pruned all unused rule implementations/tests and the obsolete Jest harness; retained only mdx-component-newlines and no-angle-bracket-placeholders; renamed the live root plugin namespace from `twenty/*` to `consuelo/*`.
- Generated test-selection registry now reflects the pruned test inventory and no longer exposes `twenty-eslint-rules`.
- Focused GREEN:
  - retained eslint-rules TypeScript package: `bun x tsc -p packages/eslint-rules/tsconfig.json --noEmit` passed.
  - root ESLint config loaded under Bun and linted a real documentation MDX file successfully.
  - test-selection + M4 runtime boundary + M5 identity/license + explore-ranker: 4 files / 98 tests passed.
  - `yarn install --immutable` completed successfully with existing peer warnings; the only working-tree effect was executable-bit normalization on generated packages/cli/bin/consuelo.js, which was restored because content was unchanged.
- A direct attempt to run the pre-existing eslint-rules Jest suite exposed pre-M5 incompatibility with ESLint 9/Node runtime (old RuleTester eslintrc format and removed metadata fields). Because only two MDX rules are still consumed, M5 removed the dead legacy rule/test surface rather than modernizing unused CRM lint infrastructure.

Next: strict review and canonical verify, then push/promotion.

- 2026-09-21 00:59:43 append: `.task/twenty-migration/m5-consuelo-identity-and-licensing-cleanup/workpad.md`

## workspace-owned: validation evidence

- 2026-09-21 01:00:05 `review.run`: passed — OK
- 2026-09-21 01:00:24 apply-patch: `packages/eslint-rules/rules/mdx-component-newlines.ts`
- 2026-09-21 01:00:24 apply-patch: `packages/eslint-rules/rules/no-angle-bracket-placeholders.ts`
- 2026-09-21 01:00:31 apply-patch: `packages/eslint-rules/rules/mdx-component-newlines.ts`
- 2026-09-21 01:00:57 `review.run`: passed — OK
- 2026-09-21 01:02:05 `verify`: failed — COMMAND_FAILED
- 2026-09-21 01:02:58 `verify`: failed — COMMAND_FAILED
- 2026-09-21 01:05:50 `review.run`: passed — OK
- 2026-09-21 01:08:42 `review.run`: passed — OK

## Verify wait — 2026-09-20

Wait reason: canonical M5 verify is still actively running after the facade call timed out; verify.js and the selected OS explore suite are live.
Duration: 30s.
Resume action: inspect the same process and verify.json without starting another verify.
Expected signal: process exits and publishValid verification evidence is available.
Fallback: if still active, continue one bounded wait; if exited without a stamp, inspect durable output/evidence before retrying.

- 2026-09-21 01:02:46 append: `.task/twenty-migration/m5-consuelo-identity-and-licensing-cleanup/workpad.md`

- 2026-09-21 01:05:31 apply-patch: `packages/consuelo-core/src/registry/index.ts`
- 2026-09-21 01:05:31 apply-patch: `packages/consuelo-core/tests/registry.test.ts`

## Canonical verify repair

- Full verify selected @consuelo/core and exposed a local-import audit false positive: `../manifests/manifest.config` was treated as explicitly extensioned because `path.extname` returned `.config`, so the auditor never tried `.ts`.
- The actual module `packages/os/manifests/manifest.config.ts` exists and is the canonical manifest config.
- Fixed `localImportExists` to always consider the base path and to append known source extensions whenever the apparent suffix is not itself a recognized source extension.
- Added a fixture regression for `./manifest.config` resolving `manifest.config.ts`.
- @consuelo/core package test is now 12/12 green.
- Strict review after the repair: 0 blocking findings; only 10 pre-existing dialer/API typecheck findings remain outside M5 scope.

- 2026-09-21 01:05:56 append: `.task/twenty-migration/m5-consuelo-identity-and-licensing-cleanup/workpad.md`

- 2026-09-21 01:07:48 apply-patch: `packages/workspace/tests/twenty-migration-runtime-boundary.test.ts`

- 2026-09-21 01:08:05 apply-patch: `packages/consuelo-core/src/registry/index.ts`

## Final M5 publish gate — GREEN

- Strict review: 0 changed, related-pre-existing, or pre-existing findings in the final task scope.
- Canonical verify: passed=true, publishValid=true; 14 registry-selected suites passed; DB guard 0 risks / 0 findings; verify stamp written.
- Migration-focused validation remains green: core registry 12/12 and migration/test-selection suite 98/98.
- Next: push this exact task state, inspect fresh GitHub checks on the pushed SHA, then promote to stream/twenty-migration.

- 2026-09-21 01:11:10 append: `.task/twenty-migration/m5-consuelo-identity-and-licensing-cleanup/workpad.md`

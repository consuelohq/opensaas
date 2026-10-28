# M6 Yarn to Bun cutover

branch: `task/twenty-migration/m6-yarn-to-bun-cutover`
stream: `stream/twenty-migration`
pr: https://github.com/consuelohq/opensaas/pull/2487
started: 2026-09-21

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `.github/actions/bun-install/action.yaml`
- `.github/actions/consuelo-ci-setup/action.yaml`
- `.github/actions/yarn-install` (deleted)
- `.yarn` (deleted)
- `.yarnrc.yml` (deleted)
- `packages/workspace/tests/twenty-migration-bun-cutover.test.ts`
- `yarn.lock` (deleted)

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
- The root Consuelo workspace uses Bun as its package manager, with a committed Bun lockfile and frozen-lockfile CI/install behavior.
- Active Consuelo CI, Docker/Railway deploy definitions, contributor/worktree bootstrap, release-change classification, and repository scripts do not require Yarn/Corepack.
- Open Design remains an intentionally vendored upstream pnpm workspace; its Corepack/pnpm commands and lockfile are out of scope and must remain intact.
- The M4/M5 migration boundary remains intact: no deleted Twenty application workspace may be reintroduced during lockfile or CI changes.

existing local pattern:
- Root scripts already overwhelmingly execute through Bun.
- Root packageManager is still yarn@4.9.2, with yarn.lock, .yarnrc.yml, and .yarn/releases/yarn-4.9.2.cjs.
- .yarnrc.yml uses node-modules linker and contains one legacy @nestjs/serve-static peer extension explicitly justified for the removed Twenty/Express stack; this must be proven unnecessary before removal.
- packages/dialer-server Docker/Railway and GitHub release classification still name Yarn artifacts.
- packages/os/scripts/ci-plan.ts already recognizes both Yarn and Bun package-manager files, so M6 should narrow the active root contract to Bun while retaining upstream Open Design pnpm behavior.

new or changed tests:
- Add packages/workspace/tests/twenty-migration-bun-cutover.test.ts covering root packageManager/engines, Bun lockfile presence, Yarn artifact absence, active CI/deploy/bootstrap surfaces, and preserved Open Design pnpm boundary.
- Update existing CI-plan/release/deployment tests where they intentionally classify package-manager changes.
- Regenerate test-selection registry after test inventory and workflow changes.

focused red command:
bun x vitest run packages/workspace/tests/twenty-migration-bun-cutover.test.ts

expected red failure:
- package.json declares yarn@4.9.2 and Yarn engines;
- bun.lock is absent while yarn.lock/.yarnrc.yml/.yarn release artifacts are present;
- active GitHub/Docker/Railway/contributor/worktree surfaces still invoke or classify Yarn/Corepack.

no-test waiver: not applicable.

## Audit snapshot

- Installed Bun: 1.3.14; Yarn: 4.9.2.
- Root packageManager: yarn@4.9.2.
- Root workspaces are explicitly listed and compatible with Bun workspaces.
- Yarn artifacts: yarn.lock, .yarnrc.yml, .yarn/releases/yarn-4.9.2.cjs, and a react-phone-number-input patch.
- .yarnrc.yml legacy packageExtension is documented for @nestjs/serve-static + Express compatibility in the removed Twenty stack; verify no surviving workspace still needs that compatibility rule.
- Active migration targets include .cursor/worktrees.json, root README/CONTRIBUTING, .cursor/Dockerfile, GitHub yarn-install action/workflows, dialer-server Dockerfile/Railway watch paths, production-release path classification, CI planner, and tests that reference the root lockfile.
- Vendored packages/consuelo-design/upstream/open-design is independently pnpm-managed; do not convert it to Bun.

- 2026-09-21 01:13:37 append: `.task/twenty-migration/m6-yarn-to-bun-cutover/workpad.md`

## workspace-owned: files changed

- `.github/actions/bun-install/action.yaml`
- `.github/actions/consuelo-ci-setup/action.yaml`
- `.github/actions/yarn-install` (deleted)
- `.yarn` (deleted)
- `.yarnrc.yml` (deleted)
- `packages/workspace/tests/twenty-migration-bun-cutover.test.ts`
- `yarn.lock` (deleted)

## workspace-owned: activity log

- 2026-09-21 01:13:37 fs.write: `.task/twenty-migration/m6-yarn-to-bun-cutover/workpad.md`
- 2026-09-21 01:14:14 fs.write: `packages/workspace/tests/twenty-migration-bun-cutover.test.ts`
- 2026-09-21 01:15:49 fs.write: `.github/actions/bun-install/action.yaml`
- 2026-09-21 01:15:49 fs.trash: `.github/actions/yarn-install`
- 2026-09-21 01:16:43 fs.write: `.github/actions/consuelo-ci-setup/action.yaml`
- 2026-09-21 01:18:01 fs.trash: `yarn.lock`
- 2026-09-21 01:18:02 fs.trash: `.yarnrc.yml`
- 2026-09-21 01:18:02 fs.trash: `.yarn`
- 2026-09-21 01:21:54 fs.write: `.task/twenty-migration/m6-yarn-to-bun-cutover/workpad.md`
- 2026-09-21 01:24:00 fs.write: `.task/twenty-migration/m6-yarn-to-bun-cutover/workpad.md`
- 2026-09-21 01:28:41 fs.write: `.task/twenty-migration/m6-yarn-to-bun-cutover/workpad.md`

## workspace-owned: files read

- `.agents/skills/link-workspace-packages/SKILL.md`
- `.agents/skills/monitor-ci/references/fix-flows.md`
- `.cursor/Dockerfile`
- `.cursor/worktrees.json`
- `.github/CONTRIBUTING.md`
- `.github/actions/consuelo-ci-setup/action.yaml`
- `.github/actions/yarn-install/action.yaml`
- `.github/workflows/consuelo-dialer-rollback.yaml`
- `.github/workflows/consuelo-production-release.yaml`
- `.gitignore`
- `.opencode/skills/link-workspace-packages/SKILL.md`
- `.opencode/skills/monitor-ci/references/fix-flows.md`
- `README.md`
- `packages/dialer-server/Dockerfile`
- `packages/dialer-server/railway.json`
- `packages/documentation/scripts/validate-documentation.mjs`
- `packages/lead-connector/src/deployment/release-workflow.contract.test.ts`
- `packages/os/scripts/ci-plan.ts`
- `packages/os/tests/ci-plan.test.ts`
- `packages/workspace/tests/twenty-migration-runtime-boundary.test.ts`

## M6 implementation and focused validation

- Root package manager is now `bun@1.3.14`; engines preserve Node `^24.5.0` and require Bun `>=1.3.14`.
- Root workspaces were converted from Yarn's object form to Bun's array form without changing the 12 workspace paths.
- Generated root `bun.lock` with Bun 1.3.14: 2,827 resolved packages.
- Bun cannot import this Yarn v4 lockfile directly, so the root Bun lock was resolved from manifests. A second frozen lockfile-only install is clean.
- Removed root `yarn.lock`, `.yarnrc.yml`, `.yarn/`, Yarn-specific gitignore state, and the Yarn install GitHub action.
- Removed the stale nested Yarn-only resolution `graphql-redis-subscriptions/ioredis`; the package is absent from surviving manifests, while direct `ioredis` dependencies remain.
- Added `.github/actions/bun-install/action.yaml` and moved Consuelo CI, release, rollback, contributor setup, worktree bootstrap, standalone dialer Docker build, Railway watch paths, CI planning, and index lockfile exclusions to Bun.
- Independent Consuelo package roots with their own existing Bun locks now explicitly pin `bun@1.3.14`: packages/os, packages/workspace, packages/documentation (already pinned), and packages/consuelo-website.
- Vendored Open Design remains intentionally pnpm/Corepack-owned and was not converted.
- Updated the historical M4 boundary test so M6's final state requires Bun rather than Yarn.
- Regenerated `packages/workspace/test-selection.registry.json`.

### GREEN evidence

- M6 RED first reproduced 4 expected failures / 1 pass; after implementation, M6 contract is 5/5 green.
- `bun install --lockfile-only --frozen-lockfile --ignore-scripts`: passed with no changes.
- Clean-room root install using only root package.json, bun.lock, and the 12 workspace manifests: passed; 5,096 packages installed under `bun install --frozen-lockfile --ignore-scripts`.
- LeadConnector deployment artifact suite under its declared Bun runner: 4/4 passed.
- CI planner + M6 + migration boundary: 21/21 passed.
- Test-selection + M6 + migration boundary: 90/90 passed.
- Documentation validator: passed, 105 selected pages.
- GitHub workflow checker: passed with zero findings on tracked workflow/action changes.
- Residual scan across active Consuelo root/CI/deploy/scripts found no Yarn-owned references; generic multi-package-manager guidance and the vendored Open Design pnpm boundary are intentionally outside that assertion.
- `git diff --check`: passed.

Next: strict review and canonical verify against origin/stream/twenty-migration, then push/promotion and fresh stream CI.

- 2026-09-21 01:21:54 append: `.task/twenty-migration/m6-yarn-to-bun-cutover/workpad.md`

## workspace-owned: validation evidence

- 2026-09-21 01:22:12 `review.run`: passed — OK
- 2026-09-21 01:23:24 `verify`: failed — COMMAND_FAILED
- 2026-09-21 01:24:40 `verify`: failed — COMMAND_FAILED
- 2026-09-21 01:26:58 `review.run`: passed — OK

## Verify wait

Wait reason: canonical M6 verify is still actively running after the facade call timed out.
Duration: 30s.
Resume action: inspect the same verify process and verify.json without starting a duplicate.
Expected signal: process exits with a publish-valid verification record.
Fallback: if the wrapper loses finalization again, capture one redirected canonical verify rather than launching parallel copies.

- 2026-09-21 01:24:00 append: `.task/twenty-migration/m6-yarn-to-bun-cutover/workpad.md`

- 2026-09-21 01:26:36 apply-patch: `packages/lead-connector/src/deployment/release-workflow.contract.test.ts`

## Final M6 publish gate — GREEN

- Full LeadConnector package after Docker contract repair: 122/122 passed.
- Strict review after final repair: 0 blocking findings.
- Canonical verify: passed=true, publishValid=true.
- Registry-selected suites: 12 passed, 0 failed.
- DB guard: passed, 0 risks / 0 findings.
- Verify stamp written for the current task state.

Next: push PR #2487, promote into stream/twenty-migration, then require fresh CI on stream PR #1991 before main integration.

- 2026-09-21 01:28:41 append: `.task/twenty-migration/m6-yarn-to-bun-cutover/workpad.md`

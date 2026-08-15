# M4 remove legacy Twenty application tree

branch: `task/twenty-migration/m4-remove-legacy-twenty-application-tree`
stream: `stream/twenty-migration`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2053/m4-remove-legacy-twenty-application-tree
github pr: https://github.com/consuelohq/opensaas/pull/2053
started: 2026-08-15

## acceptance criteria

- [ ] Remove the detached legacy Twenty application package trees from the active repository.
- [ ] Remove Twenty-only CI workflows, helpers, baselines, runbooks/deployment scaffolding, and stale workspace/test-selection references whose only consumer is the deleted application.
- [ ] Preserve Consuelo OS, CLI, `@consuelo/dialer`, `dialer-server`, and LeadConnector behavior.
- [ ] Keep Yarn 4 authoritative; only prune removed workspaces/resolutions/lock entries. Do not begin the Yarn-to-Bun migration.
- [ ] Make no predictive-model, Whittle, timing, stopping, or cadence semantic changes.
- [ ] Prove active Consuelo package manifests no longer depend on deleted Twenty packages.
- [ ] Keep Railway, Cloudflare, and production untouched.
- [ ] Canonical `verify` is publish-valid against `origin/stream/twenty-migration`.
- [ ] Push PR #2053 and promote only into `stream/twenty-migration`. Do not merge stream PR #1991 to main and do not start M5.

## plan

1. Replace the M3 transitional runtime guard with an M4 deletion/boundary contract and prove it RED.
2. Delete the eight remaining physical legacy Twenty package trees and prune stale root workspace/resolution metadata.
3. Retire Twenty-only workflows, transitional dialer compatibility/M1 guards, and repository tests/tooling whose only subject is the deleted app; update generic CI/test-selection contracts to the post-M4 topology.
4. Regenerate/prune test-selection and Yarn metadata without changing package-manager authority.
5. Run focused M4/CI/workspace contracts plus CLI, Dialer SDK, dialer-server, and LeadConnector regressions/typechecks/builds.
6. Run workflow-security, zero-consumer scans, strict review, canonical verify, then `task.push` and `task.pr` into the migration stream only.

## Test-first contract

behavior under test: after M4, the legacy Twenty application packages and execution/CI topology are absent while current Consuelo product boundaries remain buildable/testable and cannot acquire active Twenty package dependencies.

existing local pattern: `packages/workspace/tests/twenty-migration-runtime-boundary.test.ts` plus GitHub workflow policy and test-selection contract tests.

new or changed tests: convert the M3 runtime-boundary contract into the M4 physical-deletion contract; update generic CI/test-selection contracts only where they currently encode deleted Twenty ownership.

focused red command: `bun --cwd packages/workspace run test -- tests/twenty-migration-runtime-boundary.test.ts`

expected red failure: remaining `packages/twenty-*` trees, legacy workspace/resolution entries, and legacy Twenty workflow files violate the new post-M4 absence assertions.

no-test waiver: not applicable.

## current status

- Recovery reattached existing PR #2053 to managed task session `tsk_6893b20e16bc`, correctly based on the M3 migration stream.
- The earlier uncommitted M4 worktree was cleaned while the prior chat was idle; PR #2053 remained empty and nothing was pushed or merged.
- Reconstruction is proceeding from the recorded M4 contract and current repository truth, with fresh validation required before publish.

## files changed

- `.github/workflows/ci-breaking-changes.yaml` (deleted)
- `.github/workflows/ci-create-app.yaml` (deleted)
- `.github/workflows/ci-docker-build.yaml` (deleted)
- `.github/workflows/ci-front.yaml` (deleted)
- `.github/workflows/ci-sdk.yaml` (deleted)
- `.github/workflows/ci-server.yaml` (deleted)
- `.github/workflows/ci-shared.yaml` (deleted)
- `.github/workflows/ci-test-docker-compose.yaml` (deleted)
- `.github/workflows/ci-utils.yaml` (deleted)
- `packages/dialer-server/compatibility-cutover.json` (deleted)
- `packages/dialer-server/src/compatibility-cutover.contract.test.ts` (deleted)
- `packages/dialer-server/src/m1-twenty-orchestration.contract.test.ts` (deleted)
- `packages/twenty-docker` (deleted)
- `packages/twenty-e2e-testing` (deleted)
- `packages/twenty-front` (deleted)
- `packages/twenty-sdk` (deleted)
- `packages/twenty-server` (deleted)
- `packages/twenty-shared` (deleted)
- `packages/twenty-ui` (deleted)
- `packages/twenty-utils` (deleted)
- `packages/workspace/scripts/ci/lint-changed-frontend-files.mjs` (deleted)
- `packages/workspace/scripts/ci/run-changed-frontend-task.mjs` (deleted)
- `packages/workspace/scripts/ci/run-changed-server-task.mjs` (deleted)
- `packages/workspace/scripts/ci/twenty-server-eslint-baseline.json` (deleted)
- `packages/workspace/scripts/ci/twenty-server-migration-baseline.json` (deleted)
- `packages/workspace/scripts/ci/twenty-server-typecheck-baseline.json` (deleted)
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/api-breaking-workflow-build-toolchain.test.ts` (deleted)
- `packages/workspace/tests/dialer-validation-runbook.test.ts`
- `packages/workspace/tests/email-package-removal.test.ts` (deleted)
- `packages/workspace/tests/github-workflow-policy.test.js`
- `packages/workspace/tests/lint-changed-frontend-files.test.mjs` (deleted)
- `packages/workspace/tests/run-changed-frontend-task.test.mjs` (deleted)
- `packages/workspace/tests/run-changed-server-task.test.mjs` (deleted)
- `packages/workspace/tests/twenty-migration-runtime-boundary.test.ts`
- `packages/workspace/tests/twenty-server-email-build-contract.test.ts` (deleted)
- `packages/workspace/tests/typeorm-cli-contract.test.mjs` (deleted)
- `scripts/run-batch-6.sh` (deleted)
- `scripts/run-batch-7.sh` (deleted)
- `scripts/run-batch-8.sh` (deleted)
- `scripts/run-phases-5.sh` (deleted)
- `scripts/run-phases-6.sh` (deleted)
- `scripts/validate-dockerfiles.sh` (deleted)

## workspace-owned: files changed

- `.github/workflows/ci-breaking-changes.yaml` (deleted)
- `.github/workflows/ci-create-app.yaml` (deleted)
- `.github/workflows/ci-docker-build.yaml` (deleted)
- `.github/workflows/ci-front.yaml` (deleted)
- `.github/workflows/ci-sdk.yaml` (deleted)
- `.github/workflows/ci-server.yaml` (deleted)
- `.github/workflows/ci-shared.yaml` (deleted)
- `.github/workflows/ci-test-docker-compose.yaml` (deleted)
- `.github/workflows/ci-utils.yaml` (deleted)
- `packages/dialer-server/compatibility-cutover.json` (deleted)
- `packages/dialer-server/src/compatibility-cutover.contract.test.ts` (deleted)
- `packages/dialer-server/src/m1-twenty-orchestration.contract.test.ts` (deleted)
- `packages/twenty-docker` (deleted)
- `packages/twenty-e2e-testing` (deleted)
- `packages/twenty-front` (deleted)
- `packages/twenty-sdk` (deleted)
- `packages/twenty-server` (deleted)
- `packages/twenty-shared` (deleted)
- `packages/twenty-ui` (deleted)
- `packages/twenty-utils` (deleted)
- `packages/workspace/scripts/ci/lint-changed-frontend-files.mjs` (deleted)
- `packages/workspace/scripts/ci/run-changed-frontend-task.mjs` (deleted)
- `packages/workspace/scripts/ci/run-changed-server-task.mjs` (deleted)
- `packages/workspace/scripts/ci/twenty-server-eslint-baseline.json` (deleted)
- `packages/workspace/scripts/ci/twenty-server-migration-baseline.json` (deleted)
- `packages/workspace/scripts/ci/twenty-server-typecheck-baseline.json` (deleted)
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/api-breaking-workflow-build-toolchain.test.ts` (deleted)
- `packages/workspace/tests/dialer-validation-runbook.test.ts`
- `packages/workspace/tests/email-package-removal.test.ts` (deleted)
- `packages/workspace/tests/github-workflow-policy.test.js`
- `packages/workspace/tests/lint-changed-frontend-files.test.mjs` (deleted)
- `packages/workspace/tests/run-changed-frontend-task.test.mjs` (deleted)
- `packages/workspace/tests/run-changed-server-task.test.mjs` (deleted)
- `packages/workspace/tests/twenty-migration-runtime-boundary.test.ts`
- `packages/workspace/tests/twenty-server-email-build-contract.test.ts` (deleted)
- `packages/workspace/tests/typeorm-cli-contract.test.mjs` (deleted)
- `scripts/run-batch-6.sh` (deleted)
- `scripts/run-batch-7.sh` (deleted)
- `scripts/run-batch-8.sh` (deleted)
- `scripts/run-phases-5.sh` (deleted)
- `scripts/run-phases-6.sh` (deleted)
- `scripts/validate-dockerfiles.sh` (deleted)

## workspace-owned: activity log

- 2026-08-15 19:55:29 fs.trash: `packages/twenty-docker`
- 2026-08-15 19:55:35 fs.trash: `packages/twenty-e2e-testing`
- 2026-08-15 19:55:38 fs.trash: `packages/twenty-front`
- 2026-08-15 19:55:42 fs.trash: `packages/twenty-sdk`
- 2026-08-15 19:55:45 fs.trash: `packages/twenty-server`
- 2026-08-15 19:55:48 fs.trash: `packages/twenty-shared`
- 2026-08-15 19:55:51 fs.trash: `packages/twenty-ui`
- 2026-08-15 19:55:55 fs.trash: `packages/twenty-utils`
- 2026-08-15 19:56:00 fs.trash: `.github/workflows/ci-breaking-changes.yaml`
- 2026-08-15 19:56:05 fs.trash: `.github/workflows/ci-create-app.yaml`
- 2026-08-15 19:56:08 fs.trash: `.github/workflows/ci-docker-build.yaml`
- 2026-08-15 19:56:13 fs.trash: `.github/workflows/ci-front.yaml`
- 2026-08-15 19:56:16 fs.trash: `.github/workflows/ci-sdk.yaml`
- 2026-08-15 19:56:19 fs.trash: `.github/workflows/ci-server.yaml`
- 2026-08-15 19:56:22 fs.trash: `.github/workflows/ci-shared.yaml`
- 2026-08-15 19:56:25 fs.trash: `.github/workflows/ci-test-docker-compose.yaml`
- 2026-08-15 19:56:29 fs.trash: `.github/workflows/ci-utils.yaml`
- 2026-08-15 19:56:56 fs.write: `.task/twenty-migration/m4-remove-legacy-twenty-application-tree/workpad.md`
- 2026-08-15 19:57:47 fs.trash: `packages/workspace/scripts/ci/lint-changed-frontend-files.mjs`
- 2026-08-15 19:57:50 fs.trash: `packages/workspace/scripts/ci/run-changed-frontend-task.mjs`
- 2026-08-15 19:57:54 fs.trash: `packages/workspace/scripts/ci/run-changed-server-task.mjs`
- 2026-08-15 19:57:57 fs.trash: `packages/workspace/scripts/ci/twenty-server-eslint-baseline.json`
- 2026-08-15 19:58:00 fs.trash: `packages/workspace/scripts/ci/twenty-server-migration-baseline.json`
- 2026-08-15 19:58:03 fs.trash: `packages/workspace/scripts/ci/twenty-server-typecheck-baseline.json`
- 2026-08-15 19:58:08 fs.trash: `packages/workspace/tests/api-breaking-workflow-build-toolchain.test.ts`
- 2026-08-15 20:00:21 fs.trash: `packages/workspace/tests/lint-changed-frontend-files.test.mjs`
- 2026-08-15 20:00:25 fs.trash: `packages/workspace/tests/run-changed-frontend-task.test.mjs`
- 2026-08-15 20:00:28 fs.trash: `packages/workspace/tests/run-changed-server-task.test.mjs`
- 2026-08-15 20:00:31 fs.trash: `packages/workspace/tests/twenty-server-email-build-contract.test.ts`
- 2026-08-15 20:00:34 fs.trash: `packages/workspace/tests/typeorm-cli-contract.test.mjs`
- 2026-08-15 20:00:39 fs.trash: `packages/workspace/tests/email-package-removal.test.ts`
- 2026-08-15 20:00:43 fs.trash: `packages/dialer-server/src/m1-twenty-orchestration.contract.test.ts`
- 2026-08-15 20:00:48 fs.trash: `packages/dialer-server/src/compatibility-cutover.contract.test.ts`
- 2026-08-15 20:00:52 fs.trash: `packages/dialer-server/compatibility-cutover.json`
- 2026-08-15 20:01:26 fs.write: `packages/workspace/tests/github-workflow-policy.test.js`
- 2026-08-15 20:02:25 fs.write: `packages/workspace/test-selection.rules.json`
- 2026-08-15 20:07:23 fs.write: `packages/workspace/tests/dialer-validation-runbook.test.ts`
- 2026-08-15 20:09:34 fs.trash: `scripts/run-batch-6.sh`
- 2026-08-15 20:09:39 fs.trash: `scripts/run-batch-7.sh`
- 2026-08-15 20:09:45 fs.trash: `scripts/run-batch-8.sh`
- 2026-08-15 20:09:53 fs.trash: `scripts/run-phases-5.sh`
- 2026-08-15 20:10:00 fs.trash: `scripts/run-phases-6.sh`
- 2026-08-15 20:10:29 fs.trash: `scripts/validate-dockerfiles.sh`
- 2026-08-15 20:15:15 fs.write: `.task/twenty-migration/m4-remove-legacy-twenty-application-tree/workpad.md`
- 2026-08-15 20:18:57 fs.write: `.task/twenty-migration/m4-remove-legacy-twenty-application-tree/workpad.md`
- 2026-08-15 20:19:47 fs.write: `.task/twenty-migration/m4-remove-legacy-twenty-application-tree/workpad.md`
- 2026-08-15 20:24:23 fs.write: `packages/workspace/test-selection.rules.json`
- 2026-08-15 20:25:18 fs.write: `.task/twenty-migration/m4-remove-legacy-twenty-application-tree/workpad.md`
- 2026-08-15 20:26:01 fs.write: `.task/twenty-migration/m4-remove-legacy-twenty-application-tree/workpad.md`
- managed by workspace tooling.

## workspace-owned: validation evidence

- managed by workspace tooling.
- 2026-08-15 20:12:12 `checkFiles`: passed — OK
- 2026-08-15 20:15:19 `review.run`: failed — COMMAND_FAILED
- 2026-08-15 20:16:26 `checkFiles`: passed — OK
- 2026-08-15 20:21:13 `checkFiles`: passed — OK

## key decisions

- M4 is physical deletion only. Licensing/repository identity remains M5; Yarn-to-Bun remains M6.
- Preserve current dialer engine/server packages; do not preserve unreachable Twenty implementation merely because transitional guards reference it.
- Retire transitional compatibility-cutover/M1 evidence that reads deleted Twenty implementation rather than rewriting historical evidence.
- Boundary tests will assert tracked source/manifest absence, not raw directory absence, because task worktrees can contain ignored `node_modules` symlinks.

## notes for ko

- No production infrastructure, Railway, Cloudflare, licensing, Bun cutover, or dialer predictive semantics are part of M4.
- Superseded/polluted PR #2047 remains out of the merge path.

## improvements noticed

- Repository-scale deletion validation needs bounded large-output Git subprocess buffers in review/verify/test-selection tooling; this will be revalidated on the reconstructed diff.

## issues and recovery

- Earlier M4 implementation was uncommitted when its temporary worktree was later cleaned; PR #2053 remained at bootstrap SHA `b8c023e827d972f93a905774111a9883a51df02e` with zero changed files.
- Prior canonical verify attempts exposed `ENOBUFS` in large-diff Git enumeration and repeated MCP transport drops. No gate was bypassed and no publish was claimed.
- Current recovery created a fresh managed worktree for the same branch/PR rather than creating a replacement branch.

---

## publish checklist

- [ ] focused M4 contract RED then GREEN
- [ ] focused and preserved product regression suites green
- [ ] zero active consumers / zero legacy package manifests
- [ ] strict review clean
- [ ] canonical `verify` publish-valid against `origin/stream/twenty-migration`
- [ ] `task.push` updates PR #2053 with intended deletion diff
- [ ] `task.pr` promotes into `stream/twenty-migration`
- [ ] stream review PR #1991 remains unmerged to main
- [ ] M5 remains unstarted

- 2026-08-15 19:53:13 write: `.task/twenty-migration/m4-remove-legacy-twenty-application-tree/workpad.md`

- 2026-08-15 19:53:32 write: `packages/workspace/tests/twenty-migration-runtime-boundary.test.ts`

## workspace-owned: files read

- `.github/dependabot.yml`
- `.github/workflows/consuelo-ci.yaml`
- `areas/dialer/AGENTS.md`
- `packages/cli/package.json`
- `packages/dialer-server/README.md`
- `packages/dialer-server/compatibility-cutover.json`
- `packages/dialer-server/package.json`
- `packages/dialer-server/scripts/migrate-database.ts`
- `packages/dialer-server/scripts/validate-local-runtime.ts`
- `packages/dialer-server/src/main.ts`
- `packages/dialer/package.json`
- `packages/lead-connector/package.json`
- `packages/lead-connector/src/deployment/commercial-artifacts.test.ts`
- `packages/lead-connector/src/deployment/release-workflow.contract.test.ts`
- `packages/os/SCRIPTS.md`
- `packages/os/operator/prompts/review.md`
- `packages/os/package.json`
- `packages/os/scripts/artifacts-design.ts`
- `packages/os/scripts/ci-plan.ts`
- `packages/os/scripts/lib/code-call/snapshot.ts`
- `packages/os/tests/artifacts-legacy-contract.test.ts`
- `packages/os/tests/ci-plan.test.ts`
- `packages/os/tests/code-call-snapshot.test.ts`
- `packages/workspace/scripts/ci/check-github-workflows.cjs`
- `packages/workspace/scripts/lib/code-call/snapshot.ts`
- `packages/workspace/scripts/lib/db-guards.js`
- `packages/workspace/scripts/lib/git.js`
- `packages/workspace/scripts/lib/nx-projects.js`
- `packages/workspace/scripts/lib/task-node-modules.js`
- `packages/workspace/scripts/review.js`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/scripts/verify.js`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/dialer-validation-runbook.test.ts`
- `packages/workspace/tests/github-workflow-policy.test.js`
- `packages/workspace/tests/test-selection.test.js`
- `packages/workspace/tests/twenty-migration-runtime-boundary.test.ts`
- `scripts/code-review.sh`
- `scripts/validate-dockerfiles.sh`

## focused RED evidence

- Command: `bun run --cwd packages/workspace test -- tests/twenty-migration-runtime-boundary.test.ts`
- Result: 1 file failed; 3 tests failed, 1 passed.
- Failing boundary classes:
  - legacy package surface still exists (`packages/twenty-docker/twenty/Dockerfile` was first failure);
  - root workspaces still own 12 legacy entries: `create-twenty-app`, `twenty-apps`, `twenty-cli`, `twenty-e2e-testing`, `twenty-eslint-rules`, `twenty-front`, `twenty-sdk`, `twenty-server`, `twenty-shared`, `twenty-ui`, `twenty-utils`, `twenty-zapier`;
  - legacy Twenty CI workflows still exist (`ci-breaking-changes.yaml` was first failure).
- Passing boundary: active Consuelo product manifests already contain zero direct `twenty-*` dependency names.
- Note: an earlier argv-order attempt only printed Bun help and exited 0; it is explicitly not counted as RED evidence.

- 2026-08-15 19:55:25 append: `.task/twenty-migration/m4-remove-legacy-twenty-application-tree/workpad.md`

- 2026-08-15 19:56:37 apply-patch: `package.json`
## focused GREEN evidence

- After deleting the eight physical legacy package trees, nine Twenty-only workflows, and pruning root workspace/resolution ownership, the M4 boundary test passes 4/4.
- Command: `bun run --cwd packages/workspace test -- tests/twenty-migration-runtime-boundary.test.ts`.
- Tooling note: task-scoped `code.call` now fails before execution on the repository-scale deletion diff (`invalid_source` from its pre-execution snapshot). The exact same test was run through `mac.call` with the managed M4 worktree as `cwd`; source mutation continues through typed task tools.

- 2026-08-15 19:56:56 append: `.task/twenty-migration/m4-remove-legacy-twenty-application-tree/workpad.md`

- 2026-08-15 20:01:26 write: `packages/workspace/tests/github-workflow-policy.test.js`

- 2026-08-15 20:01:36 apply-patch: `packages/workspace/scripts/ci/check-github-workflows.cjs`

- 2026-08-15 20:02:03 apply-patch: `packages/os/scripts/ci-plan.ts`
- 2026-08-15 20:02:03 apply-patch: `packages/os/tests/ci-plan.test.ts`
- 2026-08-15 20:02:10 apply-patch: `packages/os/scripts/artifacts-design.ts`
- 2026-08-15 20:02:10 apply-patch: `packages/lead-connector/src/deployment/commercial-artifacts.test.ts`

- 2026-08-15 20:02:25 write: `packages/workspace/test-selection.rules.json`

- 2026-08-15 20:02:41 apply-patch: `packages/workspace/tests/test-selection.test.js`

- 2026-08-15 20:04:22 apply-patch: `packages/workspace/tests/test-selection.test.js`

- 2026-08-15 20:06:43 apply-patch: `areas/dialer/AGENTS.md`
- 2026-08-15 20:06:52 apply-patch: `areas/dialer/AGENTS.md`
- 2026-08-15 20:07:02 apply-patch: `areas/dialer/AGENTS.md`
- 2026-08-15 20:07:12 apply-patch: `scripts/code-review.sh`
- 2026-08-15 20:07:23 write: `packages/workspace/tests/dialer-validation-runbook.test.ts`

- 2026-08-15 20:07:41 apply-patch: `areas/dialer/AGENTS.md`

- 2026-08-15 20:08:08 apply-patch: `packages/os/SCRIPTS.md`
- 2026-08-15 20:08:08 apply-patch: `packages/os/operator/prompts/review.md`

- 2026-08-15 20:08:32 apply-patch: `packages/os/scripts/lib/code-call/snapshot.ts`
- 2026-08-15 20:08:32 apply-patch: `packages/workspace/scripts/lib/code-call/snapshot.ts`
- 2026-08-15 20:08:32 apply-patch: `packages/workspace/scripts/review.js`
- 2026-08-15 20:08:32 apply-patch: `packages/workspace/scripts/verify.js`
- 2026-08-15 20:08:32 apply-patch: `packages/workspace/scripts/test-selection.js`

- 2026-08-15 20:09:31 apply-patch: `.github/dependabot.yml`

- 2026-08-15 20:13:45 apply-patch: `packages/lead-connector/src/deployment/release-workflow.contract.test.ts`
## reconstructed validation evidence

- Focused M4 boundary: 4/4 passed after valid RED (3 expected boundary failures / 1 existing dependency-boundary pass).
- GitHub workflow policy: 8/8 passed.
- Dialer validation runbook contract: 5/5 passed.
- Test selection: 33/33 passed when run from the repository root. An earlier 26-failure run used `packages/workspace` as cwd; those failures were path-resolution artifacts and were not code regressions.
- OS focused contracts: `ci-plan.test.ts` + `artifacts-legacy-contract.test.ts` = 18/18 passed.
- LeadConnector commercial-artifacts focused contract: 4/4 passed with its native Bun runner.
- CLI regression suite: 10/10 passed.
- Dialer regression suite: 175/175 passed.
- dialer-server: 138 passed + 1 intentionally gated local Postgres/Redis integration test skipped.
- LeadConnector: 122/122 passed after updating one stale release-workflow assertion to read classification from `packages/os/scripts/ci-plan.ts` rather than the workflow YAML.
- Typechecks/builds: logger build, CLI typecheck/build, Dialer typecheck/build, dialer-server typecheck/build, LeadConnector typecheck/build, and OS script syntax all passed.
- Large-diff tool syntax: `review.js`, `verify.js`, `test-selection.js`, and `scripts/code-review.sh` passed syntax checks.
- `git diff --check`: passed.
- Deleted-package consumer scan: 19 surviving package manifests scanned; zero dependencies on deleted Twenty package names; zero deleted legacy package manifests remain.
- Executable/config scan across scripts, GitHub automation, OS operator/scripts, workspace scripts, dialer-server, LeadConnector source, and CLI: zero references to `packages/twenty-*` or `packages/create-twenty-app` after cleanup.
- Yarn 4 lock prune: `yarn install --mode=update-lockfile` completed; no `packages/twenty-*` paths or deleted Twenty workspace packages remain in `yarn.lock`.
- Final working-tree shape before review: 14,648 tracked deletions + 24 tracked edits; only managed `.task/**` metadata is untracked. No generated build artifacts are tracked.

### recovery/tooling notes

- The OS facade intermittently returned transport 502/network errors. Each ambiguous mutation was checked against actual filesystem state before retrying; no blind duplicate deletions were performed.
- Active task-scoped `code.call` still uses the running controller's pre-execution Git snapshot and cannot handle this repository-scale deletion. M4 patches both OS/workspace snapshot implementations to a 64 MiB Git output buffer, along with review/verify/test-selection large-output paths. Until those patches are published, scoped validation/generator commands were run through `mac.call` with the exact managed task worktree as `cwd`.
- One LeadConnector suite invocation initially used Vitest on a `bun:test` file; the file passed 4/4 with Bun. One later full LeadConnector run exposed a genuine stale CI contract and was fixed; the final full package result is 122/122.

- 2026-08-15 20:15:15 append: `.task/twenty-migration/m4-remove-legacy-twenty-application-tree/workpad.md`

- 2026-08-15 20:16:18 apply-patch: `packages/workspace/scripts/lib/git.js`

## wait cycle 2026-08-15T20:18:49Z

Wait reason: strict task-local review is still recorded as running after the mac.call transport dropped; duplicate review is forbidden while completion is unknown.
Duration: 30s bounded poll.
Resume action: inspect the same review-run record `84b3266459245728251511f421bf6963199916dab9b38106394529383528aae2` and its PID 68845.
Expected signal: record becomes `completed` with exitCode 0 and preserved stdout/stderr result.
Fallback: if still running, continue bounded polling; if PID is gone and record remains running, use the review-run orphan recovery path before any retry.

- 2026-08-15 20:18:57 append: `.task/twenty-migration/m4-remove-legacy-twenty-application-tree/workpad.md`

## wait cycle 2026-08-15T20:19:38Z

Wait reason: strict review run `84b326...` is still alive at PID 68845 after 3m09s; no completed result exists yet.
Duration: 45s bounded poll.
Resume action: inspect the same review-run record and process state immediately after wake.
Expected signal: completed record with exitCode and captured review output.
Fallback: if still running, inspect its child process/stage before any further wait or retry.

- 2026-08-15 20:19:47 append: `.task/twenty-migration/m4-remove-legacy-twenty-application-tree/workpad.md`

- 2026-08-15 20:20:56 apply-patch: `packages/workspace/scripts/review.js`

- 2026-08-15 20:24:15 apply-patch: `packages/workspace/tests/twenty-migration-runtime-boundary.test.ts`
- 2026-08-15 20:24:23 write: `packages/workspace/test-selection.rules.json`

## final review and verify safety

- Large-diff review root causes fixed on the task branch:
  - shared `packages/workspace/scripts/lib/git.js` now uses a 64 MiB Git output buffer, including staged-index capture paths used by publish;
  - `review.js` skips deleted tracked files before per-file static/changed-line analysis, avoiding thousands of pointless Git diff subprocesses for deleted source.
- An obsolete pre-fix strict-review PID was terminated only after its change hash became invalid and the exact hang was identified; no current review run was duplicated.
- Final strict task-local review on the current hash: 0 findings, 16 surviving reviewable files, no related/pre-existing findings, no documentation opportunities.
- Canonical test selection initially chose the broad `@consuelo/os` package suite because two OS cleanup files were uncovered by an explicit rule. Safety preflight correctly found destructive/privileged literals elsewhere in that broad suite, so it was not executed.
- Added exclusive `twenty-migration-os-reference-cleanup` selection for `packages/os/operator/prompts/review.md` and `packages/os/scripts/lib/code-call/snapshot.ts`, backed by the M4 deletion boundary and focused safe code.call snapshot architecture tests.
- Strengthened the M4 boundary to 5/5 by asserting active operational tooling contains no deleted Twenty application paths.
- Registry selection now contains 15 focused suites and no `auto:@consuelo/os:package-test` / broad `bun run --cwd packages/os test` command.
- Exact selected-suite preflight: 167 JS/TS targets scanned; zero destructive command literals.
- Focused safety replacement tests: 11/11 passed; test-selection contracts remain 33/33 passed.

- 2026-08-15 20:25:18 append: `.task/twenty-migration/m4-remove-legacy-twenty-application-tree/workpad.md`

## canonical publish gate

- Full canonical verify command: `bun packages/workspace/scripts/verify.js --base origin/stream/twenty-migration --quiet` from the managed M4 worktree.
- Result: exit 0; stamp written for change hash `b572f415f10e7830d2181b66f982c3691a627914a506c3cf06af46e22defa554`.
- Stamp: `result: pass`, `publishValid: true`, `mode: full`.
- Verified branch/base: `task/twenty-migration/m4-remove-legacy-twenty-application-tree` vs `origin/stream/twenty-migration`.
- Verified working-tree change set: 14,673 files.
- Review: ran and passed, not skipped.
- Registry tests: 15 selected suites, all passed, zero failed suites.
- DB guard: ran and passed, not warn-only; 497 filename risks from the deleted legacy tree, 0 findings.

Publish is now authorized by the repository gate. Next lifecycle actions are limited to PR #2053 and promotion into `stream/twenty-migration`; stream PR #1991 remains out of main and M5 remains unstarted.

- 2026-08-15 20:26:01 append: `.task/twenty-migration/m4-remove-legacy-twenty-application-tree/workpad.md`

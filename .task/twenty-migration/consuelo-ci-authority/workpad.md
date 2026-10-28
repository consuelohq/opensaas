# Consuelo CI authority

branch: `task/twenty-migration/consuelo-ci-authority`
stream: `stream/twenty-migration`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1990/consuelo-ci-authority
github pr: https://github.com/consuelohq/opensaas/pull/1990
started: 2026-08-15

## acceptance criteria

- [x] Consuelo CI runs its verify gate for every non-Twenty package change.
- [x] Legacy Twenty PR workflows start only for the Twenty-owned paths they still validate.
- [x] Legacy Twenty workflows no longer participate in merge-group CI.
- [x] Existing Twenty validation remains available when Twenty code actually changes.
- [x] No root package-manager, OS release, runtime, deployment, or product behavior is changed.

## plan

1. Inventory current Consuelo and legacy Twenty workflow triggers plus branch/ruleset requirements.
2. Add RED workflow-policy contracts for Consuelo ownership and legacy path isolation.
3. Narrow legacy workflow event scopes and make Consuelo verify catch all non-Twenty packages.
4. Run workflow parsing/security checks, focused regressions, strict review, and canonical verify.

## current status

- Implementation complete and publish-valid; ready to push for review.

## files changed

- `.github/workflows/consuelo-ci.yaml`
- `.github/workflows/ci-front.yaml`
- `.github/workflows/ci-server.yaml`
- `.github/workflows/ci-sdk.yaml`
- `.github/workflows/ci-shared.yaml`
- `.github/workflows/ci-test-docker-compose.yaml`
- `.github/workflows/ci-create-app.yaml`
- `.github/workflows/ci-utils.yaml`
- `.github/workflows/ci-breaking-changes.yaml`
- `packages/workspace/tests/github-workflow-policy.test.js`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-15 02:26:09 fs.write: `.task/twenty-migration/consuelo-ci-authority/workpad.md`
- 2026-08-15 02:29:24 fs.write: `.task/twenty-migration/consuelo-ci-authority/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 02:31:45 `review.run`: passed — OK
- 2026-08-15 02:32:00 `verify`: passed — OK

## key decisions

- Keep `Consuelo CI` as the default repository-owned gate and route all non-Twenty package changes through `Consuelo / verify`.
- Keep legacy Twenty workflows temporarily, but scope them at the GitHub event boundary so Consuelo-only PRs do not create their changed-file/status jobs at all.
- Remove `merge_group` from legacy Twenty workflows; repository rulesets do not require any status/workflow checks.
- Treat `packages/twenty-utils` Danger as legacy: it still references Twenty's CLA and contributor APIs, so it is not a Consuelo review authority.
- Do not touch the root Yarn/Bun package-manager boundary in M0A.

## notes for ko

- A normal Consuelo-only PR should stop showing the legacy Front/E2E, Server, SDK, Shared, Docker Compose, Create App, Twenty Utils/Danger, and Twenty API breaking-change workflow runs.
- Those workflows still run when their corresponding Twenty paths change, preserving compatibility coverage until the Twenty tree is removed.
- Current Consuelo docs/website/OS/dialer workflows are left intact.

## improvements noticed

- `ci-docker-build.yaml` is still a Twenty-era push/deploy workflow. It is intentionally deferred to the later executable/deploy detachment wave rather than mixed into PR-CI isolation.
- M0B can further consolidate Consuelo job routing/caching and Bun-readiness after this ownership boundary lands.

## issues and recovery

- Initial RED test had a test-only regex typo; corrected before establishing RED evidence. The valid RED run then failed only on the intended ownership conditions.

## GREEN validation

- `bun x vitest run packages/workspace/tests/github-workflow-policy.test.js` — 14/14 passed.
- workflow YAML parser — all 9 edited workflow files parsed successfully.
- focused regression set (`github-workflow-policy`, `api-breaking-workflow-build-toolchain`, `email-package-removal`) — 20/20 passed.
- workflow security checker over all 9 edited workflows — passed with 0 findings.
- `git diff --check` — clean.
- strict `review.run` — 0 blocking findings.
- canonical `verify` — passed, full mode, publish-valid stamp written.

## external impact

- schema/API/tool contracts: none.
- runtime/deploy behavior: none.
- environment variables/secrets/permissions: none.
- GitHub Actions surface: legacy Twenty workflow names are explicitly prefixed `Legacy Twenty /` and their event scopes are narrowed; Consuelo `verify` becomes the catch-all gate for non-Twenty packages.

---

## publish checklist

```bash
bun run task:push -- --message "type(twenty-migration): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: Consuelo CI is the authoritative PR gate for Consuelo-owned code; legacy Twenty workflows run only when their remaining Twenty-owned surfaces or truly shared root dependency files change.
existing local pattern: path-classification jobs plus stable aggregate status checks in `.github/workflows` and Consuelo's repo-owned verify/review tooling.
new or changed tests: inspect existing workflow contract tests first; add or update the narrowest static workflow-routing contract before editing workflow production YAML.
focused red command: pending exact test file discovery.
expected red failure: current legacy workflow path filters classify unrelated Consuelo package changes as Twenty frontend/server/SDK work.
no-test waiver: not applicable.

- 2026-08-15 02:26:09 append: `.task/twenty-migration/consuelo-ci-authority/workpad.md`

## workspace-owned: files read

- `.github/workflows/changed-files.yaml`
- `.github/workflows/ci-breaking-changes.yaml`
- `.github/workflows/ci-docker-build.yaml`
- `.github/workflows/ci-docs.yaml`
- `.github/workflows/ci-front.yaml`
- `.github/workflows/ci-sdk.yaml`
- `.github/workflows/ci-server.yaml`
- `.github/workflows/ci-shared.yaml`
- `.github/workflows/ci-test-docker-compose.yaml`
- `.github/workflows/ci-utils.yaml`
- `.github/workflows/ci-website.yaml`
- `.github/workflows/consuelo-ci.yaml`
- `AGENTS.md`
- `CODING-STANDARDS.md`
- `packages/os/tests/local-os-server-review-findings.test.ts`
- `packages/twenty-utils/congratulate-dangerfile.ts`
- `packages/twenty-utils/dangerfile.ts`
- `packages/workspace/package.json`
- `packages/workspace/scripts/ci/check-github-workflows.cjs`
- `packages/workspace/scripts/review.js`
- `packages/workspace/scripts/verify.js`
- `packages/workspace/tests/api-breaking-workflow-build-toolchain.test.ts`
- `packages/workspace/tests/github-workflow-policy.test.js`
- `packages/workspace/tests/local-os-server-review-findings.test.ts`

## RED proof

focused red command: `bun x vitest run packages/workspace/tests/github-workflow-policy.test.js`
expected/observed red failures:
- Consuelo CI has no catch-all non-Twenty package classifier, so packages such as `cli`, `sdk`, `agent`, `analytics`, `chat-bot`, and `coaching` can miss `Consuelo / verify`.
- legacy Twenty workflows have unscoped `pull_request` triggers (and several `merge_group` triggers), so Consuelo-only PRs still create legacy changed-files/status jobs.
observed: 14 tests loaded; the 2 new ownership tests failed for those exact reasons while the existing 12 workflow-policy tests passed.

- 2026-08-15 02:29:24 append: `.task/twenty-migration/consuelo-ci-authority/workpad.md`

- 2026-08-15 02:32:21 apply-patch: `.task/twenty-migration/consuelo-ci-authority/workpad.md`
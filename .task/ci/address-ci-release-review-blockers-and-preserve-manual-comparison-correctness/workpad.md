# Address CI release review blockers and preserve manual comparison correctness

branch: `task/ci/address-ci-release-review-blockers-and-preserve-manual-comparison-correctness`
stream: `stream/ci`
pr: https://github.com/consuelohq/opensaas/pull/2641
started: 2026-10-28

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

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
bun run task:push -- --message "type(ci): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `.github/workflows/changed-files.yaml`
- `.github/workflows/consuelo-ci.yaml`
- `packages/os/scripts/ci-plan.ts`
- `packages/os/tests/ci-plan.test.ts`
- `packages/workspace/tests/github-changed-files.test.js`
- `packages/workspace/tests/github-workflow-policy.test.js`
# Release-review closure: CI change routing and manual event safety

## Acceptance
- Resolve all six inline PR #2635 reviewer findings without weakening test suites or check names.
- Manual workflow_dispatch on arbitrarily aged feature branches must have reachable merge base and current main SHA in both planner and dependent diff consumers; preserve shallow 2-commit PR / merge-group path.
- NUL-safe Git path parsing detects deletions of Unicode, whitespace, tab, or newline-containing tracked names; preserve exact paths.
- Unsupported glob negation/metacharacters force downstream work to run (conservative classification).
- Temp test repo disables commit signing regardless of developer global config.
- Re-review/verify, publish task to stream/ci, sync stream against main, run all PR checks, merge PR #2635 only when clean and safe. Confirm main SHA and post-merge workflows.

## Review findings (2026-10-28)
- Codex 4403360958 and CodeRabbit 4403433443: full history needed for manual workflow_dispatch comparisons.
- CodeRabbit 4403433458: dependent verify / workflow-security checkouts need planner base history for manual runs.
- CodeRabbit 4403433398: unsupported leading ! and (), backslash in glob list must not silently skip.
- CodeRabbit 4403433478: git diff --name-only without -z corrupts special filenames, especially deleted files.
- CodeRabbit 4403433491: fixture must set commit.gpgsign=false.
- Initial stream PR #2635 at c0a14ef6: GitHub checks 19 total, failed 0, pending 0; at audit main had advanced 3 commits; no merge yet.

## Test-first contract
- Existing local pattern: packages/workspace/tests/github-workflow-policy.test.js; packages/workspace/tests/github-changed-files.test.js; packages/os/tests/ci-plan.test.ts with temporary shallow Git repository.
- New/changed tests: assert manual workflow checkout conditional depth 0 for planner, workflow-security and verify, while PR uses depth 2; assert all check names/lane tests unchanged; classify unsupported patterns ! ( ) \\ conservatively; exercise deletion-only Git diff with Unicode and leading space/tab/newline; assert fixture commits despite global commit.gpgsign enabled.
- Focused red command: bun x vitest run tests/github-workflow-policy.test.js tests/github-changed-files.test.js (packages/workspace), and bun x vitest run tests/ci-plan.test.ts (packages/os).
- Expected red: new manual depth and glob tests fail; raw filename deletion test fails before -z; globally signed test fixture fails without explicit disable.
- No-test waiver: none.
- Implementation only after red evidence. Preserve concurrent edits. Follow standard OS task review/verify/push/pr gates.

## Merge constraints
- Never merge on failed/pending required check or unresolved substantive review finding; stream.sync with current main via supported workflow, preserve other agents' work.
- Do not initiate runtime deployment: CI YAML changes activate after merge to main automatically. Post-merge checks verify no regressions.

- 2026-10-28 17:59:16 append: `.task/ci/address-ci-release-review-blockers-and-preserve-manual-comparison-correctness/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-28 17:59:16 fs.write: `.task/ci/address-ci-release-review-blockers-and-preserve-manual-comparison-correctness/workpad.md`
- 2026-10-28 17:59:32 apply-patch: `packages/workspace/tests/github-workflow-policy.test.js`
- 2026-10-28 17:59:41 apply-patch: `packages/workspace/tests/github-changed-files.test.js`
- 2026-10-28 17:59:48 apply-patch: `packages/os/tests/ci-plan.test.ts`
- 2026-10-28 18:00:16 fs.write: `.task/ci/address-ci-release-review-blockers-and-preserve-manual-comparison-correctness/workpad.md`
- 2026-10-28 18:01:43 fs.write: `.task/ci/address-ci-release-review-blockers-and-preserve-manual-comparison-correctness/workpad.md`
- 2026-10-28 18:02:46 fs.write: `.task/ci/address-ci-release-review-blockers-and-preserve-manual-comparison-correctness/workpad.md`

## Red regression evidence (October 28)
- packages/workspace: 4 newly failing assertions across workflow policy (manual checkout depth) and API unsupported-glob pattern (!, grouping). 22 original passing.
- packages/os CI planner: existing fixture fails new local signing contract; now includes exact Unicode, leading whitespace, tab, newline deletion paths to exercise NUL-safe diff after signing is configured.
- Production code remained unchanged for these red runs.

- 2026-10-28 18:00:16 append: `.task/ci/address-ci-release-review-blockers-and-preserve-manual-comparison-correctness/workpad.md`

- 2026-10-28 18:00:30 apply-patch: `.github/workflows/consuelo-ci.yaml`
- 2026-10-28 18:00:35 apply-patch: `.github/workflows/changed-files.yaml`
- 2026-10-28 18:01:04 apply-patch: `packages/os/scripts/ci-plan.ts`
- 2026-10-28 18:01:10 apply-patch: `packages/os/tests/ci-plan.test.ts`
## Green regression checkpoint
- Focused red -> green: workspace workflow/API 26/26 and OS planner 11/11 passed. PR and merge-group checkouts retain depth=2; manual workflow_dispatch planner, workflow-security, verify use full history.
- The Git integration fixture deletes 5 source files with ASCII, accented Unicode, leading spaces, tabs, and embedded newlines. NUL output uses exact filenames, without trim/quoted path issues.
- Git fixture explicitly disables signing and checks local setting to prevent global signing failures.
- Unrecognized glob patterns containing !, (), backslash conservatively run downstream checks.
- Modified only 6 CI/test files plus scoped task metadata. No unrelated edits.
- Pending: workflow security check, review.run and full verify, task push/pr, stream sync, post-publication GitHub check, merge main when safe.

- 2026-10-28 18:01:43 append: `.task/ci/address-ci-release-review-blockers-and-preserve-manual-comparison-correctness/workpad.md`

## workspace-owned: validation evidence

- 2026-10-28 18:02:07 `review.run`: passed — OK
- 2026-10-28 18:02:34 `verify`: passed — OK

## Validation and reviewer resolution
- All 6 inline review comments addressed: two manual checkout ancestry comments, downstream immutable-base availability, conservative glob handling, NUL-safe Unicode/control-path classification, deterministic unsigned Git fixture.
- Focused tests: workspace workflow/API 26/26; OS planner 11/11; OS native selector 8/8; workflow security policy passed for changed CI workflow files; git diff --check passed.
- review.run against origin/stream/ci: 0 blockers, 0 affected review issues; static, ESLint, types, spec checks passed.
- OS verify gate: passed, publishValid true, full 6 critical registry suites passed (20 local-server, 27 Windows contract, 14 workflow policy, 11 planner, 8 selector plus security checker), DB guard passed with no risks.
- Follow-up publish through task push/PR; then sync stream/ci against main and check/re-run GitHub Actions before main merge. No deployment necessary for CI YAML.

- 2026-10-28 18:02:46 append: `.task/ci/address-ci-release-review-blockers-and-preserve-manual-comparison-correctness/workpad.md`

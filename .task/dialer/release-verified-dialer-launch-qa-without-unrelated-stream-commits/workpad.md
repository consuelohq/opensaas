# Release verified Dialer launch QA without unrelated stream commits

branch: `task/dialer/release-verified-dialer-launch-qa-without-unrelated-stream-commits`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2770
started: 2026-11-06

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/dialer-server/src/lab/launch-release-classifier.test.ts`

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
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first release contract — DEV-1675

behavior under test: release exactly the previously strictly reviewed and fully verified Dialer human-scenario QA harness and isolated native billing migration rollback lab fixture repairs onto main, with no unrelated stream commits, runtime dialer changes or carrier side effects.
existing local pattern: source from stream/dialer at exact verified task promotion (task #2769, verified push 1fb46ea930bc09907914a2bede638f7d7f887993); runbook and tests are present on stream; main is an ancestor and lacks launch scenario files.
new or changed tests: transplant identical launch-scenarios.test.ts and launch-scenarios.cli.test.ts from verified stream. Before implementing catalog/CLI in main-based release task, run focused red: bun test packages/dialer-server/src/lab/launch-scenarios.test.ts (expected missing ./launch-scenarios). For rollback fixture, existing lab:verify on main expected red from native-billing forward-only migration ledger. No new runtime functionality permitted.
focused red command: bun test packages/dialer-server/src/lab/launch-scenarios.test.ts
expected red failure: module ./launch-scenarios absent until the main-based task receives exact published files.
shipping: transplant only packages/dialer-server/LAUNCH-QA.md, package.json lab:launch script, scripts/launch-scenarios.ts, scripts/local-dialer-lab.ts, src/lab/learning-rollback-scenario.ts, src/lab/launch-scenarios.ts, src/lab/launch-scenarios.test.ts, src/lab/launch-scenarios.cli.test.ts. Keep .task release workpad; no other source or active agent edits.
verification: test-first red, then focused green, 24-scenario matrix, full 3-package test suites, local disposable PostgreSQL+Redis lab, server typecheck/build, review.run strict, formal verify against main, publish exact source via native GitHub scoped PR based on main only. Do NOT merge stream/dialer into main. Do NOT deploy the backend or Worker for test-only changes. Confirm no automatic production deployment can change user-facing services; if a release workflow is invoked, monitor and abort unauthorized changes. Keep GHL live audio acceptance separate pending signed-in browser and per-call exact number approval.

- 2026-11-06 02:11:45 append: `.task/dialer/release-verified-dialer-launch-qa-without-unrelated-stream-commits/workpad.md`

## workspace-owned: files changed

- `packages/dialer-server/src/lab/launch-release-classifier.test.ts`

## workspace-owned: activity log

- 2026-11-06 02:11:45 fs.write: `.task/dialer/release-verified-dialer-launch-qa-without-unrelated-stream-commits/workpad.md`
- 2026-11-06 02:14:48 fs.write: `.task/dialer/release-verified-dialer-launch-qa-without-unrelated-stream-commits/workpad.md`
- 2026-11-06 02:15:11 fs.write: `packages/dialer-server/src/lab/launch-release-classifier.test.ts`
- 2026-11-06 02:16:36 fs.write: `.task/dialer/release-verified-dialer-launch-qa-without-unrelated-stream-commits/workpad.md`

## workspace-owned: validation evidence

- 2026-11-06 02:12:52 `review.run`: passed — OK
- 2026-11-06 02:13:16 apply-patch: `packages/dialer-server/src/lab/launch-scenarios.ts`
- 2026-11-06 02:14:07 `review.run`: passed — OK
- 2026-11-06 02:16:29 `review.run`: passed — OK
- 2026-11-06 02:18:33 `verify`: passed — OK

## Additional release-safety gate (test first)

Observed main GitHub workflow triggers dialer Railway/Worker deployment for *any* packages/dialer-server file change, including this QA-only release. User authorized shipping QA harness, not new live backend. Add a narrow QA-only classification exception with reproducible fixture tests. A package.json change must be proven exactly the lab:launch script addition; runtime source/dependency changes must still release. Tests will execute extracted workflow Bash against an isolated temporary git repository and assert release=false for QA-only and release=true for runtime/dependency changes. No unrelated workflow rewrites. Must not weaken manual workflow_dispatch release targeting.
Focused RED: bun test packages/dialer-server/src/lab/launch-release-classifier.test.ts before classifier update; existing workflow will emit release=true for QA-only fixture, contrary to requirement.

- 2026-11-06 02:14:48 append: `.task/dialer/release-verified-dialer-launch-qa-without-unrelated-stream-commits/workpad.md`

- 2026-11-06 02:15:11 write: `packages/dialer-server/src/lab/launch-release-classifier.test.ts`

- 2026-11-06 02:15:32 apply-patch: `.github/workflows/consuelo-production-release.yaml`

## Scoped independent release verification — 2026-11-05

- Task #2769 promoted verified source into stream/dialer at 1fb46ea930bc09907914a2bede638f7d7f887993, stream PR #2765. Stream/dialer ahead main by 277 commits/162 files; not merged wholesale.
- Main-based release task PR #2770 from main ancestor. Transplanted only verified Dialer QA/harness files and fixture fixes (tests first), adjusted the single pre-main RedisParallelStore test mapping. Red baseline: missing ./launch-scenarios, then green 10 focused tests/310 assertions.
- Additional test-first release guard: production workflow currently deploys Railway/Worker for any package path; new classifier fixture red (QA-only triggered release=true), fixed with allowlisted QA-only files and semantic JSON comparison dropping solely the new lab:launch script. Regression runs real extracted Bash in a disposable git repository; red-to-green 1 test/12 assertions, checks QA-only skip, runtime and dependency changes still release, manual dialer release unaffected.
- Final main-source full dialer + lead-connector + dialer-server suites: 758 pass, 93 skipped integration cases, 0 failures, 4087 assertions. Scenario matrix: 147 pass/19 test files; all 24 marked component-only and live-not-tested. Full disposable Postgres/Redis lab: 1 pass, 39 assertions, zero external providers. Server typecheck, compiled build, git diff --check green.
- Formal strict review.run with base=main and mine=true: 0 blocking issues. Three broad repository docs opportunities are unrelated to this release.
- Main release should contain only eight Dialer QA/harness/fixture paths, one extra classifier contract test and the .github/workflows release guard, plus task metadata. The release guard must classify these exact paths as QA-only and keep existing production Dialer Railway/Worker untouched. No actual carrier calls; GHL OS-owned browser still at login. Next formal verify main, task.push, retarget scoped PR #2770 base main, wait for CI, inspect exact files/sha, merge if safely gated.

- 2026-11-06 02:16:36 append: `.task/dialer/release-verified-dialer-launch-qa-without-unrelated-stream-commits/workpad.md`

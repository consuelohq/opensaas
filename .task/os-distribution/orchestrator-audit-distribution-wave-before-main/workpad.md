# orchestrator audit distribution wave before main

branch: `task/os-distribution/orchestrator-audit-distribution-wave-before-main`
stream: `stream/os-distribution`
pr: https://github.com/consuelohq/opensaas/pull/1617
started: 2026-07-24

## acceptance criteria

- [x] Audit Workers 05 and 06 together against the master plan and their briefs.
- [x] Recheck all existing Grok/Codex/CodeRabbit findings and recorded dispositions.
- [x] Prove rollback/retention/uninstall safety and managed-component provenance coexist correctly.
- [x] Diagnose and repair CodeRabbit stream-to-main path filtering without invoking a review.
- [x] Add failing behavioral/configuration tests before verified production/config corrections.
- [x] Run focused lifecycle, managed-component, config, and task verification gates.
- [x] Do not request any new external review.

## plan

1. Read both worker briefs, combined stream diff, workpads, and existing review dispositions.
2. Exercise retention, rollback, uninstall, provenance, merge classification, and content-base retention contracts together.
3. Reproduce the CodeRabbit path-filter defect with a local config contract, then patch minimally.
4. Fix only verified defects, rerun focused and task-level gates, and merge corrections into the distribution stream.

## test-first contract

- Product behavior: current/previous/pinned releases survive pruning; failed activation rolls back; uninstall preserves user content; modified managed components and unresolved content bases are never silently lost.
- Configuration behavior: a normal source file on a stream-to-main PR remains reviewable while `.task/**` is excluded except workpads.
- No production/config edit before a focused failing contract proves the defect.

## current status

- Worker 05’s three known lifecycle safety defects were addressed by PR #1605 and its final Grok review approved the result.
- Worker 06’s two known provenance/conflict defects were fixed and dispositions were recorded on PR #1601.
- Combined-stream audit found one real integration regression: Worker 06 made three managed-component files mandatory runtime inputs, but Worker 05’s lifecycle fixture did not include them, so the rollback/uninstall suite failed during bundle setup. The fixture now matches the merged runtime contract.
- CodeRabbit’s exact stream-PR skip message reported normal source files as “excluded by none and included by none.” The repository configuration now explicitly includes `**`, then excludes `.task/**`, then re-includes workpads.
- No new external review was requested.

## issues and recovery

- CodeRabbit skipped stream PRs because the repository path-filter list contains one positive workpad-only pattern after excluding `.task/**`; local contract will lock the intended include-all behavior.
- The first combined Vitest invocation ran package-relative subprocess suites from the repository root and produced path-resolution artifacts. Re-running from `packages/os` separated those invocation errors from the real runtime-fixture integration failure.

## test-first and validation evidence

- RED CodeRabbit contract: `packages/os/tests/coderabbit-config.test.ts` failed because the first filter was `!.task/**` rather than an explicit repository include.
- GREEN CodeRabbit contract: 1/1 passed after adding `**` before the task exclusions.
- RED combined lifecycle contract: `lifecycle-retention-uninstall.test.ts` failed before tests could execute because `scripts/managed-components.ts` was a required runtime input missing from Worker 05’s fixture.
- GREEN lifecycle safety: 20/20 rollback, retention, uninstall, reset, symlink, and bounded-growth tests passed after aligning the fixture.
- GREEN managed components: 14/14 tests passed.
- GREEN install-state integration: 22/22 tests passed.
- GREEN lifecycle engine: 34/34 tests passed.
- GREEN settings integration: 6/6 tests passed.
- GREEN distribution lane: 70 tests passed with 7 pre-existing TODO contracts.
- GREEN package typecheck/syntax gate.
- GREEN task verify: static rules, ESLint, typecheck, spec compliance, and DB safety passed with zero findings; no external model review was invoked.

## files changed

- `.coderabbit.yaml`
- `packages/os/tests/coderabbit-config.test.ts`
- `packages/os/tests/lifecycle-retention-uninstall.test.ts`

- 2026-07-24 04:24:54 write: `.task/os-distribution/orchestrator-audit-distribution-wave-before-main/workpad.md`

## files changed

- `packages/os/tests/coderabbit-config.test.ts`

## workspace-owned: files changed

- `packages/os/tests/coderabbit-config.test.ts`

## workspace-owned: activity log

- 2026-07-24 04:24:54 fs.write: `.task/os-distribution/orchestrator-audit-distribution-wave-before-main/workpad.md`
- 2026-07-24 04:26:10 write: `packages/os/tests/coderabbit-config.test.ts`
- 2026-07-24 04:26:10 fs.write: `packages/os/tests/coderabbit-config.test.ts`

- 2026-07-24 04:26:19 apply-patch: `.coderabbit.yaml`
- 2026-07-24 04:27:09 apply-patch: `packages/os/tests/lifecycle-retention-uninstall.test.ts`

- 2026-07-24 04:27:47 apply-patch: `.task/os-distribution/orchestrator-audit-distribution-wave-before-main/workpad.md`

## workspace-owned: validation evidence

- 2026-07-24 04:28:07 `verify`: passed — OK
- 2026-07-24 04:28:11 apply-patch: `.task/os-distribution/orchestrator-audit-distribution-wave-before-main/workpad.md`
- 2026-07-24 04:28:15 `verify`: passed — OK

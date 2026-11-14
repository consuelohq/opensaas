# Repair native CI immutable comparison base for Mercury candidate

branch: `task/dialer/repair-native-ci-immutable-comparison-base-for-mercury-candidate`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2808
started: 2026-11-14

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
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

Behavior under test: an immutable PR-event base missing from a shallow merge checkout is fetched by its exact validated SHA before native-file diff; changed files determine the same focused/full native test plan. Existing symbolic refs and genuine fetch or diff failures remain fail-closed; an absent immutable head is handled under the same rule if applicable.
Existing local pattern: node:test contract tests for the native selector, actual temporary Git repositories with a local origin, and bounded targeted immutable-SHA fetches.
New or changed tests: create an origin containing a historical base and newer main + PR merge head, clone with depth 2 so the historical SHA is absent, assert exact SHA fetch and correct native selection; exercise fetch failure and invalid/non-SHA inputs without fallback.
Focused red command: node --test packages/workspace/tests/run-changed-os-native-tests.test.mjs
Expected red failure: native selection currently exits with git diff bad object for the absent historical base.
No-test waiver: not applicable.
Integration dependency: task starts from main 0780f96 because session.start supports main or stream only (trc_65abf11e2796); candidate PR #2798 exact head 58354620316d4076f8f6824c65ed910639702caf is the root coordinator's integration target, not this task's base or a moving-main substitute.

- 2026-11-14 06:14:47 append: `.task/dialer/repair-native-ci-immutable-comparison-base-for-mercury-candidate/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-11-14 06:14:47 fs.write: `.task/dialer/repair-native-ci-immutable-comparison-base-for-mercury-candidate/workpad.md`
- 2026-11-14 06:16:51 apply-patch: `packages/workspace/tests/run-changed-os-native-tests.test.mjs`
- 2026-11-14 06:17:04 apply-patch: `packages/workspace/tests/run-changed-os-native-tests.test.mjs`
- 2026-11-14 06:17:17 apply-patch: `packages/workspace/tests/run-changed-os-native-tests.test.mjs`
- 2026-11-14 06:17:39 apply-patch: `packages/workspace/tests/run-changed-os-native-tests.test.mjs`
- 2026-11-14 06:17:56 apply-patch: `packages/workspace/scripts/ci/run-changed-os-native-tests.mjs`
- 2026-11-14 06:19:10 fs.write: `.task/dialer/repair-native-ci-immutable-comparison-base-for-mercury-candidate/workpad.md`
- 2026-11-14 06:23:02 fs.write: `.task/dialer/repair-native-ci-immutable-comparison-base-for-mercury-candidate/workpad.md`
- 2026-11-14 06:23:55 fs.write: `.task/dialer/repair-native-ci-immutable-comparison-base-for-mercury-candidate/workpad.md`

## Implementation and focused evidence

Merged candidate 58354620316d4076f8f6824c65ed910639702caf into this fresh main-based task locally, preserving both histories (trc_a38365de8d6d); source remains uncommitted. The real temporary depth-2 merge fixture reproduced `fatal: bad object` for the missing event base before the implementation (trc_bbacdc854799). The selector now checks full immutable object IDs only, fetches an absent ID from origin at depth 1 only in a shallow repository, verifies the commit, and propagates fetch/diff failures. Named refs retain existing behavior. Focused test: 12 passed, including missing base and head, failed fetch, and symbolic diff failure (trc_70764dedb77f).

`bun run review -- --strict` returned exit 0 and no findings in changed files (trc_cfe357ea75d4); its broader typecheck reported 35 background failures because the fresh checkout lacks the merged workspace conversation link/build. Those errors are not a clean typecheck. Full verification pending.

- 2026-11-14 06:19:10 append: `.task/dialer/repair-native-ci-immutable-comparison-base-for-mercury-candidate/workpad.md`

## Final validation

After an isolated frozen-lockfile Bun dependency bootstrap and local logger, contacts, conversation, and dialer builds (trc_29817569c7da), strict review passed including typecheck with no findings (trc_872fa3d54553). Full `bun run verify` passed all 13 selected registry suites, review, and database guard and produced a publish-valid stamp (trc_84b1ae17bb41). The original full-verify failure (trc_b8d79f2dfe06) was caused by the missing conversation package in the initially linked checkout and was resolved by isolated bootstrap. No manifest or lockfile changes. Candidate dependency merge is local commit 9a7dc38e1f2b054084d475f3b2012e72a5164e11; source edits remain uncommitted for managed publication by the coordinator.

- 2026-11-14 06:23:02 append: `.task/dialer/repair-native-ci-immutable-comparison-base-for-mercury-candidate/workpad.md`

## Coordinator independent review and publication plan

Root reviewed the two-file selector diff (trc_346d2dce5608): only absent immutable SHA objects in shallow repositories are fetched by exact ID; both base/head remain immutable, symbolic refs retain prior behavior, and failed fetch/diff still rejects. Root independently reran all12 node selector tests green (trc_4facfd305987); no actionable review findings. The source is frozen. The source feature candidate remains58354620316d4076f8f6824c65ed910639702caf until this narrow repair is integrated.

Publication mechanics: local dependency merge9a7dc38e1f2b054084d475f3b2012e72a5164e11 contains currentmain0780f96 and candidate5835. The managed file-publish API cannot upload local-only ancestry; after current valid verification, root will normally/non-forced push ONLY this verified dependency merge (source fix still uncommitted), then managed task.push publishes the two-file fix. Keep #2808 task-only and retarget it into existing draft#2798, never shared stream/main. Exact-head CI and final tree/source comparison remain required.

The original feature checkout tsk_a088de3ce2a6 is now evicted with original verified recovery bundle preserved (trc_e8d10c83c707); root never touched other user worktrees or primary checkout. An initial sandboxed work-session eviction could not write the task registry; a task-scoped eviction then timed out during removal after creating verified recovery. Root verified that original bundle and resumed only the removal/status tail under the old task scope with a longer runtime; final status isevicted/pathabsent. Do not restore it merely to read history.

Paid/live evaluation remains explicitly paused by Ko; all model/cost/semantic acceptance stays open in DEV-1707. No main merge, deployment, carrier calls, capture, credential/billing changes or paid inference are authorized in this CI repair.

- 2026-11-14 06:23:55 append: `.task/dialer/repair-native-ci-immutable-comparison-base-for-mercury-candidate/workpad.md`

## workspace-owned: validation evidence

- 2026-11-14 06:24:54 `verify`: passed — OK

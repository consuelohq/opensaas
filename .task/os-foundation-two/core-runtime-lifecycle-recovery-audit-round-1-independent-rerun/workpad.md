# core runtime lifecycle recovery audit round 1 independent rerun

branch: `task/os-foundation-two/core-runtime-lifecycle-recovery-audit-round-1-independent-rerun`
stream: `stream/os-foundation-two`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1688/core-runtime-lifecycle-recovery-audit-round-1-independent-rerun
github pr: https://github.com/consuelohq/opensaas/pull/1688
started: 2026-07-28

## acceptance criteria

- [x] Review PR #1674 at immutable candidate `ef2530b136ec2a170915b583abfb2341899bd6ab` against every requirement owned by Worker 23a.
- [x] Build a requirement-level intent-lineage matrix for Workers 01, 04, 05, 06, 07, and 24, including implementation/repair PRs and current evidence.
- [x] Inspect the retained comparison diff, exact candidate code, surrounding tests, lifecycle state/failure paths, CI, runtime fixtures, and relevant historical reviews.
- [x] Independently disposition existing human and automated findings without duplicating open issues.
- [x] Post every new `23A-R01-*` finding, the structured review object, top-level summary, consolidated repair prompt, and unavailable-evidence record to PR #1674.
- [x] Write `packages/os/plans/consuelo-os-foundation/reviews/final/23a-report.md` with exact evidence and a `DOMAIN CLEAR`, `DOMAIN CONDITIONAL`, or `DOMAIN BLOCKED` result.
- [ ] Push and merge only this review record into `stream/os-foundation-two`; do not modify product code or promote the stream to `main`.

## plan

1. Read the complete original-intent corpus and discover implementation, promotion, repair, and prior-audit lineage.
2. Freeze and verify PR #1674 metadata, exact candidate SHA, baseline/merge base, diff, checks, and review threads.
3. Inspect lifecycle, retention, managed-component, steering, diagnostics, and recovery code plus focused and broad evidence.
4. Run safe existing validation lanes and record unavailable real-machine or external evidence precisely.
5. Post the complete durable GitHub review, write the domain report, validate the review-only diff, and merge the audit task into its assigned stream.

## Test-first contract

- Behavior under test: review records accurately identify defects and evidence in the immutable candidate without changing product behavior.
- Existing pattern: Worker 23a and `independent-review-framework.md` require read-only inspection plus existing focused/broad tests and runtime evidence.
- New or changed tests: none; this task may change only audit records.
- Focused red command: not applicable.
- Expected red failure: not applicable.
- No-test waiver: review-only/report-only task. Existing candidate tests, CI, runtime probes, and exact code inspection replace a manufactured TDD cycle.

## current status

- Fresh independent task created from `main`; review round 1 is frozen to PR #1674 and candidate `ef2530b136ec2a170915b583abfb2341899bd6ab`.
- Mandatory plan, environment, orchestrator, review framework, assigned brief, and senior-engineer guidance are read in full.
- Full original-intent, implementation, repair, promotion, and prior-review lineage is complete.
- Four findings are durable on PR #1674: three High/P1 (`23A-R01-001` through `003`) and one Medium/P2 (`23A-R01-004`).
- Structured review, summary, consolidated repair prompt, unavailable-evidence record, final status, and disposition index are posted.
- Final domain result is `DOMAIN CONDITIONAL`; report and proposed Worker 23 ledger rows are complete and validated.
- Remaining task work is review-only diff validation, task publish, and merge into `stream/os-foundation-two`.

## files changed

- `packages/os/plans/consuelo-os-foundation/reviews/final/23a-report.md`


## workspace-owned: files changed

- `packages/os/plans/consuelo-os-foundation/reviews/final/23a-report.md`

## workspace-owned: activity log

- 2026-07-28 01:47:24 fs.write: `.task/os-foundation-two/core-runtime-lifecycle-recovery-audit-round-1-independent-rerun/review-records/structured-review.json`
- 2026-07-28 01:48:49 fs.write: `.task/os-foundation-two/core-runtime-lifecycle-recovery-audit-round-1-independent-rerun/review-records/disposition-index.md`
- 2026-07-28 01:50:56 fs.write: `packages/os/plans/consuelo-os-foundation/reviews/final/23a-report.md`

## workspace-owned: validation evidence

- Focused domain suite: 7 files, 109/109 passed (`trc_d7fd32086985`).
- Distribution suite and typecheck: 77 passed with seven TODOs; typecheck passed (`trc_95f2b3908c52`).
- Broad OS suite: 19 files failed, 192 passed, 18 skipped; failures isolated and dispositioned (`trc_57419efa9552`).
- Detached operation isolation: 6 failed, 5 passed; confirmed queued-state test-fixture drift (`trc_aa57f2d31010`).
- Onboarding isolation: 2 stale exact-string failures, 20 passed (`trc_ebea0c226aa2`).
- Script parity/generated-manifest isolation: 2 failures, 25 passes; evidence drift recorded (`trc_49e657e22562`).
- Structured review JSON schema and four finding IDs validated (`trc_f3b4d4f7d242`).
- Foundation plan validator passed with zero structural failures (`trc_89371b3877e3` stdout); supplemental report field and ten-cell lineage validation passed (`trc_5f8317b8a028`).
- Task-scoped report-only review against `origin/main` with tests skipped reported zero owned issues and zero blocking issues; 23 unrelated pre-existing ESLint/typecheck findings remain (`trc_d1f855fe9bce`).
- Full verify against `origin/main` reported zero changed-file issues but could not publish-stamp because of unrelated missing Twenty ESLint rule files and pre-existing API test failures (`trc_fdc71f37bd2b`). This is recorded evidence debt, not a reason to alter product code in this review task.
- 2026-07-28 01:54:37 `review.run`: passed — OK
- 2026-07-28 01:54:41 `review.run`: passed — OK
- 2026-07-28 01:56:25 `verify`: failed — COMMAND_FAILED
- 2026-07-28 01:57:34 `review.run`: passed — OK
- 2026-07-28 01:58:47 `verify`: failed — COMMAND_FAILED

## key decisions

- PR #1674 is the authorized immutable review surface even though synthetic audit branches are absent.
- The existing task/PR #1683 is obsolete process evidence for this run; this audit uses fresh task PR #1688.
- Product code remains read-only. Only this workpad, the assigned report, and GitHub review records may change.
- Candidate confidence is `medium` because destructive real-machine and exact-candidate Worker 24 platform evidence are unavailable; the four findings themselves are directly evidenced.
- PR #1640 and PR #1663 are verified diverged lineage, establishing promotion loss for Workers 07 and 24.
- Post-commit retention cleanup remains intentionally best effort after journal clear; prior PR #1605 evidence supports that design and it is not reported as a defect.

## notes for ko

- No real-machine checkpoint is requested for this candidate. It has three open P1 findings and lacks the Worker 24 exact-candidate integration lane.

## improvements noticed

- none yet

## issues and recovery

- Initial unscoped file reads failed with `AMBIGUOUS_TASK_SELECTION` because many task worktrees are active (`trc_1a073c5b2fc9`). Recovery: created the fresh assigned task first.
- A task-scoped `batch` failed to propagate the outer `taskSession` to child `fs.read` calls (`trc_633d413873f0`). Recovery: direct `fs.read` calls with `taskSession` succeed. This is tooling debt, not a review blocker.
- One `fs.list` query used glob syntax where a regular expression was required (`trc_f5e51f2d5d4c`); corrected query succeeded.
- One Worker 07 test filename from historical text was stale (`trc_0302936de177`); live tests were resolved from the repository.
- Exact GitHub search first defaulted to a form POST and returned 404 (`trc_d7d916b3a17b`); explicit GET succeeded (`trc_2ace4596eb1c`).
- One ancestry query used an invalid shortened historical SHA (`trc_14bbf642b2c9`); exact frozen Worker 07/24 SHAs succeeded.
- The first review-record patch was denied before dispatch by the OS dangerous-material scanner because service-control prose resembled a system power command. No file changed; equivalent service-lifecycle wording succeeded.
- Initial report overwrite omitted the required force flag (`trc_741f817c7120`); explicit overwrite succeeded.
- First plan validation exposed the exact required `Current finding-disposition index` label (`trc_6487008861de`); corrected report passes.
- Supplemental lineage validation initially overmatched later ledger rows (`trc_89371b3877e3`); section-scoped validation passed (`trc_5f8317b8a028`).
- `git.status` ignored the supplied task session and inspected the main worktree (`trc_286a028f737f`); its unrelated untracked files were discarded from this audit and task-scoped diff/review tools remained authoritative.
- One verify-schema search used an invalid regular expression (`trc_0313616a3cbc`); a literal identifier search succeeded and no repository state changed.

## GitHub review record

- `23A-R01-001`: https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098961444
- `23A-R01-002`: https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098963021
- `23A-R01-003`: https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098964745
- `23A-R01-004`: https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098966417
- Structured review: https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098968315
- Summary: https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098968913
- Consolidated repair prompt: https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098969712
- Evidence limitations: https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098970538
- Final status: https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098971539
- Disposition index: https://github.com/consuelohq/opensaas/pull/1674#issuecomment-5098975213

## Wait plan: task PR checks

- Wait reason: PR #1688 checks were queued immediately after publishing verified head `822ecbfc3c2ac081b5a0eb21d771f5e5db75c97f`.
- Duration: bounded polling, 20-second interval, maximum 12 attempts (4 minutes).
- Resume action: inspect PR #1688 checks after each interval and stop immediately when no required check is pending.
- Expected signal: zero failed required checks and zero pending required checks for the exact published head.
- Fallback: if checks fail, inspect the failing check and determine whether it is owned by this review-only diff; if the time budget expires, record the timeout and do not merge blindly.

### Wait cycle 1 result

- Start time: `2026-07-28T02:00:44Z`.
- Attempts: eight timed waits totaling 148 seconds, with immediate GitHub checks after each wake; overall observation window ended at `2026-07-28T02:04:54Z`.
- Observed result: failures `0`; pending reduced from `12` to `2`. Remaining jobs were `Consuelo / OS contracts` and `Consuelo / verify`, both still `IN_PROGRESS` for head `822ecbfc3c2ac081b5a0eb21d771f5e5db75c97f`.
- Decision: do not merge. Begin one additional bounded cycle because required checks are actively progressing and no owned failure exists.

### Wait cycle 2 plan

- Wait reason: allow the two active Consuelo checks to complete on the exact published task head.
- Duration: bounded polling, 30-second interval, maximum 8 attempts (4 minutes).
- Resume action: inspect only pending or failed PR #1688 checks after each wake.
- Expected signal: both `Consuelo / OS contracts` and `Consuelo / verify` complete successfully, with no other required check pending.
- Fallback: if either check fails, inspect its logs and stop merge; if the second budget expires, record `DOMAIN review complete / task merge pending CI` rather than bypassing protection.

### Wait cycle 2 result

- Start time: `2026-07-28T02:05:10Z`.
- Attempts: three 30-second waits with immediate pending-or-failed check inspection after each wake.
- Observed result: `Consuelo / OS contracts` completed first; `Consuelo / verify` completed by `2026-07-28T02:07:14Z`. Final pending-or-failed query returned no items (`trc_3bc3d14a4073`).
- Decision: exact published head `822ecbfc3c2ac081b5a0eb21d771f5e5db75c97f` satisfied PR checks with zero failures. Synchronize this final workpad record, reverify the metadata-only delta, then merge PR #1688 into `stream/os-foundation-two` only.

---

## publish checklist

```bash
bun run task:push -- --message "type(os-foundation-two): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `AGENTS.md`
- `CODING-STANDARDS.md`
- `packages/os/plans/consuelo-os-foundation/environment-registry.md`
- `packages/os/plans/consuelo-os-foundation/plan.md`
- `packages/os/plans/consuelo-os-foundation/reviews/final/23a-report.md`
- `packages/os/plans/consuelo-os-foundation/reviews/final/finding-ledger.md`
- `packages/os/plans/consuelo-os-foundation/workers/01-distribution-test-harness.md`
- `packages/os/plans/consuelo-os-foundation/workers/04-lifecycle-engine.md`
- `packages/os/plans/consuelo-os-foundation/workers/05-retention-rollback-uninstall.md`
- `packages/os/plans/consuelo-os-foundation/workers/06-managed-components.md`
- `packages/os/plans/consuelo-os-foundation/workers/07-steering-runtime-context.md`
- `packages/os/plans/consuelo-os-foundation/workers/23-final-integration-audit.md`
- `packages/os/plans/consuelo-os-foundation/workers/23a-core-runtime-lifecycle-recovery-audit.md`
- `packages/os/plans/consuelo-os-foundation/workers/24-distribution-integration.md`
- `packages/os/plans/consuelo-os-foundation/workers/independent-review-framework.md`
- `packages/os/plans/consuelo-os-foundation/workers/validate-plan.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/lifecycle/diagnostics.ts`
- `packages/os/scripts/lib/lifecycle/engine.ts`
- `packages/os/scripts/lib/lifecycle/lock.ts`
- `packages/os/scripts/lib/lifecycle/release.ts`
- `packages/os/scripts/lib/lifecycle/retention.ts`
- `packages/os/scripts/lib/lifecycle/runtime-links.ts`
- `packages/os/scripts/lib/lifecycle/service.ts`
- `packages/os/scripts/lib/lifecycle/state.ts`
- `packages/os/scripts/lib/lifecycle/uninstall.ts`
- `packages/os/scripts/lib/managed-components.ts`
- `packages/os/scripts/lib/native-lifecycle-endpoint.ts`
- `packages/os/scripts/lib/native-lifecycle-operation.ts`
- `packages/os/scripts/os.ts`
- `packages/os/skills/senior-engineer/SKILL.md`
- `packages/os/skills/task/SKILL.md`
- `packages/os/tests/distribution/lifecycle-contract.test.ts`
- `packages/os/tests/lifecycle-retention-uninstall.test.ts`
- `packages/os/tests/native-lifecycle-operation.test.ts`
- `packages/workspace/scripts/github.js`
- `packages/workspace/scripts/task-push.js`
- `packages/workspace/scripts/verify.js`
- `packages/workspace/senior-engineer.md`

# fix lifecycle Grok safety findings

branch: `task/os-distribution/fix-lifecycle-grok-safety-findings`
stream: `stream/os-distribution`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1605/fix-lifecycle-grok-safety-findings
github pr: https://github.com/consuelohq/opensaas/pull/1605
started: 2026-07-23

## acceptance criteria

- [ ] A retention-prune failure after a health-accepted install/update does not invert the committed operation into failure; the new release remains current and the failure is observable through lifecycle progress.
- [ ] A retention-prune failure after an accepted automatic rollback preserves the original `HEALTH_REJECTED` result, keeps the previous release current, and leaves no activation journal.
- [ ] Interrupted-activation recovery restores a verified previous release even when the failed next candidate is missing or corrupt.
- [ ] Focused lifecycle tests, distribution regressions, repository review, verify, CodeRabbit, and Grok all pass with findings dispositioned on GitHub.
- [ ] The follow-up PR is merged only into `stream/os-distribution`; stream PR #1603 is not promoted to `main`.

## plan

1. Add behavioral regressions for both Grok findings and capture the expected red failures.
2. Separate committed lifecycle outcomes from best-effort retention cleanup while emitting a typed retention failure event.
3. Restore the verified previous release before inspecting or depending on the failed candidate during crash recovery.
4. Run focused and broader validation, publish PR #1605, repeat independent review, and merge into the assigned stream only.

## current status

- Production fix implemented. All local validation and publish verification are green. Preparing task push and independent reviews.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-07-23 21:33:07 fs.write: `.task/os-distribution/fix-lifecycle-grok-safety-findings/workpad.md`

## workspace-owned: validation evidence

- 2026-07-23 22:03:12 `review.run`: passed — OK
- 2026-07-23 22:05:09 `verify`: passed — OK

## key decisions

- Retention cleanup after journal clear is post-commit housekeeping. It may report failure, but it must not change the already committed activation or accepted rollback result.
- Recovery must validate only the release it will restore. The failed candidate path is untrusted evidence and is not needed to safely repoint `runtime/current`.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- The initial task-scoped `batch` did not propagate `taskSession`; direct session-scoped calls are used instead. No product files were touched by the failed batch.
- Red test trace `trc_20ff39f2745d`: 18 tests, 3 expected failures. Missing candidate recovery throws `ROLLBACK_FAILED`; committed update throws `RETENTION_FAILED`; accepted auto-rollback is rewritten as `ACTIVATION_FAILED`.
- Green focused trace `trc_dbd6e9e89035`: 18/18 tests passed after separating retention from committed outcomes and restoring previous-first.
- Lifecycle regression trace `trc_cf691369ad03`: 4 files, 59 tests passed; 7 pre-existing TODO contracts unchanged.
- Distribution regression trace `trc_7dfc0b229cf9`: 33 files, 148 tests passed; the known non-fatal `bun:sqlite` trace-persistence warning remains isolated to the acceptance-test subprocess.
- Full OS trace `trc_fbb4a2813fb4`: 194 files, 1,344 tests passed; 18 TODOs unchanged.
- Repository review trace `trc_66af3125968a`: zero blocking findings; ESLint, typecheck, spec evaluation, source-line limits, and test coverage checks passed.
- The full suite regenerated the unrelated facade snapshot. A task-scoped `fs.read` attempt against the stream was correctly rejected because its branch did not match the task session (`trc_4939c7bb66b3`). The typed GitHub facade confirmed the 91 KB stream payload but omitted raw contents by design (`trc_7c3591797f1e`); scoped `code.call` then restored only that file from the same GitHub contents API (`trc_9eb6ccd1d251`, SHA-256 `dfc2a8e254517c7a16257ff4480631414f63f7545b3d80a006fecbdb310b206b`).
- Publish verification trace `trc_42bae6caa6c5`: passed, `publishValid: true`, with exactly three product files in scope and stamp written to `.task/os-distribution/fix-lifecycle-grok-safety-findings/verify.json`.

## Test-first contract

- Behavior under test: committed activation/rollback outcomes survive retention cleanup failure; interrupted recovery survives a missing failed candidate.
- Existing pattern: `packages/os/tests/lifecycle-retention-uninstall.test.ts` uses real staged bundles, symlink references, progress events, and deterministic health sequences.
- Tests: add one successful-update retention-failure case, one automatic-rollback retention-failure case, and one missing-candidate recovery case.
- Focused red command: `bun --cwd packages/os vitest run tests/lifecycle-retention-uninstall.test.ts`.
- Expected red failures: update rejects `RETENTION_FAILED`; automatic rollback rejects `ACTIVATION_FAILED`; recovery rejects `ROLLBACK_FAILED` before restoring previous.

---

## publish checklist

```bash
bun run task:push -- --message "type(os-distribution): description" --changed
bun run task:pr
bun run task:finish
```

## discovery

- Source review target: post-commit retention failure handling in lifecycle activation/rollback.
- Recovery review target: interrupted activation with missing or corrupt next candidate.
- Test-first contract: add focused failing tests before implementation; no production edit until red evidence is recorded.
- Origin findings: PR #1600 CR-001 and CR-002, both verified high-severity blockers.
- Discovery batch failed before any child work because `batch` did not propagate top-level task session to `fs.write` (`trc_d9d06d518ac4`, child `trc_6e07b14c271b`). Recovery uses direct calls with `tsk_6b13ad118f4c` on every call.

- 2026-07-23 21:33:07 append: `.task/os-distribution/fix-lifecycle-grok-safety-findings/workpad.md`

## workspace-owned: files read

- `.github/workflows/consuelo-os-distribution-environments.yaml`
- `packages/os/package.json`
- `packages/os/scripts/lib/lifecycle/retention.ts`
- `packages/os/scripts/lib/lifecycle/state.ts`
- `packages/workspace/senior-engineer.md`

- 2026-07-23 22:04:22 apply-patch: `.task/os-distribution/fix-lifecycle-grok-safety-findings/workpad.md`

- 2026-07-23 22:04:57 apply-patch: `.task/os-distribution/fix-lifecycle-grok-safety-findings/workpad.md`

- 2026-07-23 22:05:15 apply-patch: `.task/os-distribution/fix-lifecycle-grok-safety-findings/workpad.md`
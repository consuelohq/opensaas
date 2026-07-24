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

- `packages/os/scripts/lib/lifecycle/engine.ts`
- `packages/os/scripts/lib/lifecycle/retention.ts`
- `packages/os/tests/lifecycle-retention-uninstall.test.ts`


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-07-23 21:33:07 fs.write: `.task/os-distribution/fix-lifecycle-grok-safety-findings/workpad.md`

## workspace-owned: validation evidence

- 2026-07-23 22:03:12 `review.run`: passed — OK
- 2026-07-23 22:05:09 `verify`: passed — OK
- 2026-07-23 22:18:16 `review.run`: passed — OK
- 2026-07-23 22:18:23 `verify`: passed — OK

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

## CI and CodeRabbit wait cycle

Wait reason: GitHub-hosted checks and the manually requested CodeRabbit review for PR #1605 are still running.
Duration: poll every 30 seconds for up to 5 minutes.
Resume action: immediately call GitHub `pr.checks` and `pr.reviews` for PR #1605 after each interval.
Expected signal: no failed or pending checks, plus a completed CodeRabbit response with no unresolved actionable findings.
Fallback: if the signal is missing after 5 minutes, record the remaining jobs/review state and continue bounded polling only for required gates; any failure pauses the pipeline for diagnosis.

Observed: first wake (`trc_fe8abafa7e2b`) found 5 pending and 0 failed checks; CodeRabbit manual review completed with no actionable findings (`trc_e1be78ff8b0e`). Second wake (`trc_6eb77233787e`) found 3 pending and 0 failed checks.

## Grok re-review wait cycle

Wait reason: run the mandatory Grok 4.5 review of the exact PR #1605 diff through the prescribed bounded wrapper.
Duration: poll every 30 seconds for up to the wrapper's 900-second limit.
Resume action: inspect `packages/os/.tmp-reviews/05-retention-rollback-uninstall/grok.exit.json`, then parse and schema-validate the complete wrapper output immediately after exit.
Expected signal: exit code 0 and one complete JSON review object below the wrapper output cap.
Fallback: cancelled, incomplete, empty, truncated, or invalid output fails closed; diagnose the wrapper/run logs and rerun only through the same prescribed wrapper.

Observed first run: prescribed wrapper trace `trc_bf5a24707c66` exited 1 after 102 seconds with stop reason `Cancelled`. Grok reported that the workspace MCP was down and returned only progress narration; `filesRead` and `toolsCalled` were empty. The result is rejected fail-closed. Diagnostic read: `trc_e66eec3e6e07`.

Recovery: rerender the same committed review template with the complete master plan, Worker 05 brief, exact PR patch, changed lifecycle source/tests, prior findings, CodeRabbit state, local validation, and task context embedded in the instruction file. Rerun the exact prescribed wrapper without relying on workspace MCP. Success still requires one complete schema-valid JSON object under the wrapper cap.

Observed recovery run: wrapper/provider trace `trc_cbedd031f2b5` completed. The wrapper cap truncated only the provider's internal thought field; the complete 6,001-character review object was recovered from the bounded provider `text` field and schema-validated (`trc_1739d4bd2232`). Outcome: `issues_found`, high confidence. Prior PR #1600 CR-001/CR-002 are fixed; one new high/correctness blocker remains in explicit rollback.

- Full structured review: https://github.com/consuelohq/opensaas/pull/1605#issuecomment-5064070530
- Inline finding: https://github.com/consuelohq/opensaas/pull/1605#discussion_r3641718094
- Top-level summary: https://github.com/consuelohq/opensaas/pull/1605#issuecomment-5064071737
- Finding disposition: verified valid in current `rollback()`; adding a focused red regression before implementation.
- Search route note: the first test search used an unescaped regex and failed (`trc_f22a635378a0`); the corrected escaped query succeeded (`trc_63194e626f73`).
- Focused red trace `trc_6b9e826ed97b`: 20 tests, 1 expected failure. Explicit rollback switched to the previous release and cleared the journal, then rejected with `RETENTION_FAILED` from direct pruning.
- Focused green trace `trc_340bfbc41b59`: 20/20 tests passed after routing explicit rollback through `pruneAfterCommit` while preserving `rollback: true` event detail.
- Post-Grok regression trace `trc_b12b51dc9487`: lifecycle set 60 passed with 7 TODOs unchanged; distribution set 149 passed with 5 skips and 7 TODOs. The known isolated `bun:sqlite` trace-persistence warning remained non-fatal.
- Post-Grok full OS trace `trc_a8cc9454b389`: 194 files, 1,345 tests passed; 5 skipped and 18 TODOs unchanged.
- The full suite regenerated the unrelated facade snapshot again. Scoped GitHub contents recovery restored only that file from `stream/os-distribution` (`trc_c86f854dd53e`), retaining SHA-256 `dfc2a8e254517c7a16257ff4480631414f63f7545b3d80a006fecbdb310b206b`.
- Final repository review trace `trc_3483727cb938`: zero blocking issues across the exact three product files.
- Final publish verification trace `trc_2abfc540a6d4`: passed with `publishValid: true` for the exact three product files.
- The final `task.push --changed` was blocked because the local worktree ref remained at bootstrap SHA `4533d3fe` while the first task push advanced the remote to `3c834bd4` (`trc_a1aa4ead1e7e`). No dedicated task-sync tool exists. Repository inspection confirmed the supported explicit `task.push --files` route skips only the stale-local `--changed` guard and creates its commit from the current remote branch head through the GitHub API (`trc_e5509191e52a`, `trc_dca533c78f5f`). Recovery will publish the exact three product files plus the refreshed verify stamp through that typed route; no native Git is used.
- The first explicit-files retry used controller-relative paths and was rejected as outside the task repository root (`trc_0324cca5eea7`). Recovery uses the same supported route with absolute paths inside the registered task worktree, as accepted by `resolveFilesFromPaths`.

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
- `packages/os/tests/lifecycle-retention-uninstall.test.ts`
- `packages/workspace/scripts/task-push.js`
- `packages/workspace/senior-engineer.md`

- 2026-07-23 22:19:12 apply-patch: `.task/os-distribution/fix-lifecycle-grok-safety-findings/workpad.md`

- 2026-07-23 22:19:20 apply-patch: `.task/os-distribution/fix-lifecycle-grok-safety-findings/workpad.md`
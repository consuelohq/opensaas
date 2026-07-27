# sync distribution stream with promoted main

branch: `task/os-distribution/sync-distribution-stream-with-promoted-main`
stream: `stream/os-distribution`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1670/sync-distribution-stream-with-promoted-main
github pr: https://github.com/consuelohq/opensaas/pull/1670
started: 2026-07-27

## acceptance criteria

- [ ] Merge the newly promoted `main` ancestry into `stream/os-distribution` through PR #1670.
- [x] Preserve the stream's complete distribution rehearsal and broad runtime-closure triggers.
- [x] Preserve promoted macOS packaging, native lifecycle runtime inputs, and pinned-update fail-closed coverage.
- [x] Run focused cross-platform/lifecycle tests, workspace review, and full verify.
- [ ] Complete required GitHub CI and disposition CodeRabbit feedback.
- [ ] Merge only into `stream/os-distribution`; do not promote the stream to `main`.

## plan

1. Compare `main` and the assigned stream at each conflicted file and define the semantic union.
2. Add a failing source-contract assertion for the combined workflow behavior.
3. Apply the narrow union to the workflow and lifecycle runtime fixtures.
4. Reconcile stream ancestry into the task branch through the supported GitHub API route.
5. Validate the exact merged tree, complete automated review and CI, then merge PR #1670 into the assigned stream.

## current status

- PR #1670 head is `bbea0124fb50dec32391ee8b4a3106d8f96e44e0` before this workpad-only evidence commit.
- The reviewed merge tree is `103ff7a3e213ee74316d2f0c79f38f60446fe22d`.
- The merge commit has parents `5b4e9b25dab540e3caf3db9d53ad3d2c19d17127` and `6d97c3fe39f1f6ff55667296401f9474075bc176`.
- Compared with promoted main `702053057d19c066607d4508b49d42b183d17b32`, the merged task head is 43 commits ahead and 0 behind.
- Compared with stream head `6d97c3fe39f1f6ff55667296401f9474075bc176`, the merged task head is 4 commits ahead and 0 behind.
- GitHub CI and final CodeRabbit review are pending. Grok is intentionally deferred per Ko's weekly rate-limit note; Ko will request the independent review manually after this stream task.

## test-first contract

- Behavior: the native matrix must preserve Windows cleanup ordering, run portable distribution contracts off macOS, run the complete rehearsal on macOS, retain macOS packaging, and trigger for the complete runtime source closure.
- Existing pattern: source-contract assertions in `packages/os/tests/windows-platform.test.ts` and platform-specific suites.
- Changed test: strengthened the Windows workflow source contract before implementation.
- RED command: `bun x vitest run tests/windows-platform.test.ts` from `packages/os`.
- RED result: 15 passed, 1 failed because `Run portable distribution contracts` was absent, trace `trc_287d9b5e20f7`.

## files changed

- `.github/workflows/consuelo-os-distribution-environments.yaml`
  - broadened pull/push source closure to package, lockfile, Cloudflare, docs, native, scripts, and tests;
  - retained promoted macOS menu-bar contracts, alpha packaging, and artifact upload;
  - runs portable distribution contracts on non-macOS and the complete rehearsal on macOS;
  - raises the native matrix timeout to 30 minutes.
- `packages/os/tests/windows-platform.test.ts`
  - locks the combined Windows ordering, portable/full rehearsal split, macOS packaging, and broad trigger contract.
- `packages/os/tests/lifecycle-engine.test.ts`
- `packages/os/tests/lifecycle-retention-uninstall.test.ts`
  - include both `scripts/lifecycle.ts` and `scripts/native-lifecycle-operation.ts` in release runtime fixtures.
- Task metadata and this workpad.

## validation evidence

- Focused GREEN in the task worktree: Windows 16/16, macOS 4/4, lifecycle 55/55; trace `trc_f5a8d1252fa4`.
- Workspace strict review against `origin/stream/os-distribution`: 0 owned issues, 0 blocking issues; trace `trc_446d5920304c`.
- Full workspace verify: passed and publish-valid; trace `trc_59b3d53f54a0`.
- Exact merged-tree marker scan: 197 candidate paths checked, zero line-anchored conflict markers outside archived task records.
- Exact merged-tree selected matrix under process isolation: 7 files, 99 tests passed; trace `trc_fcc740c51b3d`.
- Main ancestry comparison: 0 behind; trace `trc_b09a79fedcd9`.
- Stream ancestry comparison: 0 behind; trace `trc_898580471935`.

## key decisions

- The three product conflicts were additive rather than mutually exclusive. The resolution preserves the stream's distribution rehearsal behavior and promoted main's macOS/native lifecycle behavior.
- The task must retain a merge commit, not squash/rebase, so the promoted-main ancestry remains explicit when PR #1670 lands on `stream/os-distribution`.
- The failed GitHub update-branch route was recovered with a deterministic Git tree assembled from the OS-created conflict worktree plus four reviewed overrides. Only the task branch ref was advanced, non-force.
- No Consuelo OS install, update, reset, restart, or uninstall action was run on either real Mac.

## issues and recovery

- Initial unscoped document reads failed with `AMBIGUOUS_TASK_SELECTION`; explicit-main retry exposed the required task-session contract, and reads were recovered through a real task session.
- Historical task recovery returned stale PR metadata; a fresh isolated task/PR #1670 was created from promoted `main`.
- `stream.sync` failed closed on three content conflicts; the conflict worktree was inspected and no native-git fallback was used.
- A discovery `batch` did not propagate its top-level session to child calls; direct session-scoped calls recovered the route.
- The advertised `task.call` alias was absent from the active OS manifest; the same scoped commands were run through manifest-backed `code.call`.
- The first `task.push` was correctly blocked by a missing verify stamp; strict review and full verify produced the stamp before publishing.
- Two malformed GitHub raw update-branch attempts were corrected; the valid endpoint then returned HTTP 422 because the branch had real merge conflicts.
- GitHub's update-branch conflict was recovered through API-created tree `103ff7a3...`, two-parent commit `bbea0124...`, and a non-force task-ref update.
- A marker scan initially matched conflict syntax quoted in an archived workpad; narrowing to line-anchored markers outside `.task` confirmed no unresolved product markers.
- Exact-tree test startup initially lacked dependencies in the temporary conflict worktree. Existing canonical dependency directories were linked without installation. Vitest threads then exposed a synthetic symlink transform artifact; rerunning the exact tree with process isolation passed all 99 selected tests.

## review status

- Workspace review: clean.
- CodeRabbit: request pending on the final evidence head.
- Grok: intentionally not invoked because Ko reported the provider is rate-limited for the week; manual independent review remains a downstream checkpoint.

## remaining work

- Request CodeRabbit on the final head and disposition any actionable findings.
- Wait for all required GitHub checks to complete successfully.
- Merge PR #1670 with merge-commit semantics into `stream/os-distribution` only.
- Verify the resulting stream remains 0 commits behind the promoted main used for this task.

## wait cycle 1

- Start time (UTC): 2026-07-27T05:33:06.587Z
- Wait reason: GitHub CI and CodeRabbit are processing final head `96abf669ca4af96e3bace511fcf384958432223a`.
- Duration: 30-second polling intervals, maximum 10 attempts.
- Resume action: inspect PR #1670 checks and normalized reviews immediately after each wake.
- Expected signal: zero pending/failed required checks and a CodeRabbit review response.
- Fallback: inspect failed checks or review findings through Consuelo OS; stop rather than merge if the bounded poll expires.

## workspace-owned: files read

- `packages/os/scripts/lib/native-lifecycle-endpoint.ts`
- `packages/os/scripts/lib/native-lifecycle-operation.ts`
- `packages/os/tests/native-lifecycle-endpoint.test.ts`
- `packages/os/tests/native-lifecycle-operation.test.ts`

## review finding verification and fixes

- RED trace `trc_fa8e81258617`: reproduced release-cache staleness, shallow secret filtering, request/authority error conflation, unbounded PID reuse, and missing native lifecycle CI coverage.
- GREEN trace `trc_da109b24923a`: 5 files and 59 tests passed after fixes.
- Valid finding: distribution workflow did not execute native lifecycle TypeScript contracts. Fixed with a macOS native-matrix step covering client, endpoint, and operation suites.
- Valid finding: channel changes could leave cached release metadata stale. Fixed with explicit release-inspector invalidation after successful channel mutation.
- Valid security finding: workspace authority secret-key validation was shallow. Fixed with recursive object/array validation and a nested-token regression test.
- Valid observability finding: malformed client requests reused workspace-authority error labels. Fixed with request-specific string validation.
- Valid finding: a reused PID could keep stale operation state active indefinitely. Fixed with a configurable bounded age for PID-backed running state.
- Additional test-harness defect exposed by the newly enabled operation suite: canonical worker tests did not seed the required queued claim. Tests now model the detached worker protocol rather than weakening its fail-closed claim guard.
- First post-fix focused run trace `trc_59fef692c5fb`: endpoint/workflow fixes passed; operation suite exposed the queued-claim fixture defect.

## workspace-owned: validation evidence

- Focused GREEN in the task worktree: Windows 16/16, macOS 4/4, lifecycle 55/55; trace `trc_f5a8d1252fa4`.
- Workspace strict review against `origin/stream/os-distribution`: 0 owned issues, 0 blocking issues; trace `trc_446d5920304c`.
- Full workspace verify: passed and publish-valid; trace `trc_59b3d53f54a0`.
- Exact merged-tree marker scan: 197 candidate paths checked, zero line-anchored conflict markers outside archived task records.
- Exact merged-tree selected matrix under process isolation: 7 files, 99 tests passed; trace `trc_fcc740c51b3d`.
- Main ancestry comparison: 0 behind; trace `trc_b09a79fedcd9`.
- Stream ancestry comparison: 0 behind; trace `trc_898580471935`.
- 2026-07-27 05:37:45 `review.run`: passed — OK
- 2026-07-27 05:38:06 `review.run`: passed — OK
- 2026-07-27 05:38:13 `verify`: passed — OK
- Strict post-fix review initially found one callback style blocker, trace `trc_c2a0a7de7af7`; rewritten without changing success-only invalidation semantics.
- Focused regression rerun: 3 files and 41 tests passed, trace `trc_b1d6edf8766d`.
- Final strict review: 0 owned, pre-existing, or blocking issues, trace `trc_2d00731733c8`.
- Final full verify: passed and publish-valid, trace `trc_b7d18f4ff138`.
- 2026-07-27 05:41:29 `review.run`: passed — OK
- 2026-07-27 05:41:37 `verify`: passed — OK
- Additional Codex finding verified: timed-out release checks could overlap. RED trace `trc_3e7c479c964d`; fixed with generation-safe single-flight inspection.
- Single-flight GREEN: 3 files and 42 tests passed, trace `trc_b05657fae04d`.
- Post-single-flight strict review clean, trace `trc_50574c2a633e`; full verify publish-valid, trace `trc_b0a4fbb02bef`.

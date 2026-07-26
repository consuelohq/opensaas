# implement distribution integration

branch: `task/os-distribution/implement-distribution-integration`
stream: `stream/os-distribution`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1663/implement-distribution-integration
github pr: https://github.com/consuelohq/opensaas/pull/1663
started: 2026-07-26

## acceptance criteria

- [ ] Reconcile the completed Worker 01-07, 25-27, and 30 outputs into one coherent distribution contract without widening ownership.
- [ ] Prove the lifecycle sequence build, publish, install, activate, update, report, migrate, rollback, repair, prune, uninstall, and reinstall through behavioral tests.
- [ ] Cover the full rehearsal matrix from the Worker 24 brief, including clean/no-Bun, non-default Bun, legacy and flattened layouts, signed-update failure modes, interrupted activation, health rollback, retention, uninstall/purge/reinstall, steering refresh, onboarding suppression, restart/watchdog behavior, notification persistence, multi-node continuity, and preservation of visible user steering/tools.
- [ ] Produce mandatory OCI, macOS, and Windows CI evidence plus existing regression coverage.
- [ ] Keep all real Mac Mini and MacBook mutations behind a human checkpoint with the exact command and expected result.
- [ ] Remove or replace stale distribution surfaces within scope: legacy runtime path assumptions, duplicate tool/package registries, obsolete `packages/os/tooling`, update-time onboarding, and unsafe user-content overwrite paths.
- [ ] Preserve `consuelo` as the OS lifecycle CLI and `consuelo-dialer` as the sales/GTM CLI with no compatibility shim.
- [ ] Complete CodeRabbit and Grok review loops, verify every finding, post dispositions to GitHub, and leave no unresolved substantive finding.
- [ ] Pass focused tests, review, publish-valid verification, and authoritative GitHub checks.
- [ ] Merge task PR #1663 into `stream/os-distribution` only; do not promote the stream to `main`.

## plan

1. Map completed upstream worker outputs, current stream commits, canonical manifests, lifecycle scripts, and existing distribution tests.
2. Realign the assigned stream with current `main` before testing so Worker 24 runs against all integrated prerequisites.
3. Convert the rehearsal matrix into an executable contract and identify the smallest missing behavior rather than duplicating already-proven coverage.
4. Write or extend behavioral tests first, run the focused suite red, and record the exact failure.
5. Implement only the integration fixes required by the failing contract; update owning docs/generated surfaces in the same task.
6. Run focused green tests, full package/regression suites, OCI/macOS/Windows lanes, review, and publish-valid verification.
7. Push the task PR, request CodeRabbit, run the required Grok wrapper, post structured findings/dispositions, fix valid findings, and rerun validation.
8. Wait for authoritative CI, merge task PR #1663 into `stream/os-distribution`, verify merge state, and preserve the human-only Mac checkpoint.

## current status

- Task session `tsk_3b69c2d01019` is active on a fresh `main` worktree and targets `stream/os-distribution`.
- Required steering, plan, registry, worker brief, review template, task doctrine, coding standards, and script documentation have been read in full.
- Upstream Worker 01-07, 25-27, and 30 contracts and the existing lifecycle/distribution suites have been inventoried.
- Environment recovery is complete: Ko approved the semantic union, stream sync merge `31f3348aab` was pushed, and PR #1663 was updated from the reconciled stream. `stream/os-distribution` is 37 commits ahead and 3 commits behind `main`; PR #1663 is therefore `DIRTY` with 77 unrelated files instead of a reviewable Worker 24 diff.
- The prescribed stream synchronization reached non-metadata conflicts in `packages/os/scripts/lifecycle.ts` and `packages/os/tests/distribution/runtime-bundle.test.ts`. Repository policy requires Ko's judgment before resolving code/test conflicts.
- No production files, tests, release state, services, or real Macs have been mutated.

## Test-first contract

- Behavior under test: a published Consuelo OS runtime can traverse the complete Worker 24 lifecycle and migration matrix while preserving user-owned content, identity, tools, and cross-platform determinism.
- Existing local pattern to follow: table-driven Bun tests under `packages/os/tests`, distribution acceptance runners, isolated temporary homes, fixture release servers, and platform-specific CI aggregate scripts.
- Intended tests: extend the canonical distribution integration/rehearsal suite after confirming its current owner; add only missing cases and a regression for every implementation defect found.
- Focused red command: deferred until the assigned stream is reconciled with `main`; running a red suite now would test a stale checkout that omits 37 integrated prerequisite commits.
- Expected red failure: one or more Worker 24 matrix cases expose a missing integration invariant, stale path/registry, or unsupported cross-platform lifecycle transition after the environment lane is valid.
- No-test waiver: none. No tests were run because the mandated environment failed before a valid test baseline existed.

## environment block requiring human judgment

- Command attempted through Consuelo OS: `bun run stream:sync -- --area os-distribution --stream stream/os-distribution`.
- Expected result: `stream/os-distribution` contains current `main` plus all distribution commits, `behindBy` becomes `0`, the stream checks pass, and PR #1663 can be updated to a clean task-only diff.
- Actual result: merge conflict in two code/test files; checks were skipped before execution (`trc_ec1788227e5d`).
- Conflict worktree: `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-worktrees/stream-os-distribution-sync-GE5vzJ`.
- `packages/os/scripts/lifecycle.ts`: the stream owns node-status injection and typed home config; `main` owns Linux/Windows platform adapter imports and associated lifecycle integration. Choosing either side would discard valid foundation work. The proposed semantic merge is to preserve both contracts, but it was not applied without Ko's approval.
- `packages/os/tests/distribution/runtime-bundle.test.ts`: the stream adds the final OS CLI inclusion and dialer/legacy CLI exclusion assertions; `main` has the platform-wave formatting/base changes. The proposed semantic merge is to preserve the stream's product-boundary assertions while retaining current-main test structure, but it was not applied without Ko's approval.
- After Ko approves those semantics, rerun the exact stream-sync command above. Expected signal: no conflict, all stream checks green, `github branch.compare` reports `behindBy: 0`, and PR #1663 is no longer `DIRTY` after its head is updated from the base stream.

## files changed

- `.task/os-distribution/implement-distribution-integration/workpad.md`
- `packages/os/scripts/testing/distribution/integration-runner.ts`
- `packages/os/tests/distribution/distribution-integration.test.ts`

## workspace-owned: files changed

- `.task/os-distribution/implement-distribution-integration/workpad.md`
- `packages/os/scripts/testing/distribution/integration-runner.ts`
- `packages/os/tests/distribution/distribution-integration.test.ts`

## workspace-owned: activity log

- 2026-07-26 15:41:49 fs.write: `.task/os-distribution/implement-distribution-integration/workpad.md`
- 2026-07-26 15:45:00 fs.read: `.task/os-distribution/implement-distribution-integration/workpad.md`
- 2026-07-26 15:45:21 fs.write: `.task/os-distribution/implement-distribution-integration/workpad.md`
- 2026-07-26 15:51:23 fs.write: `.task/os-distribution/implement-distribution-integration/resolve-stream-conflicts.py`
- 2026-07-26 15:53:09 fs.write: `packages/os/tests/distribution/distribution-integration.test.ts`
- 2026-07-26 15:53:28 fs.write: `packages/os/scripts/testing/distribution/integration-runner.ts`

## workspace-owned: validation evidence

- Route diagnosis: `stream/os-distribution` is 37 commits ahead and 3 commits behind `main` (`trc_4d9e4d579e71`).
- PR diagnosis: #1663 is `DIRTY`, has 77 files, and had one failed Cloudflare Workers build before Worker 24 implementation (`trc_42091c873b88`).
- First stream-sync recovery failed because the typed facade accepted `repo` while the underlying script rejected `--repo` (`trc_8f1e0af9457d`).
- Corrected stream-sync reached the two non-metadata merge conflicts and skipped checks (`trc_ec1788227e5d`).
- Conflict hunk extraction was read-only and changed no files (`trc_dd061551d801`).
- No TDD, package, OCI, macOS, Windows, CodeRabbit, Grok, or authoritative CI validation has been run because the environment stop rule triggered first.
- 2026-07-26 15:55:12 `review.run`: passed — OK
- 2026-07-26 15:55:23 `verify`: passed — OK
- 2026-07-26 20:42:14 `verify`: passed — OK

## key decisions

- Start from `main` exactly as assigned, while targeting the existing `stream/os-distribution` task PR.
- Treat retrieval and prior workpads as orientation; current files, tests, CI, and runtime evidence determine the final contract.
- Do not execute Worker 24 tests against a checkout missing 37 prerequisite stream commits.
- Do not silently resolve the lifecycle or runtime-bundle code/test conflicts; the repository's stream-conflict policy explicitly reserves those decisions for Ko.
- Real Mac installation, daemon, restart, rollback, and uninstall commands remain human-executed checkpoints only.

## notes for ko

- Required decision: approve or revise the proposed semantic merge for the two stream-sync conflicts described above.
- No installer, service, daemon, update, rollback, uninstall, or package publication command was run on the Mac Mini or MacBook Air.

## improvements noticed

- The batch facade did not propagate the supplied task session into task-scoped `fs.read` children, and task-scoped `status` / `task.current` returned ambient-main state. Direct task-scoped file calls remain reliable; this routing defect is recorded rather than bypassed.
- The `stream.sync` typed schema advertises `repo`, but the underlying script rejects `--repo`.
- `task.ensureSynced` reports only stream-to-origin synchronization, not whether a fresh-main task branch contains its assigned stream prerequisites; the result was technically true but insufficient for Worker 24 routing.

## issues and recovery

- Initial `fs.read` failed with ambiguous active worktrees. Recovery: created the assigned task through `task.start`, captured `tsk_3b69c2d01019`, and retried direct session-scoped reads.
- A branch-qualified read failed because task lifecycle requires an active task even for `main`. Recovery: used the newly created task session.
- `$CONSUELO_HOME` was not expanded by `fs.read`. Recovery: a task-scoped read-only Bun program resolved the environment variable and read the full steering file.
- Batch trace `trc_947d0cb6b16b` failed because child `fs.read` calls lost task context (`trc_1a96f8535a0b`, `trc_088dc82ff16d`). Recovery: direct `fs.read` with the exact task session succeeded (`trc_b28b90f3ec4c`).
- `task.current` with the exact task session returned no task (`trc_ff701fe423ae`). Recovery: the canonical scoped `current.json` and `session.json` were read directly and confirm the correct branch, worktree, PR, and session.
- The first stream-sync call passed `repo` according to the typed facade schema and failed because the script rejected the generated `--repo` flag (`trc_8f1e0af9457d`). Recovery: retried without `repo`.
- The corrected stream-sync call failed on code/test conflicts (`trc_ec1788227e5d`). Recovery: extracted exact hunks read-only (`trc_dd061551d801`), recorded the failure on PR #1663, and paused implementation as required. Further recovery requires human judgment.

---

## publish checklist

```bash
bun run task:push -- --message "type(os-distribution): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-26 15:45:21 write: `.task/os-distribution/implement-distribution-integration/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/testing/distribution/integration-runner.ts`
- `packages/os/tests/distribution/lifecycle-contract.test.ts`
- `packages/os/tests/lifecycle-engine.test.ts`
- `packages/workspace/scripts/stream-sync.js`
- `packages/workspace/senior-engineer.md`

## implementation update 2026-07-26

- Added `scripts/testing/distribution/integration-runner.ts` and package script `test:distribution:integration`.
- Replaced the stale pending-only `tests/distribution/lifecycle-contract.test.ts` with an executable integration contract.
- Added the final OS lifecycle CLI input to the retention fixture.
- Serialized curated suite files because install-state and managed-component corruption fixtures share process-level state when run concurrently.
- Focused red: `trc_782713d6047d` (missing integration runner).
- Focused green: `trc_dc073f9cb528` (2/2).
- Full rehearsal first exposed fixture/concurrency defects: `trc_c18121e5e33f`.
- Full rehearsal green: `trc_0f289a687eb7` (14 files, 177 tests). The JSON parse stack on stderr is emitted by the intentional corrupt-provenance child-process fixture; the suite asserts fail-closed behavior and exits successfully.
- Real Mac mutation remains forbidden. Human checkpoint command will be provided only after CI/review completion.

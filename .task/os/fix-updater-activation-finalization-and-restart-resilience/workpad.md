# Fix updater activation finalization and restart resilience

branch: `task/os/fix-updater-activation-finalization-and-restart-resilience`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/1790
started: 2026-08-05

## acceptance criteria

- [x] `update --check` is strictly read-only, including when `runtime/activation.json` exists.
- [x] A real update re-inspects install state after interrupted-activation recovery and cannot report the candidate version while leaving `runtime/current` on the previous release.
- [x] If `runtime/current` already points to the journal candidate and that exact bundle/version is healthy, recovery finalizes the candidate instead of rolling it back.
- [x] macOS native lifecycle work launched from the Consuelo daemon runs in a separate launchd job rather than the daemon process coalition.
- [x] A synchronous CLI update launched from inside `com.consuelo.system` fails before activation with a clear safe-path instruction.
- [x] Local OS is restored to dev `0.1.21` through an external one-shot launchd job and remains healthy with no activation journal.

## plan

1. Preserve incident evidence from raw symlinks, lifecycle diagnostics, launchd state, and the release manifest.
2. Add focused red contracts for read-only check, state re-inspection/recovery finalization, and macOS worker isolation.
3. Implement the smallest lifecycle and launcher changes that satisfy those contracts.
4. Run focused lifecycle tests, static checks, diff review, and publish verification.
5. Retry the already-published `0.1.21` update through an independent launchd one-shot job and verify current/previous links, journal cleanup, health identity, and batch task propagation.

## current status

- First update downloaded, verified, staged, and activated `0.1.21`, then stopped at lifecycle phase `service-restart`; no `health` or `complete` event was emitted.
- The updater was spawned by `code.call` under `com.consuelo.system`. `restart-now` booted out that same LaunchAgent, terminating the server, updater process, and reload helper in one coalition before bootstrap/health/finalization.
- A manual reply-safe restart at 18:09 local brought the server back on the candidate runtime.
- A later `update --check` at 18:11 acquired the lifecycle lock, treated the still-present journal as interrupted, rolled `runtime/current` back to `0.1.18`, cleared the journal, and then returned `0.1.21 / no update` from state captured before recovery.
- The running server process still has `0.1.21` code loaded, while the on-disk `runtime/current` symlink is currently `0.1.18`.
- Resolved: the isolated retry restored on-disk `runtime/current` to `0.1.21`; the process, status command, update check, and symlink now agree.
- Production fix implemented and focused/broad validation is green.

## incident evidence

- Original update lifecycle events: inspect -> lock -> manifest fetch/verify -> download/verify -> stage -> preflight -> migrate -> activate -> service-restart, then process termination (`trc_7715b3e69935`).
- Raw state after diagnostic recovery: current points to `0.1.18`, previous absent, activation journal absent; current symlink mtime `2026-08-05T22:11:06.413Z` (`trc_07ecf4087a92`).
- LaunchAgent reports last terminating signal 15 and the current server started at 18:09:44 local (`trc_84f27d44bde8`, `trc_53763a3cca04`).
- Live `0.1.21` batch propagation works; all child calls inherited task session and parent trace (`trc_ffcba88a0cf8`).

## key decisions

- Do not rerun the updater as a child of the active daemon.
- Keep check-only behavior side-effect free; recovery belongs only to mutating operations.
- Recovery should prefer a verified, exact healthy candidate already active at `runtime/current`; rollback remains the fallback when candidate health is not accepted.
- Use launchd, not POSIX `detached`, to isolate macOS native lifecycle workers from the Consuelo service coalition.
- Preserve the conservative rollback helper for callers that explicitly require unconditional rollback recovery.

## Test-first contract

- behavior under test: check-only does not mutate activation state; mutating update uses post-recovery state; a healthy active candidate is finalized; macOS lifecycle workers escape the active daemon coalition; direct self-hosted synchronous update is rejected before activation.
- existing local pattern: lifecycle engine integration fixtures build signed runtime bundles and assert current/previous links, journals, service operations, and progress phases.
- changed tests: `lifecycle-engine.test.ts`, `lifecycle-restart-contract.test.ts`, and `native-lifecycle-operation.test.ts` as needed.
- focused red command: `bun x vitest run tests/lifecycle-engine.test.ts tests/lifecycle-restart-contract.test.ts tests/native-lifecycle-operation.test.ts` from `packages/os`.
- expected red failures: check removes the journal and rolls current back; real update returns candidate metadata with current on previous; healthy candidate recovery is not available; native launcher uses ordinary detached spawn; direct daemon-child update reaches activation.

## validation evidence

- Focused incident suite passed: 66 tests across lifecycle engine, restart contract, and native lifecycle operation (`trc_85667f3c8574`).
- Harmless one-shot launchd isolation probe completed outside the Consuelo LaunchAgent coalition (`trc_d7d41be7d809`).
- Revised bootstrapped plist executed exactly once after a 15-second observation and launchd automatically removed the job (`trc_0cac86fa3953`).
- Changed-file static checks passed for all seven production/test files (`trc_ef7f67eee415`).
- OS package typecheck/syntax validation passed (`trc_85852dd49692`).
- Broad lifecycle, native endpoint, install-state, and managed-component suite passed: 12 files / 171 tests (`trc_713b272a4b9a`). The stderr JSON parse stack is an intentional corrupt-provenance test and the suite passed.
- Working-tree diff contains seven task-owned production/test files plus task metadata; no unrelated source files (`trc_1d809396ea0b`).
- Diff-scoped review passed with zero task-owned or pre-existing findings (`trc_6bd3937abdf6`).
- Full publish verification passed and wrote the task stamp (`trc_1155265e63b3`).

## files changed

- `packages/os/scripts/lib/lifecycle/engine.ts`
- `packages/os/scripts/lib/lifecycle/retention.ts`
- `packages/os/scripts/lib/native-lifecycle-endpoint.ts`
- `packages/os/scripts/lib/native-lifecycle-operation.ts`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/tests/lifecycle-engine.test.ts`
- `packages/os/tests/native-lifecycle-operation.test.ts`

## live update wait plan

- Wait reason: an isolated launchd job will activate dev `0.1.21`, boot out and bootstrap `com.consuelo.system`, health-check the exact bundle, clear the activation journal, and record terminal output.
- Duration: poll every 15 seconds for up to 90 seconds.
- Resume action: reconnect to the OS facade, then inspect the launchd job result files, lifecycle status, current/previous symlinks, activation journal, and health identity.
- Expected signal: update exit code 0; status/current both `0.1.21`; no activation journal; facade healthy; batch child context propagation still succeeds.
- Fallback: do not rerun update; inspect durable update stdout/stderr and launchd/service state, then recover with the retained `0.1.18` release if exact `0.1.21` health is not accepted.

## issues and recovery

- The first update intentionally disrupted the tool connection because it killed its own service coalition. All further live update work will use an independent launchd job.
- Workpad delete-and-recreate patch was rejected because the target existed; recovered with a task-safe forced write.
- The first isolated retry used `launchctl submit`; macOS relaunched that transient job approximately every 10 seconds even after successful exit. The job was removed immediately (`trc_aea6775426b9`). The update itself succeeded, but the production fix will use a bootstrapped plist with `RunAtLoad=true`, `KeepAlive=false`, and `LaunchOnlyOnce=true` instead of `submit`.

## live update result

- Isolated update exit: 0.
- Installed/current version: `0.1.21`, bundle `sha256:ec2bd7d287e4f6b1c95089efae942cae689613ef6f24ed4301a520b4b247cac2`.
- Previous release: `0.1.18`, bundle `sha256:b109b14672a27956bcc4753172b2002ddd061804c8ad81377293be40b5da9939`.
- Activation journal: absent.
- Facade and dev update check: healthy, no update available (`trc_73bcf0634143`).
- Temporary retry job removed and remained absent; installation stayed healthy (`trc_35b9b500cca4`).

## one-shot launchd probe wait plan

- Wait reason: validate that the replacement bootstrapped plist executes once and does not relaunch like `launchctl submit`.
- Duration: 15 seconds after the first output line appears.
- Resume action: count probe executions, inspect the launchd job state, then boot out the probe and remove its plist.
- Expected signal: exactly one output line after 15 seconds.
- Fallback: reject the plist design and do not publish macOS worker isolation until a non-repeating launchd contract is proven.

## notes for ko

- `0.1.21` itself is valid and the batch fix works. The incident was in activation orchestration and interrupted-state recovery, not bundle publication.
- Local OS is healthy on dev `0.1.21`. After this fix reaches the dev channel, one final isolated update will install the repaired updater; subsequent native UI updates will use the one-shot launchd worker automatically.

- 2026-08-05 22:16:43 write: `.task/os/fix-updater-activation-finalization-and-restart-resilience/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-05 22:16:43 fs.write: `.task/os/fix-updater-activation-finalization-and-restart-resilience/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/lifecycle/engine.ts`
- `packages/os/scripts/lib/lifecycle/retention.ts`
- `packages/os/scripts/lib/native-lifecycle-endpoint.ts`
- `packages/os/scripts/lib/native-lifecycle-operation.ts`
- `packages/os/tests/cli-update-routing.test.ts`
- `packages/os/tests/lifecycle-engine.test.ts`
- `packages/os/tests/native-lifecycle-operation.test.ts`

## workspace-owned: validation evidence

- Focused incident suite passed: 66 tests across lifecycle engine, restart contract, and native lifecycle operation (`trc_85667f3c8574`).
- Harmless one-shot launchd isolation probe completed outside the Consuelo LaunchAgent coalition (`trc_d7d41be7d809`).
- 2026-08-05 22:25:10 `checkFiles`: passed — OK
- 2026-08-05 22:25:25 `checkFiles`: passed — OK
- 2026-08-05 22:25:41 `checkFiles`: passed — OK
- 2026-08-05 22:25:57 `checkFiles`: passed — OK
- 2026-08-05 22:26:00 `checkFiles`: passed — OK
- 2026-08-05 22:26:56 apply-patch: `.task/os/fix-updater-activation-finalization-and-restart-resilience/workpad.md`
- 2026-08-05 22:27:18 `review.run`: passed — OK
- 2026-08-05 22:27:19 `review.run`: passed — OK
- 2026-08-05 22:27:30 `verify`: passed — OK
- 2026-08-05 22:27:44 apply-patch: `.task/os/fix-updater-activation-finalization-and-restart-resilience/workpad.md`
- 2026-08-05 22:27:50 `verify`: passed — OK

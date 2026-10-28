# harden macOS runtime availability watchdog and power policy

branch: `task/os-distribution/harden-macos-runtime-availability-watchdog-and-power-policy`
stream: `stream/os-distribution`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1625/harden-macos-runtime-availability-watchdog-and-power-policy
github pr: https://github.com/consuelohq/opensaas/pull/1625
started: 2026-07-24

## acceptance criteria

- [x] The watchdog is a bounded one-shot health check scheduled by launchd, not a persistent loop supervised by `KeepAlive`.
- [x] Watchdog counters, locks, restart history, and degraded state live under `$CONSUELO_HOME/node/runtime/watchdog`, never the legacy user cache path.
- [x] Local and external recovery remain thresholded, time-bounded, and protected by both a minimum restart gap and a restart circuit breaker.
- [x] macOS installs include a native AC-only availability assertion using Apple `/usr/bin/caffeinate -s`; display sleep remains unaffected and unplugged laptops are not held awake by this assertion.
- [x] Install, dry-run, rollback, uninstall, logging, and service summaries include the availability service without weakening existing OS/tunnel cutover safety.
- [x] Focused behavioral tests prove generated plist contracts and watchdog state/recovery behavior before production edits.
- [x] The real Mac mini hotfix is installed without restarting the healthy main OS service unless unavoidable; local health and launchd state are verified after cutover.
- [ ] Package validation passes and the fix is pushed into `stream/os-distribution` for future runtime releases.

## plan

1. Lock the launchd and watchdog behavior with focused red tests using temporary homes and fake host commands.
2. Convert the watchdog to a one-shot state machine with OS-owned state, locking, bounded probes, restart throttling, and circuit breaking.
3. Generate/install/uninstall a native AC-only availability LaunchAgent and schedule the watchdog with `StartInterval`.
4. Run focused tests, shell/plist dry-run checks, affected OS regressions, review, and verify.
5. Apply the validated generated watchdog and availability agents to the local Mac mini without touching `com.consuelo.system`, then verify health.
6. Push the task, merge it into `stream/os-distribution`, and report the durable release path.

## test-first contract

- Behavior: generated services use `caffeinate -s` for AC-only host availability and `StartInterval` without `KeepAlive` for the watchdog.
- Behavior: one watchdog invocation returns promptly, preserves counters across invocations, restarts only at threshold, writes under the supplied Consuelo home, and opens a circuit after bounded restart attempts.
- Existing pattern: Vitest filesystem fixtures plus real shell execution with injected PATH/env, matching other OS installer contract tests.
- Focused command: `bun --cwd packages/os x vitest run tests/system-daemon-reliability.test.ts tests/lifecycle-restart-contract.test.ts`.
- Expected red: no availability plist exists; watchdog plist still uses `KeepAlive`; watchdog defaults to `~/Library/Caches`; watchdog never returns because it owns an infinite loop.

## current status

- Task isolated from fresh local main on PR #1625.
- Apple `caffeinate(8)` on this host confirms `-s` prevents system sleep only on AC and persists until the assertion process exits.
- The live watchdog failure is reproduced separately: the legacy root-owned `~/Library/Caches/Consuelo` prevents creation of its state directory.
- Focused tests are green: 9 tests across the new reliability suite and existing lifecycle restart contract.
- Live hotfix installed at 2026-07-24T05:36:22Z without restarting `com.consuelo.system`; PID remained 862.
- Live watchdog is scheduled every 30 seconds and last exited 0; `com.consuelo.availability` is running with an active `PreventSystemSleep` assertion.

## wait cycle 1

- Start time: 2026-07-24T05:36:39Z
- Wait reason: verify launchd performs an autonomous watchdog run after the hotfix, rather than relying only on the manual kickstart.
- Duration: 35 seconds.
- Resume action: inspect watchdog run count, last exit code, new state directory, recent log lines, availability assertion, and local OS health.
- Expected signal: watchdog run count increases beyond 2, last exit remains 0, no permission errors occur, and OS health remains successful.
- Fallback: restore the backed-up watchdog plist or repair the scheduled plist while leaving the healthy main OS process untouched.
- Observed at 2026-07-24T05:38:23Z: watchdog run count advanced from 2 to 5, last exit remained 0, and all local TCP, local HTTP, and external counters were 0 under `$CONSUELO_HOME/node/runtime/watchdog`.
- Availability remained running as PID 7904 with `PreventSystemSleep=1`; `com.consuelo.system` remained healthy as PID 862 with no restart.
- The tailed permission-denied lines predate cutover and remain only because the existing 6.7 MB log was preserved; healthy one-shot runs intentionally produce no log line.
- Decision: local hotfix is stable. Continue repository regression validation and stream publication; no rollback or Workspace fallback is needed.

## files changed

- `packages/os/scripts/workspace-watchdog.sh`
- `packages/os/scripts/generate-system-daemons.sh`
- `packages/os/scripts/install-system-daemons.sh`
- `packages/os/scripts/uninstall-system-daemons.sh`
- `packages/os/tests/system-daemon-reliability.test.ts`
- `packages/os/README.md`
- `packages/os/SCRIPTS.md`
- `packages/os/docs/installer-runtime-release-checklist.md`
- task metadata and this workpad

## validation

- Red phase: availability plist absent; watchdog used legacy cache state and an infinite loop.
- Focused green after final wiring coverage: 10 tests passed across the reliability and lifecycle restart suites.
- Affected regression set: 39 passed, 10 environment-guarded skips across six suites.
- `bun run typecheck`: passed.
- Shell syntax for generator, installer, uninstaller, and watchdog: passed.
- LaunchAgent dry-run generation and `plutil` lint: passed.
- `git diff --check`: passed.
- Live scheduler verification: watchdog advanced from 2 to 5 runs with exit 0; all counters remained 0; OS PID remained 862.

## key decisions

- Use a separate `com.consuelo.availability` LaunchAgent running `/usr/bin/caffeinate -s`; do not mutate global `pmset` settings and do not depend on fake audio activity.
- Keep `launchd` responsible for process existence and use the watchdog only for semantic health and bounded remediation.
- Preserve Workspace as an emergency recovery path, but do not use it unless OS becomes unavailable.

## notes for ko

- The main OS service will remain untouched during the local watchdog/availability hotfix unless validation proves a main-service restart is required.

## improvements noticed

- Task-scoped `batch` does not propagate `taskSession` to nested file reads; direct scoped calls are required.

## issues and recovery

- Initial attempt to create `stream/os-runtime` was rejected before mutation because the wrapper did not propagate `createStream`; the task was correctly placed on existing `stream/os-distribution`.
- A discovery batch partially failed because nested `fs.read` calls lost task scope. No files changed; direct task-scoped reads recovered.

---

## publish checklist

```bash
bun run task:push -- --message "fix(os-distribution): harden macOS runtime availability" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `AGENTS.md`
- `CODING-STANDARDS.md`
- `packages/os/SCRIPTS.md`
- `packages/os/package.json`
- `packages/os/scripts/generate-system-daemons.sh`
- `packages/os/scripts/install-system-daemons.sh`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/uninstall-system-daemons.sh`
- `packages/os/scripts/workspace-watchdog.sh`
- `packages/os/tests/lifecycle-restart-contract.test.ts`
- `packages/os/tests/local-os-port-cutover.test.ts`
- `packages/workspace/senior-engineer.md`

## workspace-owned: files changed

- `packages/os/scripts/workspace-watchdog.sh`
- `packages/os/tests/system-daemon-reliability.test.ts`

## workspace-owned: activity log

- 2026-07-24 05:32:32 fs.write: `.task/os-distribution/harden-macos-runtime-availability-watchdog-and-power-policy/workpad.md`
- 2026-07-24 05:32:58 write: `packages/os/tests/system-daemon-reliability.test.ts`
- 2026-07-24 05:32:58 fs.write: `packages/os/tests/system-daemon-reliability.test.ts`
- 2026-07-24 05:33:39 write: `packages/os/scripts/workspace-watchdog.sh`
- 2026-07-24 05:33:39 fs.write: `packages/os/scripts/workspace-watchdog.sh`

- 2026-07-24 05:33:48 apply-patch: `packages/os/scripts/generate-system-daemons.sh`

- 2026-07-24 05:33:58 apply-patch: `packages/os/scripts/generate-system-daemons.sh`
- 2026-07-24 05:34:11 apply-patch: `packages/os/scripts/install-system-daemons.sh`
- 2026-07-24 05:34:15 apply-patch: `packages/os/scripts/uninstall-system-daemons.sh`

- 2026-07-24 05:35:05 apply-patch: `packages/os/SCRIPTS.md`
- 2026-07-24 05:35:05 apply-patch: `packages/os/docs/installer-runtime-release-checklist.md`
- 2026-07-24 05:35:11 apply-patch: `packages/os/README.md`
- 2026-07-24 05:35:18 apply-patch: `packages/os/scripts/generate-system-daemons.sh`
- 2026-07-24 05:35:49 apply-patch: `packages/os/scripts/workspace-watchdog.sh`

- 2026-07-24 05:36:50 apply-patch: `.task/os-distribution/harden-macos-runtime-availability-watchdog-and-power-policy/workpad.md`

- 2026-07-24 05:38:34 apply-patch: `.task/os-distribution/harden-macos-runtime-availability-watchdog-and-power-policy/workpad.md`
- 2026-07-24 05:38:40 apply-patch: `packages/os/tests/system-daemon-reliability.test.ts`

- 2026-07-24 05:39:29 apply-patch: `.task/os-distribution/harden-macos-runtime-availability-watchdog-and-power-policy/workpad.md`

## workspace-owned: validation evidence

- 2026-07-24 05:40:04 `verify`: passed — OK

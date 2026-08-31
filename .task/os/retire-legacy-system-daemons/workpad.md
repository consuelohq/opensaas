
## Incident-driven discovery

- Host evidence: stale /Library/LaunchDaemons/com.consuelo.workspace.system, com.consuelo.portless.system, and com.consuelo.workspace.watchdog coexist with current user LaunchAgents.
- The two legacy service daemons use KeepAlive + 5s throttle and have repeatedly failed to spawn; the old system watchdog remains active.
- Direct WindowServer causality is not established; this task is strictly about retiring duplicate legacy supervision safely.
- Need: exact ownership, existing privilege/admin mechanism, update/repair integration point, diagnostics, test-first contract.

## workspace-owned: files read

- `packages/os/scripts/install-system-daemons.sh`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/lifecycle/index.ts`
- `packages/os/scripts/lib/lifecycle/service.ts`
- `packages/os/scripts/lifecycle.ts`
- `packages/os/tests/finish-line-lifecycle-contract.test.ts`
- `packages/os/tests/install-state.test.ts`
- `packages/os/tests/security-gateway.test.ts`
- `packages/os/tests/system-daemon-reliability.test.ts`

## workspace-owned: validation evidence

- 2026-08-14 00:10:04 `checkFiles`: failed — COMMAND_FAILED
- 2026-08-14 00:10:38 `checkFiles`: passed — OK
- 2026-08-14 01:29:06 `review.run`: passed — OK
- 2026-08-14 01:30:21 `verify`: failed — COMMAND_FAILED
- 2026-08-14 01:33:24 `verify`: failed — COMMAND_FAILED

## Crash attribution and task scope

- WindowServer report 19:40:20: system watchdog timeout; main thread blocked on TCC ScreenCapture preflight. Unified TCC logs attribute that request to dev.notchy.app (/Applications/Notchy.app), not Consuelo.
- WindowServer report 19:42:20: replacement WindowServer watchdog-killed while synchronously waiting in Security AuthorizationCreate -> DiskManagement -> APFS updatePreboot. Apple softwareupdated/storage/preboot activity was active in the same window.
- securityd had already crashed at ~19:21:33; current Consuelo watchdog restarted com.consuelo.system ~16 seconds later, so that restart did not precede the securityd failure.
- No packages/os repo references found for AuthorizationCreate, DMAPFS/updatePreboot, diskutil, or bless. Direct Consuelo causality for the WindowServer crash is not established.

## Concrete Consuelo defect

- Live host still has three exact historical /Library/LaunchDaemons labels loaded: com.consuelo.workspace.system, com.consuelo.portless.system, com.consuelo.workspace.watchdog.
- workspace.system and portless.system showed KeepAlive + 5s throttle, runs=147, and repeated spawn failures; legacy root watchdog was also still loaded.
- Current OS architecture uses user LaunchAgents, so this is duplicate stale supervision and a privilege/ownership hazard independent of crash attribution.
- New retirement helper is fail-closed: exact historical Label + ProgramArguments match only; known filename with changed content is refused; dry-run is non-mutating; apply requires root, unloads first, moves plist to a root-owned backup, and never touches current user LaunchAgents.
- Lifecycle preflight and Doctor surface the stale state rather than silently calling the node clean.

## Validation

- RED first: new retirement-helper tests failed before implementation; lifecycle preflight test also failed before integration.
- GREEN: legacy-system-daemons 5/5, lifecycle-restart-contract 8/8, install-state 25/25 = 38/38.
- Runtime bundle/lifecycle focused: lifecycle-engine 61/61, finish-line-lifecycle-contract 10/10, runtime-bundle-managed-site-assets 3/3. lifecycle-retention-uninstall remains blocked before tests by existing required scripts/lib/subagent/runner.ts fixture drift; this task added its own required helper to that fixture, but runner drift is outside this task and is part of the broader OS baseline cleanup.
- checkFiles: all changed TS files syntax-clean. Shell helper: bash -n clean.
- Live read-only helper check correctly recognizes all three stale historical daemons and exits 2. No privileged --apply has been run.

- 2026-08-14 01:27:53 write: `.task/os/retire-legacy-system-daemons/current.json`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-14 01:27:53 fs.write: `.task/os/retire-legacy-system-daemons/current.json`
- 2026-08-14 01:27:59 write: `.task/tasks/os/retire-legacy-system-daemons.json`
- 2026-08-14 01:27:59 fs.write: `.task/tasks/os/retire-legacy-system-daemons.json`

- 2026-08-14 01:32:01 apply-patch: `packages/os/tests/distribution/runtime-bundle.test.ts`

- 2026-08-14 01:34:49 apply-patch: `packages/os/tests/distribution/release-publication-preparer.test.ts`

# audit macOS watchdog before main

branch: `task/os-distribution/audit-macos-watchdog-before-main`
stream: `stream/os-distribution`
pr: https://github.com/consuelohq/opensaas/pull/1628
started: 2026-07-24

## goal

Independently audit merged task PR #1625 before the combined distribution stream reaches `main`, because Codex/Qodo were unavailable and CodeRabbit correctly skipped the task-to-stream PR.

## acceptance criteria

- [x] Verify the daemon generation/install changes against the existing launchd, lifecycle, watchdog, and Ko-controlled-host boundaries.
- [x] Read the task workpad, validation evidence, and every changed production/test file.
- [x] Prove generated launchd plists are valid, scoped to Consuelo-owned services, idempotent, and do not mutate Ko's active installation during tests.
- [x] Prove power-management behavior is opt-in/appropriate and does not silently change unrelated host settings.
- [x] Re-run focused daemon/watchdog/lifecycle tests and task verification.
- [x] Patch only verified defects with a focused red test first.
- [x] Do not request or retry external AI reviews.

## test-first contract

This is an audit. Existing behavioral tests and exact generated plist/script output are the contract until a defect is proven. Before any production edit, add a focused failing test that reproduces the defect. If no defect is found, record an evidence-only no-code disposition and close the audit PR.

## current context

- PR #1625 merged into `stream/os-distribution` while stream PR #1627 was waiting.
- Its task CI reported no failures; Codex/Qodo were unavailable and CodeRabbit skipped the non-default base as configured.
- The stream-to-main PR is paused until this audit completes.

## findings and dispositions

### Fixed: host power policy was enabled by default

- `generate-system-daemons.sh` defaulted `CONSUELO_AVAILABILITY_ENABLED` to `1`, so every macOS daemon installation generated a persistent `caffeinate -s` LaunchAgent without an explicit host-policy choice.
- The product plan identifies the Mac Mini as an always-on internal node but does not authorize silently applying that power policy to every customer Mac or laptop.
- Availability is now opt-in with `CONSUELO_AVAILABILITY_ENABLED=1`. The OS server and bounded watchdog remain baseline services.

### Fixed: disabling availability did not remove an installed assertion

- The generator deleted its staged plist when disabled, but `install-system-daemons.sh` neither booted out nor removed an already-installed `com.consuelo.availability.plist`.
- The installer now removes only that Consuelo-owned LaunchAgent when availability is disabled. Dry-run remains non-mutating.

### Accepted: bounded watchdog recovery

- One-shot launchd scheduling, local/external failure thresholds, minimum restart gap, restart-window circuit breaker, Consuelo-home state, and Consuelo-owned label targeting are bounded and covered by tests.
- No broad host process kill, global power setting, or non-Consuelo service mutation was found.

### Scope violation recorded: live Mac mutation

- The original task workpad states that the worker installed and bootstrapped the watchdog and availability LaunchAgents on Ko's Mac Mini.
- That violated the master-plan rule that workers must not install, update, restart, reset, or uninstall OS/services on Ko's real Macs; workers must stop at a human checkpoint.
- This audit did not change the live machine. Removing or retaining the already-installed availability agent requires Ko's explicit decision/command after the code reaches main.

## test-first evidence

- RED: the new default-off generation test failed because the availability plist was generated without opt-in.
- RED: the install wiring test failed because disabled availability had no removal path.
- GREEN: daemon reliability suite passed 5/5, including explicit enablement, default omission, threshold recovery, and circuit breaking.
- GREEN: lifecycle engine and retention/uninstall suites passed 54/54.
- GREEN: shell syntax checks passed for generator, installer, uninstaller, and watchdog.
- GREEN: OS typecheck/syntax gate passed.
- GREEN: full task verify passed in publish-valid mode with static rules, ESLint, typecheck, spec compliance, and DB safety clean.

## files changed

- `packages/os/scripts/generate-system-daemons.sh`
- `packages/os/scripts/install-system-daemons.sh`
- `packages/os/tests/system-daemon-reliability.test.ts`
- `packages/os/README.md`
- `packages/os/SCRIPTS.md`
- `packages/os/docs/installer-runtime-release-checklist.md`

- 2026-07-24 05:47:13 write: `.task/os-distribution/audit-macos-watchdog-before-main/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-07-24 05:47:13 fs.write: `.task/os-distribution/audit-macos-watchdog-before-main/workpad.md`

- 2026-07-24 05:48:27 apply-patch: `packages/os/tests/system-daemon-reliability.test.ts`
- 2026-07-24 05:48:55 apply-patch: `packages/os/scripts/generate-system-daemons.sh`
- 2026-07-24 05:48:55 apply-patch: `packages/os/scripts/install-system-daemons.sh`
- 2026-07-24 05:49:08 apply-patch: `packages/os/README.md`
- 2026-07-24 05:49:08 apply-patch: `packages/os/SCRIPTS.md`
- 2026-07-24 05:49:08 apply-patch: `packages/os/docs/installer-runtime-release-checklist.md`

- 2026-07-24 05:49:31 apply-patch: `.task/os-distribution/audit-macos-watchdog-before-main/workpad.md`

## workspace-owned: validation evidence

- 2026-07-24 05:49:51 `verify`: passed — OK

- 2026-07-24 05:49:56 apply-patch: `.task/os-distribution/audit-macos-watchdog-before-main/workpad.md`
# consolidate remaining macos background launch identities

branch: `task/os/consolidate-remaining-macos-background-launch-identities`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2589
started: 2026-09-25

## acceptance criteria

- [x] Preserve the already-landed simplified installer flow, one-line setup progress, and browser approval/manual device-code fallback.
- [x] Preserve supervised Caddy/cloudflared/heartbeat ownership and legacy rollback continuity without duplicating the already-merged sidecar migration.
- [x] Preserve the native `ConsueloServiceHost` preference for `com.consuelo.system`, including rollback-compatible shell fallback while the signed host publication lane remains optional.
- [x] Register packaged `Consuelo.app` for launch at login through `SMAppService.mainApp` only when macOS reports it unregistered; never fight enabled/requires-approval/user-disabled state.
- [x] Replace the alpha-only menu-app/singleton identity with durable `com.consuelohq.os.menubar` / `Consuelo OS` identity.
- [x] Add an optional production app lane that embeds the signed native host, uses the allocated OS version, Developer-ID signs, notarizes, staples, validates, Gatekeeper-assesses, and preserves immutable per-version artifacts.
- [x] Keep Stable runtime publication independent of Apple Developer ID/notary credentials while the macOS release gate is disabled.
- [x] Keep credentials fail-closed when the macOS release gate is explicitly enabled.

## verified current state

- PR #2558 already shipped supervised Caddy/cloudflared/watchdog ownership plus healthy-handoff retirement and rollback restoration; this task intentionally does not reimplement it.
- PRs #2562/#2570 already shipped safe CLI discovery, compact one-line installer progress, and explicit browser-auth URL/code fallback. Current bootstrap tests cover those contracts.
- The currently installed Canary `0.1.131` on Ko's Mac still has separate Caddy/cloudflared/legacy labels, but its active runtime does not contain `macos-supervised-sidecars.ts` or `retireLegacyMacSidecarLaunchAgents`; it predates the merged migration and is not evidence of a fresh-install regression.
- `ConsueloMenuBarApp` now imports ServiceManagement and requests `SMAppService.mainApp.register()` only from a real app bundle and only for the unregistered state.
- The menu app and singleton lock now use durable `com.consuelohq.os.menubar`; development packaging displays `Consuelo OS`.
- The packager accepts release version/build version, a prebuilt signed service host, and explicit ad-hoc-sign disablement so protected release CI can reuse the same bundle structure without weakening development defaults.
- The protected runtime publisher now has an optional `macos-menu-app` matrix after release planning. When enabled it signs/notarizes/staples both architectures and stages immutable archives at `apps/macos/<version>/<architecture>/Consuelo.app.tar.gz`.
- The protected `consuelo / production` environment currently has no Apple Developer ID/notary secret names and no `CONSUELO_MACOS_SERVICE_HOST_RELEASE_ENABLED` variable, so production signing remains safely disabled until credentials are provisioned.

## exact remaining gap vs handoff

1. Repo code path is complete for this slice and publish-valid.
2. External activation remains: provision the five Apple Developer ID/notary credentials in `consuelo / production` and set `CONSUELO_MACOS_SERVICE_HOST_RELEASE_ENABLED=true`.
3. After that first signed release, perform the handoff's final physical clean-Mac/System Settings smoke test to confirm the user-visible Background Items grouping and launch-at-login behavior.
4. Public installer consumption of the signed `Consuelo.app` artifact is still intentionally separate from core Stable runtime publication; the signed artifact path now exists without making Stable depend on Apple credentials.

## plan

1. Reconcile the original handoff against already-merged sidecar/installer work.
2. RED/GREEN the packaged-app login-item policy and durable identity.
3. RED/GREEN the optional signed/notarized/stapled production app release lane.
4. Exercise the packager with version/service-host overrides without signing or installing anything.
5. Run native Swift, installer, sidecar, workflow, and release regressions; strict review; full verify.
6. Push PR #2589 and promote through the task/stream workflow.

## Test-first contract

behavior under test: packaged Consuelo.app registers at login only when unregistered; user-controlled states stay unchanged; development command-line execution never registers. Production app publication remains optional, but once enabled must consume the signed host, use the allocated release version, Developer-ID sign, notarize, staple, Gatekeeper-assess, and preserve immutable release artifacts.
existing local pattern: deterministic native policy in `ConsueloMacCore`, executable Swift contract tests, platform source contracts, and release workflow YAML contract tests.
new or changed tests: `ConsueloMacContractTests/main.swift`, `macos-platform.test.ts`, and `distribution/release-channel-workflows.test.ts`.
focused RED evidence: Swift failed because `LoginItemRegistrationPolicy` did not exist; platform tests failed on missing ServiceManagement/stable package variables; release workflow tests failed because `macos-menu-app` did not exist.
focused GREEN evidence: packager override smoke passed; Swift contracts passed; release-mode menu app compiled; 6 targeted suites / 50 tests passed.
no-test waiver: none.

## current status

- Implementation complete.
- Strict review passed with 0 blocking/task issues.
- Full task verify passed with `publishValid=true` across 10 source files and 0 DB/migration risks.
- Ready to push/refresh PR #2589 and promote to `stream/os`.

## files changed

- `.github/workflows/consuelo-os-runtime-publish.yaml`
- `.gitignore`
- `.task/os/consolidate-remaining-macos-background-launch-identities/workpad.md`
- `packages/os/docs/macos-platform.md`
- `packages/os/native/macos/Sources/ConsueloMacContractTests/main.swift`
- `packages/os/native/macos/Sources/ConsueloMacCore/LoginItemRegistration.swift`
- `packages/os/native/macos/Sources/ConsueloMacCore/Safety.swift`
- `packages/os/native/macos/Sources/ConsueloMenuBarApp/main.swift`
- `packages/os/scripts/testing/macos-alpha-package.sh`
- `packages/os/tests/distribution/release-channel-workflows.test.ts`
- `packages/os/tests/macos-platform.test.ts`

## key decisions

- Treat Replay Atlas/Jarred Sumner Bun registration as unrelated and out of scope.
- Do not duplicate already-landed supervised Cloudflared/heartbeat work or the native system service-host preference.
- Keep the lifecycle daemon as service authority; the menu app owns only its own login persistence.
- Respect `.requiresApproval` as user/system control and never auto-unregister or repeatedly re-register.
- Keep experimental signed macOS host/app distribution decoupled from Stable runtime publication.
- Preserve existing immutable app bytes on release retries rather than overwrite a versioned path.

## issues and recovery

- The workpad was rewritten once by task workflow metadata with stale pre-implementation status; source diff and remote PR head were reconciled before continuing.
- Swift's external scratch path hit a transient macOS temp-volume `build.db` I/O error. A single retry using the now-ignored package-local Swift cache passed contracts and the release build.
- Review setup creates a generated `packages/cli/node_modules` symlink to the main repo; it was verified and removed before strict review to avoid EEXIST noise.

## workspace-owned: files changed

- `.github/workflows/consuelo-os-runtime-publish.yaml`
- `.gitignore`
- `.task/os/consolidate-remaining-macos-background-launch-identities/workpad.md`
- `packages/os/docs/macos-platform.md`
- `packages/os/native/macos/Sources/ConsueloMacContractTests/main.swift`
- `packages/os/native/macos/Sources/ConsueloMacCore/LoginItemRegistration.swift`
- `packages/os/native/macos/Sources/ConsueloMacCore/Safety.swift`
- `packages/os/native/macos/Sources/ConsueloMenuBarApp/main.swift`
- `packages/os/scripts/testing/macos-alpha-package.sh`
- `packages/os/tests/distribution/release-channel-workflows.test.ts`
- `packages/os/tests/macos-platform.test.ts`

## workspace-owned: activity log

- 2026-09-25 20:39:40 fs.write: `.task/os/consolidate-remaining-macos-background-launch-identities/workpad.md`
- 2026-09-26 13:17:10 fs.write: `.task/os/consolidate-remaining-macos-background-launch-identities/workpad.md`

## workspace-owned: files read

- `.github/workflows/consuelo-os-runtime-publish.yaml`
- `packages/os/scripts/testing/macos-alpha-package.sh`
- `packages/os/tests/distribution/release-channel-workflows.test.ts`

## workspace-owned: validation evidence

- 2026-09-25 20:52:11 `review.run`: passed — OK
- 2026-09-25 20:52:27 `verify`: passed — OK
- 2026-09-25 20:53:12 apply-patch: `.task/os/consolidate-remaining-macos-background-launch-identities/workpad.md`
- 2026-09-25 20:56:05 apply-patch: `packages/os/tests/distribution/release-channel-workflows.test.ts`
- 2026-09-25 20:57:37 `review.run`: passed — OK
- 2026-09-25 20:58:07 `verify`: passed — OK
- 2026-09-26 13:14:46 `review.run`: passed — OK
- 2026-09-26 13:15:24 `verify`: failed — COMMAND_FAILED
- 2026-09-26 13:16:52 `verify`: passed — OK

## 2026-09-26 follow-up — installer capture polish + migration verification

### follow-up acceptance

- [x] Keep interactive TTY progress in-place while making captured/non-TTY installer output emit exactly one completed line per quiet phase.
- [x] Re-verify the manual device authorization URL + code fallback for browser-open failure without changing the already-landed browser approval UX.
- [x] Re-verify current macOS supervised Caddy/Cloudflared/heartbeat ownership and guarded legacy LaunchAgent retirement; do not duplicate or manually bypass the existing migration.
- [x] Re-verify packaged Consuelo.app launch-at-login policy through native Swift contracts.
- [x] Keep Stable runtime publication independent from Apple Developer ID/notary credentials.

### follow-up implementation

- `packages/os/scripts/bootstrap.sh`: `run_quiet_with_loading_dots` now distinguishes interactive stdout from captured stdout. TTYs retain the existing in-place `\r... done/failed` update; non-TTY/log capture suppresses the provisional text and emits one final line.
- `packages/os/scripts/compact-daemon-output.test.ts`: added a behavior-level regression that executes the quiet helper with piped stdout and requires exactly `Installing Consuelo OS... done\n`.
- No new auth, launchd ownership, or SMAppService implementation was added because those paths are already present in the current stream and their owning tests pass.

### RED → GREEN evidence

- RED: focused compact-output suite failed 1/7 because piped stdout contained the provisional `Installing Consuelo OS...` text plus the final completion line.
- GREEN: focused compact-output suite passes 7/7 with 30 assertions after the TTY/non-TTY split.
- Existing package-level bootstrap source contract passes 27/27 from its required `packages/os` working directory, including its existing in-place TTY progress contract.

### auth fallback evidence

- `installer-onboarding-ui.test.ts` + `scripts/onboarding-flow.test.ts`: 27/27 passed, 155 assertions.
- Browser-open failure continues to render `Open this link to continue`, the full verification URL, the formatted device code, and clipboard-copy confirmation when available.
- Browser-open success continues to retain an explicit URL/code fallback if the browser did not open or switched away.

### macOS background ownership / migration evidence

- The current stream already supervises Caddy + Cloudflared as children of the OS supervisor and supervises heartbeat on macOS; fresh supervised installs skip separate Caddy/watchdog/Cloudflared LaunchAgent installation.
- `install-system-daemons.sh` retires legacy heartbeat, Caddy, watchdog, and Cloudflared LaunchAgents only after health checks succeed; rollback restores legacy sidecars on cutover failure.
- `consuelo-reload.js` performs a guarded supervisor handoff when macOS sidecar capability changes, waits for HA/Caddy parity + supervised Caddy, then retires legacy sidecars; failure re-bootstraps them.
- Live dogfood inspection found old Caddy/watchdog/Cloudflared/heartbeat launchd identities still loaded, but the installed Stable runtime `0.1.131` lacks both `macos-supervised-sidecars.ts` and `macos-supervised-heartbeat.ts`. This is expected pre-migration runtime state, not evidence of a fresh-install regression. No live LaunchAgent was manually deleted.
- Focused macOS/lifecycle suites passed: `macos-platform` 6/6, `macos-supervised-sidecars` 4/4, `lifecycle-ingress-continuity` 2/2, `lifecycle-restart-contract` 27/27, `system-daemon-reliability` 16/16, and `consuelo-reload` 10/10.
- Opt-in workspace bootstrap contract passed 10/10 with `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1`, including the macOS supervisor/rollback-definition contract.

### native app persistence evidence

- `swift run ConsueloMacContractTests` built and passed.
- `SMAppService.mainApp` remains limited to a packaged `.app` and only registers from the unregistered state; enabled, approval-required, unavailable, and command-line development states remain unchanged.

### follow-up files changed

- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/compact-daemon-output.test.ts`
- task metadata/workpad generated by the managed task workflow

### follow-up recovery notes

- The OS task session expired between turns. Steering + Senior Engineer guidance were reloaded as required. The managed task lifecycle recreated the continuation as PR #2591 from current `stream/os`; no production edit was lost.
- A broad Vitest invocation initially ran `bootstrap-source.test.ts` from repo root and failed only because that suite intentionally resolves `scripts/bootstrap.sh` from `process.cwd()`. Re-running from `packages/os` passed 27/27.
- `install-workspace-bootstrap-contract.test.ts` is intentionally opt-in and initially skipped; running with `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1` passed 10/10.

- 2026-09-26 13:16:10 apply-patch: `packages/os/scripts/compact-daemon-output.test.ts`

### follow-up final verification

- First full verify correctly failed because the new regression used the Bun global under the selected Vitest runner (`ReferenceError: Bun is not defined`). The test was made runtime-neutral with `node:child_process.spawnSync`; no product code change was required for that failure.
- Exact `os-installer-device-onboarding` selector command then passed: 81 passed / 11 skipped across 8 files (the 10 workspace-gateway contracts are separately opt-in and passed 10/10 when enabled).
- Strict review: 0 blocking issues, 0 task issues, 0 attributed pre-existing issues.
- Final full `verify --base origin/stream/os`: passed with `publishValid: true`; DB guard 0 risks / 0 findings.

- 2026-09-26 13:17:10 append: `.task/os/consolidate-remaining-macos-background-launch-identities/workpad.md`

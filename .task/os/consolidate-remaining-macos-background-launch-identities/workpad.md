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

- `.task/os/consolidate-remaining-macos-background-launch-identities/workpad.md`

## workspace-owned: activity log

- 2026-09-25 20:39:40 fs.write: `.task/os/consolidate-remaining-macos-background-launch-identities/workpad.md`

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

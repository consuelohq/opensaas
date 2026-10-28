# consolidate macos background services under consuelo

branch: `task/os/consolidate-macos-background-services-under-consuelo`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2551
started: 2026-09-23

## acceptance criteria

- [x] Add a first-party native macOS service-host executable whose process remains the launchd-visible parent while the existing Bun supervisor remains the runtime/lifecycle authority.
- [x] Package the service host for both supported macOS architectures through the existing native distribution lane and make its install/runtime location deterministic.
- [x] The primary `com.consuelo.system` LaunchAgent uses the first-party service host when available; a legacy/runtime fallback remains explicit for rollback and development environments.
- [x] The service host forwards termination/interruption to the Bun child, mirrors child exit, and never re-signs or wraps vendor binaries as if they were Consuelo binaries.
- [x] Existing menu-bar app remains a lifecycle client only and does not become the runtime supervisor.
- [x] Existing lifecycle restart/update/rollback and uninstall contracts remain green.
- [x] Production signing/notarization is fail-closed and testable when credentials are supplied; no claim of Developer ID/notarization acceptance is made without actual credentials.
- [x] Caddy/cloudflared/watchdog consolidation is not silently mixed into the host bootstrap; remaining direct launch items are recorded as the next slice.

## plan

1. Use the existing Windows native service host and runtime publication flow as the distribution precedent; locate the real installer/release artifact boundaries.
2. Freeze the macOS service-host package/install/launchd contract in tests and run a focused RED.
3. Implement the smallest Swift service host, macOS packaging/distribution plumbing, and primary LaunchAgent migration with rollback-safe fallback.
4. Run Swift/native + installer/lifecycle/distribution regression suites, strict review, and full verification where the facade permits.
5. Push and promote into `stream/os`; then continue remaining sidecar consolidation, CLI/install polish, and release-facade reliability as separate focused tasks.

## current status

- Previous productization slice is already merged into `stream/os`: macOS heartbeat now runs inside the supervised Consuelo OS worker tree instead of a direct Bun-backed LaunchAgent.
- This task starts from that stream state.
- Current macOS native app is alpha/ad-hoc signed and remains a thin lifecycle client; there is no native service-host target yet.
- Production Developer ID signing/notarization is documented as required but is not currently wired into the release lane.

## Test-first contract

behavior under test: supported macOS runtime packages contain a first-party `ConsueloServiceHost` executable; the primary `com.consuelo.system` LaunchAgent invokes that host rather than exposing `/bin/bash`/Bun as its program when the host is installed; the host owns only process supervision/forwarding while the Bun supervisor retains runtime authority; legacy fallback remains available for rollback/development.
existing local pattern: Windows already ships a compiled native service host around the Bun supervisor; macOS currently packages only `ConsueloMenuBarApp`, and `generate-system-daemons.sh` creates a shell-backed primary LaunchAgent.
new or changed tests: `macos-platform.test.ts`, `system-daemon-reliability.test.ts`, `distribution/runtime-bundle.test.ts`, `distribution/release-channel-workflows.test.ts`, and `distribution/workflow-contract.test.ts` as needed for native CI packaging.
focused red command: `bun --cwd packages/os test tests/macos-platform.test.ts tests/system-daemon-reliability.test.ts tests/distribution/runtime-bundle.test.ts tests/distribution/release-channel-workflows.test.ts`.
expected red failure: no `ConsueloServiceHost` Swift target/binary exists, macOS packaging does not include one, and the generated primary plist still launches `/bin/bash`.
no-test waiver: not applicable.

## files changed

- `packages/os/native/macos/Package.swift` and `Sources/ConsueloServiceHost/main.swift` — add the thin first-party native service host.
- `packages/os/scripts/generate-system-daemons.sh` — prefer the active runtime's architecture-matched service host, preserving the shell fallback for legacy runtimes/rollback.
- `packages/os/scripts/testing/macos-alpha-package.sh` — build/embed the helper inside the alpha app for native CI/development validation.
- `packages/os/scripts/lib/distribution/runtime-bundle.ts` — allow only exact arm64/x64 service-host build artifacts into verified runtime bundles and exclude other macOS build products.
- `.github/workflows/consuelo-os-runtime-publish.yaml` — build both architecture artifacts before release planning, require Developer ID signing + Apple notarization + `spctl` acceptance, and distribute identical host inputs to every platform bundle.
- macOS/service/distribution workflow tests and docs updated for the new boundary.

## key decisions

- Do not make the menu-bar app the supervisor.
- Do not re-sign Bun, Caddy, cloudflared, or other vendor binaries to make them appear first-party.
- Prefer the existing runtime/lifecycle engine as authority; the native host is a stable first-party launch/process boundary.
- Treat actual Developer ID identity, hardened-runtime signing, notarization, stapling, and Gatekeeper acceptance as release gates that require real Apple credentials; source/tests may enforce the fail-closed contract without pretending those credentials were exercised.
- Follow the Windows publication precedent: build platform-native hosts before release planning, download the same native artifacts into every bundle build so the version-neutral release fingerprint remains identical across the release set, and activate the architecture-appropriate host at runtime.

## notes for ko

- The highest-impact direct Bun heartbeat item was removed in the prior merged slice (#2547).
- This branch is PR #2551.
- Focused productization tests: 50/50 passing.
- Expanded lifecycle/distribution regression: 113/113 passing.
- Native smoke: Swift service host compiled, mirrored a child exit status of 7, alpha app embedded the helper, and the current ad-hoc development bundle passed strict `codesign` verification.
- Strict review: zero blocking issues.
- Production credential discovery: local keychain has zero valid code-signing identities; the repository exposes only `CONSUELO_OS_RELEASE_SIGNING_PRIVATE_KEY`; the `consuelo / production` environment has no Apple credentials. Organization secret names could not be enumerated with the current GitHub token because it lacks `admin:org` permission.
- Production runtime publication is intentionally fail-closed until these protected secrets exist: `CONSUELO_MACOS_DEVELOPER_ID_P12_BASE64`, `CONSUELO_MACOS_DEVELOPER_ID_P12_PASSWORD`, `CONSUELO_MACOS_NOTARY_KEY_P8_BASE64`, `CONSUELO_MACOS_NOTARY_KEY_ID`, `CONSUELO_MACOS_NOTARY_ISSUER_ID`.

## improvements noticed

- The macOS distribution lane already runs on both macOS 26 arm64 and macOS 15 Intel, so it can provide architecture-specific native build evidence rather than relying on cross-compilation.

## errors i ran into

- Initial `session.start` used `startFrom: "stream/os"`; the tool rejected it before mutation because the schema expects `"main"` or `"stream"`. Retried correctly with `"stream"`.
- One discovery search guessed a nonexistent `packages/os/scripts/public-install.sh` path; the repo reader rejected that search. No mutation occurred; subsequent discovery will locate the actual installer entrypoint instead of guessing.
- The first raw GitHub helper call used its unsupported `api` action; the typed raw GitHub facade was then used with an explicit read-only reason. Production environment secret names contain no Apple signing/notarization credentials.
- A local double-Swift-build reproducibility probe exceeded the facade window and left only task-local scratch output; the matching task-scoped build process was terminated and `.build-a`/`.build-b` were removed. No tracked source was changed by the probe.
- Native smoke completed successfully, but the facade classified SwiftPM's ignored `.build` directory as a mutation in verify mode. The generated `.build` output and smoke package were removed immediately; no tracked source was discarded.
- Organization-level GitHub secret enumeration returned HTTP 403 because the current token lacks `admin:org`; repository and production-environment secret-name checks succeeded and contained no Apple credentials.

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-09-23 01:00:55 write: `.task/os/consolidate-macos-background-services-under-consuelo/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-23 01:00:55 fs.write: `.task/os/consolidate-macos-background-services-under-consuelo/workpad.md`

## workspace-owned: files read

- `.github/workflows/consuelo-os-distribution-environments.yaml`
- `.github/workflows/consuelo-os-runtime-publish.yaml`
- `packages/os/SCRIPTS.md`
- `packages/os/docs/macos-platform.md`
- `packages/os/native/macos/Package.swift`
- `packages/os/native/macos/Sources/ConsueloMacContractTests/main.swift`
- `packages/os/native/windows-service/Program.cs`
- `packages/os/plans/consuelo-os-foundation/workers/02-runtime-bundle-builder.md`
- `packages/os/scripts/bootstrap.ps1`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/build-runtime-bundle.ts`
- `packages/os/scripts/generate-system-daemons.sh`
- `packages/os/scripts/lib/distribution/runtime-bundle.ts`
- `packages/os/scripts/lib/windows-platform.ts`
- `packages/os/scripts/testing/macos-alpha-package.sh`
- `packages/os/scripts/windows-platform.ts`
- `packages/os/tests/distribution/release-channel-workflows.test.ts`
- `packages/os/tests/distribution/runtime-bundle.test.ts`
- `packages/os/tests/distribution/workflow-contract.test.ts`
- `packages/os/tests/finish-line-lifecycle-contract.test.ts`
- `packages/os/tests/installer-runtime-dependencies.test.ts`
- `packages/os/tests/macos-platform.test.ts`
- `packages/os/tests/system-daemon-reliability.test.ts`

- 2026-09-23 01:55:28 apply-patch: `.github/workflows/consuelo-os-runtime-publish.yaml`
- 2026-09-23 01:55:28 apply-patch: `packages/os/tests/distribution/release-channel-workflows.test.ts`
- 2026-09-23 01:55:28 apply-patch: `packages/os/docs/macos-platform.md`
- 2026-09-23 01:55:28 apply-patch: `packages/os/SCRIPTS.md`

## workspace-owned: validation evidence

- 2026-09-23 01:56:06 `review.run`: passed — OK

- 2026-09-23 01:56:22 apply-patch: `.task/os/consolidate-macos-background-services-under-consuelo/workpad.md`
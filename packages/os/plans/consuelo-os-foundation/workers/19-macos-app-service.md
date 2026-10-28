# Worker 19: macOS Menu-Bar App And Service Integration

## Mandatory context

Read `/Users/kokayi/Dev/opensaas/packages/os/plans/consuelo-os-foundation/plan.md` in full, then read the completed outputs from workers 04, 05, 18, 24, and 25. Do not begin from a standalone app template that creates a second installer or updater.

The master plan's OS-only execution, Ko-controlled real-Mac checkpoints, and CodeRabbit/Grok review rules are mandatory for this task.

## Mission

Build the first-party macOS control surface for an already-installed Consuelo OS while keeping the Bun lifecycle engine and launchd service as the source of truth.

## Product behavior

The menu-bar app must show:

- installed version and release channel;
- OS service, connector, and health state;
- workspace and node identity without exposing secrets;
- available update count and release summary;
- actions for update, retry/repair, rollback, open launcher, view redacted diagnostics, and uninstall.
- a safe workspace node list with role, capabilities, online/offline/stale presence, default selection, and revocation state from Worker 25's authenticated contract.

The app may guide first install, but it must invoke the same installer/lifecycle contract as terminal installation. It must not implement a parallel installation path.

## Architecture constraints

- Use SwiftUI and the architecture approved by worker 18. Do not introduce Electron.
- Communicate with the local runtime through the typed interface approved by worker 18.
- Do not parse ANSI output, bootstrap logs, or arbitrary stdout.
- Never read or render raw OAuth, bearer, tunnel, provider, or Cloudflare credentials.
- The launchd service remains independent of the app process.
- Preserve CLI compatibility for headless and recovery use.
- Preserve `~/.consuelo/` as the hidden runtime/state boundary.

## Required implementation

1. Add the menu-bar app target and its typed lifecycle client.
2. Add stable UI states for not installed, installing, healthy, degraded, update available, updating, rollback available, and repair required.
3. Route every mutation through the lifecycle engine.
4. Add redacted diagnostics export suitable for support.
5. Add explicit confirmation for uninstall and destructive repair.
6. Make channel selection visible only where policy allows it; default internal Mac Mini to `dev` through configuration, not code.
7. Keep signing/notarization configuration isolated from normal local builds.
8. Add restart and update-notification preference controls through the shared lifecycle API, not direct process mutation.

## Tests

- Unit tests for lifecycle-state rendering and command mapping.
- Contract tests against a mocked lifecycle server/IPC boundary.
- UI tests for update, rollback, degraded, and uninstall confirmation states.
- Process test proving app exit does not stop the service.
- Secret-redaction test.
- Clean local alpha packaging smoke test.
- Multi-node list/default/offline/revoked rendering tests with no secret-bearing fields.

## Acceptance gates

- The app can control a test installation without editing runtime files directly.
- A CLI-triggered update is reflected in the app without restart.
- An app-triggered update is visible through CLI status.
- Failed updates preserve the previous working release and surface recovery.
- Offline MacBook Air behavior is comprehensible and does not affect Mac Mini dev updates.
- The app builds without requiring production signing credentials.
- No worker installs or replaces the app on Ko's Macs; Ko runs the final checkpoint command after CI and disposable-home tests pass.
- Signing/notarization remains an explicit release gate before broad macOS distribution.

## Out of scope

- App Store submission.
- iOS.
- New auth platform/dashboard work.
- Replacing the web launcher or `/gtm` route.

## Completion report

Include screenshots, test output, package location, local-service proof, and a precise list of remaining signing/notarization steps.

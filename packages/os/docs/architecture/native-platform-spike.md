# ADR: Native platform shell over the Consuelo lifecycle engine

Status: accepted for alpha planning
Date: 2026-07-22
Owner: Worker 18

## Decision

Consuelo has one lifecycle authority: a headless lifecycle engine shipped in the signed runtime bundle. The CLI, macOS menu-bar app, Windows tray app, and later Linux shell are clients of that engine. They must not independently install, start, stop, update, roll back, or infer service state.

The native shell communicates with the engine over a versioned, authenticated local IPC endpoint:

- macOS and Linux: an owner-only Unix domain socket under the Consuelo runtime directory.
- Windows: a local-only named pipe with an ACL restricted to the installing user and service identity; network access is denied.
- Protocol: framed JSON, or generated protobuf later, using the TypeScript contract in `scripts/lib/native-lifecycle-client.ts`. Human-readable CLI output is never an API.
- Authentication: peer identity and filesystem or pipe ACLs establish the local principal; the shell may receive an ephemeral session capability after connection. No workspace token, signing key, tunnel token, or long-lived bearer credential is stored in the GUI process.

The service remains supervised after the UI closes. `closeShell()` only drops subscriptions. Service termination is an explicit privileged lifecycle operation and is intentionally absent from this spike contract.

## Existing authority and reuse

The current repository already contains lifecycle primitives that should be consolidated behind the engine rather than copied into native apps:

- installer and provisioning state plus doctor checks in `scripts/lib/install-state.ts`;
- launchd control and health probing in `scripts/consuelo-reload.js`;
- system daemon install and removal scripts;
- structured JSON command surfaces in OS scripts;
- release and runtime directories under `$CONSUELO_HOME/runtime`.

The spike adds a shell-facing contract only. It does not create a second updater or service manager.

## Typed API and event model

Requests are `status.get`, `update.apply { targetVersion }`, and `update.rollback { targetVersion }`.

Snapshots contain schema version, monotonic sequence, observed timestamp, installed runtime version and channel, runtime state, per-service health and owning service manager, available update count, latest version, rollback candidate, and local connection state.

Events are complete snapshots with monotonic sequence numbers. Clients ignore stale snapshots. This makes reconnect, UI restart, and offline recovery deterministic without partial-event replay logic in each shell.

## Platform responsibility matrix

| Concern | Shared lifecycle engine | macOS shell | Windows shell | Linux shell |
|---|---|---|---|---|
| Install, repair, removal plan | Authoritative | Displays plan and requests action | Displays plan and requests action | Displays plan and requests action |
| Service supervision | Adapter interface | `launchd` | Windows Service Control Manager | `systemd` |
| IPC | Versioned protocol and authorization | Unix domain socket client | Local named-pipe client | Unix domain socket client |
| Status and health | Computes canonical snapshot | Renders snapshot | Renders snapshot | Renders snapshot |
| Update and rollback | Verifies metadata, signatures, compatibility, atomic activation, health gate, rollback | Shows consent and progress | Shows consent and progress | Shows consent and progress |
| Secrets | Owns protected credentials | None beyond ephemeral capability | None beyond ephemeral capability | None beyond ephemeral capability |
| UI lifecycle | Independent | SwiftUI `MenuBarExtra`; quit UI only | WinUI tray shell; quit UI only | Optional tray shell; quit UI only |
| Logs and diagnostics | Produces structured records | Opens or exports views | Opens or exports views | Opens or exports views |

## Service model mapping

macOS uses `launchd`; the installed service is independent of the menu-bar app process. The app may launch at login separately, but quitting it cannot unload the service.

Windows uses a non-interactive Windows service. Microsoft recommends a separate GUI communicating with the service through IPC rather than an interactive service. Named pipes are suitable only when configured as local-only with restrictive ACLs.

Linux uses `systemd` units and socket ownership or permissions. Alpha can support a user service first; machine-wide installation requires a separate privilege and policy design.

## Alpha and signed distribution paths

Alpha:

- Internal development shells run only on disposable CI runners and designated test environments.
- Runtime bundle and shell consume the same immutable version and channel metadata.
- Update and rollback remain mocked until signed bundle verification and atomic activation exist.
- No installation or update tests run on Ko's Mac Mini or MacBook Air. Human checkpoint commands are supplied instead.

Signed distribution:

- macOS: sign app, helper or service executable, installer, and embedded runtime with Developer ID; enable hardened runtime where required; notarize with `notarytool`, staple the ticket, and verify Gatekeeper acceptance.
- Windows: Authenticode-sign installer, shell, service, and runtime executables. Prefer MSIX where service and privilege constraints permit; otherwise use a signed installer with explicit service registration and rollback.
- Linux: publish signed native packages per target distribution or a signed portable bundle; package scripts register systemd units.

Sparkle, WinSparkle, MSIX App Installer, WinGet, and Linux package managers are delivery mechanisms only. They may provide discovery, download, consent, and progress, but activation remains an engine operation. They may not parse CLI prose, hold release-signing or workspace secrets, independently choose a channel, overwrite the active runtime in place, or bypass compatibility, health, and rollback policy.

## Offline behavior

The shell retains the last structured snapshot and marks the connection and runtime offline when IPC is unavailable. Status remains readable on an offline MacBook Air. Update actions fail closed until the engine reconnects. No cloud connection is required to render installed version, channel, cached service state, or retained rollback metadata.

## Security properties

- Local IPC is not remotely reachable.
- Requests are an allowlisted tagged union; arbitrary commands and shell strings are impossible at the contract layer.
- The GUI receives no long-lived credentials.
- Lifecycle operations are auditable and return operation IDs.
- The engine validates release signatures before activation.
- Docker and container runtimes are not product dependencies.

## Constraints for downstream workers

Worker 19 — macOS native UI:

- Build a SwiftUI `MenuBarExtra` shell against this contract.
- Do not call `launchctl`, installer scripts, or CLI prose from Swift.
- Quitting the app only disconnects IPC.
- Show cached and offline state explicitly.

Worker 20 — Windows native UI:

- Use a separate tray application and Windows service.
- Use a local named pipe with restrictive ACLs and remote pipe access disabled.
- Do not create an interactive service or duplicate update logic.

Worker 21 — native lifecycle integration:

- Implement the authoritative engine endpoint and service-manager adapters.
- Generate bindings or schema from one source.
- Add signed-bundle verification, atomic current-version switch, health-gated activation, and retained rollback.

Worker 22 — signed distribution:

- Own code-signing identities, notarization, Authenticode, package signing, release metadata signing, and CI release evidence.
- Package the same runtime artifact consumed by CLI and native shells.
- Prove clean install, update, rollback, and removal on disposable matrix runners before any human checkpoint.

## Official references checked

- Apple `MenuBarExtra`: https://developer.apple.com/documentation/swiftui/menubarextra
- Apple notarization: https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution
- Apple macOS distribution and Developer ID: https://developer.apple.com/macos/distribution/
- Microsoft interactive services: https://learn.microsoft.com/windows/win32/services/interactive-services
- Microsoft named pipes and security: https://learn.microsoft.com/windows/win32/ipc/named-pipes
- systemd service and socket units: https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html and https://www.freedesktop.org/software/systemd/man/latest/systemd.socket.html

## Consequences

The architecture keeps platform code thin and makes CLI and native parity testable. A polished native shell cannot ship safely before the lifecycle endpoint, signed runtime bundle, and activation and rollback policy exist. That sequencing is intentional.

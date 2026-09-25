# macOS menu-bar app and service boundary

The Consuelo macOS app is a SwiftUI `MenuBarExtra` shell over the shared typed lifecycle protocol. It displays lifecycle, update, connector, service, workspace, and node state; it does not supervise the Bun runtime, invoke service-manager commands, parse CLI prose, or mutate installation files directly.

## Runtime contract

The app connects only to the owner-local framed JSON endpoint at `~/.consuelo/run/lifecycle.sock`. Requests are length-prefixed and bounded to 1 MiB. The shell maps controls to an allowlisted tagged union: status, update, rollback, repair, restart, notification preference, release-channel preference, default-node selection, diagnostics export, and uninstall. Worker 21 owns the authoritative endpoint and service-manager adapter.

A lightweight subscription polls the same typed status request and accepts only monotonic snapshots, so CLI-triggered operations appear without restarting the app. When the endpoint is unavailable, the client retains the last readable snapshot, marks it offline, and fails mutating actions closed.

Closing the app cancels only the UI subscription. It never stops, unloads, restarts, updates, repairs, resets, or uninstalls Consuelo OS.

When Consuelo is running from a packaged `Consuelo.app`, the app uses macOS ServiceManagement to request launch-at-login registration for the main app. It registers only from a real app bundle and only when macOS reports the app as not registered. If the login item is already enabled or macOS reports that user approval is required, Consuelo leaves that state unchanged rather than repeatedly trying to override the user's Login Items choice. Command-line `swift run` development builds never register a login item.

## Workspace and diagnostics safety

Workspace decoding accepts only the control plane's safe node projection. The native presentation intentionally exposes a smaller user-facing subset: display name, Default/Current/Home badges, platform, release channel, and Online/Stale/Offline/Revoked state. Connector identifiers, capability lists, agent plumbing, key/thumbprint data, credentials, and provider internals are not rendered in the menu.

Diagnostics export is lifecycle-engine owned. The native redactor removes representative tokens, authorization values, tunnel origins, key material, credential fields, and user-specific home paths before support artifacts are presented.

## Service host and build boundary

The primary `com.consuelo.system` LaunchAgent prefers the architecture-matched first-party `ConsueloServiceHost` from the active verified runtime. The host is intentionally thin: launchd owns the native host process, the host starts `scripts/start-consuelo-daemon.sh`, forwards termination/interruption to that child, and mirrors its exit status. Bun remains the runtime supervisor and lifecycle authority. If an older runtime does not contain the host, daemon generation falls back to the legacy shell-backed launch contract so rollback remains possible.

The runtime publisher has an experimental arm64/x64 service-host lane behind `CONSUELO_MACOS_SERVICE_HOST_RELEASE_ENABLED`. When that lane is enabled, the protected `consuelo / production` environment must supply the Developer ID certificate and App Store Connect notary credentials; that job fails closed if any credential is missing, applies a hardened-runtime Developer ID signature, submits the host to Apple's notary service, and requires `spctl` acceptance before publishing the native host artifact. Until that lane is explicitly enabled, core runtime publication can proceed without the native macOS host and the legacy rollback-compatible launch contract remains available.

The required protected secret names are `CONSUELO_MACOS_DEVELOPER_ID_P12_BASE64`, `CONSUELO_MACOS_DEVELOPER_ID_P12_PASSWORD`, `CONSUELO_MACOS_NOTARY_KEY_P8_BASE64`, `CONSUELO_MACOS_NOTARY_KEY_ID`, and `CONSUELO_MACOS_NOTARY_ISSUER_ID`. Secret values must never be committed to the repository.

## Menu app build boundary

The `macos-26` arm64 CI lane runs the Swift contract executable, builds the menu target plus `ConsueloServiceHost`, embeds the service host under `Contents/Library/LaunchServices`, creates `Consuelo.app` with the durable bundle identifier `com.consuelohq.os.menubar` and display name `Consuelo OS`, applies only an ad-hoc development signature when `codesign` is available, archives the bundle as `Consuelo.app.tar.gz` so Unix executable modes survive artifact transport, and uploads that development archive.

When `CONSUELO_MACOS_SERVICE_HOST_RELEASE_ENABLED` is explicitly enabled and a runtime release changes, the protected runtime publication workflow also packages architecture-specific production `Consuelo.app` bundles. Each app receives the allocated Consuelo OS release version, embeds the already Developer-ID-signed native service host, is Developer-ID signed with hardened runtime, is submitted to Apple's notary service, has the notarization ticket stapled and validated, and must pass Gatekeeper assessment. The resulting archives are preserved as CI artifacts and staged immutably in the release bucket at `apps/macos/<version>/<architecture>/Consuelo.app.tar.gz`. Existing bytes at an allocated version path are preserved rather than overwritten on retries.

## Human checkpoint

Until the protected Developer ID/notary credentials are provisioned and the macOS release gate is enabled, the menu app remains a separate development install from the public Consuelo OS installer. To build, install it under your user account, and launch it:

```bash
bash packages/os/scripts/testing/macos-alpha-package.sh --install --launch
```

The default destination is `~/Applications/Consuelo.app`. `CONSUELO_MAC_APP_INSTALL_DIR` may point at another directory inside your home folder for isolated development installs. The alpha installer does not write to system `/Applications` and does not require elevated privileges.

To launch a build artifact without installing it:

```bash
open packages/os/.tmp-macos-alpha/Consuelo.app
```

Expected result: a Consuelo icon appears in the menu bar, status and Nodes are read from the owner-local lifecycle endpoint, and the packaged app registers itself to reopen at login when macOS permits it. If macOS requires approval or the user disables the login item, the app respects that state. Quitting the menu app leaves the background service unchanged. The app may request lifecycle actions such as update or default-node changes, but it never replaces the lifecycle engine or service supervisor.

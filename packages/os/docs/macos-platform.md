# macOS menu-bar app and service boundary

The Consuelo macOS app is a SwiftUI `MenuBarExtra` shell over the shared typed lifecycle protocol. It displays lifecycle, update, connector, service, workspace, and node state; it does not supervise the Bun runtime, invoke service-manager commands, parse CLI prose, or mutate installation files directly.

## Runtime contract

The app connects only to the owner-local framed JSON endpoint at `~/.consuelo/run/lifecycle.sock`. Requests are length-prefixed and bounded to 1 MiB. The shell maps controls to an allowlisted tagged union: status, update, rollback, repair, restart, notification preference, release-channel preference, default-node selection, diagnostics export, and uninstall. Worker 21 owns the authoritative endpoint and service-manager adapter.

A lightweight subscription polls the same typed status request and accepts only monotonic snapshots, so CLI-triggered operations appear without restarting the app. When the endpoint is unavailable, the client retains the last readable snapshot, marks it offline, and fails mutating actions closed.

Closing the app cancels only the UI subscription. It never stops, unloads, restarts, updates, repairs, resets, or uninstalls Consuelo OS.

## Workspace and diagnostics safety

Workspace decoding accepts only the control plane's safe node projection. The native presentation intentionally exposes a smaller user-facing subset: display name, Default/Current/Home badges, platform, release channel, and Online/Stale/Offline/Revoked state. Connector identifiers, capability lists, agent plumbing, key/thumbprint data, credentials, and provider internals are not rendered in the menu.

Diagnostics export is lifecycle-engine owned. The native redactor removes representative tokens, authorization values, tunnel origins, key material, credential fields, and user-specific home paths before support artifacts are presented.

## Build and release boundary

The `macos-26` arm64 CI lane runs the Swift contract executable, builds the menu target, creates `Consuelo.app`, applies only an ad-hoc development signature when `codesign` is available, archives the bundle as `Consuelo.app.tar.gz` so Unix executable modes survive artifact transport, and uploads that alpha archive. Developer ID signing, hardened-runtime entitlements, notarization, stapling, update feeds, and promotion are downstream release gates and are intentionally absent here.

## Human checkpoint

Until Developer ID signing and notarization are available, the menu app remains a separate alpha/development install from the public Consuelo OS installer. To build, install it under your user account, and launch it:

```bash
bash packages/os/scripts/testing/macos-alpha-package.sh --install --launch
```

The default destination is `~/Applications/Consuelo.app`. `CONSUELO_MAC_APP_INSTALL_DIR` may point at another directory inside your home folder for isolated development installs. The alpha installer does not write to system `/Applications` and does not require elevated privileges.

To launch a build artifact without installing it:

```bash
open packages/os/.tmp-macos-alpha/Consuelo.app
```

Expected result: a Consuelo icon appears in the menu bar, status and Nodes are read from the owner-local lifecycle endpoint, and quitting the menu app leaves the background service unchanged. The app may request lifecycle actions such as update or default-node changes, but it never replaces the lifecycle engine or service supervisor.

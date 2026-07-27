# macOS menu-bar app and service boundary

The Consuelo macOS app is a SwiftUI `MenuBarExtra` shell over the shared typed lifecycle protocol. It displays lifecycle, update, connector, service, workspace, and node state; it does not supervise the Bun runtime, invoke service-manager commands, parse CLI prose, or mutate installation files directly.

## Runtime contract

The app connects only to the owner-local framed JSON endpoint at `~/.consuelo/run/lifecycle.sock`. Requests are length-prefixed and bounded to 1 MiB. The shell maps controls to an allowlisted tagged union: status, update, rollback, repair, restart, notification preference, release-channel preference, default-node selection, diagnostics export, and uninstall. Worker 21 owns the authoritative endpoint and service-manager adapter.

A lightweight subscription polls the same typed status request and accepts only monotonic snapshots, so CLI-triggered operations appear without restarting the app. When the endpoint is unavailable, the client retains the last readable snapshot, marks it offline, and fails mutating actions closed.

Closing the app cancels only the UI subscription. It never stops, unloads, restarts, updates, repairs, resets, or uninstalls Consuelo OS.

## Workspace and diagnostics safety

Workspace rendering accepts only Worker 25's safe node projection: identifiers, display name, role, platform, architecture, channel, connector identifier, capability summary, timestamps, presence, state, and public-key thumbprint. Token, authorization, private-key, tunnel-origin, credential, and local-service fields fail decoding.

Diagnostics export is lifecycle-engine owned. The native redactor removes representative tokens, authorization values, tunnel origins, key material, credential fields, and user-specific home paths before support artifacts are presented.

## Build and release boundary

The `macos-26` arm64 CI lane runs the Swift contract executable, builds the menu target, creates `Consuelo.app`, applies only an ad-hoc development signature when `codesign` is available, archives the bundle as `Consuelo.app.tar.gz` so Unix executable modes survive artifact transport, and uploads that alpha archive. Developer ID signing, hardened-runtime entitlements, notarization, stapling, update feeds, and promotion are downstream release gates and are intentionally absent here.

## Human checkpoint

A local isolated package smoke produces an unpacked app at `packages/os/.tmp-macos-alpha/Consuelo.app`. A downloaded CI artifact is the separate `Consuelo.app.tar.gz` archive and must be extracted first:

```bash
mkdir -p ./consuelo-alpha
cd ./consuelo-alpha
tar -xzf Consuelo.app.tar.gz
open Consuelo.app
```

Expected result: a Consuelo icon appears in the menu bar, status is read from the owner-local lifecycle endpoint, and quitting the menu app leaves the background service unchanged. Launch the artifact only in an approved test environment. Do not copy the app into a managed location or run lifecycle mutations on a production or personally managed machine during this checkpoint.

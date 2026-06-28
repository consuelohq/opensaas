# Installer Runtime Release Checklist

Last reviewed: 2026-06-21

This checklist gates public OS installer releases that depend on local runtime binaries and optional hosted enhancements.

## Baseline runtime contract

Portless is optional. A clean public install must work without a `portless` binary, without hosted portless artifacts, and without a `com.consuelo.portless.system` LaunchAgent. In that baseline path, Consuelo OS binds the normal local service on `http://127.0.0.1:8960` and records `PORTLESS_ENABLED=0` instead of persisting a stale `PORTLESS_BIN`.

Required baseline behavior:

- missing portless does not fail bootstrap;
- missing portless does not fail `install:system-daemons`;
- generated user LaunchAgents include `com.consuelo.system` and `com.consuelo.watchdog`;
- generated user LaunchAgents include `com.consuelo.portless.system` only when portless is configured or discoverable;
- the local health endpoint responds on the regular local port.

## Optional portless artifacts

The installer can still consume pre-published portless binaries from Consuelo-owned hosting when `CONSUELO_OS_INSTALL_PORTLESS=1` or `CONSUELO_OS_REQUIRE_PORTLESS=1` is explicitly set. Publish and verify these URLs before enabling that optional path:

- `https://install.consuelohq.com/os/bin/portless/darwin-arm64/portless`
- `https://install.consuelohq.com/os/bin/portless/darwin-arm64/portless.sha256`
- `https://install.consuelohq.com/os/bin/portless/darwin-amd64/portless`
- `https://install.consuelohq.com/os/bin/portless/darwin-amd64/portless.sha256`

Each `.sha256` file must contain a valid SHA-256 token for its sibling binary. Accepted checksum shapes are:

- `<sha>`
- `<sha>  portless`
- `<sha> *portless`

When optional install is requested, malformed checksum metadata, checksum mismatch, or download failure must not silently install an unverified binary. If `CONSUELO_OS_REQUIRE_PORTLESS=1`, those failures remain fatal. If only optional install is requested, the installer may fall back to the regular local port without enabling portless.

No repo-local platform artifact publishing script was found for these portless runtime files in this release pass. Until one exists, the operator step is manual: upload both architecture binaries and their `.sha256` sidecars to the hosted path above, then verify with bounded curl and `shasum -a 256` before enabling optional portless install.

## Clean-machine smoke

Run this on a clean macOS user/profile or VM with no local Homebrew/runtime assumptions:

```bash
curl -fsSL https://install.consuelohq.com/os | bash -s -- --yes --install-daemons --mode local
```

Required starting state:

- no existing `portless` or `cloudflared` on `PATH`;
- no Cloudflare login;
- no Wrangler login;
- no repo checkout on disk.

Required baseline verification:

- `~/.consuelo/os/bin/cloudflared` exists and is executable when Cloudflare tunnel transport is configured;
  Cloudflared is not required for baseline local-port installs. It is required only after approved bootstrap material selects a Cloudflare tunnel transport for a connector.
- `~/.consuelo/os/.env` contains `BUN_BIN`, `CLOUDFLARED_BIN`, and `PORTLESS_ENABLED=0` when portless is absent;
- `~/.consuelo/os/.env` does not contain `PORTLESS_BIN` when portless is absent;
- `launchctl print` shows the workspace and watchdog LaunchAgents;
- `launchctl print` does not require `com.consuelo.portless.system` when portless is absent;
- the local health endpoint responds on `http://127.0.0.1:8960/health`;
- managed MCP ingress reaches the local service after approved tunnel bootstrap.

Optional portless verification, only when portless is configured or optional install is enabled:

- `~/.consuelo/os/bin/portless` exists and is executable, or `PORTLESS_BIN` points to another executable;
- `~/.consuelo/os/.env` contains `PORTLESS_ENABLED=1` and an absolute `PORTLESS_BIN`;
- `launchctl print` shows `com.consuelo.portless.system`.

## Current release evidence

- Baseline portless fallback: covered by installer runtime tests added on 2026-06-21; clean dry-run PATH reports `optional_missing` and daemon generation skips the portless LaunchAgent.
- Optional portless artifacts: not yet published as of 2026-06-21; all four required URLs returned HTTP 404. This blocks optional hosted portless install, not baseline OS launch.
- Clean-machine smoke: not run in this environment during this pass; remains required before internal release.
- PR checks: PR #1154 was inspected on 2026-06-21; `Workers Builds: opensaas` remained the only red check. Record an explicit release-owner decision if that inherited check is not a release gate.

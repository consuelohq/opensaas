# Linux platform support

Consuelo OS uses the same signed, immutable runtime bundle and shared lifecycle engine on Linux as on macOS. Linux does not rebuild or mutate a promoted release. The active release remains selected through `~/.consuelo/runtime/current`, and update, health acceptance, rollback, repair, retention, and uninstall policy remain owned by the shared lifecycle engine.

## Supported hosts

| Dimension               | Supported contract                                                           |
| ----------------------- | ---------------------------------------------------------------------------- |
| Operating system        | Linux                                                                        |
| Architectures           | x64 and arm64                                                                |
| C libraries             | glibc and musl                                                               |
| Validated distributions | Ubuntu 24.04 native runner and Debian 12 container                           |
| Runtime dependency      | Bundled or explicitly resolved Bun executable; no Docker runtime requirement |
| Primary service manager | systemd user service                                                         |
| Fallback                | Session-scoped detached process when a systemd user manager is unavailable   |

Unsupported operating systems, architectures, or unidentifiable C libraries fail before a service unit or fallback process is created.

## Service lifecycle

The primary adapter writes only the Consuelo-owned user unit at:

```text
${XDG_CONFIG_HOME:-~/.config}/systemd/user/consuelo-os.service
```

The unit runs the immutable entry point:

```text
~/.consuelo/runtime/current/scripts/server/main.ts
```

It uses an absolute Bun path, a `0077` umask, user-only state, restart-on-failure, `NoNewPrivileges`, and a private temporary directory. It never requires a machine-wide daemon or root-owned service.

When `systemctl --user` is unavailable, Consuelo starts one bounded session process and records only its PID under `~/.consuelo/node/runs/`. This fallback is intentionally session-scoped; it does not claim machine-wide boot persistence.

## Authentication

Interactive Linux sessions open the existing verification URL with `xdg-open` when `DISPLAY` or `WAYLAND_DISPLAY` is available. Headless sessions receive the same verification URL and user code without changing the authentication protocol or requiring a Cloudflare account.

## Permissions and ownership

Consuelo-owned directories are maintained at mode `0700`; generated service and process-state files use mode `0600`. Uninstall removes the Consuelo-owned unit or fallback state and delegates runtime/generated-state removal to the shared lifecycle engine. It does not remove unrelated user systemd units or user-visible workspace content unless the existing explicit lifecycle flags request that content removal.

## Diagnostics

The adapter reports a structured snapshot containing platform, architecture, libc, selected manager, service state, unit path or fallback PID, and failure detail. Lifecycle progress and health acceptance remain emitted by the shared lifecycle engine, so Linux update, rollback, repair, and uninstall evidence uses the same result envelopes as macOS.

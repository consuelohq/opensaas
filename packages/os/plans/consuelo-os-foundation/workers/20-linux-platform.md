# Worker 20: Linux Installer And Service Adapter

## Mandatory context

Read `/Users/kokayi/Dev/opensaas/packages/os/plans/consuelo-os-foundation/plan.md` in full and consume the completed lifecycle contracts from workers 04 and 05. Linux is an adapter to the same runtime-bundle and lifecycle model, not an independent distribution system.

The master plan's OS-only execution, Ko-controlled real-Mac checkpoints, and CodeRabbit/Grok review rules are mandatory for this task.

## Mission

Deliver a production-shaped Linux installation, service, update, rollback, repair, and uninstall adapter with CI coverage on representative distributions.

## Required scope

- Detect supported architecture and libc constraints before installation.
- Install the same immutable OS runtime-bundle contract used by macOS.
- Use a systemd user service where available and document a bounded fallback for environments without it.
- Preserve `~/.consuelo/` ownership boundaries and strict permissions.
- Open browser/device auth where available and provide a headless URL/code path.
- Implement lifecycle status and structured diagnostics through the shared engine.
- Implement complete uninstall without removing user-owned managed-component modifications unless explicitly requested.
- Never require Docker at runtime.

## Distribution matrix

At minimum, test current supported Ubuntu LTS and one materially different common distribution. Record the exact supported matrix rather than claiming generic Linux support.

Use the mandatory OCI clean-host lane for repeatable Linux tests. The container harness is test infrastructure only; it must not become a product dependency or require Docker on Ko's Mac.

## Tests

- Clean install from no Bun/no Consuelo state.
- Existing Bun and alternate PATH install.
- Auth/headless auth handoff.
- Service start, restart, user logout/login behavior where testable.
- Update to a newer immutable runtime bundle.
- Failed update rollback.
- Repair after interrupted activation.
- Uninstall and reinstall.
- File ownership and permission checks.
- Architecture mismatch and unsupported-host failure messages.

## Acceptance gates

- The same runtime-bundle digest promoted by release channels is installed.
- No distro-specific rebuild occurs during promotion.
- Status/update/rollback semantics match macOS.
- A user can install without a Cloudflare account.
- Secrets and local DB state remain node-local.
- Unsupported environments fail before partially installing services.

## Out of scope

- Desktop GUI.
- Kubernetes deployment.
- Syncthing or cloud workspace-state synchronization.
- Broad distro claims without CI evidence.

## Completion report

Provide the supported distro/architecture table, CI evidence, service paths, uninstall proof, and any known host requirements.

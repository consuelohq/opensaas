# Worker 21: Windows Installer And Service Adapter

## Mandatory context

Read `/Users/kokayi/Dev/opensaas/packages/os/plans/consuelo-os-foundation/plan.md` in full and consume workers 04 and 05. Do not implement Windows as WSL-only and do not fork the release/channel model.

The master plan's OS-only execution, Ko-controlled real-Mac checkpoints, and CodeRabbit/Grok review rules are mandatory for this task.

## Mission

Deliver a native Windows installation and lifecycle adapter using the same immutable runtime bundles, channel metadata, state model, and security boundaries as macOS and Linux.

## Required scope

- Provide a PowerShell bootstrap with integrity verification and actionable errors.
- Detect supported Windows and CPU versions before mutation.
- Install Bun through the approved Bun-owned installation path when absent, then record the resolved executable path for service use.
- Install and operate the Consuelo background service using the platform mechanism approved by worker 18.
- Handle Windows paths, ACLs, browser launch, process lifecycle, and tunnel process ownership explicitly.
- Preserve the logical `~/.consuelo/` model using the correct Windows home directory.
- Implement shared lifecycle status, update, rollback, repair, diagnostics, and uninstall.
- Support a terminal-only path before any future native Windows UI.

## Security requirements

- Use least-privilege service identity where practical.
- Do not place secrets in command lines, logs, registry values readable by unrelated users, or world-readable files.
- Apply restrictive ACLs to node keys, tokens, tunnel credentials, DBs, and logs.
- Preserve OAuth and signed connector boundaries.
- Do not require a user Cloudflare account.

## Tests

- GitHub-hosted Windows clean-install test.
- No-Bun and existing-Bun paths.
- Paths containing spaces and non-default user profiles.
- Service start/restart and boot persistence.
- Device-auth handoff.
- Update, interrupted update, rollback, repair, uninstall, and reinstall.
- ACL assertions for secret-bearing paths.
- Tunnel/local gateway health smoke.
- PowerShell execution-policy failure guidance.

## Acceptance gates

- Native Windows works without WSL.
- Installed bytes match the promoted runtime-bundle digest.
- The service can locate Bun after reboot without depending on an interactive shell PATH.
- Uninstall removes managed runtime/service state and preserves user-modified managed components by default.
- Unsupported environments fail cleanly.

## Out of scope

- Windows Store/MSIX distribution unless the spike explicitly approves it for a later phase.
- Native Windows GUI.
- Domain/enterprise fleet management.

## Completion report

Provide CI links, supported Windows versions, service model, ACL evidence, and remaining signing/reputation requirements.

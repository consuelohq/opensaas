# PR 1154 Scope Audit

Last reviewed: 2026-06-21

This audit covers `consuelohq/opensaas` PR #1154 (`stream/security`) before treating the stream as release-ready.

## Summary

`origin/main...origin/stream/security` currently contains 91 changed paths:

- 27 `packages/os/**` paths;
- 50 `.task/**` paths;
- 14 non-OS workspace/operator paths.

## Classification

### Intentional OS installer/security release-train content

These paths are part of the OS installer/security release train and can stay if their focused validation remains green:

- `packages/os/docs/security-tightening-evidence.md`
- `packages/os/package.json`
- `packages/os/scripts/bootstrap.sh`
- `packages/os/scripts/generate-system-daemons.sh`
- `packages/os/scripts/install-system-daemons.sh`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/install-edge-site-publisher.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/platform-cloudflare-provisioning.ts`
- `packages/os/scripts/lib/workspace-connector-transport.ts`
- `packages/os/scripts/lib/workspace-device-authorization.ts`
- `packages/os/scripts/lib/workspace-device-login-client.ts`
- `packages/os/scripts/provision-managed-os-mcp-ingress-policy.ts`
- `packages/os/scripts/seed-workspace-edge-route.ts`
- `packages/os/scripts/start-portless-daemon.sh`
- `packages/os/scripts/uninstall-system-daemons.sh`
- OS contract and installer tests under `packages/os/tests/**`.

### Inherited stream content, not introduced by this hardening pass

These are broad stream contents already present in PR #1154. They should not be described as OS installer release-hardening work:

- `.task/security/**` task records for prior security tasks;
- `.task/tasks/security/**` task indexes for prior security tasks;
- `packages/os/scripts/explore.js`, `packages/os/scripts/lib/task-meta.js`, and related OS task/explore test updates.

### Non-OS inherited stream content requiring separate release note or cleanup decision

These paths are outside the OS installer/security dependency scope and should not ship silently as part of an installer release:

- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/code-call.ts`
- `packages/workspace/scripts/explore.js`
- `packages/workspace/scripts/lib/task-meta.js`
- `packages/workspace/scripts/lib/task-workpad.js`
- `packages/workspace/scripts/office.ts`
- `packages/workspace/scripts/task-start.js`
- `packages/workspace/tests/code-call.test.ts`
- `packages/workspace/tests/office-theme.test.js`
- `packages/workspace/tests/task-meta.test.ts`
- `packages/workspace/tests/task-workpad.test.js`
- `packages/workspace/tests/task-workpad.test.ts`
- `packages/workspace/tests/trace-watch.test.ts`
- `scripts/operator/trace-watch.ts`

These are classified as inherited stream content in this pass, not accidental changes from the release-hardening task. Before merging PR #1154 to `main`, either split/rebase them out or explicitly include a separate workspace/operator release note and validation evidence.

### `.task` churn

The PR includes 50 `.task/**` path changes. Security-task records are inherited stream metadata. Workspace-agent task deletions are unrelated to OS installer release-hardening and should be reviewed as part of stream hygiene before main merge.

## Release note separation

OS installer/security release notes should cover runtime dependency installation, checksum hardening, launchd executable normalization, direct daemon repair fallback, and Cloudflare provisioning boundary evidence.

Workspace/operator release notes, if retained, must be separate and cover code-call, explore, task workpad/meta, office theme/link behavior, and trace-watch changes.

## Current release decision

Do not mark PR #1154 release-ready while clean-machine baseline OS smoke is missing or while the non-OS inherited stream content lacks an explicit keep/split decision. `Workers Builds: opensaas` appears inherited from the forked Twenty workflow surface and needs a release-owner keep/remove/rewire decision. Portless artifact 404s block only optional hosted portless install, not the baseline local-port OS path.

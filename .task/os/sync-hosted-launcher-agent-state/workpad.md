# Workpad

## Acceptance criteria

- A completed hosted install reports verified local agent connections to the OS control plane without granting the public installer Cloudflare, D1, or R2 administration access.
- The control plane authenticates writes with the short-lived connector bootstrap credential issued during device approval and stores only a hash of that credential.
- Agent-status writes are workspace- and node-bound, accept only known agent identifiers with `verified` status, reject expired credentials, prevent one workspace credential from mutating another workspace record, and never persist configuration paths, secrets, tokens, or arbitrary labels.
- A public read endpoint returns only the safe aggregate required by the launcher: workspace host, connected-agent count, canonical agent names/labels, and update time.
- The static launcher hydrates that public aggregate from OS after page load, keeps a safe static fallback when the control plane is unavailable, and renders values through DOM text APIs rather than HTML interpolation.
- Existing `/configuration`, `/tools`, `/environments`, `/secrets`, `/settings`, and gateway behavior remain unchanged.
- Browser-session/OAuth issuance for Configuration pages, the GTM capability rename, and steering identity fallback remain out of scope for this PR.

## Plan

1. Extend the device-authority store with short-lived hashed node bootstrap credentials and workspace agent-status records.
2. Persist the bootstrap credential when device approval succeeds.
3. Add an authenticated agent-status write endpoint and a public redacted read endpoint.
4. Add an installer client that syncs verified agents after local verification; failure is reported diagnostically without invalidating a successful local install.
5. Hydrate the hosted launcher from the public status endpoint with a static fallback.
6. Prove authentication, expiry, workspace isolation, persistence, redaction, installer integration, and launcher hydration with focused tests; then run broader OS review and publish gates.

## Test-first contract

### Behavior under test

- Device approval creates a hashed, expiring bootstrap credential bound to one workspace, node, and account.
- A valid bootstrap credential can replace that node's verified-agent set; unknown, expired, malformed, and mismatched credentials fail closed.
- Public reads aggregate safe canonical agent records and omit node IDs, account IDs, credential hashes, configuration paths, and tokens.
- Installer verification sends only verified agent identifiers and the in-memory bootstrap credential to the control plane.
- Launcher HTML fetches the public endpoint, updates count/list safely, and preserves fallback content on failure.

### Existing patterns

- Device authority route/store patterns in `cloudflare/os-device-authority/src/routes/device.ts`, `types.ts`, and `stores.ts`.
- Device-login HTTP client pattern in `scripts/lib/workspace-device-login-client.ts`.
- Local agent canonical identifiers in `scripts/lib/local-agent-connectivity.ts` and launcher labels in `scripts/lib/sites.ts`.
- Static launcher generation in `scripts/lib/launcher-onboarding.ts`.

### Intended tests

- Add focused device-authority agent-status endpoint tests covering valid write/read, hashed-token storage, expiry, replacement, workspace isolation, validation, and redaction.
- Add installer client tests covering payload shape, authorization header, errors, and no secret leakage.
- Extend onboarding/install tests to prove sync occurs after verification and does not make local installation depend on control-plane availability.
- Extend launcher tests to prove safe hydration code and fallback behavior.

### Focused red command

`bun --cwd packages/os test tests/os-device-agent-status.test.ts tests/launcher-onboarding.test.ts tests/oauth-device-http-client.test.ts scripts/onboarding-flow.test.ts`

### Expected red failure

New route/store/client exports and launcher hydration markers do not exist yet, so the new contract tests must fail before production implementation.

## Current status

Implementation complete. The local launcher still reads canonical verified-agent state directly. Hosted installs now sync a redacted per-node record through device authority using the already-issued short-lived connector bootstrap credential. Hosted launcher snapshots hydrate a public safe aggregate after page load and preserve the static local fallback if the control plane is unavailable.

## Key decisions

- Use device authority as the control-plane owner for initial node status. This avoids direct Cloudflare administration from customer machines.
- Store bootstrap credential hashes only and expire them after the existing bootstrap window.
- Treat the launcher count as configured/verified agent connectivity, not process liveness.
- Keep node-level records private and expose only a workspace aggregate.
- Do not route this through the current Consuelo Sites Gateway descriptor path because that path currently returns service descriptors and browser-session scope is a separate follow-up.
- Persist the bootstrap credential hash during grant commit, after route provisioning and account-workspace persistence succeed. The original pretest expected persistence during approval preparation; exploration showed commit is the safe boundary, so the test contract was corrected before green implementation.
- Keep the sync nonfatal. Local agent installation remains successful when the hosted status endpoint is unavailable; diagnostics record only status, count, reason, or a safe message.

## Scope pressure / deferred work

- Browser OAuth/session issuance for Configuration pages.
- Long-lived node heartbeat and online/offline presence.
- Multi-node management UI and per-node detail.
- `consuelo-workspace-snapshot` to `gtm-context` rename.
- Steering workspace identity fallback.

## Validation evidence

- Red: the focused contract failed because the store methods, route, installer client, installer integration, and launcher hydration markers did not exist.
- Focused green: `tests/os-device-agent-status.test.ts`, `tests/launcher-onboarding.test.ts`, and `tests/oauth-device-http-client.test.ts` passed: 3 files, 14 tests.
- Installer integration green: the new `syncVerifiedAgentsAfterInstall` onboarding test passed in isolation; 1 passed, 21 unrelated tests skipped by the name filter.
- Device-authority regression: worker and architecture suites passed: 49 tests passed, 15 conditionally skipped.
- Release contracts: device-authority release contract passed: 8 tests; two environment-gated contract files skipped by their own guards.
- Syntax: `node packages/os/scripts/check-syntax.js` passed.
- Worker bundle: `wrangler deploy --config packages/os/cloudflare/os-device-authority/wrangler.toml --dry-run` passed.
- Full release dry run: `bun run os:release-device-auth -- --dry-run` generated the new launcher snapshot, planned R2 keys, and bundled the Worker successfully.
- Final focused regression: 6 files and 71 tests passed across the new route/client/launcher contracts, device-authority worker and architecture suites, and release contract.
- Strict review initially found three missing local async error boundaries. The write route, public read route, and installer sync helper now fail closed with safe errors; strict review then passed with zero findings.
- Full task verify passed with `publishValid: true` and no database route-seed risks.
- Known stream drift: `tests/local-agent-connectivity.test.ts` currently expects `sites/settings/index.html`, which current `stream/os` no longer materializes. All 69 other assertions in that combined run passed. This task does not change the Settings/Configuration migration.
- Known stream drift: the full `scripts/onboarding-flow.test.ts` includes an existing daemon-log-path expectation mismatch. The new installer status-sync test passed independently.

## Issues and recovery

- Initial `task.start` used an invalid `startFrom` value (`stream/os`); retried with the supported `stream` selector and created task session `tsk_e0fa2d1e0e2d`.
- An initial batched task-scoped read did not propagate the session to a child call; subsequent task reads use direct OS calls with the task session.
- A later batched task-scoped exploration repeated the same child-session limitation. No repository work used workspace fallback; all reads, edits, tests, release dry runs, and lifecycle actions remained on OS.
- `git.diff` with local base `stream/os` failed because that local ref was unavailable. The working-tree diff and `origin/stream/os` were used for evidence instead.
- An attempted `bun --cwd packages/os run typecheck` only printed Bun help because no package typecheck script exists. It is excluded from validation evidence and was replaced with the package syntax checker and focused TypeScript test imports.

## Final changed files

- `packages/os/cloudflare/os-device-authority/src/app.ts`
- `packages/os/cloudflare/os-device-authority/src/routes/workspace-agents.ts`
- `packages/os/cloudflare/os-device-authority/src/security/route-policies.ts`
- `packages/os/cloudflare/os-device-authority/src/services/grants.ts`
- `packages/os/cloudflare/os-device-authority/src/stores.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/cloudflare/os-device-authority/src/utils.ts`
- `packages/os/scripts/install.ts`
- `packages/os/scripts/lib/launcher-onboarding.ts`
- `packages/os/scripts/lib/workspace-device-authorization.ts`
- `packages/os/scripts/lib/workspace-device-login-client.ts`
- `packages/os/scripts/onboarding-flow.test.ts`
- `packages/os/tests/launcher-onboarding.test.ts`
- `packages/os/tests/oauth-device-http-client.test.ts`
- `packages/os/tests/os-device-agent-status.test.ts`
- `packages/os/tests/os-device-authority-architecture.test.ts`

- 2026-07-19 03:23:16 write: `.task/os/sync-hosted-launcher-agent-state/workpad.md`

## files changed

- `packages/os/cloudflare/os-device-authority/src/routes/workspace-agents.ts`
- `packages/os/tests/os-device-agent-status.test.ts`

## workspace-owned: files changed

- `packages/os/cloudflare/os-device-authority/src/routes/workspace-agents.ts`
- `packages/os/tests/os-device-agent-status.test.ts`

## workspace-owned: activity log

- 2026-07-19 03:23:16 fs.write: `.task/os/sync-hosted-launcher-agent-state/workpad.md`
- 2026-07-19 03:23:54 write: `packages/os/tests/os-device-agent-status.test.ts`
- 2026-07-19 03:23:54 fs.write: `packages/os/tests/os-device-agent-status.test.ts`
- 2026-07-19 03:24:11 apply-patch: `packages/os/tests/oauth-device-http-client.test.ts`
- 2026-07-19 03:24:11 apply-patch: `packages/os/tests/launcher-onboarding.test.ts`
- 2026-07-19 03:24:11 apply-patch: `packages/os/scripts/onboarding-flow.test.ts`
- 2026-07-19 03:25:11 apply-patch: `packages/os/tests/os-device-agent-status.test.ts`
- 2026-07-19 03:26:08 fs.write: `packages/os/cloudflare/os-device-authority/src/routes/workspace-agents.ts`

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/http.ts`
- `packages/os/cloudflare/os-device-authority/src/services/grants.ts`
- `packages/os/cloudflare/os-device-authority/src/stores.ts`
- `packages/os/cloudflare/os-device-authority/src/utils.ts`
- `packages/os/package.json`
- `packages/os/scripts/lib/install-diagnostics.ts`
- `packages/os/scripts/lib/sites.ts`
- `packages/os/tests/os-device-authority-architecture.test.ts`
- `packages/workspace/scripts/os-release-device-auth.ts`

- 2026-07-19 03:33:28 apply-patch: `packages/os/cloudflare/os-device-authority/src/services/grants.ts`

- 2026-07-19 03:33:45 apply-patch: `.task/os/sync-hosted-launcher-agent-state/workpad.md`

## workspace-owned: validation evidence

- Red: the focused contract failed because the store methods, route, installer client, installer integration, and launcher hydration markers did not exist.
- Focused green: `tests/os-device-agent-status.test.ts`, `tests/launcher-onboarding.test.ts`, and `tests/oauth-device-http-client.test.ts` passed: 3 files, 14 tests.
- Installer integration green: the new `syncVerifiedAgentsAfterInstall` onboarding test passed in isolation; 1 passed, 21 unrelated tests skipped by the name filter.
- Device-authority regression: worker and architecture suites passed: 49 tests passed, 15 conditionally skipped.
- Release contracts: device-authority release contract passed: 8 tests; two environment-gated contract files skipped by their own guards.
- Syntax: `node packages/os/scripts/check-syntax.js` passed.
- Worker bundle: `wrangler deploy --config packages/os/cloudflare/os-device-authority/wrangler.toml --dry-run` passed.
- Full release dry run: `bun run os:release-device-auth -- --dry-run` generated the new launcher snapshot, planned R2 keys, and bundled the Worker successfully.
- Known stream drift: `tests/local-agent-connectivity.test.ts` currently expects `sites/settings/index.html`, which current `stream/os` no longer materializes. All 69 other assertions in that combined run passed. This task does not change the Settings/Configuration migration.
- Known stream drift: the full `scripts/onboarding-flow.test.ts` includes an existing daemon-log-path expectation mismatch. The new installer status-sync test passed independently.
- 2026-07-19 03:34:22 `review.run`: passed — OK
- 2026-07-19 03:34:44 apply-patch: `packages/os/cloudflare/os-device-authority/src/routes/workspace-agents.ts`
- 2026-07-19 03:34:45 apply-patch: `packages/os/scripts/install.ts`
- 2026-07-19 03:35:02 `review.run`: passed — OK
- 2026-07-19 03:35:12 `verify`: passed — OK

- 2026-07-19 03:35:23 apply-patch: `.task/os/sync-hosted-launcher-agent-state/workpad.md`
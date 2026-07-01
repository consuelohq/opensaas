# OS workspace route registration

## Acceptance criteria

- Device/browser authorization dynamically registers the approved workspace hostname in the Cloudflare workspace route registry.
- Public installer remains free of Cloudflare account-admin credentials and direct Wrangler calls.
- New workspace names/hosts do not require preseeded/manual D1 rows.
- `internal.consuelohq.com`, `macbook-air-test.consuelohq.com`, or other test names are not hardcoded as success paths.
- `--refresh-source` continues to run the normal installer; any daemon skipping is only from explicit `--skip-daemons` or default daemon policy, not route provisioning.

## Test-first contract

Behavior under test:
- When the OS device authority approves a pending Google device grant for an arbitrary workspace name/host, it writes a D1 route row for exactly that host before the device token exchange returns success.

Existing pattern to follow:
- `tests/os-device-authority-worker.test.ts` already exercises Google OAuth approval and token exchange with an in-memory durable grant store.
- Workspace route rows are read by `workspace-edge` from `record_json`, while the live D1 table also requires denormalized columns.

New/changed tests:
- Add a focused `os-device-authority-worker` test using a fake D1 route registry binding that captures executed SQL.
- Assert the SQL includes the dynamic host and workspace id and does not depend on old manual test hosts.

Focused red command:
```bash
bun --cwd packages/os test tests/os-device-authority-worker.test.ts
```

Expected red failure:
- The new test fails because `createOsDeviceAuthorityHandler` currently does not accept or write a workspace route registry binding during approval.

## Notes

- The installer should not receive Cloudflare credentials. Route registration belongs to the device authority/control-plane path.

- 2026-06-23 03:36:28 apply-patch: `packages/os/cloudflare/os-device-authority/src/index.ts`
- 2026-06-23 03:37:18 apply-patch: `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- 2026-06-23 03:37:30 apply-patch: `packages/os/cloudflare/os-device-authority/src/index.ts`
- 2026-06-23 03:37:52 apply-patch: `packages/os/cloudflare/os-device-authority/src/index.ts`
- 2026-06-23 03:38:13 apply-patch: `packages/os/cloudflare/os-device-authority/wrangler.toml`
- 2026-06-23 03:38:21 apply-patch: `packages/os/cloudflare/workspace-edge/migrations/0001_workspace_route_registry.sql`
- 2026-06-23 03:40:13 apply-patch: `packages/os/cloudflare/os-device-authority/src/index.ts`

## Implementation notes

- Added dynamic route setup to the OS device authority approval path, not the public installer.
- The approved workspace host comes from the device-code request payload generated from the user-entered workspace name.
- The device authority now has a D1 binding to `consuelo-workspace-route-registry`.
- Route SQL is generated through the existing `workspace-edge-route-seed` helper so D1 row shape stays shared.
- The default launcher snapshot remains a configurable Worker var; hostnames are not hardcoded.
- Google callback and signed `/login/device/approve` both fail closed with HTTP 502 if route setup fails, so the terminal does not receive an approved bootstrap for an unregistered host.

## Validation

Red evidence:
- `bun --cwd packages/os test tests/os-device-authority-worker.test.ts` failed as expected: new route-registry capture had length 0.

Green evidence:
- `bun --cwd packages/os test tests/os-device-authority-worker.test.ts`: 7 passed.
- `CONSUELO_RUN_OS_DEVICE_AUTH_HARDENING_CONTRACTS=1 bun --cwd packages/os test tests/os-device-approval-auth-hardening-contract.test.ts`: 5 passed.
- `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/workspace-edge-route-seed-contract.test.ts`: 5 passed.
- `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/cloudflare-worker-deployment-contract.test.ts`: 4 passed.
- `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun --cwd packages/os test tests/install-workspace-bootstrap-contract.test.ts`: 6 passed.
- `bun run typecheck` from `packages/os`: workspace script syntax checks passed.
- `wrangler deploy --config cloudflare/os-device-authority/wrangler.toml --dry-run`: passed and showed `WORKSPACE_ROUTE_REGISTRY` D1 binding plus default snapshot vars.

## Remaining publish steps

- Run workspace review/verify.
- Merge to main.
- Deploy `consuelo-os-device-authority` from main.
- Retest fresh installer using a new workspace name and verify D1 route appears without manual seeding.

## workspace-owned: validation evidence

- 2026-06-23 03:41:08 `review.run`: passed — OK
- 2026-06-23 03:41:17 apply-patch: `packages/os/cloudflare/os-device-authority/src/index.ts`
- 2026-06-23 03:41:34 `review.run`: passed — OK
- 2026-06-23 03:41:51 `verify`: passed — OK
- 2026-06-23 03:42:31 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/security/os-workspace-route-registration/current.json`, `.task/security/os-workspace-route-registration/session.json`, `.task/security/os-workspace-route-registration/workpad.md`, `.task/tasks/security/os-workspace-route-registration.json`, `packages/os/cloudflare/os-device-authority/src/index.ts`, `packages/os/cloudflare/os-device-authority/wrangler.toml`, `packages/os/cloudflare/workspace-edge/migrations/0001_workspace_route_registry.sql`, `packages/os/scripts/lib/workspace-edge-route-seed.ts`, `packages/os/tests/os-device-authority-worker.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

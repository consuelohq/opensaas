# write cloudflare edge router registry tests

## Goal

Write red contract tests for PR A: Cloudflare Worker edge router, D1 edge route registry, and Cloudflare provisioning contract.

This task intentionally does not implement production modules. Another agent should make the tests green.

## Test-first contract

Behavior under test:
- Cloudflare edge router fails closed for unknown workspace hosts, unknown paths, and offline OS connectors.
- Edge router proxies Dialer routes to a Railway service upstream through signed internal edge headers.
- Edge router proxies OS routes only through connected outbound connector origins and signs upstream requests.
- D1 edge registry stores workspace hostname route rows, resolves longest-prefix routes, ignores disabled routes, lets Dialer stay active while OS is offline, and revokes hostnames fail-closed.
- Cloudflare provisioning plans/applies one public workspace hostname, one hidden OS tunnel origin hostname, idempotent Cloudflare operation keys, and separate connector bootstrap credentials from durable registry rows.

Existing pattern followed:
- `packages/os/tests/workspace-cloudflare-gateway-contract.test.ts`
- `packages/os/scripts/lib/workspace-cloudflare-gateway.ts`

New tests:
- `packages/os/tests/cloudflare-edge-router.test.ts`
- `packages/os/tests/cloudflare-d1-route-registry.test.ts`
- `packages/os/tests/cloudflare-provisioning-contract.test.ts`

Focused red command:

```bash
bun --cwd packages/os test \
  tests/cloudflare-edge-router.test.ts \
  tests/cloudflare-d1-route-registry.test.ts \
  tests/cloudflare-provisioning-contract.test.ts
```

Expected red failure:
- missing `../scripts/lib/workspace-cloudflare-edge-router`
- missing `../scripts/lib/workspace-cloudflare-d1-route-registry`
- missing `../scripts/lib/workspace-cloudflare-provisioning`

## Red evidence

Focused red command failed as expected with 3 failed suites and 0 tests run because the three future contract modules do not exist yet. Trace: `trc_5dbff0e373a4`.

## Implementation notes for next agent

Implement these modules without weakening the tests:

- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/lib/workspace-cloudflare-d1-route-registry.ts`
- `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`

Do not store connector bootstrap credentials in D1 route rows. D1 should be the edge-readable route cache. Postgres/app DB should remain the long-term source of truth in the later backend work.

Railway should remain a service upstream for `/dialer`; Cloudflare should own workspace host routing and provisioning.

- 2026-06-11 04:30:38 write: `.task/security/write-cloudflare-edge-router-registry-tests/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-11 04:30:38 fs.write: `.task/security/write-cloudflare-edge-router-registry-tests/workpad.md`

## workspace-owned: validation evidence

- 2026-06-11 04:30:46 `checkFiles`: passed — OK

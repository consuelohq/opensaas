# Preserve OS connector routes during Sites registry updates

branch: `task/os/preserve-os-connector-routes-during-sites-registry-updates`
stream: `stream/os`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1833/preserve-os-connector-routes-during-sites-registry-updates
github pr: https://github.com/consuelohq/opensaas/pull/1833
started: 2026-08-11

## acceptance criteria

- [x] Restore the live authenticated `/mcp` and `/gtm` connector routes without changing existing Sites routes.
- [x] Preserve connector columns, OS routes, `defaultNodeId`, and `nodeTargets` during Sites-only registry refreshes.
- [x] Keep the existing destructive seed behavior unchanged for explicit provisioning callers.
- [x] Prove the regression with executable SQLite/D1-compatible SQL and the publisher contract suite.
- [ ] Pass strict review, push PR #1833, merge it to `stream/os`, and promote it to `main`.

## plan

1. Diagnose the public ChatGPT route from OAuth ingress through D1 and the Cloudflare Tunnel.
2. Reconcile the missing live connector routes with a guarded D1 mutation.
3. Add a failing execution-level regression before production edits.
4. Make Sites publication preserve existing connector state and validate focused contracts.
5. Review, push, merge, promote, and verify the live route remains present.

## current status

- Live D1 now has one active `/mcp` route and one active `/gtm` route for the connected connector.
- The durable implementation and focused contract suites are green; strict review and shipping remain.

## files changed

- `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- `packages/os/scripts/lib/install-edge-site-publisher.ts`
- `packages/os/tests/workspace-edge-route-seed-contract.test.ts`
- `packages/os/tests/install-edge-site-publisher.test.ts`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-11 19:54:53 fs.write: `.task/os/preserve-os-connector-routes-during-sites-registry-updates/workpad.md`
- 2026-08-11 19:59:46 fs.write: `.task/os/preserve-os-connector-routes-during-sites-registry-updates/workpad.md`

## workspace-owned: validation evidence

- Red: focused route-seed contract had 7 passes and 1 failure because a Sites-only seed changed `connector_id` to `null`.
- Green: focused publisher/route/gateway contracts had 29 passes and 0 failures.
- Green: `bun run typecheck` reported `workspace script syntax checks passed`.
- Live D1: connector status is `connected`; `/mcp` route count is 1; `/gtm` route count is 1 after heartbeat propagation.
- 2026-08-11 20:05:45 `review.run`: passed — OK
- 2026-08-11 20:06:02 `verify`: passed — OK

## key decisions

- Sites publication uses an opt-in conflict update that replaces the incoming Sites/Gateway snapshot while merging existing `os-connector` routes and preserving multi-node state.
- Provisioning seeds retain their existing full replacement behavior so explicit connector registration remains authoritative.
- The live repair was guarded by the existing non-OS route snapshot to avoid overwriting concurrent Sites changes.

## notes for ko

- `consuelo restart` restarted the local runtime correctly; it could not reconstruct a cloud D1 route deleted by the Sites publisher.
- ChatGPT's active OAuth token is held by ChatGPT, so exact authenticated end-to-end confirmation requires retrying the existing ChatGPT conversation.

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## Discovery

- Live failure: authenticated `https://os.consuelohq.com/mcp` resolves the OAuth workspace host but D1 has no `/mcp` route and no node targets.
- Local origin is healthy through Cloudflare Tunnel and Caddy; tunnel `/mcp` returns the expected unauthenticated 401.
- Current D1 Sites record must be preserved while connector routes are reconciled.
- Test-first target: prove Sites-only route seeds cannot erase an existing OS connector route or node target.

- 2026-08-11 19:54:53 append: `.task/os/preserve-os-connector-routes-during-sites-registry-updates/workpad.md`

- 2026-08-11 19:59:18 apply-patch: `packages/os/tests/workspace-edge-route-seed-contract.test.ts`
## Test-first contract

- Red command: `cd packages/os && CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun test tests/workspace-edge-route-seed-contract.test.ts`
- Result: 7 passed, 1 failed.
- Focused failure: Sites-only refresh replaced the shared hostname row, changing `connector_id` from `connector_home` to `null` and dropping persisted OS connector state.

- 2026-08-11 19:59:46 append: `.task/os/preserve-os-connector-routes-during-sites-registry-updates/workpad.md`

- 2026-08-11 20:02:26 apply-patch: `packages/os/scripts/lib/workspace-edge-route-seed.ts`
- 2026-08-11 20:02:26 apply-patch: `packages/os/scripts/lib/install-edge-site-publisher.ts`
- 2026-08-11 20:03:35 apply-patch: `packages/os/tests/install-edge-site-publisher.test.ts`

- 2026-08-11 20:05:22 apply-patch: `.task/os/preserve-os-connector-routes-during-sites-registry-updates/workpad.md`

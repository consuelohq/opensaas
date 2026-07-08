# provision central mcp connector route for installed nodes

branch: `task/security/provision-central-mcp-connector-route-for-installed-nodes`
stream: `stream/security`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1378/provision-central-mcp-connector-route-for-installed-nodes
github pr: https://github.com/consuelohq/opensaas/pull/1378
started: 2026-07-08

## acceptance criteria

- [x] Fix the post-auth ChatGPT connection failure where central `https://os.consuelohq.com/mcp` OAuth succeeds but MCP cannot route to the installed node.
- [x] Keep the installer/user flow generic; no Ko-machine URL, workspace, IP, or one-off hardcoding.
- [x] Register an `os-connector` `/mcp` route and `workspace_connectors` row during device approval/workspace selection.
- [x] Return a Cloudflare Tunnel token to the installer so `materializeWorkspaceConnectorBootstrap` can configure local `cloudflared`.
- [x] Fail closed when D1 route registration is present but connector provisioning is unavailable.
- [x] Keep route SQL free of tunnel tokens/secrets.
- [x] Validate with focused OS tests, typecheck, review, and verify before push.

## plan

1. Extend the existing device-authority worker test to require connector provisioning on auth-first workspace selection and pre-named Google approval.
2. Add a worker-side Cloudflare connector provisioner that creates/reuses a remotely managed tunnel, writes tunnel config, ensures DNS records, and returns the tunnel token/origin.
3. Wire device approval to provision connector material, seed D1 with `connectorId`/`tunnelOriginUrl`, and include `cloudflare_tunnel_token` in approved JSON.
4. Run focused tests, typecheck, review, verify, then push/promote the task.

## current status

- Live install completes, but ChatGPT post-auth fails because D1 has only site routes and no `workspace_connectors` row for the newly installed workspace.
- Current `registerApprovedWorkspaceRoute` calls `createWorkspaceEdgeRouteSeedSql` without `connectorId` or `tunnelOriginUrl`, so `/mcp` is intentionally omitted.
- Current approval JSON has `connector_id` but no `cloudflare_tunnel_token`, so the installer cannot configure Cloudflare tunnel transport.

## test-first contract

Behavior under test:

- Auth-first workspace selection should seed D1 with public site routes plus an `/mcp` `os-connector` target and a `workspace_connectors` row.
- The approval response should include `cloudflare_tunnel_token` for the installer, but the seed SQL must not contain that token.
- Google approval for a pre-named workspace should provision connector material before the device polls the approved grant.
- D1-backed route setup without connector provisioning should fail instead of silently creating only site routes.

Existing local pattern:

- `packages/os/tests/os-device-authority-worker.test.ts` already has captured route-registry tests for auth-first workspace selection and Google approval.
- `packages/os/tests/workspace-edge-route-seed-contract.test.ts` already defines expected SQL behavior when connector inputs are supplied.

Focused red command:

- `cd packages/os && bun x vitest run tests/os-device-authority-worker.test.ts --runInBand`

Expected red failure:

- Captured route SQL lacks `workspace_connectors` and `os-connector`, and approval JSON lacks `cloudflare_tunnel_token`.

## files changed

- `packages/os/cloudflare/os-device-authority/src/index.ts`
- `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts`
- `packages/os/tests/os-device-authority-worker.test.ts`
- `packages/os/tests/cloudflare-provisioning-contract.test.ts`

## workspace-owned: files changed

- Device authority now provisions the connector route during approval/workspace selection and returns `cloudflare_tunnel_token` in approved installer JSON.
- Cloudflare provisioning module now has a reusable API client for remote tunnel creation/reuse, tunnel token fetch, config PUT, and DNS create/update.
- Tests cover route SQL with `workspace_connectors`, fail-closed missing provisioner behavior, and mocked Cloudflare API sequence.

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- `cd packages/os && bun x vitest run tests/os-device-authority-worker.test.ts` -> 21 passed.
- `cd packages/os && CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1 bun x vitest run tests/cloudflare-provisioning-contract.test.ts tests/workspace-edge-route-seed-contract.test.ts tests/cloudflare-d1-route-registry.test.ts` -> 33 passed.
- `cd packages/os && bun run typecheck` -> workspace script syntax checks passed.
- `bun run review -- --base origin/stream/security --json` -> clean (`yours: []`).
- `bun run verify -- --base origin/stream/security` -> passed; stamp written to `.task/security/provision-central-mcp-connector-route-for-installed-nodes/verify.json`.
- 2026-07-08 21:21:16 `review.run`: passed — OK

## key decisions

- Users still do not need Cloudflare accounts. Consuelo Cloudflare env owns provisioning; the installer only receives the tunnel token needed for local `cloudflared tunnel run`.
- Approval is split into prepare/provision/commit so second-node installs provision routes for the final node id instead of the workspace slug fallback.
- D1 route setup with a route registry but no connector provisioner fails closed instead of silently creating only site routes.

## notes for ko

- After this deploy, live `os.consuelohq.com` still needs the Consuelo-owned Cloudflare env/secrets present on the worker: account id, zone id, and API token. The end user does not provide those.

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(security): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-08 20:37:31 apply-patch: `.task/security/provision-central-mcp-connector-route-for-installed-nodes/workpad.md`
- 2026-07-08 20:38:07 apply-patch: `packages/os/tests/os-device-authority-worker.test.ts`
- 2026-07-08 20:38:58 apply-patch: `packages/os/tests/os-device-authority-worker.test.ts`

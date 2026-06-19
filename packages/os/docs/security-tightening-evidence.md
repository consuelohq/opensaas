# Security Tightening Evidence

Last reviewed: 2026-06-19

This note tracks the remaining evidence for the Network and Security Report items that are not fully closed by the local OS gateway hardening alone.

## MCP Persistent Connected-App Credentials

Status: separate open follow-up; not part of the managed OS MCP Cloudflare ingress surface.

Reviewed files:

- `packages/twenty-server/src/engine/api/mcp/controllers/mcp-core.controller.ts`
- `packages/twenty-server/src/engine/api/mcp/services/mcp-protocol.service.ts`
- `packages/twenty-server/src/engine/api/mcp/mcp.module.ts`
- `packages/twenty-server/src/engine/api/mcp/controllers/__tests__/mcp-core.controller.spec.ts`

Scope note: this section tracks the older Twenty-server MCP connected-app credential gap. The managed OS MCP ingress provisioning work is under `packages/os` and does not depend on these Twenty MCP files.

Current evidence:

- The Twenty MCP surface exposes an authenticated JSON-RPC `POST /mcp` endpoint guarded by JWT, workspace auth, and permission guards.
- The current MCP path can authenticate through the existing workspace user or API-key context.
- No `/mcp/oauth/start`, `/mcp/oauth/callback`, or `/mcp/connections` endpoints were found in the reviewed MCP controller/module files.
- No persistent connected-app credential record scoped to subject, workspace, device, connector, and scopes was found in the reviewed MCP files.
- No MCP-specific grant audit trail was found in the reviewed MCP service/controller files.

Required closure criteria:

- Add a persistent MCP connected-app credential lifecycle with issue, list/status, rotate, revoke, and use-audit flows.
- Store only verifier material or credential hashes. Raw credential material must be write-only and returned only at issue/rotation time.
- Bind credential use to workspace, caller/app identity, method, path, request-body signature, timestamp, nonce, and explicit scopes.
- Keep list/get responses limited to scoped status fields: credential id, subject/workspace/device/connector identifiers, scopes, status, expiry, created/rotated/revoked timestamps, and redacted last-use metadata.
- Add contract tests proving raw credentials, nonces, request bodies, tunnel origins, and local absolute paths are not returned or logged.

## Cache-Before-D1 Policy

Status: covered by route-policy tests.

Current evidence:

- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts` resolves the route registry before checking the site snapshot cache.
- Site snapshot cache reads are reachable only after the route resolves as `allowed: true`, target kind is `site-snapshot`, and auth is `public`.
- `packages/os/tests/cloudflare-edge-router.test.ts` includes positive cache-hit coverage after route resolution.
- `packages/os/tests/cloudflare-edge-router.test.ts` includes negative coverage for revoked hostname, disabled site route, missing route, and private snapshot route policy results. These cases assert that the cache is not read and cached HTML is not returned.

## Caddy Hardening

Status: covered by generated-config tests from the security pass.

Current evidence:

- `packages/os/scripts/lib/security-gateway.ts` renders Cloudflare-facing Caddy config with body size limits, gateway-sensitive header stripping, explicit upstream header overwrite, and proxy transport timeouts.
- `packages/os/tests/security-gateway.test.ts` snapshots the generated Caddy config without storing raw credentials in the config artifact.

## Tool-Scope Classification

Status: covered by manifest-backed gateway tests from the security pass.

Current evidence:

- `packages/os/scripts/lib/security-gateway.ts` resolves tool scopes from the tool manifest instead of regex-only guessing.
- Unknown tools fail closed unless explicitly classified by the manifest-backed resolver.
- `packages/os/tests/security-gateway.test.ts` covers read/write/dangerous classifications and unknown-tool denial.

## Deployment And Provider Evidence

Status: repo-local platform provisioning support added; deployed-provider evidence still required.

Architecture boundary:

- Public OS install requests Consuelo approval and consumes scoped `WorkspaceBootstrap` material issued by the Consuelo control plane.
- Cloudflare account-admin mutations are Consuelo platform operations. Customers do not need a Cloudflare account, Wrangler login, Cloudflare API token, zone id, account id, ruleset id, R2 bucket authority, or D1 authority to install OS locally.
- WAF rules, IP lists, rulesets, DNS/tunnel registration, D1 route registration, and R2/D1 publishing are owned by Consuelo-managed platform/admin tooling or server-side provisioning.

Repo-local evidence found:

- `packages/os/cloudflare/workspace-edge/wrangler.toml` declares the workspace edge Worker routes for `internal.consuelohq.com/*` and `*.consuelohq.com/*`.
- `packages/os/cloudflare/workspace-edge/wrangler.toml` binds D1 as `WORKSPACE_ROUTE_REGISTRY` and R2 as `SITES_SNAPSHOTS`.
- `packages/os/cloudflare/workspace-edge/src/index.ts` wires the D1 registry, edge signing secret presence, and optional R2 snapshot store into the edge router.
- `packages/os/cloudflare/os-device-authority/wrangler.toml` declares the `os.consuelohq.com/*` route and `DEVICE_GRANTS` Durable Object binding.
- `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts` builds managed OS MCP custom-rule expressions for the OS workspace hostname class under `*.consuelohq.com`, excluding hidden `*.os-origin.consuelohq.com`, `workspace.consuelohq.com`, and reserved platform hosts.
- `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts` represents the dashboard-proven allow rule as a `skip` action with `ruleset: 'current'` and phases `http_ratelimit`, `http_request_firewall_managed`, and `http_request_sbfm`.
- `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts` verifies the configured `$mcp_allowed_ips` account list before creating/updating rules and fails closed when the list is missing.
- `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts` provisions `Allow/skip trusted OS MCP provider traffic` and `Block untrusted OS MCP traffic` idempotently without duplicate rules on repeated provisioning runs. Existing dashboard-created rules without `ref` are parsed and matched by description before update/reorder so migration does not duplicate them.
- `packages/os/scripts/lib/platform-cloudflare-provisioning.ts` derives managed OS MCP ingress policy from Consuelo-owned Cloudflare env, requires `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` when policy env is explicit, and stays inert for local/dev envs with no managed policy keys.
- `packages/os/scripts/provision-managed-os-mcp-ingress-policy.ts` is the explicit platform/admin script for managed OS MCP WAF provisioning. Public install does not import or call it.
- `packages/os/scripts/install.ts` no longer imports Cloudflare provisioning, edge publishing, or Wrangler-backed helpers. It records `platformProvisioning` status from the approval/bootstrap boundary and consumes only scoped local bootstrap material.
- `packages/os/scripts/lib/workspace-device-login-client.ts` accepts optional server-issued `cloudflare_tunnel_token` / `cloudflareTunnelToken` from approved device grants as scoped connector bootstrap material.
- `packages/os/scripts/lib/install-edge-site-publisher.ts` and `packages/os/scripts/seed-workspace-edge-route.ts` are classified as internal Consuelo operator helpers because they use Wrangler for R2/D1 mutations.
- `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts` exposes a real managed-policy Cloudflare client for `getAccountIpList`, `getZoneCustomRuleset`, `createZoneCustomRuleset`, `createZoneCustomRulesetRule`, and `updateZoneCustomRulesetRule` without returning secret material.
- `packages/os/tests/platform-cloudflare-provisioning-contract.test.ts` covers the public install boundary, explicit platform/admin script wiring, inert local/dev env, incomplete-env fail closed, real Cloudflare policy client request shape, exact skip phases, and no hardcoded per-workspace WAF hostnames without calling Cloudflare.
- `packages/os/tests/cloudflare-provisioning-contract.test.ts` covers expression generation, exact skip phases, env-derived provisioning, fake Rulesets API create/update/reorder idempotency, missing-list fail closed, dashboard no-`ref` reconciliation, no hardcoded example hostnames, and real client request shapes without calling Cloudflare.
- `packages/os/tests/install-workspace-bootstrap-contract.test.ts` asserts public install does not import/call WAF provisioning, `publishWorkspaceEdgeSnapshot`, `edgePublish`, `wrangler`, or Cloudflare admin env vars.
- `packages/os/tests/oauth-device-http-client.test.ts` asserts scoped tunnel bootstrap material is consumed from the approved device response.

Remaining evidence gap:

- Read-only provider evidence still needs to confirm the deployed Cloudflare zone has the managed OS MCP rules active, ordered correctly, and backed by the intended provider-only `$mcp_allowed_ips` entries.
- Read-only deployment evidence still needs to confirm the public installer does not require Cloudflare account credentials in its runtime environment.
- The temporary local/dev deny CIDR override remains cleanup debt until `$mcp_allowed_ips` contains provider IPs only.

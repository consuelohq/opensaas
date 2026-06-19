# Security Tightening Evidence

Last reviewed: 2026-06-19

This note tracks the remaining evidence for the Network and Security Report items that are not fully closed by the local OS gateway hardening alone.

## MCP Persistent Connected-App Credentials

Status: open follow-up.

Reviewed files:

- `packages/twenty-server/src/engine/api/mcp/controllers/mcp-core.controller.ts`
- `packages/twenty-server/src/engine/api/mcp/services/mcp-protocol.service.ts`
- `packages/twenty-server/src/engine/api/mcp/mcp.module.ts`
- `packages/twenty-server/src/engine/api/mcp/controllers/__tests__/mcp-core.controller.spec.ts`

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

Status: repo-local provisioning support added; deployed-provider evidence still required.

Repo-local evidence found:

- `packages/os/cloudflare/workspace-edge/wrangler.toml` declares the workspace edge Worker routes for `internal.consuelohq.com/*` and `*.consuelohq.com/*`.
- `packages/os/cloudflare/workspace-edge/wrangler.toml` binds D1 as `WORKSPACE_ROUTE_REGISTRY` and R2 as `SITES_SNAPSHOTS`.
- `packages/os/cloudflare/workspace-edge/src/index.ts` wires the D1 registry, edge signing secret presence, and optional R2 snapshot store into the edge router.
- `packages/os/cloudflare/os-device-authority/wrangler.toml` declares the `os.consuelohq.com/*` route and `DEVICE_GRANTS` Durable Object binding.
- `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts` builds managed OS MCP custom-rule expressions for the OS workspace hostname class under `*.consuelohq.com`, excluding hidden `*.os-origin.consuelohq.com`, `workspace.consuelohq.com`, and reserved platform hosts.
- `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts` verifies the configured `$mcp_allowed_ips` account list before creating/updating rules and fails closed when the list is missing.
- `packages/os/scripts/lib/workspace-cloudflare-provisioning.ts` provisions `Allow/skip trusted OS MCP provider traffic` and `Block untrusted OS MCP traffic` idempotently without duplicate rules on repeated provisioning runs.
- `packages/os/tests/cloudflare-provisioning-contract.test.ts` covers expression generation, env-derived config, fake Rulesets API idempotency, and provisioning integration without calling Cloudflare.

Remaining evidence gap:

- Read-only provider evidence still needs to confirm the deployed Cloudflare zone has the managed OS MCP rules active, ordered correctly, and backed by the intended provider-only `$mcp_allowed_ips` entries.
- The temporary local/dev deny CIDR override remains cleanup debt until `$mcp_allowed_ips` contains provider IPs only.

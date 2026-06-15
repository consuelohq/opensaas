# consuelo-workspace-edge

The workspace-edge Worker is the single edge gateway for workspace hostnames. Public workspace pages are served as site snapshots from Cloudflare Cache API and R2. Connector and hosted service routes continue to use signed proxy behavior.

## Hostname model

Workspace hostnames are the routing boundary. Examples: kokayi.consuelohq.com and openai.consuelohq.com. D1 maps hostnames and path prefixes to route targets. A root path can be a public site snapshot, while connector paths such as /mcp and /traces stay signed connector routes.

## MCP connection auth

Live `/mcp` connector routes require a persistent, scoped, revocable MCP connection credential before the Worker proxies to a local OS connector. The credential is a connected-app grant bound to one Google identity, workspace, device, connector, and capability set. It can survive normal ChatGPT sessions, but rotation, revocation, workspace disablement, or device binding revocation must invalidate it before connector routing.

The MCP OAuth/connect flow is separate from OS device approval. Google proves the user's identity for the MCP connection, then the Worker maps `google:<sub>` to an already approved workspace/device/connector binding in `MCP_APPROVED_CONNECTOR_BINDINGS`. OAuth alone must not approve a device or connector. A successful callback issues a persistent MCP connection credential in `MCP_CONNECTION_CREDENTIALS`; `/mcp/connections`, `/mcp/connections/:id/rotate`, `/mcp/connections/:id/revoke`, and `/mcp/connections/:id/audit` provide the lifecycle surface.

The MCP connection credential is not the local gateway token. A local gateway token is the generated Consuelo OS app token in `security/generated/auth.json` and signs each Caddy-to-Bun request with timestamp, nonce, workspace identity, caller identity, scope, and signature. The MCP connection credential is the edge-facing connected-app credential used before `/mcp` traffic reaches the connector. Edge validation must never replace Bun signed-header verification.

Provider network allowlists use IP addresses or CIDR ranges only. Values such as API keys, bearer tokens, OAuth secrets, or app credentials are invalid policy and fail closed. Provider IP allowlisting is an edge guardrail; OAuth/session/credential validation is the identity boundary.

## Cloudflare configuration

Required bindings and runtime values:

| Name | Kind | Purpose |
| --- | --- | --- |
| `WORKSPACE_ROUTE_REGISTRY` | D1 | Hostname and path route policy. |
| `SITES_SNAPSHOTS` | R2 | Published immutable Sites snapshots. |
| `MCP_CONNECTION_CREDENTIALS` | KV | Hashed persistent MCP connection credential records, indexes, and audit events. |
| `MCP_CONNECTION_STATES` | KV | Short OAuth state records for the MCP connect callback only. |
| `MCP_APPROVED_CONNECTOR_BINDINGS` | KV | Approved Google identity to workspace/device/connector bindings. |
| `CONSUELO_EDGE_SIGNING_SECRET` | Secret | Edge-owned internal proxy signature key. |
| `MCP_GOOGLE_OAUTH_CLIENT_ID` | Secret/env var | Google OAuth client id for MCP connect. |
| `MCP_GOOGLE_OAUTH_CLIENT_SECRET` | Secret | Google OAuth client secret for MCP connect. |
| `MCP_ALLOWED_PROVIDER_CIDRS` | Env var | Optional comma/whitespace separated provider IP/CIDR ranges. |

Cloudflare WAF/IP-list configuration should mirror `MCP_ALLOWED_PROVIDER_CIDRS` for known MCP provider egress networks. The WAF rule must use Cloudflare IP lists or literal CIDR ranges, not API keys or OAuth secrets. Keep the Worker credential checks enabled even when a provider IP list is configured.

## Reserved platform hosts

Wildcard routing must not capture platform services. The router blocks reserved hosts before cache or D1 lookup. Reserved defaults include app, docs, diffs, install, linear, api, www, and legacy sites hostnames under consuelohq.com. The internal hostname remains explicitly routed for internal workspace-edge flows.

## Local authoring and edge publishing

The local OS remains the authoring layer: consuelo.db, artifacts, sites, and local cache. The cloud layer receives only published immutable snapshots. D1 holds the hostname/path/current version pointer, R2 stores immutable HTML and assets, and Cache API serves hot public responses. Public reads should not depend on the user machine.

Sites stay on Cloudflare/R2, but route policy is the authority for whether a workspace hostname root can serve a snapshot. The Worker must resolve `WORKSPACE_ROUTE_REGISTRY` before reading Cache API or R2. Only routes whose target is a site snapshot and whose auth policy is explicitly `public` can be served from cache or R2; private previews and internal content must fail closed until a policy-aware auth path exists.

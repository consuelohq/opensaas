# consuelo-workspace-edge

The workspace-edge Worker is the single edge gateway for workspace hostnames. Public workspace pages are served as site snapshots from Cloudflare Cache API and R2. Connector and hosted service routes continue to use signed proxy behavior.

## Hostname model

Workspace hostnames are the routing boundary. Examples: kokayi.consuelohq.com and openai.consuelohq.com. D1 maps hostnames and path prefixes to route targets. A root path can be a public site snapshot, while connector paths such as /mcp and /traces stay signed connector routes.

## MCP connection auth

Live `/mcp` connector routes require a persistent, scoped, revocable MCP connection credential before the Worker proxies to a local OS connector. The credential is a connected-app grant bound to one Google identity, workspace, device, connector, and capability set. It can survive normal ChatGPT sessions, but rotation, revocation, workspace disablement, or device binding revocation must invalidate it before connector routing.

The MCP connection credential is not the local request proof. After edge validation, the connector/local gateway path still needs per-request signed Consuelo headers with timestamp, nonce, workspace identity, caller identity, scope, and signature. Bun remains the final authorization layer.

Provider network allowlists use IP addresses or CIDR ranges only. Values such as API keys, bearer tokens, OAuth secrets, or app credentials are invalid policy and fail closed. Provider IP allowlisting is an edge guardrail; OAuth/session/credential validation is the identity boundary.

## Reserved platform hosts

Wildcard routing must not capture platform services. The router blocks reserved hosts before cache or D1 lookup. Reserved defaults include app, docs, diffs, install, linear, api, www, and legacy sites hostnames under consuelohq.com. The internal hostname remains explicitly routed for internal workspace-edge flows.

## Local authoring and edge publishing

The local OS remains the authoring layer: consuelo.db, artifacts, sites, and local cache. The cloud layer receives only published immutable snapshots. D1 holds the hostname/path/current version pointer, R2 stores immutable HTML and assets, and Cache API serves hot public responses. Public reads should not depend on the user machine.

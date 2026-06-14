# consuelo-workspace-edge

The workspace-edge Worker is the single edge gateway for workspace hostnames. Public workspace pages are served as site snapshots from Cloudflare Cache API and R2. Connector and hosted service routes continue to use signed proxy behavior.

## Hostname model

Workspace hostnames are the routing boundary. Examples: kokayi.consuelohq.com and openai.consuelohq.com. D1 maps hostnames and path prefixes to route targets. A root path can be a public site snapshot, while connector paths such as /mcp and /traces stay signed connector routes.

## Reserved platform hosts

Wildcard routing must not capture platform services. The router blocks reserved hosts before cache or D1 lookup. Reserved defaults include app, docs, diffs, install, linear, api, www, and legacy sites hostnames under consuelohq.com. The internal hostname remains explicitly routed for internal workspace-edge flows.

## Local authoring and edge publishing

The local OS remains the authoring layer: consuelo.db, artifacts, sites, and local cache. The cloud layer receives only published immutable snapshots. D1 holds the hostname/path/current version pointer, R2 stores immutable HTML and assets, and Cache API serves hot public responses. Public reads should not depend on the user machine.

# Workspace node registry and routing

## Authority boundary

The OS device authority Durable Object is the source of truth for workspace membership and node identity. It owns:

- the account-to-workspace mapping;
- globally unique node IDs and their bound Ed25519 public-key thumbprints;
- home/member role, display name, platform, architecture, channel, and capabilities;
- the explicit default node ID;
- active/revoked state and deterministic heartbeat presence;
- consumed heartbeat nonces used for replay prevention.

The workspace-edge D1 registry is the source of truth only for routable connector targets. One workspace hostname record may contain multiple node targets, each with a node ID, connector ID, connector status, tunnel origin, revocation state, last-seen timestamp, and heartbeat TTL. The D1 record also mirrors the selected default node so edge routing does not need to query the Durable Object on each request.

The two stores intentionally do not duplicate authority:

- Durable Object decides whether a node identity exists, belongs to the account, may be administered, and may emit a heartbeat.
- D1 decides which already-authorized connector target receives a workspace request.
- A node registration or management action updates the Durable Object first and then updates its D1 routing projection.
- Existing single-connector D1 records remain readable. Multi-node routing activates only when `nodeTargets` are present.

No new D1 migration is required. Multiple connector rows are already supported by `workspace_connectors`; the per-host node routing projection is stored in the existing `record_json` field.

## Registration and identity rules

The first approved machine remains the `home` node and initial default. A later machine for the same authenticated account reuses the existing workspace hostname and receives a distinct `member` node and connector identity. Adding a member does not replace the default.

A reconnect is accepted only when the presented node ID is bound to the same public key. Reusing a node ID with another key, across either the same account or a different account, fails closed. Revoked node identities cannot reconnect.

## Presence

Nodes send the exact JSON heartbeat body signed with their registered Ed25519 key in `x-consuelo-node-signature`. The body contains `workspaceId`, `nodeId`, `timestamp`, `nonce`, `connectorStatus`, `capabilities`, and an optional canonical `agents` array. Current installers re-inspect local agent configuration on each one-shot heartbeat run and report only identifiers whose MCP connection is verified. Older heartbeat clients may omit `agents`, which preserves the prior reported set; an explicit empty array clears it.

The normal installer persists the node signing material only in the private generated-security directory, writes a one-shot heartbeat client into the installed OS package, and creates a user LaunchAgent with `RunAtLoad` plus a 30-second `StartInterval`. The standard daemon installer/uninstaller owns that generated LaunchAgent alongside the node's cloudflared connector. The signing key is never embedded in the plist, command line, URL, response, or log output.

Heartbeats are accepted only when:

- the node exists and belongs to the supplied workspace ID;
- the node is active;
- the timestamp is within five minutes of authority time;
- the signature verifies against the stored public key;
- the nonce has not already been consumed.

Presence is deterministic from server time and the stored last-seen timestamp:

- `online`: age is at most 60 seconds and connector status is connected;
- `stale`: age is greater than 60 seconds and at most 180 seconds;
- `offline`: age is greater than 180 seconds, the connector is disconnected, or the node is revoked.

Only `online` targets are routable.

## Routing

Workspace hostname resolution and node selection are separate steps. The hostname identifies the workspace route record. The optional `x-consuelo-node-id` header selects a node within that workspace.

- Explicit request: route to the requested active, online node.
- Untargeted request: route to the explicit default node.
- Missing or foreign node: return `WORKSPACE_NODE_NOT_FOUND`.
- Revoked node: return `WORKSPACE_NODE_REVOKED`.
- Offline or stale selected node: return `WORKSPACE_NODE_OFFLINE`.

There is no automatic fallback to another machine. In particular, an unavailable default produces a deterministic 503 response even when another member is online. Central MCP proxying and direct workspace-edge proxying use the same selection contract and replace untrusted routing headers with the resolved node and connector IDs.

OAuth discovery is intentionally independent of connector presence. The protected-resource and authorization-server metadata endpoints remain available when the selected/default node is stale or offline so clients can authenticate and recover. Normal MCP and application routes still require an active online node and continue to fail with `WORKSPACE_NODE_OFFLINE`.

## Protected management API

All management operations require an OAuth bearer token with `workspace:read` and enforce the token's account/workspace binding.

- `GET /workspace/nodes`
- `POST /workspace/nodes/default`
- `PATCH /workspace/nodes/:nodeId`
- `POST /workspace/nodes/:nodeId/revoke`
- `POST /workspace/nodes/heartbeat` (signed node identity rather than user OAuth)

The list response is safe for product UI consumption. It includes only canonical agent identifiers alongside existing safe node metadata and omits public-key JWKs, tunnel origins, local service paths, configuration contents, credentials, and tokens. The public `GET /workspace/agents` projection is derived from the same node records and heartbeat TTL, returning `online`, `stale`, `offline`, or `never_reported`. The legacy bootstrap-token write remains a compatibility path for older installers but does not fabricate heartbeat freshness.

Worker 07 can use the compact top-level fields directly:

```json
{
  "workspaceId": "workspace_...",
  "currentNodeId": "node_...",
  "currentNode": {},
  "defaultNodeId": "node_...",
  "nodeCount": 2,
  "presence": {
    "online": 2,
    "stale": 0,
    "offline": 0
  },
  "nodes": []
}
```

## Canonical CLI

The management API is exposed through one package command. Credentials are accepted only through the environment and are never placed in a URL or response.

```bash
export CONSUELO_OS_WORKSPACE_TOKEN='<oauth-workspace-token>'
bun run --cwd packages/os workspace:nodes -- list --current-node node-home
bun run --cwd packages/os workspace:nodes -- default node-member
bun run --cwd packages/os workspace:nodes -- rename node-member 'Travel Mac'
bun run --cwd packages/os workspace:nodes -- revoke node-member
```

Set `CONSUELO_OS_AUTHORITY_ORIGIN` only when targeting a registered non-production authority. The default is `https://os.consuelohq.com`.

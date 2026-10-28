# Worker 25: Multi-Node Registry, Presence, And Routing

## Mandatory context

Bootstrap with `os.get_steering()`, then read `/Users/kokayi/Dev/opensaas/packages/os/plans/consuelo-os-foundation/plan.md` and this brief in full. Use `os.call` with one task session from `stream/os-web`. Never fall back to the old workspace connector or inspect a different computer after an OS error.

## Mission

Finish the server-backed multi-node model so one verified account can install the same workspace on multiple computers, see each node's real state, preserve a stable home/default node, and route explicitly without the latest install replacing another node.

## Current behavior to verify

- Device authority persists `AccountWorkspace` and `WorkspaceNode` records.
- The first approved node is labeled `home`; later nodes are labeled `member`.
- Install sends node ID and node name and persists a local node identity.
- The store supports point lookup by account and node but no authenticated workspace-node listing.
- Node records have timestamps but no signed heartbeat, TTL presence, capability summary, revoke state, or connector health state.
- Workspace route provisioning currently materializes one connector target per workspace route, so another node may replace the existing target.

## Required design

Define one authoritative node record with safe server-visible fields:

```text
workspaceId
nodeId
displayName
role: home | member
platform
architecture
channel
connectorId
capabilities summary
createdAt
lastSeenAt
presence: online | offline | stale
state: active | revoked
publicKeyThumbprint
```

Private keys, bearer tokens, tunnel credentials, raw environment values, local paths, DB contents, and logs remain node-local.

## Required behavior

1. Same verified account resolves its existing workspace before workspace naming.
2. A fresh machine with no local node ID receives a new stable node identity.
3. Reinstall on the same machine reconnects the same node when its valid local identity is present.
4. The first node remains home/default until an authenticated explicit change.
5. A later node install cannot overwrite the home node's connector route.
6. Each node has a distinct connector identity and tunnel route.
7. Signed heartbeats update presence through a bounded TTL; stopping or powering off a machine becomes offline/stale.
8. Authenticated workspace members can list safe node metadata, select a default node, rename a node, and revoke a node.
9. MCP/tool calls can name an explicit node. Untargeted calls use the current default.
10. An unavailable default returns an explicit node-offline error. It never silently executes on another computer.
11. Revocation invalidates node connector access without deleting the workspace or other nodes.

## Storage and routing constraints

- Choose a server-side storage model that supports atomic membership checks, list-by-workspace, unique node IDs, presence updates, and revocation. Document the Durable Object/D1 boundary rather than adding two competing authorities.
- Route records must support multiple node connector targets or a separate node-target registry. Workspace hostname routing and node routing are separate decisions.
- Heartbeats and route updates are authenticated by node identity and connector signing; IP address alone is never node identity.
- Presence updates are bounded and inexpensive. Do not write on every tool token or stream chunk.

## Product surfaces

- Add typed safe node APIs for settings and the future native app.
- Add compact current/default-node and node-count/presence summary to the contract consumed by Worker 07.
- Add discoverable OS operations such as node list/status/select/rename/revoke using the canonical tool/CLI model.
- Keep multi-node administration OAuth/workspace protected.

## Tests

- First account install creates one home/default node.
- Same account on a second fresh identity creates a member node in the same workspace.
- Reinstall with a valid node identity reconnects instead of duplicating.
- Malicious reuse of another node ID with a different key is rejected.
- Two connectors coexist and route to their own fixture services.
- Second-node provisioning does not replace the default route.
- Explicit call reaches the requested node.
- Untargeted call reaches the default node.
- Offline default fails without cross-node fallback.
- Heartbeat TTL transitions online to stale/offline deterministically.
- Revoked node cannot heartbeat, route, or call.
- Cross-workspace listing and targeting are rejected.
- Safe node response/redaction contract contains no credentials or sensitive local data.

## Real-machine acceptance checkpoint

Workers must not install or update either real Mac. After automated tests pass:

1. Stop and give Ko the exact normal install command for the MacBook Air using the same Google account as the Mac Mini.
2. State the expected browser, terminal, and node-list results before Ko runs it.
3. After Ko confirms completion, perform read-only validation that two distinct nodes exist, the original home/default is unchanged, and powered-off state is reported correctly.

## Acceptance gates

- Multiple nodes are enumerable and independently routable.
- The existing home node is never implicitly replaced.
- Presence distinguishes offline hardware from provisioning failure.
- No route or tool silently crosses machines.
- Node management is authenticated, redacted, and revocable.
- Automated two-node tests pass before the real-Mac checkpoint.

## Review and completion

Request CodeRabbit, then run the approved Grok 4.5 review with the master plan, this brief, exact diff, and test results. Render the prompt to the Git-ignored `packages/os/.tmp-reviews/<task>/grok-prompt.md`, post the structured review, inline findings, and top-level summary to the task PR, verify every finding, post each disposition to the PR, and remove `packages/os/.tmp-reviews/<task>/` after posting. GitHub is the durable review record. Include dispositions, trace IDs, migrations, routing proof, and the Ko checkpoint command in the workpad.

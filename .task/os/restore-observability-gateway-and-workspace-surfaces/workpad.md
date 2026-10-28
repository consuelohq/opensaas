# restore observability gateway and workspace surfaces

branch: `task/os/restore-observability-gateway-and-workspace-surfaces`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/1792
started: 2026-08-05

## approved scope

- Restore the authenticated Cloudflare edge-to-node gateway data plane for Traces, Configuration, Environments, and Secrets metadata.
- Remove legacy hard-coded launcher ownership and keep workspace product navigation on the authenticated workspace hostname.
- Restore the existing Astro Observability -> Traces product experience instead of designing a replacement.
- Preserve fail-closed workspace and node isolation. Never return or reveal credential values.
- Reconcile existing enrolled nodes automatically; do not require every current user to enroll again.

## acceptance criteria

- [x] Browser workspace-session requests to `/gateway/*` proxy to the selected online OS node instead of returning a service descriptor.
- [x] Edge dispatch preserves method, query, request body, JSON responses, and trace event streams.
- [x] The edge signs each node request with a node-scoped secret and the node verifies identity, path, body digest, freshness, and nonce replay.
- [x] Missing, revoked, stale, offline, disconnected, unauthenticated, or cross-workspace/node requests fail closed before local data access.
- [x] Existing nodes receive and persist their node-scoped edge secret through their already-signed heartbeat flow.
- [x] Configuration and Environments use authenticated same-origin gateway routes.
- [x] Secrets lists metadata only for the signed workspace/node, with no value, reveal, or write route.
- [x] Launcher links resolve to the current workspace host and do not contain `sites.consuelohq.com`.
- [x] The server-rendered local-agent list survives a transient hosted status failure.
- [x] Observability materializes the existing Traces cockpit with recent, summary, and event-stream gateway transports.
- [x] `/observability`, `/observability/traces`, `/traces`, `/tracing`, and the temporary legacy alias share one immutable traces snapshot.
- [x] No browser-facing page calls localhost, a tailnet address, a connector origin, or a third-party runtime script.

## implementation

### authenticated gateway dispatch

- Extended D1 route resolution to bind gateway-service routes to the requested/default online node.
- Replaced the edge route-descriptor response with an actual proxy request to the selected connector origin.
- Added a sanitized gateway proxy header allowlist so browser cookies and unrelated headers never cross into the node.
- Added explicit workspace-session auth to browser gateway routes and kept unauthenticated requests out of the connector path.

### node-scoped edge authentication

The worker-wide authority secret is not copied to customer nodes. Both trusted workers derive a per-node secret from:

- workspace ID;
- node ID;
- connector ID; and
- the existing `WORKSPACE_EDGE_INTERNAL_SIGNING_SECRET`.

The signed request covers protocol version, method, full path and query, workspace, node, connector, surface, SHA-256 body digest, timestamp, and nonce. The local node maintains a short replay window. The compatibility machine-token protocol remains separate and is selected independently.

New enrollment receives the derived secret in the device-bound approval result. Existing enrollment receives the same derived secret through the node's signed heartbeat response; the heartbeat process atomically and idempotently reconciles it into the owner-only generated auth file. A master-secret rotation is therefore repaired automatically on the next heartbeat.

### configuration and Secrets

- Kept the existing Configuration and Environment interfaces and connected their gateway requests to the node.
- Added `GET /gateway/secrets/bindings` as a metadata-only Hono route.
- Added the Secrets gateway adapter and workspace route.
- Replaced the placeholder Secrets page with a same-origin hydrated binding table.
- Deliberately omitted values, ciphertext, fingerprints, reveal controls, and write endpoints.

### launcher and Observability

- Consolidated product navigation onto same-origin/workspace-host routes.
- Removed the public Astro launcher's hard-coded `sites.consuelohq.com` targets.
- Preserved server-rendered local-agent state during status-probe failures.
- Ported the existing Observability -> Traces cockpit, KPI summary, search/filtering, trace detail, raw payload panes, pagination, stable selection, and SSE/polling behavior.
- Removed the remote GSAP runtime and used the browser Web Animations API.

## rollout order

1. Deploy the device authority and release/update the OS node runtime.
2. Wait for signed node heartbeats to reconcile node-scoped edge credentials and refresh D1 node presence.
3. Publish the launcher, configuration, secrets, and Observability snapshots plus updated route seed.
4. Deploy the workspace edge proxy.
5. Verify one authenticated workspace end to end, then purge/version-bust prior snapshots if their hashes remain active.

This order prevents a gateway cutover before existing nodes can authenticate the new edge protocol.

## validation evidence

- Focused OS suite: 24 files, 239 tests passed — `trc_b346f7cb8611`.
- Full edge-to-real-Hono-node bridge: Environments write/read, Secrets metadata, and Traces read passed — `trc_5998667ac526`.
- Workspace script syntax/type check passed — `trc_7962fc58f17d`.
- Website Astro build passed with 0 errors and 0 warnings — `trc_8e8664526631`.
- Strict task-owned review passed with zero findings — `trc_35d95ffd556d`.
- Full publish-valid verify passed, including package test selection and DB guard — `trc_f3500dfa7707`.
- Workspace edge Wrangler dry-run passed after final heartbeat/auth changes — `trc_a9a007c7f49e`.
- Device authority Wrangler dry-run passed after final heartbeat/auth changes — `trc_9133025d1834`.
- Stream/os synchronized with main and pushed before publication — `trc_db9370a9623c`.
- `git diff --check` passed — `trc_a62d29ff2295`.

The focused suite prints an intentional malformed-provenance stack from a passing fail-closed install-state test; the test command exits 0.

## key decisions

- Cloudflare remains the browser boundary; browsers never receive local/tunnel addresses.
- The workspace session authenticates the person. A distinct node-scoped signature authenticates the edge to the selected computer.
- A compromised node cannot derive another workspace or node's edge request secret.
- Secrets are metadata-only in the UI. Credential values leave the sealed store only through brokered operations.
- `Observability` is the surface, `Traces` is the current module, and `trace-burn-intelligence` is migration-only terminology.
- Static shells may be cacheable; all private data routes are session-authenticated and `no-store`.

## files changed

- Cloudflare device authority grant and heartbeat routes.
- Cloudflare workspace edge handler and router.
- D1 node/route resolution and route seeding.
- Node security gateway, heartbeat client/script, device login/bootstrap, and install reconciliation.
- Configuration/Secrets UI, Secrets Hono route, and service adapter.
- Launcher source and generated launcher.
- Observability Traces source, site materialization, route aliases, and edge publisher.
- Focused unit, integration, security, browser-contract, install, and end-to-end tests.

## deployment status

Implementation and local validation are complete. No production worker, D1, R2, node, or snapshot mutation has been performed from this task yet.

## workspace-owned: validation evidence

- Focused OS suite: 24 files, 239 tests passed — `trc_b346f7cb8611`.
- Full edge-to-real-Hono-node bridge: Environments write/read, Secrets metadata, and Traces read passed — `trc_d8efb6df8217`.
- Workspace script syntax/type check passed — `trc_7962fc58f17d`.
- Website Astro build passed with 0 errors and 0 warnings — `trc_8e8664526631`.
- Workspace edge Wrangler dry-run passed — `trc_ea38f5bc8df7`.
- Device authority Wrangler dry-run passed — `trc_996d38917846`.
- `git diff --check` passed — `trc_59edea40e652`.
The focused suite prints an intentional malformed-provenance stack from a passing fail-closed install-state test; the test command exits 0.
- 2026-08-06 00:40:06 `checkFiles`: failed — COMMAND_FAILED
- 2026-08-06 00:40:12 `checkFiles`: passed — OK
- 2026-08-06 00:40:46 `review.run`: passed — OK
- 2026-08-06 00:40:47 `review.run`: passed — OK
- 2026-08-06 00:41:16 `checkFiles`: passed — OK
- 2026-08-06 00:42:02 `review.run`: passed — OK
- 2026-08-06 00:48:37 `verify`: passed — OK
- 2026-08-06 00:48:37 `verify`: passed — OK
- 2026-08-06 00:48:38 `verify`: passed — OK
- 2026-08-06 00:48:38 `verify`: passed — OK

## workspace-owned: files read

- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`


## discovery

- Runtime identity: locate authoritative workspace/node sources and current steering projection.
- Routing: trace os.call -> central MCP proxy -> workspace node selection/default behavior.
- Contract: locate os.call schema/types and backward-compatibility tests.
- Observability: locate current trace request context fields and node-related coverage.
- Cloud authority: confirm existing node registry/default-node APIs are reused, not duplicated.

## workspace-owned: files read

- `packages/os/cloudflare/os-device-authority/src/routes/workspace-nodes.ts`
- `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- `packages/os/cloudflare/os-device-authority/src/services/nodes.ts`
- `packages/os/cloudflare/os-device-authority/src/types.ts`
- `packages/os/package.json`
- `packages/os/scripts/code-run.ts`
- `packages/os/scripts/lib/codemode/tools/index.ts`
- `packages/os/scripts/lib/consuelo-home.ts`
- `packages/os/scripts/lib/install-state.ts`
- `packages/os/scripts/lib/mcp-gateway.ts`
- `packages/os/scripts/lib/security-gateway.ts`
- `packages/os/scripts/lib/trace-persistence.ts`
- `packages/os/scripts/lib/types.ts`
- `packages/os/scripts/lib/workspace-edge-node-auth.ts`
- `packages/os/scripts/os.ts`
- `packages/os/scripts/server/middleware/auth.ts`
- `packages/os/scripts/server/routes/mcp.ts`
- `packages/os/scripts/server/security/authenticated-principal.ts`
- `packages/os/scripts/server/services/os-runtime.ts`
- `packages/os/scripts/server/services/steering-service.ts`
- `packages/os/tests/fixtures/trace-persistence-runtime.ts`
- `packages/os/tests/mcp-gateway-action-scopes.test.ts`
- `packages/os/tests/mcp-gateway.test.ts`
- `packages/os/tests/os-get-steering-trace.test.ts`
- `packages/os/tests/os-raw-steering.test.ts`
- `packages/os/tests/trace-persistence.test.ts`
- `packages/os/tests/traces-hono-routes.test.ts`
- `packages/os/tests/workspace-node-registry-routing.test.ts`
- `packages/os/tools/codemode/handler.ts`

## acceptance criteria

- Steering runtime identity reads authoritative installed workspace/node config before env fallbacks and does not advertise stale `userId: null` as identity.
- Steering exposes current node, workspace default node, and a minimal safe available-node directory when central routing context is present; absence of central inventory never breaks steering.
- Public MCP `call` accepts optional top-level `nodeId`; the selector is routing metadata and is never injected into the selected tool input.
- Central MCP routing uses body `nodeId` when present and the workspace default when omitted; conflicting body/header selectors fail closed; foreign/offline/revoked node behavior stays authoritative in the existing registry.
- Existing auth, scope, Origin, dangerous-material, modern/legacy MCP, and default routing behavior do not regress.
- Existing tracing gains enough node-routing metadata for the later observability UI without creating a second tracing system.
- No Nodes UI, task affinity, cloud pricing/provisioning, or live node deployment in this branch.

## plan

1. Add failing tests for steering identity, MCP `nodeId` parsing/drop behavior, central body/default routing, selector mismatch, and routing trace metadata.
2. Introduce a small shared node-routing envelope parser/serializer so the proxy and local route do not each invent body/header semantics.
3. Replace env-only steering identity with installed config plus trusted request routing context, preserving safe fallback behavior.
4. Extend the public `call` descriptor and parser with optional `nodeId`, dropping it before facade execution.
5. Teach the central MCP proxy to resolve body `nodeId`, emit trusted node context for steering/traces, and preserve default routing when omitted.
6. Add node routing fields to existing gateway trace input.
7. Run focused tests, security regressions, diff review, strict review, and verify before publishing.

## Test-first contract

Red tests to establish before production edits:

- `os-get-steering-trace.test.ts`: installed config wins over missing/stale env identity; current node appears; `userId` is not part of runtime identity.
- `mcp-gateway.test.ts`: public `call` advertises/accepts `nodeId` and strips it before `executeFacadeTool`.
- `workspace-node-registry-routing.test.ts`: central MCP call body targets an explicit workspace node; omission uses default; body/header mismatch fails before upstream fetch; unknown/foreign node still fails closed.
- Gateway trace coverage: trusted routed requests record resolved node and routing source without exposing secrets.

Baseline behavior must be captured before edits. If a target test contains a destructive command literal, do not execute that file; switch to static/type validation or a narrower safe test target.


- 2026-08-12 04:34:57 apply-patch: `packages/os/tests/os-get-steering-trace.test.ts`
- 2026-08-12 04:35:16 apply-patch: `packages/os/tests/os-get-steering-trace.test.ts`
- 2026-08-12 04:35:16 apply-patch: `packages/os/tests/mcp-gateway.test.ts`
- 2026-08-12 04:35:16 apply-patch: `packages/os/tests/workspace-node-registry-routing.test.ts`

- 2026-08-12 04:37:17 apply-patch: `packages/os/scripts/lib/mcp-node-routing.ts`
- 2026-08-12 04:37:17 apply-patch: `packages/os/scripts/lib/mcp-gateway.ts`
- 2026-08-12 04:37:17 apply-patch: `packages/os/scripts/os.ts`
- 2026-08-12 04:37:17 apply-patch: `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`

- 2026-08-12 04:41:05 apply-patch: `packages/os/tests/workspace-node-registry-routing.test.ts`
- 2026-08-12 04:41:05 apply-patch: `packages/os/tests/os-get-steering-trace.test.ts`
- 2026-08-12 04:41:05 apply-patch: `packages/os/tests/fixtures/trace-persistence-runtime.ts`
- 2026-08-12 04:41:05 apply-patch: `packages/os/tests/trace-persistence.test.ts`

- 2026-08-12 04:43:03 apply-patch: `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- 2026-08-12 04:43:03 apply-patch: `packages/os/scripts/os.ts`
- 2026-08-12 04:43:03 apply-patch: `packages/os/scripts/server/services/steering-service.ts`
- 2026-08-12 04:43:03 apply-patch: `packages/os/scripts/lib/trace-persistence.ts`
- 2026-08-12 04:43:03 apply-patch: `packages/os/scripts/server/routes/mcp.ts`

- 2026-08-12 04:43:47 apply-patch: `packages/os/tests/mcp-gateway.test.ts`

## workspace-owned: validation evidence

- 2026-08-12 04:45:39 `review.run`: passed — OK
- 2026-08-12 04:45:52 `review.run`: passed — OK
- 2026-08-12 04:47 targeted regression packet: 24 focused tests passed across MCP scope authorization, node routing, steering identity, and trace persistence.
- 2026-08-12 04:48 post-hardening packet: 5 focused node-routing/steering tests passed.
- 2026-08-12 04:49 `review.run --base origin/main --strict --no-tests`: 12 changed code/test files, 0 findings.
- 2026-08-12 04:49 `verify --base origin/main`: passed; `publishValid: true`; 0 DB risks; 0 blocking findings.

## implementation summary

- Steering runtime identity now prefers authoritative installed workspace config and local node identity instead of stale process env values; the old `userId` runtime field is no longer emitted.
- Central `get_steering` requests receive a bounded safe node directory with current/default node and presence metadata. Client-supplied routing-context headers are stripped and replaced centrally; local steering only consumes context matching the authenticated workspace, resolved node, and route source.
- Public MCP `call` accepts optional top-level `nodeId`. The selector is used by central routing and is deliberately stripped before nested facade-tool execution. Omission preserves existing workspace-default routing.
- Central MCP routing resolves body `nodeId`, retains the legacy explicit-node header for compatibility, and rejects body/header disagreement before upstream execution.
- Existing authentication traces now include requested/resolved/default node IDs and route source for the later observability UI.

## boundaries / follow-up

- No Nodes UI, default-node UI control, task/resource node affinity, pricing/provisioning, or live cloud/Mac deployment is included here.
- Review identified non-blocking public MCP and trace documentation opportunities. Trace documentation should land with the later observability surface; public MCP docs can be updated when the node-routing contract is documented for external consumers.
- Broad destructive-guard suites were not run manually; final validation used inspected focused authorization/routing tests plus the canonical `review.run` and `verify` gates.
- 2026-08-12 04:48:37 apply-patch: `packages/os/cloudflare/os-device-authority/src/services/mcp-proxy.ts`
- 2026-08-12 04:48:37 apply-patch: `packages/os/scripts/lib/mcp-node-routing.ts`
- 2026-08-12 04:48:37 apply-patch: `packages/os/scripts/server/routes/mcp.ts`
- 2026-08-12 04:49:04 `review.run`: passed — OK
- 2026-08-12 04:49:20 `verify`: passed — OK

- 2026-08-12 04:49:43 apply-patch: `.task/os/node-identity-and-routing/workpad.md`
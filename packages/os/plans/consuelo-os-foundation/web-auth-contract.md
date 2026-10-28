# OS web authentication contract

Worker 13 characterization for Worker 14. This document describes the behavior present on 2026-07-22 and the narrow implementation boundary for universal login. It does not authorize production routing, WAF, provider, or lifecycle changes.

## Current authority surface

The device authority Hono app registers 21 routes. Most are registered with `app.all`, then reject unsupported methods in their handlers. Exact status bodies remain covered by the existing worker tests.

| Method | Path | Current access and behavior | Store / dependency | Owner |
| --- | --- | --- | --- | --- |
| ALL | `/` | Public service descriptor; no account or workspace data | none | existing |
| ALL | `/health` | Public health response | none | existing |
| ALL | `/.well-known/oauth-authorization-server` | Public MCP OAuth metadata | none | existing |
| ALL | `/.well-known/oauth-protected-resource` | Public bearer-resource metadata | none | existing |
| ALL | `/.well-known/oauth-protected-resource/mcp` | Public bearer-resource metadata alias | none | existing |
| ALL | `/login/device` | Public device approval page | grant store | existing |
| ALL | `/login/device/code` | Device-code issue endpoint; form POST contract | grant store | existing |
| ALL | `/login/device/workspace` | Workspace naming step after approval | grant store, route registry/provisioner | existing |
| ALL | `/login/device/approve` | Approval assertion path | grant store | existing |
| ALL | `/login/oauth/access_token` | Device grant polling/token response | grant store | existing |
| ALL | `/login/google/start` | Google OAuth start for device approval | OAuth state + grant store | existing |
| ALL | `/login/google/callback` | Google callback; also dispatches legacy MCP callback state | OAuth state, grant/account/node stores, route registry/provisioner | existing |
| ALL | `/oauth/authorize` | ChatGPT MCP authorization code + PKCE S256 | MCP OAuth state | existing |
| ALL | `/oauth/google/callback` | MCP Google callback | MCP OAuth state/code + account workspace | existing |
| ALL | `/oauth/token` | MCP authorization-code and refresh-token exchange | MCP code/access/refresh stores | existing |
| ALL | `/oauth/revoke` | MCP token revocation | MCP access/refresh stores | existing |
| ALL | `/oauth/introspect` | MCP token introspection | MCP access-token store | existing |
| ALL | `/mcp` | OAuth bearer-protected connector proxy | MCP token store, D1 route registry, internal HMAC signing secret | existing |
| ALL | `/mcp/*` | Same contract for MCP subpaths | same | existing |
| GET | `/workspace/agents` | Public, sanitized aggregate status by validated workspace host; no node credentials | workspace-agent status store | existing |
| POST | `/workspace/agents` | Node-bootstrap bearer write; credential expires and is rejected on mismatch | node-bootstrap + workspace-agent status stores | existing |

The workspace-edge worker is a separate fail-closed host/path router backed by D1 and optional R2 snapshots. It must not become an authentication authority. Connector forwarding continues to strip inbound internal headers, resolve the workspace route from D1, add trusted workspace/connector headers, and sign the request with the existing internal HMAC contract.

## Current account, workspace, and node model

`AccountWorkspace` is currently one record per Google account (`aw:<accountId>`). That is a single-workspace lookup, not a general membership table. The first registered node becomes `home`; later new node IDs become `member`. A known node reconnects with its previous role. Repeat installation for an account with an existing workspace reuses that workspace before workspace naming and then registers/reconnects the node.

Worker 14 must introduce a membership lookup abstraction that can represent zero, one, or multiple workspaces without silently redefining the existing `AccountWorkspace` persistence contract. Until a durable multi-membership schema is approved, adapter output must be deterministic and must not expose workspace identifiers or names before Google authentication succeeds.

## Universal login route contract

Target authority host: `https://os.consuelohq.com`.

| Method | Path | Contract | Owner |
| --- | --- | --- | --- |
| GET | `/` | Static sanitized pre-auth preview only. No membership, node, connector, route-registry, or protected workspace data. | Worker 14 |
| GET | `/login/google/start` | Preserve state validation and Google configuration failures. Add only a typed web-login purpose and safe local return path. | Worker 14, preserving existing |
| GET | `/login/google/callback` | Preserve device and MCP state dispatch. Web-login state resolves memberships after identity validation. | Worker 14, preserving existing |
| GET | `/auth/workspaces` | Authenticated authority-session workspace chooser for multiple memberships. Zero memberships show onboarding; one membership redirects directly. | Worker 14 |
| POST | `/auth/handoff` | CSRF-protected issuance of a short-lived, opaque, single-use, workspace-audience-bound handoff. | Worker 14 |
| GET | `/auth/consume` | Workspace-host endpoint only. Atomically consumes a handoff whose audience equals the request host, establishes a host-only session, then redirects to the sanitized return path. | Worker 14 |
| POST | `/auth/logout` | CSRF-protected deletion of the current host-only workspace session. | Worker 14 |

## Handoff and session schema

Opaque handoff persistence fields:

```ts
type WorkspaceLoginHandoff = {
  tokenHash: string;
  accountId: string;
  workspaceId: string;
  workspaceHost: string; // audience
  returnPath: string;    // local path only
  issuedAt: number;
  expiresAt: number;     // recommended <= 60 seconds
  consumedAt?: number;   // atomic single-use marker
};
```

The browser receives only the opaque token. Consumption returns one generic `invalid_handoff` result for unknown, expired, consumed, or wrong-audience tokens. This avoids token-state and membership oracles. Wrong-audience attempts must not create a session. Atomic consumption is required in the durable implementation.

Workspace session cookie:

```text
__Host-consuelo_os_session=<opaque>; Path=/; Secure; HttpOnly; SameSite=Lax
```

No `Domain` attribute is permitted. Authority and workspace sessions are separate host-scoped credentials. Session rotation is required after handoff consumption and privilege changes. Logout clears only the current host credential unless an explicit authority logout flow is added later.

## Threat model and required failures

- OAuth state is random, purpose-bound, expiring, and one-time. MCP PKCE S256, client allowlist, redirect-prefix validation, resource validation, requested state echo, code expiry, refresh rotation, introspection, and revocation remain unchanged.
- Web login must use an OAuth nonce in addition to state if an ID-token path is introduced. Existing token-info audience validation remains mandatory.
- Return paths accept only same-host absolute paths beginning with one `/`; schemes, protocol-relative forms, backslashes, and malformed values fall back to `/`.
- Handoffs are opaque, short-lived, single-use, audience-bound to the exact workspace host, and consumed atomically. All invalid cases use the same response shape.
- State-changing authority/session endpoints require origin validation plus a CSRF token bound to the authenticated session. GET endpoints do not mutate credentials except the one-time `/auth/consume` capability exchange.
- Pre-auth pages and error responses reveal no membership count, workspace identifier, hostname, node state, connector state, or D1 route result.
- Workspace cookies are host-only. Broad `.consuelohq.com` cookies are forbidden.
- `/mcp` keeps the existing `WWW-Authenticate` bearer challenge, scope/resource checks, D1 resolution, trusted-header replacement, and internal HMAC signature.
- Device-code installation, ChatGPT MCP OAuth, connector bootstrap, first-node `home`, later-node `member`, reconnect, and repeat-install existing-workspace behavior are regression contracts.

## Executable contract and implementation ownership

`security/web-auth-contract.ts` is a pure seam for return-path normalization, zero/one/multiple membership outcomes, host-only cookie serialization, route ownership, and deterministic handoff behavior. It registers no routes and changes no production behavior.

Worker 14 must implement:

1. Durable authority-session, membership, CSRF, and handoff stores with atomic consume semantics.
2. Hono route registration and method/status/header behavior for the universal-login routes.
3. Google web-login state/nonce integration without changing device or MCP callback dispatch.
4. Workspace-host session middleware and protected-page gating.
5. D1 migrations only after schema review, including expiry indexes and replay-safe consume operations.
6. Behavioral tests against the actual Hono handler for public/protected matrices, zero/one/multiple memberships, every invalid handoff case, cookie flags, safe returns, CSRF, no pre-auth leakage, and repeat installation.

Worker 14 must not alter provider lifecycle, live WAF, connector HMAC, MCP OAuth, device-code paths, or platform provisioning outside the minimal route integration required by these tests.

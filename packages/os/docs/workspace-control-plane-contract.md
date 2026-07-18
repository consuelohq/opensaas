# Workspace Control-Plane Contract

Status: approved architecture contract  
Last reviewed: 2026-07-16

This document defines the product and engineering contract for the Consuelo OS workspace launcher, configuration surfaces, environments, credentials, nodes, and private control-plane data.

It is intentionally narrower than the full OS security architecture. The existing device, connector, OAuth, edge-signing, replay, scope, and approval systems remain authoritative. This contract defines the visibility and configuration layer that sits above them.

## Product model

Every managed workspace receives one hostname and a stable set of routes:

```text
https://{workspace}.consuelohq.com/
  Public workspace launcher

https://{workspace}.consuelohq.com/configuration
  Workspace configuration control plane for Tools, Environments, and Secrets

https://{workspace}.consuelohq.com/observability
  Live traces and observability product

https://{workspace}.consuelohq.com/diffs
  Code-review product

https://{workspace}.consuelohq.com/artifacts
  Workspace artifacts

https://{workspace}.consuelohq.com/mcp
  Workspace agent ingress
```

`/configuration` is the canonical user-facing control-plane route. `/settings` is a compatibility redirect only. Canonical private APIs use `/gateway/configuration/*`; `/gateway/settings/*` remains a temporary compatibility alias.

Route labels are capitalized in the UI. Route paths remain lowercase.

## Launcher information architecture

The launcher is a small public directory for the workspace. Configuration is the final section.

```text
Connect to your cloud agents
  ChatGPT

Sites
  Go to market
  Artifacts
  Observability
  Code review

Guides and Tips
  Documentation

Writing
  Decision loops

Configuration
  Tools
  Environments
  Secrets
```

Product navigation must use canonical workspace-relative routes where the destination belongs to the workspace. `sites.consuelohq.com` is a legacy internal host and must not be the durable route source for customer launchers.

This contract does not redesign Observability, Code review, Artifacts, Go to market, or Decision loops. Those surfaces keep their own implementation schedules.

## Public and private delivery boundary

The launcher and configuration shell may be static assets, but static HTML must contain only public presentation data.

### Public shell data

Allowed in a public launcher or static configuration shell:

- product labels;
- route links;
- generic setup instructions;
- the public MCP connection URL;
- non-sensitive build/version metadata;
- empty loading and signed-out states.

### Private control-plane data

Private data must load only after a workspace-bound browser session is established:

- workspace identifiers and internal routing metadata;
- connected devices, nodes, connectors, and agents;
- manifest contents and effective tool state;
- environment values;
- credential references and availability;
- grants, permissions, approvals, and scopes;
- last-used information;
- authorization failures and audit activity.

The Configuration shell contains no private embedded snapshot. It loads private state only through the authenticated Configuration gateway. This boundary must remain in place before the control plane exposes nodes, credentials, grants, or activity.

### Secret material

Secret values are never part of:

- static HTML;
- browser snapshots;
- control-plane list or detail responses;
- agent prompts or tool arguments;
- logs, traces, workpads, errors, or audit payloads;
- synchronized workspace configuration.

A successful setup response reports status only.

## Human browser-session contract

Better Auth is not required for this layer. Consuelo OS already owns the difficult authorization protocol. The missing capability is a narrow human browser session for the workspace control plane.

The intended flow is:

```text
1. Browser opens a private workspace route.
2. Workspace edge finds no valid workspace browser session.
3. Browser is redirected to os.consuelohq.com/sign-in with:
   - target workspace hostname;
   - one-time state;
   - safe return path.
4. The person signs in through the existing human identity path.
5. Device Authority verifies account-to-workspace membership.
6. Device Authority issues a one-time exchange code.
7. The workspace edge exchanges the code server-to-server.
8. The edge sets an opaque, short-lived, host-bound session cookie.
9. Private control-plane API requests are resolved to the workspace,
   caller-supplied identity headers are removed, and the request is
   forwarded through the existing signed connector path.
10. The local node performs its normal authorization before returning data
    or accepting a mutation.
```

Session requirements:

- opaque identifier rather than self-authoritative browser claims;
- bound to one account and workspace;
- host-bound to the intended workspace subdomain;
- `Secure`, `HttpOnly`, and an appropriate `SameSite` policy;
- short idle and absolute expiry;
- revocable;
- not reused as an MCP or machine credential;
- never sufficient by itself to bypass local tool authorization or approval.

`os.consuelohq.com/` currently redirects to `/login/device`. The installer path must remain stable. A new `/sign-in` entry should ship before any product decision changes the root route.

## Node model

Node role and node location are independent dimensions.

```text
Role
  home
  member

Location
  this-device
  self-hosted
  consuelo-hosted
```

The home node is:

- the first approved node by default;
- the default local execution node;
- the default location for native device credentials;
- an authority that may approve member-node relationships.

The home node is not a permanent raw-secret relay for every other node.

A cloud node may be the home node. A local Mac may be a member node. UI and APIs must not infer role from location.

The control plane stores desired state and metadata. Each node reports actual state:

```text
Control plane
  node registry
  environment definitions
  credential references
  node and tool bindings
  desired configuration
  redacted audit events

Node
  installed tools and skills
  local capabilities
  native credential availability
  effective configuration
  health and last-seen state
```

A credential configured on one node is not automatically available on another node.

## Environment contract

Consuelo owns the environment and credential control plane. The selected credential source owns the secret value.

An environment contains:

```ts
export type EnvironmentRecord = {
  environmentId: string;
  workspaceId: string;
  name: string;
  slug: string;
  description?: string;
  plainValues: Record<string, string>;
  credentialBindings: Record<string, CredentialReferenceId>;
  nodeIds: string[];
  toolPatterns: string[];
  createdAt: string;
  updatedAt: string;
};
```

The shape above is conceptual. The implementation may use normalized records, but the domain invariants must remain visible.

Rules:

- plain values may synchronize through the workspace control plane;
- credential references may synchronize as metadata;
- credential values do not synchronize as ordinary environment data;
- environment names are workspace-scoped;
- node and tool bindings are explicit;
- destructive or external operations still require their normal approvals;
- environment selection does not grant permission to a tool;
- a tool may consume only requirements declared by its contract or explicitly bound by an administrator.

Environment variables are a runtime compatibility mechanism, not the source of truth. OS must construct explicit child-process environments rather than relying on ambient dotenv loading.

## Credential model

A credential connection is metadata plus a provider-owned reference:

```ts
export type CredentialRecord = {
  credentialId: string;
  workspaceId: string;
  provider: string;
  accountLabel?: string;
  kind: 'api-key' | 'oauth-grant' | 'service-account' | 'session';
  source: CredentialSourceKind;
  sourceReference: string;
  status: 'required' | 'active' | 'invalid' | 'rotating' | 'revoked';
  scopeLabels: string[];
  nodeIds: string[];
  toolPatterns: string[];
  createdAt: string;
  rotatedAt?: string;
  revokedAt?: string;
  lastUsedAt?: string;
};
```

Control-plane records must not include secret prefixes, suffixes, lengths, hashes, fingerprints, or encrypted payloads unless a future managed-custody design explicitly requires and reviews them.

### Credential sources

The OS domain depends on an owned interface, not directly on Bun, Apple, 1Password, or another provider:

```ts
export interface CredentialSource {
  status(reference: CredentialReference): Effect.Effect<CredentialStatus, CredentialSourceError>;

  withCredential<A>(
    request: CredentialUseRequest,
    operation: (credential: ResolvedCredential) => Effect.Effect<A, CredentialConsumerError>,
  ): Effect.Effect<A, CredentialBrokerError>;
}
```

Initial source classes:

```text
This device
  Native OS credential store through a Bun-backed adapter.
  Apple Keychain on macOS, libsecret on supported Linux desktops,
  Windows Credential Manager on Windows.

Existing runtime environment
  Compatibility source for explicitly configured headless deployments.
  The value remains in the node runtime and is never returned through the API.

1Password
  Shared/headless source resolved independently by each authorized node.

Bitwarden Secrets Manager
  Shared/headless source resolved independently by each authorized node.
```

Consuelo-hosted credential custody is deferred. See Linear issue `DEV-1581`.

Bun Secrets is an adapter choice for `This device`, not the system architecture. Provider tools must not import `Bun.secrets` or invoke Apple Keychain commands directly.

### Credential status

External and agent-facing methods expose metadata only:

```text
credentials.list
credentials.status
credentials.setup.begin
credentials.bind
credentials.rotate.begin
credentials.revoke
credentials.audit
```

There is no public `credentials.get`, `secrets.read`, or `keychain.read` method.

Allowed availability states include:

```text
configured
missing
invalid
expired
revoked
denied
node-offline
provider-unavailable
```

## Secure setup ceremonies

Agents may request or explain setup. They do not receive credential values.

### Local interactive value

```text
1. User or agent requests a provider connection.
2. OS returns a setup requirement.
3. A protected local form or no-echo terminal prompt receives the value.
4. The local credential broker writes it to the selected source.
5. The response reports configured or failed without echoing the value.
```

A CLI must not accept a credential as a normal argument because shell history and process inspection can expose it.

### Provider OAuth

```text
1. User starts the connection from Configuration or CLI.
2. OS creates provider-specific state bound to workspace, node, and scopes.
3. The user completes provider consent in a browser.
4. The callback validates state and intended destination.
5. Grant material is written directly to the selected credential source.
6. The UI receives status only.
```

### Remote setup for a self-hosted node

Remote entry of a native node credential requires a separate node encryption key and a reviewed sealed-delivery protocol. The current Ed25519 signing key must not be casually repurposed for encryption.

This remote ceremony is not part of the first native credential release.

## Runtime injection contract

The execution boundary is:

```text
agent tool call
  -> local authorization and approval
  -> environment broker
  -> credential broker
  -> credential source
  -> smallest possible provider adapter or child process
  -> secret discarded after execution
```

The broker verifies:

- workspace;
- caller and application identity;
- selected node;
- exact tool;
- environment binding;
- credential status;
- node and tool permission;
- required approval.

Rules:

- do not place secrets in the long-lived OS parent environment;
- do not persist resolved `.env` files;
- pass an explicit environment to the child process;
- prefer provider SDK arguments, stdin, or file descriptors when supported;
- redact process arguments, output, errors, traces, and crash reports;
- never return the resolved credential from a provider adapter;
- record a redacted credential-use event whether the resolution succeeds or fails.

## Effect ownership contract

Rendering-only functions may remain pure TypeScript. Control-plane behavior must be behind explicit Effect services with typed failures.

Required boundaries:

```text
ConfigurationSnapshotService
  reads effective, private configuration state

ManifestOverlayRepository
  serializes and persists overlay mutations

ManifestOverlayService
  validates requested mutations and returns effective state

WorkspaceSessionService
  issues, validates, revokes, and audits browser sessions

NodeRegistryService
  owns node metadata, desired state, and reported state

EnvironmentRepository / EnvironmentService
  owns environment persistence and business rules

CredentialRegistryService
  owns metadata, source references, bindings, and lifecycle status

CredentialBrokerService
  authorizes and resolves a credential inside an execution boundary

CredentialSource adapters
  isolate Bun/native, runtime-env, 1Password, and Bitwarden behavior

ControlPlaneAuditService
  writes stable redacted events with reason and correlation identifiers
```

HTTP, CLI, launcher, and Sites adapters parse input, call these contracts, and shape responses. They do not own business logic or filesystem/provider behavior.

Failures must be typed at the service boundary. Expected categories include:

```text
InvalidInput
NotAuthenticated
NotAuthorized
WorkspaceMismatch
NodeUnavailable
UnknownTool
UnknownSkill
UnknownWorkflow
ConcurrentModification
PersistenceFailure
CredentialMissing
CredentialInvalid
CredentialDenied
ProviderUnavailable
ApprovalRequired
```

Errors sent across the public boundary must remain useful without exposing internal paths, connector origins, credentials, request bodies, or private identifiers.

## Audit contract

The control plane needs one redacted event model across sessions, configuration, environments, nodes, and credentials.

Every event includes:

- event type and stable reason code;
- correlation identifier;
- account and workspace identifiers;
- actor type and redacted actor identifier;
- node, tool, and application identifiers when relevant;
- timestamp;
- outcome;
- safe metadata.

Required event classes:

```text
workspace.session.issued
workspace.session.revoked
workspace.session.denied
configuration.overlay.changed
environment.created
environment.updated
environment.deleted
credential.setup.started
credential.configured
credential.status.changed
credential.used
credential.denied
credential.rotated
credential.revoked
node.registered
node.state.changed
authorization.denied
approval.required
approval.completed
```

Audit events never include secret values, provider tokens, request bodies, raw authorization headers, nonces, or private tunnel origins.

## Existing Configuration baseline

The shipped Configuration stack is the implementation baseline:

- `settings-snapshot.ts` aggregates current state;
- `settings-site.ts` renders the public Configuration shell and toggles;
- `manifest-overlay.ts` records tool, skill, and workflow disables;
- `settings-gateway.ts` serves canonical Configuration operations and legacy Settings aliases;
- `settings-sites-gateway-endpoints.ts` bridges the Sites gateway;
- `workspace-edge-route-seed.ts` registers `/configuration`, the canonical gateway routes, and the legacy redirect/aliases.

The hardening stack has already established these invariants:

1. Public Configuration HTML contains no private workspace snapshot.
2. Hosted hydration failure produces a safe unavailable state rather than private fallback data.
3. Missing gateway identity, workspace, site, capability, or source-mode headers fail closed.
4. Overlay mutations are serialized per OS process and use collision-safe atomic files.
5. Configuration materialization has one canonical implementation and storage location.
6. Workflow disables are enforced by workflow intent routing.
7. Snapshot and mutation behavior run behind Effect programs with typed control-plane failures.
8. Successful mutations append metadata-only audit events.

The remaining browser-to-edge session and connector proof belongs to the workspace browser-session stack. Preserve the route, overlay, manifest-filtering, Effect, audit, and signed-gateway foundations.

## Non-goals

The first implementation stacks do not include:

- Better Auth;
- Consuelo-hosted credential custody;
- automatic secret replication between nodes;
- a generic password-manager product;
- enumeration of a user's Apple Keychain or password vault;
- remote browser-to-node secret delivery;
- Observability product redesign;
- Artifacts, Code review, Go to market, or Decision loops migrations;
- provider-specific tools beyond what a later connector task explicitly implements;
- changing the installer device authorization protocol;
- changing `os.consuelohq.com/` before `/sign-in` is proven.

## Implementation dependency map

```text
PR 0  Workspace control-plane contract
  |
  v
PR 1  Harden existing control plane
  - Effect services and typed failures
  - private/public snapshot boundary
  - fail-closed scopes
  - serialized overlay writes
  - workflow enforcement and audit
  |
  v
PR 2  Canonical Configuration surface
  - /configuration
  - /gateway/configuration/*
  - launcher Configuration section last
  - /settings redirect and gateway aliases
  |
  v
PR 3  Workspace browser session
  - os.consuelohq.com/sign-in
  - one-time exchange
  - host-bound cookie
  - signed edge forwarding
  |
  v
PR 4  Environment registry
  - plain configuration
  - node and tool bindings
  - environment UI and API
  |
  v
PR 5  Native credential broker
  - source contract
  - This device adapter
  - existing runtime environment adapter
  - metadata/status only
  |
  v
PR 6  Secret bindings and runtime injection
  - /secrets product
  - setup ceremonies
  - approval and policy
  - injection and redaction
  - audit
  |
  v
PR 7+ External credential sources
  - 1Password
  - Bitwarden
```

The documentation task follows verified runtime behavior. It must not publish planned architecture as shipped product behavior.

## Evidence ledger

| Contract statement | Current evidence | Current status |
| --- | --- | --- |
| Workspace launcher and Configuration are static Sites routes | `scripts/lib/workspace-edge-route-seed.ts`, `scripts/lib/install-edge-site-publisher.ts` | Shipped |
| Configuration shell contains no private embedded snapshot | `scripts/lib/settings-site.ts` | Shipped hardened boundary |
| Overlay filters effective tools and skills | `scripts/lib/manifest-overlay.ts`, effective manifest readers | Shipped |
| Workflow disables are enforced by routing | `hooks/intent.js` and overlay readers | Shipped |
| Configuration gateway supports canonical routes and Settings aliases | `scripts/lib/settings-gateway.ts`, server routes, Sites gateway endpoints | Shipped |
| Missing gateway scope metadata fails closed | `scripts/lib/settings-sites-gateway-endpoints.ts` | Shipped |
| Device authorization binds a human approval to a node key | Device Authority device routes and installer login client | Shipped security foundation |
| Existing Google path can identify a human | Device Authority Google OAuth routes | Shipped identity foundation |
| Edge and local layers independently authorize OS requests | workspace edge, security gateway, local Hono middleware | Shipped security foundation |
| Native cross-platform secret API is available through Bun | Bun runtime adapter candidate | Experimental adapter; not domain contract |
| Cloud credential custody | No approved runtime design | Deferred to DEV-1581 |

## Review rule

Any later PR that intentionally differs from this contract must update this document or record a replacement decision. Silence is not approval to weaken the boundary.

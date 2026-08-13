# Consuelo OS Install Control Plane

Status: implementation contract for Branch 3  
Last reviewed: 2026-08-13

This document describes the hosted persistence, diagnostics, device projection, and private read API that implement `docs/install-telemetry-contract.md`.

## Ownership

The control plane intentionally keeps one canonical source for each class of data:

- `consuelo-workspace-route-registry` D1 owns canonical install sessions/events, the private user projection, diagnostic metadata, and evidence references.
- Device Authority remains authoritative for workspace-node/device state and heartbeat-derived liveness.
- `consuelo-install-diagnostics` R2 stores server-redacted diagnostic blobs only.
- Sentry, Cloudflare observability, and PostHog remain evidence/analytics projections and are not queried for canonical dashboard counts.

The D1 schema lives in `cloudflare/workspace-edge/migrations/0004_install_control_plane.sql`.

## Ingest

Machine-originated structured telemetry uses:

```text
POST https://os.consuelohq.com/api/os/v1/install-events
x-consuelo-install-id: ins_<uuid-v4>
content-type: application/json
```

The public installer trust boundary accepts only schema-v1 `producer: installer` events with anonymous identity. The header must exactly match the event `installId`. The HTTP parser rejects unknown envelope/context/error fields rather than recursively storing arbitrary JSON.

The public ingest endpoint never accepts a canonical `userId` or `workspaceId`. Canonical identity binding must happen through trusted app/Device Authority code after device authorization. `google:<sub>` is rejected as a canonical Consuelo user ID.

The `install_id` remains correlation, not authentication. Device authorization must independently validate its own credentials and approval flow.

### Device Authority correlation and identity binding

Installer device-code requests may carry the same `x-consuelo-install-id`. Device Authority validates the identifier and, when valid, stores it only in trusted server-side grant state. Missing or malformed correlation is ignored rather than weakening or blocking the existing authorization flow, and the install ID is never copied into the human verification URL.

The primary application-mediated approval assertion carries both canonical application identifiers: `UserEntity.id` and `WorkspaceEntity.id`. After the approved grant commits, Device Authority best-effort records one idempotent `install.identity.bound` event for the correlated install and returns the canonical `user_id`/`workspace_id` to the installer. Telemetry failure cannot change device-authorization success.

Direct provider-derived authority identities remain non-canonical. In particular, a legacy/direct `google:<sub>` account can authorize a device through its existing path, but it does not populate canonical install `userId` or the dashboard user projection.

### Diagnostics

Redacted diagnostic bundles use:

```text
POST https://os.consuelohq.com/api/os/v1/install-diagnostics
x-consuelo-install-id: ins_<uuid-v4>
content-type: application/json
```

The request is bounded to 2 MiB. The server applies `redactDiagnosticValue()` again before R2 even if the installer already redacted locally. Only bundle availability, ID, outcome, creation time, and expiry are exposed to the dashboard; the R2 object key remains private server metadata.

Failed bundles are retained for 30 days. Successful bundles are not uploaded by default; if explicitly enabled they may be retained for at most 7 days.

R2 keys are separated by outcome so bucket lifecycle rules can enforce the physical maximum:

```text
install-diagnostics/failed/<installId>/<bundleId>.json
install-diagnostics/successful/<installId>/<bundleId>.json
```

The reviewed lifecycle configuration is `cloudflare/os-device-authority/install-diagnostics-r2-lifecycle.json`.

## Private dashboard API

The read-only dashboard API is intercepted by Workspace Edge before normal workspace-site routing:

```text
https://internal.consuelohq.com/api/internal/os/v1/overview
https://internal.consuelohq.com/api/internal/os/v1/users
https://internal.consuelohq.com/api/internal/os/v1/installs
https://internal.consuelohq.com/api/internal/os/v1/devices
https://internal.consuelohq.com/api/internal/os/v1/errors
https://internal.consuelohq.com/api/internal/os/v1/installs/:installId
```

There are no user/device/install mutation endpoints in v1.

All responses are `Cache-Control: no-store`. The worker checks the exact internal hostname and fails closed unless the request passes an explicit operator authorizer.

### Operator authorization

Production authorization uses the Cloudflare Access JWT supplied in `cf-access-jwt-assertion`. The worker verifies:

- RS256 signature against the configured Access team's published JWK set;
- exact issuer/team domain;
- Access application audience;
- expiration/not-before timestamps;
- an explicit operator email allow-list.

A launcher link is never an authorization mechanism.

Workspace Edge intentionally has no committed operator identity. Production must provide:

```text
OS_INTERNAL_DASHBOARD_ACCESS_TEAM_DOMAIN
OS_INTERNAL_DASHBOARD_ACCESS_AUD
OS_INTERNAL_DASHBOARD_ALLOWED_EMAILS
```

If any authorization configuration is absent, the private API fails closed.

## Device projection

Workspace Edge obtains device summaries from Device Authority over the existing internal edge secret. The internal Device Authority response contains only the dashboard device projection; it does not expose device public keys, thumbprints, provider subjects, or other authority internals.

Device state is derived from the authority node registry:

- revoked authority node -> `revoked`;
- non-revoked node with a heartbeat inside the authority heartbeat TTL -> `active`;
- otherwise -> `offline`.

Legacy/direct authority records with `accountId = google:<sub>` may still appear as devices but are deliberately emitted without `userId` until canonical application identity is resolved.

## D1 projection and recovery

`event_id` is the idempotency key. A retry with the same event ID and different content is rejected.

The event log is persisted before the session projection. If a D1/session projection write fails after the event was accepted, a retry of the same event replays the persisted install events and repairs the session projection rather than leaving the install permanently unqueryable. Out-of-order events remain in the timeline but cannot regress a newer terminal/session projection.

Structured sessions/events are pruned after 400 days. User-directory records are not implicitly deleted by install telemetry retention; user/account deletion policy is a separate lifecycle concern.

## Deployment prerequisites

Do not deploy the dashboard as public data merely because the UI shell is internal-looking. The following infrastructure prerequisites must be satisfied before enabling the internal dashboard in production.

### 1. Apply the D1 migration

From `packages/os`:

```bash
bun run cloudflare:workspace-edge:migrate
```

This applies `0004_install_control_plane.sql` to `consuelo-workspace-route-registry` together with any earlier pending migrations.

### 2. Create the diagnostic R2 bucket

The Device Authority worker expects:

```text
bucket: consuelo-install-diagnostics
binding: INSTALL_DIAGNOSTICS
```

Create the bucket if it does not already exist before the real worker deployment.

### 3. Apply the R2 lifecycle rules

From `packages/os`:

```bash
bunx wrangler r2 bucket lifecycle set consuelo-install-diagnostics \
  --file cloudflare/os-device-authority/install-diagnostics-r2-lifecycle.json
```

The lifecycle file physically expires failed diagnostics at 30 days and successful diagnostics at 7 days. Application metadata may make an explicitly configured successful bundle unavailable sooner than 7 days; the bucket lifecycle is the hard maximum.

### 4. Configure Cloudflare Access

Create/maintain the Access application for `internal.consuelohq.com` with the intended operator-only policy, then provide the Access team domain, application audience, and explicit allowed operator email(s) to Workspace Edge using deployment secrets/environment configuration.

The worker performs Access JWT verification itself as defense in depth; the Access policy and the worker allow-list should agree.

### 5. Validate before enabling the UI

At minimum:

```bash
bun run cloudflare:device-authority:deploy:dry-run
bun run cloudflare:workspace-edge:deploy:dry-run
```

Then verify in Canary that anonymous install events are ingested, trusted identity binds to the same `install_id`, diagnostic references expire correctly, Device Authority state projects safely, and a request without valid operator authorization cannot read `/api/internal/os/v1/*`.

## Parallel-branch handoff

Branch 2 may emit installer telemetry against the public ingest contract and should bind canonical identity only after trusted device approval. Branch 5 can build against the shared dashboard types/API routes. Branch 4 only needs to link the private site; it must not duplicate the authorization boundary.

The later dashboard-integration branch should hydrate registered-user profile fields from the canonical Consuelo application user source through `InstallControlPlaneRepository.upsertUser()`. Installer events never carry email/display name.

The later observability-integration branch should populate Sentry and Cloudflare evidence references and PostHog projections while preserving D1 as the canonical count/read model.

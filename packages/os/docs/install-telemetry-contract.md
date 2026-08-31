# Consuelo OS Install Telemetry Contract

Status: approved foundation contract  
Last reviewed: 2026-08-13

This document defines the shared contract for Consuelo OS install telemetry, diagnostics correlation, canonical identity, retention, and the read-only internal install dashboard.

It is intentionally a foundation contract. The installer, Device Authority, control-plane storage, Sentry, Cloudflare observability, PostHog, R2, and internal dashboard implementations land in later tasks. Those implementations must consume this contract rather than inventing competing identifiers or event vocabularies.

The executable TypeScript contract is `scripts/lib/install-telemetry-contract.ts`.

## Goals

The install system must answer both operational and product questions from the same correlated install history:

- Did this install start, complete, fail, or fall back to a degraded path?
- At which stable stage did it fail?
- Which canonical Consuelo user, workspace, and node did it eventually bind to?
- Which Sentry error, Cloudflare trace, and redacted diagnostic bundle belong to the same install?
- How many people registered, authorized a device, completed an install, activated a node, and remained active?
- Which release, channel, platform, or architecture is associated with elevated failure rates?

The contract must provide those answers without making Sentry, Cloudflare, PostHog, or an R2 object listing the canonical database for users or installs.

## Non-goals

This foundation task does not:

- send events to Sentry, PostHog, or Cloudflare;
- create D1 or application-database migrations;
- upload diagnostic bundles to R2;
- change the device authorization protocol or approval security model;
- expose private telemetry in static launcher HTML;
- add dashboard UI or launcher navigation;
- create user/device mutation endpoints;
- replace the existing installer diagnostic redactor.

## Correlation identity

### `install_id`

Every instrumented installer run receives one opaque install identifier as early as possible:

```text
ins_<uuid-v4>
```

The TypeScript type is `InstallId`. `createInstallId()` generates the identifier and `isInstallId()` validates it.

Rules:

1. Generate one `install_id` per installer invocation. Do not derive it from a user, email, device key, hostname, timestamp, workspace, or machine identifier.
2. Reuse the same `install_id` for every event and projection produced by that installer invocation.
3. Never recycle an `install_id` for a later reinstall. A reinstall is a new install session even if it eventually binds to the same `nodeId`.
4. An `install_id` is a correlation identifier, not an authentication credential and not proof of identity.
5. An `install_id` may exist before the installer knows a canonical user or workspace. Identity is bound later through `install.identity.bound`.
6. The canonical transport header for machine-originated install-aware requests is:

```text
x-consuelo-install-id: ins_<uuid-v4>
```

The header name is exported as `INSTALL_ID_HEADER`.

### Device authorization propagation

The installer must attach `x-consuelo-install-id` to install-aware Device Authority requests. Device Authority validates the identifier format and carries the correlation identifier in server-side grant/session state or equivalent trusted state.

Do not put `install_id` into the human verification URL or OAuth query string merely to preserve correlation. Browser callbacks should recover correlation from trusted server-side device grant/state.

A missing or malformed correlation identifier must not weaken authentication. Device authorization continues to fail closed according to its existing security rules; telemetry correlation is not an authorization prerequisite.

### `event_id`

Every canonical install event has an opaque event identifier:

```text
evt_<uuid-v4>
```

`event_id` exists for idempotent ingestion and cross-system evidence. Retries of the same logical event reuse the same event ID when the producer can do so safely. A genuinely new event receives a new event ID.

## Canonical identity

Install telemetry has one identity vocabulary:

```ts
type InstallCanonicalIdentity =
  | {
      state: 'anonymous';
      nodeId?: string;
    }
  | {
      state: 'canonical';
      userId: string;
      workspaceId: string;
      nodeId?: string;
    };
```

The identity rules are strict:

- `userId` means the canonical Consuelo application `UserEntity.id`.
- `workspaceId` means the canonical Consuelo application `WorkspaceEntity.id`.
- `nodeId` means the Device Authority workspace-node identifier.
- Provider identity is not canonical application identity.
- A Device Authority value such as `google:<sub>` must never be copied into telemetry or the internal dashboard as `userId` merely because it occupies an `accountId` field in an older/direct authority path.
- Direct provider-derived authority identities must be explicitly resolved or migrated to a canonical Consuelo user before an install becomes `state: 'canonical'`.
- Human profile fields such as email and display name are not duplicated into install events. The private dashboard may hydrate profile details from the canonical application user store at read time.

The primary application-mediated OS approval already signs the canonical `approvedUser.id` into Device Authority. That path is the model for new identity bindings.

## Event envelope

The canonical event envelope is `InstallTelemetryEvent`:

```ts
type InstallTelemetryEvent = {
  schemaVersion: 1;
  eventId: InstallEventId;
  installId: InstallId;
  producer: InstallTelemetryProducer;
  name: InstallTelemetryEventName;
  stage: InstallStage;
  outcome: InstallOutcome;
  occurredAt: string;
  sequence: number;
  identity: InstallCanonicalIdentity;
  context?: InstallTelemetrySafeContext;
  error?: {
    code: InstallErrorCode;
    impact: 'recoverable' | 'fatal';
  };
};
```

### Schema evolution

`schemaVersion` is currently `1`.

Additive optional fields may be introduced without changing the version when old consumers can safely ignore them. A breaking semantic or structural change requires a new schema version and an explicit compatibility strategy in the control-plane ingest path.

Do not repurpose an existing event name, stage, or error code to mean something different.

### Producers

Version 1 recognizes:

- `installer` — local installer/bootstrap process;
- `app` — canonical application identity/approval layer;
- `device_authority` — hosted OS device authorization and node-registration authority;
- `workspace_node` — installed node/runtime reporting installation-adjacent state such as first health/heartbeat evidence;
- `control_plane` — canonical ingestion/normalization service.

### Lifecycle event names

Version 1 recognizes:

```text
install.started
install.stage.started
install.stage.completed
install.stage.failed
install.identity.bound
install.diagnostic.uploaded
install.completed
install.failed
```

`install.stage.failed` can be recoverable. For example, device authorization may fail while the installer deliberately continues through its local fallback path. `install.failed` is reserved for the terminal install-session outcome.

`install.identity.bound` records the transition from an anonymous install to canonical Consuelo identity. It contains canonical IDs in the identity envelope, not a provider subject or email.

### Ordering

Each producer increments `sequence` monotonically within one install session when it owns a sequential lifecycle. Sequence is a deterministic tie-breaker, not a distributed global clock.

The control plane adds an ingestion timestamp to its persisted/read representation. Dashboard timelines sort primarily by `occurredAt`, then by producer/sequence or another deterministic ingest tie-breaker. Producers must send ISO-8601 UTC timestamps.

## Install stages

The stable stage vocabulary is deliberately more precise than the human seven-row installer progress UI:

| Stage | Meaning |
| --- | --- |
| `bootstrap` | Earliest installer/runtime bootstrap before normal setup stages. |
| `dependencies` | Required runtime/dependency checks. |
| `workspace` | Workspace naming/mode resolution before hosted identity is complete. |
| `device_auth` | Device-code request, browser approval, and polling. |
| `workspace_selection` | Finishing a device approval when a workspace must be selected/named. |
| `workspace_route` | Hosted workspace route preparation required for approved bootstrap. |
| `node_registration` | Binding the approved device identity to a workspace node. |
| `connector_provisioning` | Hosted connector/tunnel bootstrap provisioning. |
| `skills` | Installer skill selection/materialization. |
| `agents` | Local agent detection/connection configuration. |
| `local_provisioning` | Writing/materializing the local OS installation. |
| `background_service` | Installing, starting, or validating the local background service. |
| `agent_status_sync` | Reporting verified connected-agent state to the hosted control plane. |
| `health` | End-of-install health verification. |
| `complete` | Terminal successful/degraded session stage. |

Human UI labels may remain coarser. Telemetry uses this vocabulary so failures are operationally actionable.

## Stable error codes

Version 1 defines the following error codes:

| Code | Typical stage | Default interpretation |
| --- | --- | --- |
| `INSTALLER_UNEXPECTED_FAILURE` | any | Fatal unclassified installer exception. |
| `DEPENDENCY_CHECK_FAILED` | dependencies | Required dependency unavailable. |
| `DEVICE_CODE_REQUEST_FAILED` | device_auth | Device-code request could not be completed. |
| `DEVICE_AUTH_UNAVAILABLE` | device_auth | Auth service/path unavailable; local fallback may continue. |
| `DEVICE_AUTH_DENIED` | device_auth | User/authority denied the device grant. |
| `DEVICE_AUTH_EXPIRED` | device_auth | Device authorization expired. |
| `DEVICE_AUTH_TIMEOUT` | device_auth | Installer stopped waiting before approval completed. |
| `DEVICE_AUTH_POLL_FAILED` | device_auth | Polling failed for a non-domain/transport reason. |
| `DEVICE_AUTH_PROOF_FAILED` | device_auth | Device public-key proof creation/validation failed. |
| `WORKSPACE_SELECTION_FAILED` | workspace_selection | Approved session could not finish workspace selection. |
| `WORKSPACE_ROUTE_SETUP_FAILED` | workspace_route | Hosted route preparation failed. |
| `NODE_REGISTRATION_FAILED` | node_registration | Approved device could not register/reconnect its node. |
| `CONNECTOR_PROVISION_FAILED` | connector_provisioning | Connector/tunnel provisioning failed. |
| `LOCAL_PROVISION_FAILED` | local_provisioning | Local OS materialization failed. |
| `BACKGROUND_SERVICE_INSTALL_FAILED` | background_service | Background service definition/install failed. |
| `BACKGROUND_SERVICE_START_FAILED` | background_service | Background service could not start. |
| `BACKGROUND_SERVICE_HEALTHCHECK_FAILED` | background_service | Service started or appeared installed but health validation failed. |
| `AGENT_CONNECTIVITY_FAILED` | agents | Selected local-agent connection/verification failed. |
| `AGENT_STATUS_SYNC_FAILED` | agent_status_sync | Hosted status sync failed after local verification. |
| `HEALTH_CHECK_FAILED` | health | Terminal OS health verification failed. |
| `DIAGNOSTIC_UPLOAD_FAILED` | complete/any | A redacted diagnostic bundle could not be uploaded; never fail install solely for telemetry. |

Expected domain failures should use these stable codes instead of parsing raw error strings in analytics or the dashboard.

Each error also carries an `impact`:

- `recoverable` — the installer can deliberately continue or finish in a degraded/fallback state;
- `fatal` — the install cannot be considered complete without remediation.

The producer chooses impact based on the actual control flow. A code is not globally hard-coded to one impact because the same underlying failure can be recoverable in one release path and fatal in another.

## Privacy and redaction

There are two different data products and they must not be conflated.

### Structured install telemetry

Canonical install events accept only the scalar allow-list represented by `InstallTelemetrySafeContext` and enforced by `pickInstallTelemetrySafeContext()`.

The current allow-list contains operational metadata such as:

- platform and architecture;
- release and channel;
- installer version/mode;
- node role/status;
- device-login status;
- HTTP status code;
- duration/attempt/count metrics;
- daemon and dry-run booleans.

Unknown fields are dropped rather than recursively serialized. Arbitrary diagnostic objects must never be assigned directly to `context`.

The contract explicitly forbids fields/families including:

- human PII such as email, name, picture, or IP;
- provider subjects or ambiguous authority `accountId` values;
- workspace slugs/hosts and node names when they reveal human-selected labels;
- OAuth/device codes, state, nonce, cookies, authorization headers;
- access/refresh/bootstrap/tunnel/signing credentials;
- private/signing key material;
- local home paths, arbitrary paths, argv, URLs;
- raw request/response bodies.

Canonical IDs (`userId`, `workspaceId`, `nodeId`) live only in the typed identity envelope when they are known and authorized for the private control-plane record.

### Diagnostic bundles

Diagnostic bundles are richer support evidence. Before leaving the local machine they must pass the existing installer diagnostic redaction contract (`redactDiagnosticValue`) or its reviewed successor.

A diagnostic bundle must never be treated as safe merely because the corresponding structured event was safe.

Diagnostic upload failures must not become the cause of an otherwise successful installation.

### Raw errors and Sentry

Canonical events carry stable error codes and impact, not arbitrary exception messages or stack traces.

Sentry may receive the original exception/stack where useful, but the Sentry integration must apply its own scrubber before transport and tag the event with safe correlation identifiers. Sentry evidence is not copied wholesale into the canonical event store.

The hosted installer may discover the Sentry DSN from the Device Authority observability-config endpoint so normal installations do not require a local environment variable. That endpoint exposes only the DSN, is `no-store`, and does not publish PostHog keys or other worker configuration. Discovery failure disables that projection rather than changing install behavior.

## Storage ownership

One system owns each class of data:

| Data | Owner | Contract |
| --- | --- | --- |
| Install sessions and canonical events | Consuelo control-plane read model | Source of truth for install counts, status, identity binding, timelines, and dashboard queries. |
| Redacted diagnostic bundles | Cloudflare R2 | Bounded-lifetime support blobs referenced from canonical install records. |
| Exceptions and application traces | Sentry | Deep error/debug evidence and alerting; not canonical install/user counts. |
| Edge logs and traces | Cloudflare observability | Worker/network execution evidence; not canonical install/user counts. |
| Product analytics/funnels | PostHog | Product behavior projections and cohort/funnel analysis; not canonical user or install identity storage. |

Vendor projections must include `install_id` where supported so an operator can pivot from a canonical install to deeper evidence.

A dashboard page must not need to live-query Sentry, PostHog, or Cloudflare to render its canonical numbers. Those systems may be linked or queried for deeper evidence after the canonical control-plane record is loaded.

## Retention

Version 1 defaults are exported as `INSTALL_TELEMETRY_RETENTION_DAYS`:

| Record | Retention |
| --- | ---: |
| Canonical install sessions | 400 days |
| Canonical install events | 400 days |
| Failed-install diagnostic bundles | 30 days |
| Successful-install diagnostic bundles | not uploaded by default (`0`) |
| Successful-install diagnostic bundles when explicitly enabled | at most 7 days |

The 400-day structured-event window supports approximately thirteen months of year-over-year/release comparison while keeping the canonical event schema minimal and pseudonymous.

Vendor-specific Sentry, PostHog, and Cloudflare retention is configured independently. Their retention must not be assumed to equal the canonical control-plane retention.

Deletion/account-lifecycle work may impose a shorter effective retention for records tied to a deleted user. That policy is additive and must preserve the privacy guarantees above.

## Dashboard metric definitions

The dashboard must keep growth concepts distinct:

- **registered user** — a canonical Consuelo `UserEntity` exists;
- **authorized device** — an install has successfully bound to canonical user/workspace identity through device approval;
- **completed install** — the install session reached terminal completed/degraded success according to its canonical install record;
- **activated user** — at least one canonical workspace node associated with the user has produced its first trusted heartbeat/health evidence after installation;
- **active user (7d)** — at least one canonical node associated with the user has trusted last-seen/heartbeat evidence inside the rolling seven-day window;
- **online device** — determined by the node registry/heartbeat service's authoritative online threshold, not by a threshold invented in the dashboard frontend.

A single number labeled only `Users` is insufficient for operational/product decisions. The overview read model exposes registered, activated, and active-7-day users separately.

## Internal dashboard API contract

Version 1 is read-only and private.

Canonical prefix:

```text
/api/internal/os/v1
```

List/overview routes:

```text
GET /api/internal/os/v1/overview
GET /api/internal/os/v1/users
GET /api/internal/os/v1/installs
GET /api/internal/os/v1/devices
GET /api/internal/os/v1/errors
GET /api/internal/os/v1/installs/:installId
```

The executable constants are `INSTALL_DASHBOARD_API_PREFIX`, `INSTALL_DASHBOARD_API_ROUTES`, and `installDashboardDetailRoute()`.

There are deliberately no create/delete/revoke/retry/admin-mutation endpoints in version 1.

The browser authorization boundary must follow the private control-plane rules in `docs/workspace-control-plane-contract.md`: static shells may be public presentation assets, but user/device/install/error data is fetched only behind an authenticated, authorized browser session. A hidden launcher link is not a security boundary.

## Read models

The shared TypeScript contract exposes vendor-independent read-model types so the control-plane and dashboard branches can develop in parallel:

- `InstallDashboardOverview`
- `InstallDashboardUserSummary`
- `InstallDashboardInstallSummary`
- `InstallDashboardDeviceSummary`
- `InstallDashboardErrorGroup`
- `InstallDashboardInstallDetail`
- `InstallDashboardPage<T>`

### User summaries

User summaries are private dashboard projections over the canonical application user source plus install/device aggregates. They may include operator-useful profile display fields such as email/display name because they are loaded from the authorized canonical application source.

Those profile fields are not emitted by installer telemetry events and must not be copied into Sentry/Cloudflare/PostHog install-event metadata merely because the dashboard can display them.

### Install summaries

Install summaries own the canonical lifecycle state, stage, timestamps, release/channel/platform context, identity binding, last stable error code, and whether a diagnostic bundle remains available.

### Device summaries

Device summaries project Device Authority/node-registry state. Node liveness remains authoritative in the node registry; the dashboard does not infer it from install completion.

### Error groups

Error groups aggregate stable error codes by stage and impact and may include platform/channel breakdowns. They group by `InstallErrorCode`, never by raw exception message.

### Install detail

The install detail page is the operator support surface. It includes:

- canonical install summary;
- normalized chronological event timeline;
- diagnostic-bundle availability/reference metadata;
- Sentry event IDs and Cloudflare trace IDs as evidence references.

The detail response does not proxy raw vendor event bodies into the browser.

## Implementation handoff

The planned branches consume this foundation as follows:

```text
install telemetry contract (this task)
       |
       +-- installer telemetry
       |     generates install_id, emits lifecycle events,
       |     propagates the header, captures failures
       |
       +-- install control plane
       |     ingests/idempotently stores events, binds identity,
       |     owns retention/read model, stores R2 references
       |
       +-- internal user dashboard
       |     builds fixture UI against these read-model types
       |
       +-- launcher customization
             independent navigation/configuration work

parallel branches merge to stream/os
       |
       v
internal dashboard integration
       |
       v
Sentry / Cloudflare / PostHog / R2 projection validation
       |
       v
Canary acceptance
```

Later tasks may extend this contract only deliberately. If a later implementation needs a new stage, error code, safe field, route, or identity state, it updates the executable contract, focused tests, and this document together.

## Review rule

The canonical install store and identity vocabulary must remain stable even if an observability vendor changes.

Any later PR that intentionally differs from this contract must update this document or record a replacement decision. Silence is not approval to introduce a second install ID, provider-derived user identity, arbitrary telemetry payload, or vendor-owned source of truth.

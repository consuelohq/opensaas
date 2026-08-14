# LeadConnector embedded dialer

The standalone embedded dialer lives under `packages/lead-connector/src/embed` and builds into `packages/lead-connector/dist/embed-app`.

## Boundaries

The browser application imports only the public embed subpath and communicates with `packages/dialer-server` over authenticated HTTP. It never imports provider token handling, persistence adapters, server Effect layers, telephony credentials, or dialer lifecycle implementation.

The backend call session is authoritative. The browser state machine projects server status and sends commands; it does not infer winner selection or provider lifecycle from local state.

## Build

```sh
bun run --cwd packages/lead-connector build
```

The build produces:

- `index.html`
- `main.js`
- `main.css`
- `consuelo-lead-connector-click-to-call.js`
- `consuelo-lead-connector-click-to-call.css`
- `consuelo-lead-connector-click-to-call.marketplace.html`

The iframe host must grant microphone permission. The application also displays permission guidance before a live conversation.

## Parent protocol

Protocol version: `1`.

Allowed parent origins:

- `https://app.leadconnectorhq.com`
- `https://app.msgsndr.com`

A message is accepted only when both the origin is allowlisted and `event.source` is the actual parent window.

Parent to iframe:

- `consuelo.leadconnector/handshake`
- `consuelo.leadconnector/click-to-call`

Iframe to parent:

- `consuelo.leadconnector/ready`
- `consuelo.leadconnector/busy`
- `consuelo.leadconnector/completed`

All messages include `version: 1`. Complete phone numbers are not rendered in the iframe UI.

## Authentication

The parent supplies an opaque bootstrap bearer credential during the versioned handshake. The iframe exchanges it through `POST /v1/embed/session` for a short-lived signed embed token.

The browser never receives provider OAuth credentials, refresh credentials, encryption keys, telephony credentials, or server secrets. `dialer-server` validates the signed token and derives workspace and user identity for every resource and call-session request.

The production mechanism that issues the initial bootstrap credential to an installed custom menu is a marketplace distribution decision for the end-to-end cutover branch. This package deliberately does not embed that policy.

## HTTP contracts

- `POST /v1/embed/session`
- `GET /v1/integrations/leadconnector/contacts`
- `POST /v1/integrations/leadconnector/opportunities/search`
- `GET /v1/integrations/leadconnector/pipelines`
- `POST /v1/integrations/leadconnector/dispositions`
- `POST /v1/call-sessions`
- `GET /v1/call-sessions/:providerGroupId`
- `POST /v1/call-sessions/:providerGroupId/terminate`

Single starts use the direct/single application contract. Multiline starts use the queue/predictive contract. Public HTTP responses expose `providerGroupId`, while provider-specific identifiers remain internal to the dialer application boundary.

Pause and resume control client-side queue progression. They do not overwrite active provider state; status polling continues while paused.

## Public click-to-call asset

The standalone package publishes executable JavaScript and a separate stylesheet for ordinary script-tag integrations. HighLevel Marketplace streams its Custom JS field as HTML, so `build:embed` emits two installation forms:

- `consuelo-lead-connector-click-to-call.marketplace.html` contains the complete inline launcher and remains available for byte-for-byte manual Marketplace updates.
- `consuelo-lead-connector-click-to-call.marketplace-loader.html` is the preferred one-time production bootstrap. It is a small stable `<link>` + `<script>` loader for the launcher assets on `https://calls.consuelohq.com`. Once that bootstrap is installed and verified in Marketplace, normal releases update the Cloudflare-hosted launcher assets and do not require Marketplace browser or developer-session credentials.

The stable launcher asset paths are served with revalidation headers so a fixed Marketplace loader does not pin an old launcher indefinitely. The application shell itself remains content-versioned. The legacy Twenty compatibility asset remains untouched until parity is proven and the cutover branch can remove it without selecting unrelated frontend baselines.

## Automated production release

Dialer changes are validated in `Consuelo CI` across `packages/dialer`, `packages/dialer-server`, and `packages/lead-connector`. A matching push to `main` runs the dialer lane in `Consuelo Production Release` in this order:

1. Re-run the three package test suites, typechecks, and production builds on the exact merged SHA.
2. Deploy `dialer-server` to Railway and require a terminal `SUCCESS` deployment.
3. Run non-mutating health, authentication, and unsigned-callback smoke checks.
4. Deploy the LeadConnector Cloudflare Worker, capture its exact version ID, and verify `/`, `/admin`, `/overlay`, `/health`, CSP/permissions policy, and launcher asset SHA-256 values.
5. Reconcile the configured GoHighLevel Custom Menu ID through the official v3 API and GET-read it back.
6. Upload a release manifest containing the Git SHA, Railway deployment ID/status, Cloudflare version/build marker, launcher hashes, Custom Menu read-back evidence, and smoke results.

The `consuelo dialer / production` GitHub Environment is deployment-only. It needs:

- secret `RAILWAY_DIALER_PROJECT_TOKEN`;
- secret `CLOUDFLARE_DIALER_WORKER_API_TOKEN`;
- secret `LEADCONNECTOR_PRODUCTION_PRIVATE_INTEGRATION_TOKEN`;
- variable `RAILWAY_DIALER_PROJECT_ID`;
- variable `RAILWAY_DIALER_ENVIRONMENT_ID`;
- variable `RAILWAY_DIALER_SERVICE_ID`;
- variable `RAILWAY_DIALER_PUBLIC_ORIGIN`;
- variable `CLOUDFLARE_ACCOUNT_ID`;
- variable `LEADCONNECTOR_PRODUCTION_CUSTOM_MENU_ID`;
- variable `LEADCONNECTOR_PRODUCTION_LOCATION_ID`;
- variable `LEADCONNECTOR_PRODUCTION_EMBED_URL`.

Stripe credentials, Twilio credentials, Groq credentials, database/Redis URLs, encryption keys, and other application-runtime secrets remain in Railway. They must not be copied into GitHub Actions for deployment.

`Consuelo Dialer Rollback` is manual and requires exact known-good Railway deployment and Cloudflare Worker version IDs. It never guesses a previous release.

## Validation

Browser architecture and branding tests scan source and built assets. They reject forbidden provider branding, Twenty, Recoil, NestJS, GraphQL, direct telephony dependencies, Node-only imports, server Effect imports, and secret-bearing implementation terms.

No marketplace installation, customer data mutation, or live call is part of this package build.

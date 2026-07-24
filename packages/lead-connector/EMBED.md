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

The standalone package publishes `consuelo-lead-connector-click-to-call.js`. The script uses an explicit iframe target origin and the same versioned protocol as the embedded application. The legacy Twenty compatibility asset remains untouched until parity is proven and the cutover branch can remove it without selecting unrelated frontend baselines.

## Validation

Browser architecture and branding tests scan source and built assets. They reject forbidden provider branding, Twenty, Recoil, NestJS, GraphQL, direct telephony dependencies, Node-only imports, server Effect imports, and secret-bearing implementation terms.

No marketplace installation, customer data mutation, or live call is part of this package build.

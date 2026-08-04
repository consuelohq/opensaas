# Dialer Server

Private Hono and Bun backend for the Consuelo dialer product.

`packages/dialer` remains authoritative for telephony, multiline conference behavior, AMD, caller-ID locks, winner selection, and lifecycle state. `packages/dialer-server` only authenticates requests, resolves workspace context, verifies provider callbacks, composes infrastructure, and translates HTTP contracts.

The production runtime has no Twenty or compatibility API dependency.

## Deployment topology

```text
LeadConnector custom-menu iframe
  -> Cloudflare static assets and same-origin proxy
  -> Railway dialer-server
  -> Postgres / Redis / Twilio / LeadConnector APIs
```

Cloudflare serves `packages/lead-connector/dist/embed-app` and proxies only `/v1/*`, `/webhooks/*`, `/integrations/*`, and `/health` to Railway. Railway runs the compiled Bun binary from `packages/dialer-server/Dockerfile`.

Configure the Railway service to use `/packages/dialer-server/railway.json` as its config-as-code path. That file builds only the dedicated dialer server image and health-checks `/health`.

## Public routes

- `GET /health`
- `POST /v1/embed/session`
- `POST /v1/call-sessions`
- `GET /v1/call-sessions/:sessionId`
- `POST /v1/call-sessions/:sessionId/terminate`
- `POST /webhooks/twilio/status`
- `POST /webhooks/twilio/customer-twiml`
- `POST /v1/integrations/leadconnector/oauth`
- `GET /v1/integrations/leadconnector/callback`
- `POST /v1/webhooks/leadconnector`
- LeadConnector contact, opportunity, pipeline, stage, and disposition routes under `/v1/integrations/leadconnector/*`

The iframe bootstrap route accepts only opaque encrypted parent context. The browser never receives the LeadConnector Shared Secret, OAuth tokens, token-encryption key, Twilio credentials, or the embed-session signing secret.

## Railway environment contract

Required infrastructure:

- `DATABASE_URL`
- `REDIS_URL`
- `DIALER_SERVER_PUBLIC_URL`
- `DIALER_SERVER_EMBED_SESSION_SECRET`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `LEADCONNECTOR_CLIENT_ID`
- `LEADCONNECTOR_CLIENT_SECRET`
- `LEADCONNECTOR_REDIRECT_URI`
- `LEADCONNECTOR_SCOPES`
- `LEADCONNECTOR_TOKEN_ENCRYPTION_KEY`
- `LEADCONNECTOR_SHARED_SECRET`

Production safety and optional provider modes:

- `CONSUELO_SCENARIO_SAFE_TO_NUMBERS`
- `CONSUELO_SCENARIO_SAFE_FROM_NUMBERS`
- `TWILIO_DEFAULT_NUMBER`
- `TWILIO_TEST_ACCOUNT_SID`
- `TWILIO_TEST_AUTH_TOKEN`
- `LEADCONNECTOR_WEBHOOK_PUBLIC_KEY`
- `LEADCONNECTOR_LEGACY_WEBHOOK_PUBLIC_KEY`
- `DIALER_SERVER_EMBED_SESSION_TTL_SECONDS`
- `DIALER_SERVER_AUTH_IDENTITIES_JSON` for temporary non-embed compatibility clients
- `DIALER_SERVER_RUNTIME_MODULE` only when overriding the built-in Railway composition

Do not put secret values in repository files, logs, transcripts, browser bundles, or Cloudflare static variables.

## Cloudflare edge contract

`packages/lead-connector/wrangler.jsonc` deploys the static iframe application. Configure the Worker variable `DIALER_SERVER_ORIGIN` with the private Railway service origin or protected Railway public origin. The customer-visible URL remains the Cloudflare dialer hostname.

The Worker sets an explicit `frame-ancestors` allowlist for the provider-owned application hosts and enables microphone permission for the iframe.

## Validation

```bash
bun test packages/dialer/src
bun test packages/dialer-server/src
bun test packages/lead-connector/src
bun run --cwd packages/dialer typecheck
bun run --cwd packages/dialer-server typecheck
bun run --cwd packages/lead-connector typecheck
bun run --cwd packages/dialer-server build
bun run --cwd packages/lead-connector build
bun packages/dialer-server/scripts/validate-local-runtime.ts
```

Provider-test validation requires the documented Keychain exports and never places a real call:

```bash
bun packages/dialer-server/scripts/validate-provider-test.ts
```

Live calls require Ko's explicit authorization for the exact scope.

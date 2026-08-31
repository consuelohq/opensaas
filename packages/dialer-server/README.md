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
- `GET /v1/calls/active`
- `GET /v1/calls?status=&cursor=&limit=`
- `GET /v1/calls/:callId`
- `GET /v1/calls/:callId/transcript`
- `POST /webhooks/twilio/status`
- `POST /webhooks/twilio/customer-twiml`
- `GET /webhooks/twilio/media` (Twilio-signed WebSocket upgrade)
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
- `GROQ_API_KEY` when at least one workspace has explicitly enabled transcription
- `GROQ_TRANSCRIPTION_MODEL` (defaults to `whisper-large-v3-turbo`)
- `DIALER_TRANSCRIPTION_CHUNK_BYTES` (defaults to 160,000, about 20 seconds per track)
- `DIALER_TRANSCRIPTION_MAX_BUFFER_BYTES` (defaults to 240,000, about 30 seconds per track)
- `DIALER_TRANSCRIPTION_TIMEOUT_MS`, `DIALER_TRANSCRIPTION_MAX_CONCURRENCY`, and `DIALER_TRANSCRIPTION_MAX_SESSIONS`

Do not put secret values in repository files, logs, transcripts, browser bundles, or Cloudflare static variables.

## Transcription and privacy

Transcription is disabled by default for every workspace through `dialer_workspace_settings.transcription_enabled`. Enabling it is an explicit workspace administration action; startup never silently opts a workspace in.

Twilio sends separate inbound and outbound μ-law tracks. The server keeps at most the configured buffer limit in memory, gives each track only one in-flight transcription owner, wraps claimed audio in an 8 kHz mono μ-law WAV, and discards the claimed bytes after processing. Only transcript text and provider metadata are stored. WAV, MP3, μ-law payloads, raw Media Stream frames, and call recordings are never persisted or sent to the browser.

The default concurrency limit is four provider requests across all sessions, with a maximum of 100 in-memory sessions. Backpressure or provider timeout marks the transcript failed, clears both buffers, and leaves the carrier call running. Process startup marks stale `pending` or `processing` transcripts failed with `PROCESS_RESTARTED` so interrupted work is visible rather than stranded.

Speaker labels remain `inbound` and `outbound`: the current customer conference leg does not prove that its outbound track contains only the representative. The schema can accept customer, representative, unknown, and future transfer participants once topology-specific attribution is proven.

## Transfer follow-up seam

Transfer controls are intentionally absent from both LeadConnector surfaces. A follow-up should add focused Effect operations such as `initiateTransfer`, `beginTransferConsultation`, `completeTransfer`, and `cancelTransfer` to the call-operations application, backed by the existing conference service in `packages/dialer/src/services/conference.ts`. Thin authenticated Hono adapters should live under `/v1/calls/:callId/transfers` and translate only validated requests and typed failures. The existing `dialer_call_events` table already supports `transfer_initiated`, `transfer_consulting`, `transfer_completed`, `transfer_cancelled`, and `transfer_failed`, so no historical call-record rewrite is required.

## Cloudflare edge contract

`packages/lead-connector/wrangler.jsonc` deploys the static iframe application. Configure the Worker variable `DIALER_SERVER_ORIGIN` with the private Railway service origin or protected Railway public origin. The customer-visible URL remains the Cloudflare dialer hostname.

The Worker sets an explicit `frame-ancestors` allowlist for the provider-owned application hosts and enables microphone permission for the iframe.

## Local Postgres/Redis benchmark lab

The dialer has a provider-free local lab for predictive-model development. It starts disposable PostgreSQL and Redis processes on isolated loopback ports, runs the real dialer database migrations, seeds deterministic synthetic histories, runs the benchmark scenarios, then shuts both services down and removes their temporary data directories. It does not read Railway, Twilio, LeadConnector, or other production credentials.

Requirements:

- Bun
- PostgreSQL 16+ with `pg_config`, `initdb`, and `pg_ctl` available on `PATH`
- Redis with `redis-server` available on `PATH`

Run the fast smoke lab before predictive-model work:

```bash
bun run --cwd packages/dialer-server lab:local -- --scale smoke
```

Run the opt-in service integration contract when changing the lab itself; the normal unit suite skips this database/process-spawning check:

```bash
bun run --cwd packages/dialer-server lab:verify
```

Use the standard dataset for D1/D2/D3 model comparisons, and the large dataset only for intentional local performance work:

```bash
bun run --cwd packages/dialer-server lab:local -- --scale standard
bun run --cwd packages/dialer-server lab:local -- --scale large
```

The scales currently seed 250 / 5,000 / 25,000 callable contacts and four synthetic historical attempts per training contact. `--seed <integer>` makes an alternate deterministic history. Output is JSON and includes schema-migration timing, persisted fixture counts, predictive ranking latency by candidate-pool size, hazard aggregation latency, attempt-ingest throughput, Redis coordination latency, and cleanup verification.

Benchmark timings are observational baselines, not normal PR pass/fail thresholds. Correctness, deterministic fixtures, successful real migrations, and clean service teardown are the required gates. This lets future dialer work compare richer provider-neutral signal models without coupling the benchmark to GoHighLevel, Twilio, Railway, or a production database.

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

The Groq adapter has a separate, explicit integration check using deterministic synthetic μ-law silence. It makes no carrier call and refuses to run without both opt-in and credential presence:

```bash
DIALER_RUN_GROQ_TRANSCRIPTION_INTEGRATION=1 \
  bun packages/dialer-server/scripts/validate-groq-transcription.ts
```

Live calls require Ko's explicit authorization for the exact scope.

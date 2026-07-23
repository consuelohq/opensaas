# Dialer Server

Private Hono HTTP boundary for `@consuelo/dialer`.

The Hono application is runtime-neutral and testable with `app.request()`. The Bun entry point loads deployment-specific Effect layers from `DIALER_SERVER_RUNTIME_MODULE`, constructs bearer authentication and Twilio signature adapters, and starts `Bun.serve`.

The runtime module must export `createDialerApplicationLayers(environment)`. Railway deployment supplies that module together with durable Postgres/Redis-backed implementations. This branch intentionally does not introduce a Cloudflare Worker runtime, production deployment, or LeadConnector integration.

## HTTP contract

- `GET /health`
- `POST /v1/call-sessions`
- `GET /v1/call-sessions/:sessionId`
- `POST /v1/call-sessions/:sessionId/terminate`
- `POST /webhooks/twilio/status`
- `POST /webhooks/twilio/customer-twiml`

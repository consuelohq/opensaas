# LeadConnector Integration

`@consuelo/lead-connector` owns provider-specific OAuth, encrypted installation records, contacts, opportunities, pipelines, stages, webhooks, dispositions, notes, tags, custom-menu deployment, and the standalone embedded browser application.

It does not own telephony, Twilio lifecycle logic, caller-ID locks, or winner selection. Those remain in `@consuelo/dialer`. HTTP routing and secret-bearing runtime composition remain in `@consuelo/dialer-server`.

## Secure iframe bootstrap

1. The installed custom-menu iframe sends the provider-owned `REQUEST_USER_DATA` message to the exact trusted parent origin.
2. The parent returns opaque encrypted user context.
3. The iframe posts only that ciphertext to `POST /v1/embed/session`.
4. `dialer-server` decrypts it with `LEADCONNECTOR_SHARED_SECRET` and verifies the active installation, location, workspace, and user.
5. The server issues a short-lived Consuelo session containing the installation and location identifiers.
6. Every authenticated request revalidates the installation ID, so disconnect or reinstall invalidates old iframe sessions.

Provider OAuth tokens, Shared Secret, token-encryption key, Twilio credentials, and server signing keys never enter browser code or static assets.

## Static embed deployment

Build and deploy the Cloudflare static application:

```bash
bun run --cwd packages/lead-connector deploy:embed
```

`wrangler.jsonc` serves `dist/embed-app` and proxies only dialer API, webhook, integration, and health routes to `DIALER_SERVER_ORIGIN`.

The Worker applies:

- Explicit provider-parent `frame-ancestors`.
- Microphone permission for the iframe.
- No `X-Frame-Options` denial.
- Same-origin API access for the embedded client.

## Sandbox custom menu

Configure only an isolated test location:

```bash
export LEADCONNECTOR_SANDBOX_ACCESS_TOKEN='<sandbox token>'
export LEADCONNECTOR_SANDBOX_LOCATION_ID='<sandbox location>'
export LEADCONNECTOR_SANDBOX_EMBED_URL='https://<dialer host>/embed/'
bun run --cwd packages/lead-connector configure:sandbox-menu
```

The command is idempotent. It updates an existing `Consuelo Dialer` menu instead of creating duplicates. The menu uses iframe mode, targets only the specified sandbox location, enables microphone access, and does not enable camera access.

Do not run this command against a customer location or a production marketplace installation.

## Validation

```bash
bun test packages/lead-connector/src
bun run --cwd packages/lead-connector typecheck
bun run --cwd packages/lead-connector build
```

Source and built-asset branding contracts reject customer-visible legacy provider names. Exact upstream wire fields and provider-owned domains are preserved only where required by the protocol.

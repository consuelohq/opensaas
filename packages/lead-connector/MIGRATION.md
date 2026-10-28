# LeadConnector extraction inventory

This package is the provider-specific integration boundary. It contains no
customer-system entities, UI state, telephony lifecycle decisions, or HTTP
framework code.

## Migrated in this branch

- OAuth authorization URL generation with PKCE and single-use state.
- Encrypted access-token and refresh-token lifecycle with rotation.
- Workspace-to-location installation ownership contracts.
- Current provider HTTP version and authorization headers.
- Contact, opportunity, and pipeline reads.
- Note, task, tag, and disposition writes.
- Current webhook signature verification with the temporary legacy fallback.
- Atomic webhook event claims and provider-event translation.
- Stable typed Effect failures, ports, runtime adapters, and deterministic test
  layers.

## Retained temporarily

- The existing generic API package continues serving compatibility routes until
  the new Hono runtime has persistent installation and event-store adapters.
- The customer-system server retains temporary compatibility adapters for its
  existing integration screens and synchronization jobs.
- Existing customer-system pipeline mappings remain in place because they are
  not provider contracts.

## Delete later after parity

- Duplicate OAuth, token, client, webhook, opportunity, and pipeline provider
  implementations in the generic API package.
- Provider-specific synchronization code that only mirrors records into the
  temporary customer system.
- Legacy customer-system settings state and integration controls after the
  embedded application replaces them.

## Preserved public routes

- `POST /v1/integrations/leadconnector/oauth`
- `GET /v1/integrations/leadconnector/callback`
- `POST /v1/webhooks/leadconnector`

No short-name aliases are introduced. Existing compatibility routes remain
available until the new runtime persistence adapters are production-ready.

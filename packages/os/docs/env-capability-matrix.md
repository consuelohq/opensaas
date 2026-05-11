# Environment Capability Matrix

Do not include real secret values in this file.

| Variable / Capability | Required for v1? | Required for pilot? | Used by | Secret? |
| --- | --- | --- | --- | --- |
| Server/App runtime | Yes | Yes | MCP server, Bun runbooks | No |
| `CONSUELO_GRAPHQL_URL` | Yes | Yes | GraphQL proof, workspace data runbooks | No |
| `CONSUELO_INTERNAL_GRAPHQL_API_KEY` | Yes | Yes | GraphQL proof, workspace data runbooks | Yes |
| Postgres | No | Later | Direct admin/data workflows | Yes |
| Redis | No | Later | Cache, queue, feature flag workflows | Yes |
| S3 Storage | No | Later | Workspace files, artifacts, reports | Yes |
| Google Auth/APIs | No | Later | Calendar, Gmail, Drive, Ads runbooks | Yes |
| Microsoft Auth/APIs | No | Later | Outlook, Teams, Graph runbooks | Yes |
| Email | No | Later | Draft/send follow-up runbooks | Yes |
| GHL | No | Pilot-dependent | CRM and campaign runbooks | Yes |
| Groq/OpenAI | No | Pilot-dependent | AI analysis and generation runbooks | Yes |
| Twilio | No | Later | Calling/SMS runbooks | Yes |
| Stripe | No | Later | Billing/revenue runbooks | Yes |
| PostHog | No | Later | Product analytics and behavior runbooks | Yes |
| Sentry | No | Later | Runtime observability runbooks | Yes |
| Railway/Deployment | No | Internal pilot | Deployment and environment proof | Yes |
| Meta Ads | No | Later | Ads review runbooks | Yes |
| Google Ads | No | Later | Ads review runbooks | Yes |

The first scaffold uses only GraphQL proof env. Other capabilities are documented so future scripts can declare runtime requirements and expose safe agent-facing metadata in the manifest.

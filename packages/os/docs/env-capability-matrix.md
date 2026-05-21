# Environment Capability Matrix

Do not include real secret values in this file.

| Variable / Capability | Required for v1? | Required for pilot? | Used by | Secret? |
| --- | --- | --- | --- | --- |
| Server/App runtime | Yes | Yes | OS portal, Bun skills | No |
| `CONSUELO_GRAPHQL_URL` | Yes | Yes | GraphQL proof, workspace data skills | No |
| `CONSUELO_INTERNAL_GRAPHQL_API_KEY` | Yes | Yes | GraphQL proof, workspace data skills | Yes |
| Postgres | No | Later | Direct admin/data workflows | Yes |
| Redis | No | Later | Cache, queue, feature flag workflows | Yes |
| S3 Storage | No | Later | Workspace files, artifacts, reports | Yes |
| Google Auth/APIs | No | Later | Calendar, Gmail, Drive, Ads skills | Yes |
| Microsoft Auth/APIs | No | Later | Outlook, Teams, Graph skills | Yes |
| Email | No | Later | Draft/send follow-up skills | Yes |
| GHL | No | Pilot-dependent | CRM and campaign skills | Yes |
| Groq/OpenAI | No | Pilot-dependent | AI analysis and generation skills | Yes |
| Twilio | No | Later | Calling/SMS skills | Yes |
| Stripe | No | Later | Billing/revenue skills | Yes |
| PostHog | No | Later | Product analytics and behavior skills | Yes |
| Sentry | No | Later | Runtime observability skills | Yes |
| Railway/Deployment | No | Internal pilot | Deployment and environment proof | Yes |
| Meta Ads | No | Later | Ads review skills | Yes |
| Google Ads | No | Later | Ads review skills | Yes |

The first scaffold uses only GraphQL proof env. Other capabilities are documented so future scripts can declare runtime requirements and expose safe agent-facing metadata in the manifest.

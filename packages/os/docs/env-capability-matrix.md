# Environment Capability Matrix

Do not include real secret values in this file.

| Variable / Capability | Required now? | Used by | Secret? |
| --- | --- | --- | --- |
| Server/App runtime | Yes | OS portal, Bun skills | No |
| `CONSUELO_GRAPHQL_URL` | Yes | GraphQL proof, workspace data skills | No |
| `CONSUELO_INTERNAL_GRAPHQL_API_KEY` | Yes | GraphQL proof, workspace data skills | Yes |
| Postgres | No | Direct admin/data workflows | Yes |
| Redis | No | Cache, queue, feature flag workflows | Yes |
| S3 Storage | No | Workspace files, artifacts, reports | Yes |
| Google Auth/APIs | No | Calendar, Gmail, Drive, Ads skills | Yes |
| Microsoft Auth/APIs | No | Outlook, Teams, Graph skills | Yes |
| Email | No | Draft/send follow-up skills | Yes |
| GHL | No | CRM and campaign skills | Yes |
| Groq/OpenAI | No | AI analysis and generation skills | Yes |
| Twilio | No | Calling/SMS skills | Yes |
| Stripe | No | Billing/revenue skills | Yes |
| PostHog | No | Product analytics and behavior skills | Yes |
| Sentry | No | Runtime observability skills | Yes |
| Railway/Deployment | No | Deployment and environment proof | Yes |
| Meta Ads | No | Ads review skills | Yes |
| Google Ads | No | Ads review skills | Yes |

The first scaffold uses only GraphQL proof env. Other capabilities are documented so future scripts can declare runtime requirements and expose safe agent-facing metadata in the manifest.

# Environment Capability Matrix

Do not include real secret values in this file.

| Variable / Capability | Required now? | Used by | Secret? |
| --- | --- | --- | --- |
| Server/App runtime | Yes | OS portal, Bun skills | No |
| `CONSUELO_APP_GRAPHQL_URL` | Yes | App object reads: snapshot, reporting source data | No |
| `CONSUELO_APP_GRAPHQL_API_KEY` | Yes | App object reads: snapshot, reporting source data | Yes |
| `CONSUELO_GRAPHQL_URL` | Backcompat | Legacy alias for app GraphQL URL | No |
| `CONSUELO_INTERNAL_GRAPHQL_API_KEY` | Backcompat | Legacy alias for app GraphQL key | Yes |
| `CONSUELO_APP_API_URL` | No | App Files API cloud artifact publishing | No |
| `CONSUELO_APP_API_KEY` | No | App Files API cloud artifact publishing | Yes |
| `CONSUELO_APP_URL` | No | App-visible file URL construction | No |
| `CONSUELO_OS_API_URL` | Future | Hosted OS control plane | No |
| `CONSUELO_OS_API_KEY` | Future | Hosted OS control plane | Yes |
| `CONSUELO_WORKSPACE_SNAPSHOT_QUERY` | No | Schema-specific workspace snapshot override | No |
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

GraphQL and app Files API are separate capabilities: GraphQL reads structured app objects, while the app Files API publishes app-visible artifacts through upload URLs and file records. The future Consuelo OS API is a separate control-plane capability.

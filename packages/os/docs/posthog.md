# PostHog API in Consuelo OS

PostHog is an **optional provider tool** in OS. It is available to every installed OS node, but no
data leaves a node unless its operator configures credentials and invokes a PostHog operation.
Website analytics and Device Authority install telemetry are separate integrations.

## Tool operations

- `posthog.config`: show active region, endpoint origins and **credential presence** (not values).
- `posthog.projects({ limit })`: list projects readable by the operator's personal API key.
- `posthog.query({ sql, projectId?, limit? })`: execute one **read-only HogQL** statement. Results
  are capped at 100 rows and responses at 2 MB.
- `posthog.capture({ event, distinctId, propertiesJson? })`: **explicitly** emit one event.
  The distinct id must be opaque (for example `anon_54bf`), not an email or phone number.
  Property keys containing common sensitive identifiers are rejected, as are email-like
  values. Do not send PII, phone numbers, call recordings, transcripts, content or credentials.
  `capture` is a mutating action; do not assume a failed request is safe to retry.

Use OS `tools.search({ query: "posthog" })` if the operations are not already in context.
The tool names are the same in the tool manifest for local OS and distributed OS.

## Credential ownership

Each **node/user supplies its own credentials**. Consuelo does not bundle an organization-wide
PostHog credential. Prefer local macOS Keychain entries, where supported, over putting a personal
API key in shell history, command arguments or repository files.

| Purpose | Environment variable | macOS Keychain service |
| --- | --- | --- |
| private read-only API queries | `POSTHOG_PERSONAL_API_KEY` | `consuelo-posthog-personal-api-key` |
| event ingestion | `POSTHOG_PROJECT_TOKEN` | `consuelo-posthog-project-token` |
| default project for queries | `POSTHOG_PROJECT_ID` | `consuelo-posthog-project-id` |
| US/EU region | `POSTHOG_REGION` (`us` or `eu`) | `consuelo-posthog-region` |

`POSTHOG_API_KEY` is accepted as a compatibility alias for the **ingestion project token**.
It must not be used as the personal API key. The supported PostHog Cloud regions are US
(`us.posthog.com`) and EU (`eu.posthog.com`). `POSTHOG_HOST` may specify the matching
HTTPS origin, but cross-region and insecure hosts are rejected.

To verify configuration without displaying a key:

```sh
bun run --cwd packages/os posthog config --json
```

To query (example):

```sh
bun run --cwd packages/os posthog query --sql 'SELECT event, count() FROM events GROUP BY event ORDER BY count() DESC LIMIT 20' --project-id 123 --limit 20 --json
```

For read API access, create a **least-privilege PostHog personal API key** with project-scoped
permissions. Ingestion project tokens are publishable in browser code, but must not grant
private queries. Project tokens can incur analytics volume/cost: only capture approved events.

## Instrumentation boundaries

- **Marketing website:** Its `MarketingLayout.astro` already has PostHog bootstrapping.
  Confirm that `PUBLIC_POSTHOG_KEY` is present **at build time**, and verify live
  HTML and PostHog Events after deployment. The project token is public; never expose
  a personal API key to `PUBLIC_*` variables.
- **Device Authority/installer:** Existing server-side observability uses a PostHog project token.
  Do not conflate this with the personal API key used by `posthog.query`.
- **Desktop/local OS:** No automatic tracking is enabled by the new tool.
- **Dialer:** Do not capture raw leads, phone numbers, recordings, transcripts, disposition
  notes, Twilio credentials or customer content. Before instrumenting dialer events, adopt
  a scoped event catalog, opaque IDs, opt-in/retention rules and separate workspace/project
  authorization. Suggested aggregate events: `dialer_session_started`, `dialer_session_finished`,
  `dialer_capacity_waited` with a non-identifying reason code.

API details: https://posthog.com/docs/api and https://posthog.com/docs/api/queries.

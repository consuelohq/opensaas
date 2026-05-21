# Data model context

The current internal Consuelo workspace data model is still evolving toward the output shape expected by Consuelo OS.

Skills must handle this gap gracefully. A skill should return `not_configured` or `query_failed` for missing schema/data-model support instead of crashing the OS runtime.

## Early GraphQL proof

The first scaffold uses GraphQL only to prove that the OS runtime can reach the Consuelo backend through configured environment variables.

Required environment variables for the proof:

- `CONSUELO_GRAPHQL_URL`
- `CONSUELO_INTERNAL_GRAPHQL_API_KEY`

Optional identity environment variables:

- `CONSUELO_WORKSPACE_ID`
- `CONSUELO_USER_ID`

The skill should report only:

- whether the env var exists
- GraphQL URL host
- query success/failure
- safe error messages


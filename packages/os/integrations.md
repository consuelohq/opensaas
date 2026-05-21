# Integrations

The OS scaffold documents integration requirements without wiring every provider.

## GraphQL

The initial proof surface is the internal Consuelo GraphQL API.

Environment variables:

- `CONSUELO_GRAPHQL_URL`
- `CONSUELO_INTERNAL_GRAPHQL_API_KEY`

The key must be provided through local/server environment only.

## Storage

The OS should model files as workspace files, reports, outputs, and artifacts.

Local filesystem is the first backend. S3 storage is a future backend. Skills should return artifact descriptors so the storage backend can change without changing the agent contract.


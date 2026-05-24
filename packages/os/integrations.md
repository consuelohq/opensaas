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

Local filesystem is the first OS artifact backend. Consuelo app Files and Attachments are the cloud/app source of truth, backed by the existing S3-compatible storage paths. The first workspace snapshot skill is read-only and returns file/attachment refs; a later cloud artifact adapter should create app-native file/artifact records with approval where needed. Mirage is future optional VFS evaluation over this app-native contract, not the first backend.


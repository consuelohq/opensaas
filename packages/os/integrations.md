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



## App-visible cloud artifacts

Cloud artifact publishing uses the Consuelo app Files API, not GraphQL. The adapter requests a presigned upload URL, uploads bytes to that URL, creates the app file record, optionally attaches the file to an explicitly supported target (`contact`, `call`, `company`, or `deal`), then looks up the file to return app-visible refs. Local artifacts remain the default and fallback path. OS does not direct-write S3 except through an app-provided upload URL.

Capability split:

- `consuelo-app-graphql`: read structured app objects.
- `consuelo-app-files-api`: publish app-visible Files/Attachments/S3 artifacts.
- `consuelo-os-api`: future hosted OS control plane.

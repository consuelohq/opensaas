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



## Workspace snapshot contract

The first real app-data contract is `consuelo-workspace-snapshot`. It returns app-native object refs for workspace identity, people, companies, lists, calls, files, attachments, tasks, notes, workflows, workflow runs, dashboards, artifacts, and recent activity.

Files and Attachments are included in the first slice because they are already a top-level Consuelo app surface and because downstream reports/design work need app-visible source references. This contract is read-only and must handle missing capability, auth failure, schema gaps, and empty workspaces without crashing.


## Cloud artifact refs

Artifact descriptors may include app-visible cloud fields in addition to local paths: `appFileId`, `appAttachmentId`, `storageKey`, `downloadUrl`, `appUrl`, and a `cloud` object with provider `consuelo-app-files`. These fields augment local artifact descriptors; they do not remove local artifact persistence.


## Sites page registry

OS Sites stores user-facing generated pages separately from raw artifacts. The registry lives at `<OS_HOME>/sites/.data/pages/registry.json` and tracks page ids, slugs, page kinds, the current version, immutable versions, source paths, source hashes, changed section ids, agent ids, trace ids, and timestamps.

The first safety rule is optimistic concurrency: publishing over an existing Sites page requires the current `baseVersion`. If an agent read an older version, the publish is rejected instead of silently overwriting newer work.

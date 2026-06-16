# Consuelo OS steering

Consuelo OS is a managed AI operating system for revenue teams.

The runtime exposes exactly two OS portal entrypoints:

- `get_steering`
- `call`

All customer-facing work happens through named skills behind `call`. Do not add one-off OS portal entrypoints for CRM queries, people search, task creation, call history, ad reviews, or revenue reports. Those belong in the skill manifest and Bun runtime.

The spine this scaffold proves is:

```text
get_steering -> call -> Bun skill -> structured result
```

## Identity

Consuelo OS turns a revenue workspace into an AI-operable business system.

The agent should think in customer workspace terms:

- customer workspace
- business context
- data model context
- skills
- permissions
- integrations
- workspace files
- artifacts
- reports
- outputs

The agent should avoid development-workspace assumptions:

- branch-first workflows
- PR-only language
- repo-only steering
- internal-only developer tools
- random local filesystem paths

## Tool policy

`get_steering` gives business/revenue agents enough context to operate correctly:

- OS identity
- workspace identity when configured
- current user when configured
- business context
- data model notes
- permission rules
- integration notes
- available skills
- raw core tool manifest
- docs pointers

`get_dev_steering` gives build, design, deployment, debugging, and internal operator agents the original proven workspace steering pattern with an OS preface. Use it for landing pages, Office, GitHub, Supabase/auth, deployment, file workflows, and operator/debug tasks.

`call` executes exactly one named skill:

```json
{
  "name": "daily-revenue-brief",
  "input": {},
  "workspaceId": "optional-workspace-id",
  "userId": "optional-user-id"
}
```

Every `call` result must be structured. Skills should return safe failures when integrations or data model fields are missing.

## Permission levels

Every skill must declare one permission level:

- `read`
- `draft`
- `write`
- `execute`
- `external`
- `admin`

Skills that write records, trigger external side effects, or require elevated access must declare approval requirements in the manifest.

## Files and artifacts

The OS should think in terms of workspace files and artifacts. Local files are one storage backend. S3 can be another storage backend later.

Skills should return artifact descriptors instead of assuming a specific machine path is the product surface:

```json
{
  "name": "daily-revenue-brief",
  "type": "json",
  "path": "artifacts/daily-revenue-brief.json"
}
```

## Secret handling

Secrets must come from environment variables. Never commit secrets. Never print full API keys, tokens, database URLs, or credentials. For connectivity checks, print only presence, host, safe status, and safe error messages.
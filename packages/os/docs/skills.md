# Skills

The default tool manifest is the agent-facing source of truth:

```text
packages/os/manifests/tool.manifest.json
```

Runtime implementations live in `packages/os/scripts/`. The current smoke skill is implemented at `packages/os/scripts/revenue/daily-revenue-brief.ts`.

## daily-revenue-brief

Purpose: prove the first Consuelo OS runtime spine.

Permission: `draft`

Approval: not required

Writes records: false

External side effects: false

Required env for GraphQL proof:

- `CONSUELO_GRAPHQL_URL`
- `CONSUELO_INTERNAL_GRAPHQL_API_KEY`

Example call:

```bash
bun --cwd packages/os ./scripts/os.ts call '{"name":"daily-revenue-brief"}'
```

Example output shape:

```json
{
  "ok": true,
  "name": "daily-revenue-brief",
  "permission": "read",
  "requiresApproval": false,
  "result": {
    "summary": "Daily revenue brief scaffold executed.",
    "workspaceStatus": "workspace_configured",
    "graphqlStatus": "connected",
    "nextSteps": []
  },
  "artifacts": []
}
```

Failure modes:

| Status | Meaning |
| --- | --- |
| `missing_env` | GraphQL URL or API key is absent. |
| `connected` | GraphQL responded successfully. |
| `not_configured` | GraphQL responded with an expected schema/data-model gap. |
| `query_failed` | The proof query failed for another safe reason. |

The skill should keep returning structured output even when the current data model is incomplete.


## Artifacts

`artifacts` is the top-level orchestration skill for durable generated output. Landing pages, guides, specifications, plans, reports, email, images, demos, and motion work are additive subskills. The skill teaches agents how to generate and validate source-first output, publish with `artifacts.publish`, and verify `/artifacts` plus immutable history.


### consuelo-workspace-snapshot

Purpose: read Consuelo workspace context for downstream agents.

Inputs: optional `limit` from 1 to 100.

Outputs: structured workspace snapshot with app-native object refs for workspace, people, companies, lists, calls, files, attachments, tasks, notes, workflows, workflow runs, dashboards, artifacts, and recent activity.

Capabilities: `CONSUELO_GRAPHQL_URL`, `CONSUELO_INTERNAL_GRAPHQL_API_KEY`, optional `CONSUELO_WORKSPACE_ID`, optional `CONSUELO_USER_ID`.

Failure modes: `MISSING_CAPABILITY`, `AUTH_FAILED`, `SCHEMA_GAP`, and `QUERY_FAILED`.

Guardrail: read-only. No uploads, app writes, S3 writes, file attach/detach, or Mirage dependency in this first slice.


### app-visible cloud artifacts

Skills that produce artifacts should continue creating local artifacts first. When app-visible publishing is requested and `consuelo-app-files-api` is configured, skills can call the cloud artifact adapter to publish the artifact through the Consuelo app Files API. This is separate from GraphQL snapshot reads and should be approval-gated by the calling skill when the output will be customer-facing or attached to business records.

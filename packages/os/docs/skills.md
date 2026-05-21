# Skills

The default tool manifest is the agent-facing source of truth:

```text
packages/os/tooling/tool-manifest.json
```

Runtime implementations live in `packages/os/scripts/`. The current smoke skill is implemented at `packages/os/scripts/revenue/daily-revenue-brief.ts`.

## daily-revenue-brief

Purpose: prove the first Consuelo OS runtime spine.

Permission: `read`

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

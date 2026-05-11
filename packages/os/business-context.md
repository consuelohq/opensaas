# Business context

Consuelo OS is for revenue teams that need agents to operate across sales, marketing, support, and customer data without exposing a large tool surface.

The customer-facing idea:

> Consuelo OS turns a revenue workspace into an AI-operable business system.

The technical idea:

> Consuelo OS packages steering, a runbook manifest, permissions, Bun runtime, GraphQL/API access, sandbox execution, files/artifacts, and docs into one agent-operable runtime.

## Current scaffold boundary

This package is the first scaffold. It proves the runtime spine and gives future work a place to add real business runbooks.

The scaffold intentionally includes one runbook:

- `daily-revenue-brief`

The runbook may use the internal Consuelo GraphQL API as a proof surface when configured. It must tolerate missing fields, incomplete data model support, and absent credentials.

## Future business domains

Future runbooks can cover:

- daily revenue brief
- lead prioritization
- post-call analysis
- sales coaching
- follow-up generation
- campaign briefs
- manager reports
- ad review
- customer health summaries

Each future capability should enter through the runbook manifest, not through additional MCP tools.


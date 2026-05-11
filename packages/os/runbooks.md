# Runbooks

Runbooks are the capabilities behind `call`.

The raw default manifest at `tooling/tool-manifest.json` is the source of truth for what business/revenue agents can discover. Bun scripts under `scripts/` are the runtime implementations.

## Current runbook

### daily-revenue-brief

Purpose: prove the OS runtime spine.

Flow:

```text
call("daily-revenue-brief") -> Bun runbook -> optional GraphQL proof query -> structured result
```

Permission: `read`

This runbook does not implement the full revenue brief. It reports scaffold status, GraphQL connectivity status, and next wiring steps.

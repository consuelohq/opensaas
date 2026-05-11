# Runbooks

Runbooks are the capabilities behind `call`.

The raw manifest at `tooling/runbook-manifest.json` is the source of truth. Documentation explains the manifest for humans and agents.

## Current runbook

### daily-revenue-brief

Purpose: prove the OS runtime spine.

Flow:

```text
call("daily-revenue-brief") -> Bun runbook -> optional GraphQL proof query -> structured result
```

Permission: `read`

This runbook does not implement the full revenue brief. It reports scaffold status, GraphQL connectivity status, and next wiring steps.


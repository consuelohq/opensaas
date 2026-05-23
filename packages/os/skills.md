# Skills

Skills are the capabilities behind `call`.

The raw default manifest at `tooling/tool-manifest.json` is the source of truth for what business/revenue agents can discover. Bun scripts under `scripts/` are the runtime implementations.

## Current skill

### daily-revenue-brief

Purpose: prove the OS runtime spine.

Flow:

```text
call("daily-revenue-brief") -> Bun skill -> optional GraphQL proof query -> structured result
```

Permission: `read`

This skill does not implement the full revenue brief. It reports scaffold status, GraphQL connectivity status, and next wiring steps.


## Consuelo Design

`consuelo-design` is the top-level orchestration skill for design artifact work. Landing pages are represented as the `landing-page` subskill/preset, not as the primary product skill. The skill teaches agents how to chain existing `consueloDesign.*` tools, template rules, browser validation, `design.publish`, and `/design-wiki` verification.

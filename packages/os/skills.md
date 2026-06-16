# Skills

Skills are the capabilities behind `call`.

The canonical full manifest at `manifests/tool.manifest.json` is the source of truth for what OS tools and skills exist. Default steering includes the generated core subset at `manifests/core.manifest.json`; use `tools.search` for extended tools. Bun scripts under `scripts/` are the runtime implementations.

## Current skill

### daily-revenue-brief

Purpose: prove the OS runtime spine.

Flow:

```text
call("daily-revenue-brief") -> Bun skill -> optional GraphQL proof query -> structured result
```

Permission: `read`

This skill does not implement the full revenue brief. It reports scaffold status, GraphQL connectivity status, and next wiring steps.


## Office

`office` is the top-level orchestration skill for design artifact work. Landing pages are represented as the `landing-page` subskill/preset, not as the primary product skill. The skill teaches agents how to chain existing `office.*` tools, template rules, browser validation, `design.publish`, and `/office` verification.


## Consuelo Workspace Snapshot

`consuelo-workspace-snapshot` is the first read-only Consuelo app connection skill. It reads workspace object refs through the configured GraphQL/API facade and includes Files and Attachments as first-class refs for downstream reports, briefs, design work, and future cloud artifacts. It does not upload files, write app records, mutate S3, or depend on Mirage.

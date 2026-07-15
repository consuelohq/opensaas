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

Permission: `draft`

This skill publishes a versioned HTML brief into the canonical Artifacts catalog while reporting GraphQL connectivity status and remaining production-data wiring.


## Artifacts

`artifacts` is the top-level orchestration skill for durable generated output. Landing pages, guides, specifications, plans, reports, email, images, demos, and motion work are additive subskills. The skill teaches agents how to generate and validate source-first output, publish with `artifacts.publish`, and verify `/artifacts` plus immutable history.


## Consuelo Workspace Snapshot

`consuelo-workspace-snapshot` is the first read-only Consuelo app connection skill. It reads workspace object refs through the configured GraphQL/API facade and includes Files and Attachments as first-class refs for downstream reports, briefs, design work, and future cloud artifacts. It does not upload files, write app records, mutate S3, or depend on Mirage.

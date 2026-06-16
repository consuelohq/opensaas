# Skills

Skills are the capabilities behind `call`.

The canonical full manifest at `manifests/tool.manifest.json` is the source of truth for what OS tools and skills exist. Default steering includes the generated core subset at `manifests/core.manifest.json`; use `tools.search` for extended tools. Bun scripts under `scripts/` are the runtime implementations.

## Tool recovery

Unknown tool calls return `NOT_FOUND` with structured recovery metadata instead of a bare failure. The recovery payload names the requested tool, the recommended manifest tool when confidence is high, candidate tools when the request is ambiguous, and a copy-safe `tools.search` call for follow-up discovery.

The OS facade does not auto-route invalid tool names. Agents should use the recommended tool for high-confidence aliases such as `mac.run` to `mac.call`, and should run `tools.search` when the payload returns multiple candidates for short aliases such as `run`, `exec`, `shell`, `read`, or `write`.

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


## Consuelo Workspace Snapshot

`consuelo-workspace-snapshot` is the first read-only Consuelo app connection skill. It reads workspace object refs through the configured GraphQL/API facade and includes Files and Attachments as first-class refs for downstream reports, briefs, design work, and future cloud artifacts. It does not upload files, write app records, mutate S3, or depend on Mirage.

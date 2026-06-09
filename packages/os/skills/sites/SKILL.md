# Sites skill

## Purpose

Sites is the local Consuelo OS site system. Use this skill when work involves generated work surfaces, local HTML pages, artifact-backed output, or the Office site category inside Sites.

Artifacts are the internal provenance, storage, and metadata layer. Sites is the user-facing place where generated work is organized for local review.

## Current local layout

```text
<OS_HOME>/sites/
<OS_HOME>/sites/index.html
<OS_HOME>/sites/office/
<OS_HOME>/sites/office/index.html
<OS_HOME>/sites/office/data/artifacts.json
<OS_HOME>/sites/office/assets/
<OS_HOME>/sites/traces/index.html
<OS_HOME>/sites/diffs/index.html
```

Do not create `sites/github/` yet. GitHub and workflow views are future Sites categories, not part of the current local scaffold.

## Office under Sites

Office is currently the artifact-backed Sites category for generated docs, reports, files, and pages. Artifact creation refreshes the Office site data under `sites/office/data/artifacts.json`.

## Commands

Use the canonical Sites command surface:

```bash
bun ./scripts/os.ts sites path
bun ./scripts/os.ts sites status
bun ./scripts/os.ts sites refresh
bun ./scripts/os.ts sites open
```

Each command supports `--json`.

`sites refresh` is repeatable and safe. It regenerates local Sites files from the current artifact database without deleting local OS configuration or user-owned skills/tools.

## Guardrails

- Treat `sites/` as the canonical local layout.
- Treat `sites/office/` as the current generated-work category.
- Do not treat `pages/office/` as canonical.
- Do not introduce public or hosted URL security assumptions in this local-only flow.
- Preserve artifacts as the storage/provenance layer rather than the user-facing product name.

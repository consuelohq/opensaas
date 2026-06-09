# Sites skill

## Purpose

Sites is the local Consuelo OS site system. Use this skill when work involves generated work surfaces, local HTML pages, artifact-backed output, or the Office site category inside Sites.

Artifacts are the internal provenance, storage, and metadata layer. Sites is the user-facing place where generated work is organized for local review.

## Current local layout

```text
<OS_HOME>/sites/
<OS_HOME>/sites/index.html
<OS_HOME>/sites/pages/
<OS_HOME>/sites/pages/index.html
<OS_HOME>/sites/pages/<slug>/index.html
<OS_HOME>/sites/pages/<slug>/versions/<versionId>/index.html
<OS_HOME>/sites/.data/pages/registry.json
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
bun ./scripts/os.ts sites publish --target <file-or-dir> --path /pages/<slug> --title <title> --kind <kind> [--base-version <id>]
```

Each command supports `--json`.

`sites refresh` is repeatable and safe. It regenerates local Sites files from the current artifact database without deleting local OS configuration or user-owned skills/tools.

## Guardrails

- Treat `sites/` as the canonical local layout.
- Treat `sites/office/` as the current generated-work category.
- Do not treat `pages/office/` as canonical.
- Do not introduce public or hosted URL security assumptions in this local-only flow.
- Preserve artifacts as the storage/provenance layer rather than the user-facing product name.


## Versioned Sites pages

`sites publish` writes generated local pages into the Sites page registry. Every publish creates an immutable version and updates the current page pointer. Existing pages require `--base-version <currentVersionId>` so multiple agents cannot silently overwrite one another. Use `--force-publish` only when Ko explicitly wants an intentional overwrite or recovery publish.

Supported page kinds for this first safety layer are `spec`, `plan`, `guide`, `trace`, `diff`, `office`, and `uncategorized`. Typed reader rendering, section patching, and leases are follow-up layers; do not hand-author those into Sites pages unless the current task explicitly asks for them.

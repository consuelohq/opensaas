# Office

Use this skill when Ko asks about Consuelo OS Office, local Office pages, generated docs/reports/files/pages, traces, diffs, GitHub/workflow views, or the artifact-backed workspace surface inside an installed OS home.

## Product model

Office is the AI-native office suite for local Consuelo OS workspaces. It is the user-facing place for generated work: docs, reports, files, pages, tables, traces, diffs, GitHub/workflow views, and future database-backed live documents.

Artifacts are the durable internal provenance and storage records behind Office. Keep the technical artifact database/table/storage concept intact. Use Office as the user-facing name when discussing generated work or local pages.

## Local page layout

Office pages live under `<OS_HOME>/pages`:

```text
<OS_HOME>/pages/
<OS_HOME>/pages/office/
<OS_HOME>/pages/office/index.html
<OS_HOME>/pages/office/data/artifacts.json
<OS_HOME>/pages/office/assets/
<OS_HOME>/pages/traces/
<OS_HOME>/pages/diffs/
<OS_HOME>/pages/github/
```

The `office` page is artifact-backed today. The traces, diffs, and GitHub surfaces are reserved local page slots for product shape and future expansion.

## Commands

Use the OS CLI command surface when a user or agent needs to find or refresh Office:

```bash
bun ./scripts/os.ts office path
bun ./scripts/os.ts office status
bun ./scripts/os.ts office refresh
bun ./scripts/os.ts office open
```

Add `--json` when a script or agent needs machine-readable output.

## Refresh rules

Office should stay fresh after generated work changes. Artifact creation refreshes the local Office page automatically. If a page looks stale, run `office refresh`. Refreshing Office is repeatable and safe to rerun.

## Language

Prefer:

```text
Office stores generated docs, reports, files, and pages.
```

Use artifacts for implementation details:

```text
Artifacts are durable provenance/storage records behind Office.
```

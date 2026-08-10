# Consuelo Artifacts operator reference

This reference governs durable generated output in Consuelo OS.

## Definition

An artifact is materialized output with:

- a stable `/artifacts/...` route
- a current version
- immutable historical versions
- a category and template classification
- stored files with integrity metadata
- optional execution trace and skill provenance

Prompts, pending projects, and work orders are inputs to artifact creation. They are not catalog artifacts until rendered output exists.

## System boundaries

Canonical implementation:

```text
packages/os/scripts/artifacts.ts
packages/os/scripts/lib/artifacts.ts
packages/os/scripts/server/routes/artifacts.ts
packages/os/scripts/server/services/artifacts-gateway.ts
packages/os/skills/artifacts/
```

Canonical runtime data:

```text
<OS_HOME>/artifacts/catalog.json
<OS_HOME>/artifacts/current/<route>/
<OS_HOME>/artifacts/versions/<route>/<version-id>/
<OS_HOME>/sites/artifacts/index.html
<OS_HOME>/sites/artifacts/data/catalog.json
```

Do not read from or write to retired archive, vendored Open Design runtime, or workspace publisher locations.

## Standard flow

1. Load steering and the relevant design context.
2. Select the closest subskill.
3. Create or update source files.
4. Render a file or directory with `index.html`.
5. Validate the rendered output in a browser.
6. Publish with `artifacts.publish` and the current base version when updating.
7. Verify `/artifacts`, the stable artifact route, and history.
8. Report source, route, artifact ID, version ID, validation, and approval-gated actions.

## Tool calls

```ts
await workspace.call({ tool: "artifacts.check", input: {}, timeout: 120 })
await workspace.call({ tool: "artifacts.listSkills", input: {}, timeout: 120 })
await workspace.call({ tool: "artifacts.listDesignSystems", input: {}, timeout: 120 })
await workspace.call({ tool: "artifacts.uiStatus", input: {}, timeout: 120 })
```

Publish materialized output:

```ts
await workspace.call({
  tool: "artifacts.publish",
  input: {
    target: "/absolute/path/to/rendered-output",
    path: "/specs/example",
    name: "Example Specification",
    category: "specs",
    template: "spec",
    baseVersion: "<current-version-when-updating>"
  },
  timeout: 120
})
```

Generation tools create design sessions or work orders. They do not create catalog entries by themselves:

```ts
await workspace.call({
  tool: "artifacts.generateWebsite",
  input: { name: "Campaign landing page", prompt: "...", dryRun: true },
  timeout: 600
})
```

## Revision safety

- A first publish creates version 1.
- An update must provide the current base version.
- A mismatch must fail instead of overwriting another revision.
- A rollback creates a new version whose bytes match the selected historical version.
- Force publishing is reserved for an explicitly approved recovery.

## Validation

For visual artifacts, verify:

- the stable route loads
- internal assets load under the same route
- mobile and desktop layout
- keyboard and focus behavior
- accessible names and hierarchy
- metadata title and description
- `/artifacts` lists the new current version
- historical version routes still load

## Open Design

Open Design is optional generation machinery. Use it for live visual iteration only when requested. The canonical facade remains `bun run artifacts`; direct Open Design commands and legacy publisher scripts are not public contracts.

## Templates

Consuelo digital-guide templates live under:

```text
packages/consuelo-design/templates/digital-eguides/
```

Use the current `packages/consuelo-website/DESIGN.md` and `areas/consuelo-design/AGENTS.md` as design truth. Do not copy template rules into new command implementations.

## Approval

Local drafting, rendering, and validation are allowed at the draft tier. External publication, customer-facing replacement, spend, destructive changes, or other external side effects require explicit approval.

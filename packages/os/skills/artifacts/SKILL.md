---
name: artifacts
description: Use for durable Consuelo artifact work, including websites, landing pages, digital guides, specifications, plans, reports, demos, HTML email, images, motion frames, HyperFrames, publishing, history, and rollback.
---

# Artifacts

Artifacts is the canonical Consuelo OS domain for durable generated outputs. An artifact has a stable route, current version, immutable version history, rendered files, classification, and optional trace or skill provenance.

A prompt, pending project, or work order is not an artifact. It becomes an artifact only after output has been materialized and published.

## Core workflow

```text
brief
  -> choose the closest subskill
  -> read the required design and template context
  -> create or edit source-first output
  -> render materialized output
  -> validate in browser
  -> publish with artifacts operation=publish
  -> verify /artifacts and the stable artifact route
  -> report source, durable link, version, validation, and remaining decisions
```

Use the live Open Design UI only when Ko explicitly asks for visible collaboration, manual iteration, project inspection, or a headed preview workspace.

## Required context

For substantial visual work, read only the relevant current sources:

- `areas/consuelo-design/AGENTS.md`
- `packages/consuelo-website/DESIGN.md`
- the selected subskill under `subskills/`
- any template explicitly required by that subskill

The packaged operator reference is available at `references/agents.md`.

## Canonical commands and tools

Use `bun run artifacts` and the canonical `artifacts` tool with an explicit `operation`. Do not use retired dotted artifact tools, archive names, or workspace publishing fallbacks.

Primary operations:

- `artifacts({ operation: "publish", ... })` — publish a materialized file or directory to a stable route.
- `artifacts({ operation: "refresh" })` — regenerate the Artifacts index and catalog output.
- `artifacts({ operation: "check" })` — validate catalog and stored artifact files.
- `artifacts({ operation: "generate.website" | "generate.digital-eguide" | "generate.email" | ... })` — create work orders or design sessions.
- `artifacts({ operation: "schedule.publish", schedule, reportFile, taskSession })` — publish a Daily Schedules report plus the generated task workpad for that task session.
- `bun run artifacts history --id <artifact-id>` — inspect immutable versions.
- `bun run artifacts rollback --id <artifact-id> --version-id <version-id>` — create a new current version from an earlier immutable version.

## Publishing rules

1. Publish only materialized output containing an `index.html` entrypoint.
2. Use a stable route such as `/specs/os-architecture` or `/guides/revenue-operations`.
3. Existing artifacts require the current base version. Never silently overwrite another agent's revision.
4. Use force publishing only for an intentional, explicitly approved recovery.
5. Verify the rendered page, `/artifacts`, and version history after publishing.
6. Do not dual-write to retired archives or create a second artifact-site output tree.

## Subskills

Subskills are additive presets for artifact-specific generation and validation:

- `landing-page.json`
- `spec.json`
- `research-guide.json`
- `digital-eguide.json`
- `plan.json`
- `html-email.json`
- `motion-frame.json`
- `hyperframes.json`

## Approval gates

Drafting, local generation, rendering, and validation are allowed at the draft permission tier. External publishing, customer-facing replacement, spend, destructive changes, or other external side effects require explicit approval.

## Reporting

For published work, report:

- source path or project/work-order location
- `/artifacts/...` durable route
- artifact ID and current version ID
- browser or accessibility validation evidence
- approval-gated next actions

# align consuelo design tooling with headless execution

branch: `task/workspace-agents/align-consuelo-design-tooling-with-headless-execution`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/382
started: 2026-05-13

## acceptance criteria

- [x] Confirm whether current `consueloDesign.generate*` tooling defaults to UI/chat operation.
- [x] Make `generate ...` default to a headless work order instead of opening/sending to Open Design UI.
- [x] Preserve explicit live UI session path behind `--live` / `live: true`.
- [x] Update prompt wording so generated prompt is a work order, not a chat message.
- [x] Update typed schema/tool docs to expose `live?: boolean`.
- [x] Validate headless e-guide generation writes a work order and does not include old live-preview instruction.
- [x] Validate live session dry-run still returns the old UI plan.

## findings

The underlying tooling was not aligned with Ko's desired flow. `generate digital-eguide` created/opened an Open Design project and stored a `pendingPrompt`; the prompt included "Start with a useful artifact in the Open Design preview..." and the Consuelo design AGENTS text still described Open Design as a live workspace. This pushed agents toward sending the prompt into Open Design chat, which is the behavior Ko rejected.

## changes

- `packages/workspace/scripts/consuelo-design.ts`
  - added `--live` / `--ui-session`
  - made generate/render workflows return `mode: headless-work-order` by default
  - write work orders under `.od/consuelo/archive/work-orders/`
  - keep old UI project creation behind `--live`
  - replaced preview/chat prompt language with work-order language
- `packages/workspace/scripts/lib/facade/schemas.ts`
  - added `live?: boolean` to Consuelo design session/digital-e-guide inputs
- `packages/workspace/tooling/tool-manifest.json`
  - added boolean `live` flag mapping to `--live`
  - updated descriptions to headless work order default
- generated docs/types
  - `packages/workspace/TOOLS.md`
  - `packages/workspace/src/generated/workspace.d.ts`
- docs updated
  - `areas/consuelo-design/AGENTS.md`
  - `packages/consuelo-design/README.md`
  - `packages/consuelo-design/templates/digital-eguides/README.md`

## validation

- `generate digital-eguide --template research --name test-headless --prompt Brief --json`
  - returned `mode: headless-work-order`
  - wrote work order file
  - included research template + reader shell paths
  - did not include old "Start with a useful artifact in the Open Design preview" language
- `generate digital-eguide --template research --name test-live --prompt Brief --live --dry-run --json`
  - returned `mode: live-open-design-session`
  - preserved `corepack pnpm tools-dev start web --json` plan
- `tool-runner consueloDesign.generateDigitalEguide` headless path passed
- `tool-runner consueloDesign.generateDigitalEguide` with `live:true,dryRun:true` passed
- `bun run generate-docs` passed
- `bun run generate-types` passed

## notes for ko

This makes the generated prompt a work order/spec by default. Agents should now read it and create/edit local artifact source directly, then publish through durable `design.publish`. The headed UI route still exists, but only with `--live` / `live: true`.

## publish checklist

```bash
bun run task:push -- --message "feat(workspace): make consuelo design headless by default" --changed
bun run task:pr
```
- Refined headless JSON shape to return `artifact` + `workOrder` instead of `project.pendingPrompt` so the default path no longer exposes Open Design chat wording.
- Re-ran CLI and tool-runner validations after the shape change; headless output has no `pendingPrompt` field and live dry-run still uses `project.pendingPrompt` only for explicit `--live`.
- Re-ran `generate-docs`, `generate-types`, `consuelo-design check`, and `git diff --check` after final shape update.

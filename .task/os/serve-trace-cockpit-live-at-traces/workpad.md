# serve trace cockpit live at traces

Task branch: task/os/serve-trace-cockpit-live-at-traces
Source: main
Session: tsk_4a1c774a9388

Goal: replace the generated /traces placeholder with the approved cockpit UI direction and wire browser code only to /gateway/traces/* routes.

Out of scope: Astro migration unless required for shell preservation.

Test-first contract: materializeSites writes a real trace cockpit shell with gateway data hooks, mobile hooks, KPI cards, heatmap, inspect-next, and trace table affordances; no local/backend leaks.

Validation: pending.

- 2026-06-18 15:57:43 write: `.task/os/serve-trace-cockpit-live-at-traces/workpad.md`

## files changed

- `packages/os/scripts/lib/sites.ts`
- `packages/os/tests/sites-trace-cockpit.test.ts`

## workspace-owned: files changed

- `packages/os/scripts/lib/sites.ts`
- `packages/os/tests/sites-trace-cockpit.test.ts`

## workspace-owned: activity log

- 2026-06-18 15:57:43 fs.write: `.task/os/serve-trace-cockpit-live-at-traces/workpad.md`
- 2026-06-18 16:00:03 write: `packages/os/tests/sites-trace-cockpit.test.ts`
- 2026-06-18 16:00:03 fs.write: `packages/os/tests/sites-trace-cockpit.test.ts`
- 2026-06-18 16:01:09 write: `packages/os/tests/sites-trace-cockpit.test.ts`
- 2026-06-18 16:01:09 fs.write: `packages/os/tests/sites-trace-cockpit.test.ts`
- 2026-06-18 16:02:50 write: `packages/os/scripts/lib/sites.ts`
- 2026-06-18 16:02:50 fs.write: `packages/os/scripts/lib/sites.ts`
- 2026-06-18 16:08:39 fs.write: `.task/os/serve-trace-cockpit-live-at-traces/workpad.md`

## workspace-owned: validation evidence

- 2026-06-18 16:04:36 `review.run`: passed — OK
- 2026-06-18 16:07:56 `review.run`: passed — OK
- 2026-06-18 16:09:04 `verify`: passed — OK

## workspace-owned: files read

- `packages/os/scripts/lib/sites.ts`

- 2026-06-18 16:06:48 apply-patch: `packages/os/scripts/lib/sites.ts`

## implementation

- Added a Trace cockpit shell in `packages/os/scripts/lib/sites.ts`.
- `materializeSites()` now writes that shell for `sites/traces/index.html`; other reserved Sites still use the existing placeholder path.
- Added `packages/os/tests/sites-trace-cockpit.test.ts` to pin cockpit copy, gateway-only routes, mobile/data hooks, and no local/backend leaks.
- No Astro dependency was added.

## validation evidence

- Red: `tests/sites-trace-cockpit.test.ts` failed because `/traces` was still the reserved placeholder; trace `trc_9a4369c2eca7`.
- Green: focused cockpit test and typecheck passed; trace `trc_dacb82b37913`.
- Guardrails passed: `sites-cli`, `trace-sites-gateway-read-layer`, `workspace-edge-sites-gateway-integration` with `CONSUELO_RUN_WORKSPACE_GATEWAY_CONTRACTS=1`, and `bun --cwd packages/os typecheck`; trace `trc_60b5f4d8d3d5`.
- Review passed with zero issues; trace `trc_310d9e1b252a`.

## note

- `tests/trace-sites-gateway-live-endpoints.test.ts` still has an optional Vitest runtime issue importing `bun:sqlite`; this is outside this shell change and was not modified.

- 2026-06-18 16:08:39 append: `.task/os/serve-trace-cockpit-live-at-traces/workpad.md`

## workspace-owned: test selection

- changed files: `.task/os/serve-trace-cockpit-live-at-traces/current.json`, `.task/os/serve-trace-cockpit-live-at-traces/evidence-log.json`, `.task/os/serve-trace-cockpit-live-at-traces/read-log.json`, `.task/os/serve-trace-cockpit-live-at-traces/session.json`, `.task/os/serve-trace-cockpit-live-at-traces/workpad.md`, `.task/tasks/os/serve-trace-cockpit-live-at-traces.json`, `packages/os/scripts/lib/sites.ts`, `packages/os/tests/sites-trace-cockpit.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

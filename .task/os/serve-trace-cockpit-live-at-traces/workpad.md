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
- 2026-06-18 16:10:25 fs.write: `.task/os/serve-trace-cockpit-live-at-traces/workpad.md`
- 2026-06-18 16:13:33 fs.write: `.task/os/serve-trace-cockpit-live-at-traces/workpad.md`
- 2026-06-18 16:16:01 fs.write: `.task/os/serve-trace-cockpit-live-at-traces/workpad.md`
- 2026-06-18 16:21:14 fs.write: `.task/os/serve-trace-cockpit-live-at-traces/workpad.md`

## workspace-owned: validation evidence

- 2026-06-18 16:04:36 `review.run`: passed — OK
- 2026-06-18 16:07:56 `review.run`: passed — OK
- 2026-06-18 16:09:04 `verify`: passed — OK
- 2026-06-18 16:17:11 `verify`: passed — OK
- 2026-06-18 16:22:00 `verify`: passed — OK

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

- changed files: `.task/os/serve-trace-cockpit-live-at-traces/current.json`, `.task/os/serve-trace-cockpit-live-at-traces/evidence-log.json`, `.task/os/serve-trace-cockpit-live-at-traces/read-log.json`, `.task/os/serve-trace-cockpit-live-at-traces/session.json`, `.task/os/serve-trace-cockpit-live-at-traces/verify.json`, `.task/os/serve-trace-cockpit-live-at-traces/workpad.md`, `.task/tasks/os/serve-trace-cockpit-live-at-traces.json`, `packages/os/scripts/lib/sites.ts`, `packages/os/tests/sites-trace-cockpit.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## publish update

- Final push created commit `27d408e39790cf39423c98797c2ee0412971fa62` with message `feat(os): serve trace cockpit shell`.
- The published task changes are intentionally narrow: `packages/os/scripts/lib/sites.ts` and `packages/os/tests/sites-trace-cockpit.test.ts`, plus task metadata.
- This preserves the approved cockpit UI direction in the downloaded OS `/traces` shell without adding Astro or changing gateway service ownership.

- 2026-06-18 16:10:25 append: `.task/os/serve-trace-cockpit-live-at-traces/workpad.md`

## final agent-authored workpad update

What changed:
- Replaced only the generated `sites/traces/index.html` path with the approved Trace cockpit shell.
- Added a focused test that fails on the old placeholder shell and passes only when the cockpit shell, gateway routes, data hooks, and leak guards are present.

Why it changed:
- Ko confirmed the existing cockpit UI/UX should be preserved; the repo was still generating a generic reserved placeholder for `/traces`.
- This task captures that cockpit as the downloaded OS source-of-truth without adding Astro or redesigning the Site.

Validation run:
- Red: `tests/sites-trace-cockpit.test.ts` failed on the reserved placeholder.
- Green: `sites-trace-cockpit`, `sites-cli`, `trace-sites-gateway-read-layer`, `workspace-edge-sites-gateway-integration`, package typecheck, review, and verify passed.

Issues:
- `trace-sites-gateway-live-endpoints.test.ts` still has an unrelated Vitest `bun:sqlite` import issue when run under Vitest.

Follow-ups:
- Wire richer reports and live stream data into the cockpit as a separate backend/data task.
- Consider Astro only as a parity-preserving shell extraction task, not as part of this shell wiring commit.

- 2026-06-18 16:13:33 append: `.task/os/serve-trace-cockpit-live-at-traces/workpad.md`

- 2026-06-18 16:16:01 write: `.task/os/serve-trace-cockpit-live-at-traces/workpad.md`

## implementation checkpoint

The task replaces the generated `/traces` placeholder with the approved Trace cockpit shell, keeps the work in OS Sites generation, and preserves gateway-only browser data access. Validation passed for the focused cockpit test, Sites CLI coverage, Trace gateway read-layer coverage, workspace edge Sites gateway integration, package syntax/typecheck, review, and verify. Follow-up remains backend data depth: richer report endpoints and fuller live stream data can be wired into this shell separately.

- 2026-06-18 16:21:14 append: `.task/os/serve-trace-cockpit-live-at-traces/workpad.md`

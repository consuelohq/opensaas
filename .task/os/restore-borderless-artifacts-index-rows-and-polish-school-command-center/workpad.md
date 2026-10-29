# Restore borderless Artifacts index rows and polish School command center

branch: `task/os/restore-borderless-artifacts-index-rows-and-polish-school-command-center`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/2659
started: 2026-10-29

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(os): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/consuelo-website/public/images/home/consuelo-mark.svg`
- `packages/consuelo-website/public/logo.svg`
- `packages/os/definitely-missing.json`
- `packages/os/scripts/build-runtime-bundle.ts`
- `packages/os/scripts/lib/artifacts.ts`
- `packages/os/tests/artifacts.test.ts`
- `packages/os/tests/distribution/runtime-bundle.test.ts`
- `packages/os/tests/workspace-fluid-layout.test.ts`

## Test-first contract — School and Artifacts refinement

Goal: Restore one-per-row Artifacts index without boxed cards or full-row hover, keep responsive shared wrapper; School Home and Assignments should have no decorative dividing rules or boxed cards, hover only text, and visible due times must keep AM/PM together. Move all School quick links to just under the Home headline/date, add an Assignments link among them, remove the redundant orange All assignments CTA and bottom quick-links section. Preserve all 60 assignment IDs, data, browser-only completion key, and workspace chrome navigation.

Existing code pattern: `packages/os/scripts/lib/artifacts.ts` builds the Artifacts index and uses `workspace-fluid-layout.test.ts`. School is independent source under `~/Consuelo/Artifacts/School/template.html` with Bun build and `school-ui.test.ts`; its published artifact requires base-version compare. No new or changed class facts, scheduling, or academic work.

New/changed tests: OS regression ensures Artifacts one-column row layout, absence of bordered card styles, links/share/search. School tests ensure quick access before stats/timeline with no repeated bottom section, no hero All assignments link, date/time fragments with unsplittable time, unchanged IDs/storage, and CSS structural requirements. Add real-browser computed-style/hover/viewport checks (390, 768, 1024, 1366 and desktop) and run existing School completion smoke.

Red command: `bunx vitest run packages/os/tests/workspace-fluid-layout.test.ts`; School `bun run build.ts && bun test school-ui.test.ts`. Expected red: old Artifacts grid-style assertion contract and new row layout regression fail; School quick-links placement / clock spans fail.

Risk/constraints: Do not alter shared workspace chrome for other surfaces, do not remove semantic affordance of checkbox or focus indicators; remove decoration rather than functional controls. Work in scoped task worktree and separate School work session. Complete OS through stream PR (not main/deploy), School through published new existing artifact version. No calendar actions.

- 2026-10-29 03:12:17 append: `.task/os/restore-borderless-artifacts-index-rows-and-polish-school-command-center/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-29 03:12:17 fs.write: `.task/os/restore-borderless-artifacts-index-rows-and-polish-school-command-center/workpad.md`
- 2026-10-29 03:12:34 apply-patch: `packages/os/tests/workspace-fluid-layout.test.ts`
- 2026-10-29 03:13:16 apply-patch: `packages/os/scripts/lib/artifacts.ts`
- 2026-10-29 03:16:55 write: `.task/os/restore-borderless-artifacts-index-rows-and-polish-school-command-center/.qa/artifacts-row-visual.ts`
- 2026-10-29 03:16:55 fs.write: `.task/os/restore-borderless-artifacts-index-rows-and-polish-school-command-center/.qa/artifacts-row-visual.ts`
- 2026-10-29 03:18:22 append: `.task/os/restore-borderless-artifacts-index-rows-and-polish-school-command-center/workpad.md`
- 2026-10-29 03:18:22 fs.write: `.task/os/restore-borderless-artifacts-index-rows-and-polish-school-command-center/workpad.md`
- 2026-10-29 03:18:22 apply-patch: `packages/os/tests/workspace-fluid-layout.test.ts`
- 2026-10-29 03:18:38 apply-patch: `packages/os/scripts/lib/artifacts.ts`
- 2026-10-29 03:19:01 apply-patch: `.task/os/restore-borderless-artifacts-index-rows-and-polish-school-command-center/.qa/artifacts-row-visual.ts`
- 2026-10-29 03:19:26 fs.trash: `.task/os/restore-borderless-artifacts-index-rows-and-polish-school-command-center/.qa`
- 2026-10-29 03:19:26 fs.write: `.task/os/restore-borderless-artifacts-index-rows-and-polish-school-command-center/workpad.md`
- 2026-10-29 03:20:19 fs.write: `.task/os/restore-borderless-artifacts-index-rows-and-polish-school-command-center/workpad.md`
- 2026-10-29 03:23:35 fs.write: `.task/os/restore-borderless-artifacts-index-rows-and-polish-school-command-center/workpad.md`
- 2026-10-29 03:24:24 fs.write: `.task/os/restore-borderless-artifacts-index-rows-and-polish-school-command-center/workpad.md`
- 2026-10-29 03:25:30 fs.write: `.task/os/restore-borderless-artifacts-index-rows-and-polish-school-command-center/workpad.md`

## Implementation and evidence (2026-10-29)

`packages/os/scripts/lib/artifacts.ts` now shows one full-width row per artifact with unboxed title/path, separate timestamp, and Share; no card grid or whole-row hover; filters/search/Share and workspace chrome preserved. Invalid OS PNG mark repaired from pre-existing Consuelo website black/white transparent marks (matching alpha masks) and theme-aware `<picture>` + favicon. `packages/os/tests/workspace-fluid-layout.test.ts` red-before-green covers row layout, no card grid, valid embedded data URIs, and prior responsive chrome. OS targeted 19 tests pass (5 suites). Real Chrome previews of 9 artifacts at 1600/390/1024px: each item occupies a single unboxed row; no horizontal overflow, no row hover fill, Share controls preserved and logo loads in dark theme. Temporary screenshot fixtures under task `.qa` removed before push.

Separate School source `~/Consuelo/Artifacts/School` updated: Home quick links moved under hero date, redundant All assignments CTA/bottom section removed, all decorative dividers/borders removed from Home, Assignments, cards, local nav and School chrome while preserving actual checkbox and keyboard focus affordance; date/clock displayed as atomic spans on both pages. School 16 Bun tests (3 suites) pass; original Chrome smoke 72 viewport/menu/completion checks and 25 assignment workflow checks pass; new `school-polish-smoke.ts` validates 5 screen sizes with 76 checks, including time wrapping, zero dividers/overflow and row-hover background. `code.call` could not start macOS Chrome due sandbox ProcessSingleton; OS `mac.call` host fallback completed cross-viewport browser QA, no other host modifications. No School assignment JSON, calendar event, source URL or completion key changed.

- 2026-10-29 03:19:26 append: `.task/os/restore-borderless-artifacts-index-rows-and-polish-school-command-center/workpad.md`

## workspace-owned: validation evidence

- 2026-10-29 03:19:43 `review.run`: passed — OK
### Publication / validation status
School existing artifact `artifact-8da95445a80bccc4` `/school` v8 published from verified v7 base `2026-10-29T02-58-41-148Z` to `2026-10-29T03-19-49-054Z`; integrity `artifacts.check`: 75 artifacts, 0 missing. Actual internal browser returned Google login redirect in this tool session (not authenticated); live page could not be independently visually inspected, but source and sandboxed rendering were verified. No calendar events changed.
Strict OS review completed with 0 blockers. Targeted OS 19 tests in 5 suites pass; Playwright Artifacts test confirms 9 rows unboxed and valid logo at 1600/390/1024. OS full verify running; prior stream OS baseline had an unrelated PostHog MCP classifier mismatch, so report that honestly if still present. No main merge/deploy is authorized by this request.
- 2026-10-29 03:20:19 append: `.task/os/restore-borderless-artifacts-index-rows-and-polish-school-command-center/workpad.md`
- 2026-10-29 03:21:27 `verify`: failed — COMMAND_FAILED
- 2026-10-29 03:21:36 `verify`: failed — COMMAND_FAILED
### Runtime-bundle regression fix (test-first)
The full verify found a layout-induced packaging regression: the real customer closure smoke failed because `assets/consuelo-mark-white.png` was missing in the installed bundle. Root cause: runtime-bundle `DEFAULT_DISCOVERY_PATHS` and `classifyRuntimeBundlePath` whitelist only `assets/consuelo-mark.png`. Test first: assert the new dark asset has role `runtime` in `classifyRuntimeBundlePath` and is in the built manifest; run focused test red (existing clean-host smoke already red with missing asset). Fix both explicit whitelist and default discovery, rerun real customer closure and original focused gallery tests. Keep unrelated PostHog MCP mismatch untouched.
- 2026-10-29 03:23:35 append: `.task/os/restore-borderless-artifacts-index-rows-and-polish-school-command-center/workpad.md`
- 2026-10-29 03:23:39 apply-patch: `packages/os/tests/distribution/runtime-bundle.test.ts`
- 2026-10-29 03:24:04 apply-patch: `packages/os/scripts/lib/distribution/runtime-bundle.ts`
### Distribution regression resolved
Added a new test expectation for `assets/consuelo-mark-white.png` to both classifier and runtime bundle manifest, confirmed red (`expect(null).toBe('runtime')`). Corrected `packages/os/scripts/lib/distribution/runtime-bundle.ts` `DEFAULT_DISCOVERY_PATHS` and `classifyRuntimeBundlePath` to include new mark without broadening other asset permissions. Focused green: 37/37 tests in Artifacts, workspace fluid layout, artifact routes/sharing, and distribution runtime bundle; the real customer closure clean-host parity test passed (8.25s). No user academic work/data touched. Known unrelated PostHog classifier mismatch remains owner-scoped.
- 2026-10-29 03:24:24 append: `.task/os/restore-borderless-artifacts-index-rows-and-polish-school-command-center/workpad.md`
- 2026-10-29 03:24:43 `review.run`: passed — OK

## Final full-suite results and release boundary

After runtime bundle fix: broad `bun run --cwd packages/os test`: 3,502 passed, 1 failed, 161 skipped, 7 todo, 409 test files. The **sole** failure is pre-existing `tests/mcp-central-proxy-scope.test.ts` read-only central classifier mismatch (generated PostHog `posthog.config`, `posthog.projects`, `posthog.query` absent from central facade constants). This task touches neither PostHog nor central classifier. Strict `review.run` against origin/stream/os: 0 blocking issues, eslint+typecheck+static/spec pass. Runtime bundle contract 21/21 pass including clean-host closure, gallery/Artifact subset 37/37 pass. GUI browser 3 sizes logo/rows and 5 School sizes clocks/hover pass. OS verify's `publishValid` remains false until independently owned PostHog classifier is reconciled; do NOT claim green overall, do NOT merge main/deploy. Publish task to stream/os for review and leave broader release gate to owners. Existing School v8 published separately as a durable artifact and does not require OS rollout.

- 2026-10-29 03:25:30 append: `.task/os/restore-borderless-artifacts-index-rows-and-polish-school-command-center/workpad.md`

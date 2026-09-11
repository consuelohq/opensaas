# prototype feature story stage remember observe

branch: `task/website/prototype-feature-story-stage-remember-observe`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2354
started: 2026-09-01

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/consuelo-website/src/components/home/FeatureStoryMemory.astro`
- `packages/consuelo-website/src/components/home/FeatureStoryObserve.astro`

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
bun run task:push -- --message "type(website): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/consuelo-website/AGENTS.md`
- `packages/consuelo-website/COMPONENTS.md`
- `packages/consuelo-website/DESIGN.md`
- `packages/consuelo-website/src/components/home/FeatureEvidenceFigure.astro`
- `packages/consuelo-website/src/components/home/FeatureMedia.astro`
- `packages/consuelo-website/src/components/home/HomeFeaturePreview.astro`
- `packages/consuelo-website/src/content/home-content.ts`
- `packages/consuelo-website/src/styles/primitives.css`
- `packages/consuelo-website/src/styles/tokens.css`
- `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`
- `packages/consuelo-website/tests/website-structure.test.js`

## Acceptance criteria

- Replace the current 3x2 feature grid with a six-chapter editorial/scrollytelling system that keeps a consistent product stage and lets each capability use the visual form that best explains it.
- Keep CONNECT as the approved real four-agent evidence film; do not reintroduce additional chat UI for REMEMBER or OBSERVE.
- REMEMBER must use a designed, data-driven workspace-memory field built from sanitized synthetic records that communicate accumulated context and retrieval over time.
- OBSERVE must use the visual grammar of the real Consuelo Home heatmap and Tracing surfaces, but only with sanitized deterministic demo data; no private branch names, node IDs, costs, paths, or customer data may enter public source.
- CONTROL, SECURE, and SWITCH remain in the same chapter system using the existing artwork as temporary fallback media for this prototype.
- Desktop uses a stable/sticky visual stage with adjacent chapter copy; mobile stacks each chapter and its visual naturally. No horizontal overflow at phone, tablet, or desktop widths.
- Motion clarifies state only, runs once as a chapter becomes visible, and respects prefers-reduced-motion.
- This task may promote to stream/website for review/live iteration, but must not merge stream/website to main or deploy production without separate approval.

## Plan

1. Update the structural contract first so the old 3x2 grid fails and the new story-stage ownership is explicit.
2. Add typed sanitized demo data for memory and observability to home-content.ts.
3. Build focused REMEMBER and OBSERVE stage components, reuse the existing CONNECT evidence component, and use current artwork as fallback for the remaining three chapters.
4. Rework HomeFeaturePreview.astro into the six-chapter scrollytelling layout with desktop sticky behavior and mobile stacking.
5. Validate source contracts, build, responsive browser geometry, reduced motion, and public-data sanitization; then review/verify and promote to stream/website.

## Test-first contract

behavior under test: the homepage feature section is a six-chapter story-stage system, not a 3x2 media grid; CONNECT preserves its evidence film; REMEMBER and OBSERVE have distinct non-chat visual components; responsive and reduced-motion behavior remain explicit.
existing local pattern: packages/consuelo-website/tests/website-structure.test.js source contracts plus homepage-mobile-layout.test.mjs rendered geometry checks.
new or changed tests: replace the existing grid-focused website structure assertions with story-stage/component/data assertions; update rendered feature geometry assertions to require one-column mobile chapters, sticky desktop stages, sanitized memory/trace visuals, and zero overflow.
focused red command: bun test packages/consuelo-website/tests/website-structure.test.js -t "feature story"
expected red failure: HomeFeaturePreview still contains product-panel__grid and does not import/render the new REMEMBER/OBSERVE story components.
no-test waiver: none.

- 2026-09-01 00:56:56 append: `.task/website/prototype-feature-story-stage-remember-observe/workpad.md`

## workspace-owned: files changed

- `packages/consuelo-website/src/components/home/FeatureStoryMemory.astro`
- `packages/consuelo-website/src/components/home/FeatureStoryObserve.astro`

## workspace-owned: activity log

- 2026-09-01 00:56:56 fs.write: `.task/website/prototype-feature-story-stage-remember-observe/workpad.md`
- 2026-09-01 00:57:10 apply-patch: `packages/consuelo-website/tests/website-structure.test.js`
- 2026-09-01 00:58:04 apply-patch: `packages/consuelo-website/src/data/home-content.ts`
- 2026-09-01 00:58:27 write: `packages/consuelo-website/src/components/home/FeatureStoryMemory.astro`
- 2026-09-01 00:58:27 fs.write: `packages/consuelo-website/src/components/home/FeatureStoryMemory.astro`
- 2026-09-01 00:58:48 write: `packages/consuelo-website/src/components/home/FeatureStoryObserve.astro`
- 2026-09-01 00:58:48 fs.write: `packages/consuelo-website/src/components/home/FeatureStoryObserve.astro`
- 2026-09-01 01:00:24 apply-patch: `packages/consuelo-website/src/components/home/HomeFeaturePreview.astro`
- 2026-09-01 01:00:38 apply-patch: `packages/consuelo-website/src/components/home/FeatureStoryMemory.astro`
- 2026-09-01 01:00:38 apply-patch: `packages/consuelo-website/src/components/home/FeatureStoryObserve.astro`
- 2026-09-01 01:00:46 apply-patch: `packages/consuelo-website/DESIGN.md`
- 2026-09-01 01:00:58 apply-patch: `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`
- 2026-09-01 01:13:40 fs.write: `.task/website/prototype-feature-story-stage-remember-observe/workpad.md`
- 2026-09-01 01:15:03 fs.write: `.task/website/prototype-feature-story-stage-remember-observe/workpad.md`

## Implementation and validation

- Replaced the old 3x2 FEATURES grid with a six-chapter product story. Each chapter keeps a consistent dominant evidence column plus adjacent product copy; the evidence column is sticky on desktop/tablet and stacks below copy on <=760px mobile.
- CONNECT remains the approved 20.97s four-agent evidence film. No new chat UI was introduced.
- Added `FeatureStoryMemory.astro`: a synthetic Project Meridian workspace dossier with four dated records (decision, artifact, context, retrieval) and a final prior-context-restored state. It uses only public-safe synthetic names/data and no real workspace identifiers.
- Added `FeatureStoryObserve.astro`: a deterministic 5-day activity heatmap modeled on Consuelo Home plus one expanded trace row modeled on Tracing. Demo values intentionally use `Local node`, synthetic counts, and a generic `browser.open` success; no internal branch names, node IDs, paths, customer data, or real costs are embedded.
- CONTROL, SECURE, and SWITCH stay in the new chapter architecture but intentionally retain their existing illustration media as temporary fallbacks until their individual evidence concepts are built.
- Added a small IntersectionObserver that activates REMEMBER/OBSERVE motion once when the evidence enters view. Movement is limited to 8px + opacity and uses website motion tokens. Reduced-motion loads all story surfaces active, removes transitions, and keeps the CONNECT poster instead of autoplay video.
- Updated `DESIGN.md` so the source-of-truth composition now describes six evidence chapters rather than a 3x2 grid and explicitly allows different evidence media per capability.

### Test evidence

- RED: focused feature-story source contract failed because `FeatureStoryMemory.astro` did not exist. Trace: `trc_0ff8ffc06f49`.
- GREEN: focused feature-story source contract passes 1/1 with 65 assertions. Latest trace: `trc_d0bee0546edc`.
- Production website build passes: Astro check 0 errors / 0 warnings / 24 existing hints; 24 pages built. Trace: `trc_ee0c3ebb070b`.
- The first build attempt failed only because the task worktree lacked `packages/consuelo-website/node_modules`; added the same ignored package-local symlink to the main checkout dependencies used by prior website tasks, then build passed. Failed trace: `trc_31f59b5bfe59`; recovery trace: `trc_49da4fa34e3f`.
- The full existing `website-structure.test.js` still has 3 unrelated failures in unchanged hero/header/design-operator contracts; our focused feature-story contract passes. Failure-name evidence: `trc_c75a4a8d5a9d`.
- The broad Playwright homepage integration hit the OS upstream 502 twice when run synchronously. A task-owned tmux retry emitted only the top-level test failure and then hung during its cleanup path without assertion detail, so it was stopped. No product claim relies on that runner.

### Real browser verification

- Desktop 1440x900: six chapters; each chapter uses 877px evidence + 256px copy columns; evidence is sticky; no horizontal overflow. Trace: `trc_5ab6654792a3`.
- REMEMBER activation: all four records reach opacity 1 / zero transform after the one-shot reveal. Trace: `trc_2139e8b993b4`.
- OBSERVE activation: selected heat cell is explicit, trace row resolves to `Codex · browser.open · Local node · 1.8 s · SUCCESS`, 877x515 stage. Trace: `trc_0e0712f3b04f`.
- Mobile 390x844: six chapters, static/stacked evidence, REMEMBER 334x384, OBSERVE 334x416, zero horizontal overflow. Trace: `trc_2a4311ad054e`.
- Tablet 1024x1366: two-column chapter layout, sticky evidence, REMEMBER/OBSERVE both 550x323 at the 2032:1192 evidence ratio, zero overflow. Trace: `trc_620638ef394a`.
- Fresh reduced-motion load: REMEMBER and OBSERVE are immediately active with 0s transitions; CONNECT video is hidden and poster is visible; zero overflow. Trace: `trc_d8bc05bdaeab`.

- 2026-09-01 01:13:40 append: `.task/website/prototype-feature-story-stage-remember-observe/workpad.md`

## workspace-owned: validation evidence

- 2026-09-01 01:14:37 `review.run`: passed — OK
- 2026-09-01 01:14:55 `verify`: passed — OK

## Final gates

- Strict mine-only review: 0 task-owned issues, 0 blockers; one pre-existing project typecheck configuration note (`no projects with 'typecheck' target found`). Trace: `trc_8ff005801ac7`.
- Full task verifier: passed and publish-valid across the 7 intended product/test/design files; 0 DB risks. Trace: `trc_75103b8202f1`.
- Publish boundary remains `task -> stream/website` only. Do not merge stream PR #2337 to main or deploy production from this task.

- 2026-09-01 01:15:03 append: `.task/website/prototype-feature-story-stage-remember-observe/workpad.md`

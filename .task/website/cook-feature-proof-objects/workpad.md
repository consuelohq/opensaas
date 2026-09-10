# cook feature proof objects

branch: `task/website/cook-feature-proof-objects`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2361
started: 2026-09-01

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/consuelo-website/src/components/home/FeatureStoryControl.astro`
- `packages/consuelo-website/src/components/home/FeatureStoryMemory.astro`
- `packages/consuelo-website/src/components/home/FeatureStoryObserve.astro`
- `packages/consuelo-website/src/components/home/FeatureStorySecure.astro`
- `packages/consuelo-website/src/components/home/FeatureStorySwitch.astro`
- `packages/consuelo-website/src/lib/trace-heatmap.ts`

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

## Test-first contract

behavior under test: the six feature chapters keep the approved editorial layout while REMEMBER, CONTROL, OBSERVE, SECURE, and SWITCH render distinct product-derived proof objects; OBSERVE reuses the actual Consuelo heatmap interaction/visual grammar rather than a fabricated marketing-only grid; CONNECT remains unchanged.
existing local pattern: packages/consuelo-website/tests/website-structure.test.js owns homepage source contracts, with direct workspace browser geometry/motion checks used for responsive behavior.
new or changed tests: extend the feature-story contract to require dedicated CONTROL/SECURE/SWITCH proof components, require OBSERVE to share/extract a reusable heatmap primitive with the internal Home surface where feasible, and assert public demo data contains no private identifiers/paths/secrets.
focused red command: bun test packages/consuelo-website/tests/website-structure.test.js -t "feature proof objects"
expected red failure: dedicated CONTROL/SECURE/SWITCH proof components and shared product heatmap primitive do not yet exist; current fallback FeatureMedia paths still satisfy those chapters.
no-test waiver: none.

## Scope boundary

- Keep CONNECT evidence film unchanged.
- Keep the approved six-chapter sticky desktop / stacked mobile architecture.
- Main and production are out of scope; publish only task -> stream/website for review.
- No generated decorative imagery; product UI, deterministic HTML/CSS, and real/sanitized product structures only.

- 2026-09-01 01:54:44 append: `.task/website/cook-feature-proof-objects/workpad.md`

## workspace-owned: files changed

- `packages/consuelo-website/src/components/home/FeatureStoryControl.astro`
- `packages/consuelo-website/src/components/home/FeatureStoryMemory.astro`
- `packages/consuelo-website/src/components/home/FeatureStoryObserve.astro`
- `packages/consuelo-website/src/components/home/FeatureStorySecure.astro`
- `packages/consuelo-website/src/components/home/FeatureStorySwitch.astro`
- `packages/consuelo-website/src/lib/trace-heatmap.ts`

## workspace-owned: activity log

- 2026-09-01 01:54:44 fs.write: `.task/website/cook-feature-proof-objects/workpad.md`
- 2026-09-01 01:57:59 fs.write: `packages/consuelo-website/src/lib/trace-heatmap.ts`
- 2026-09-01 01:58:48 fs.write: `packages/consuelo-website/src/components/home/FeatureStoryControl.astro`
- 2026-09-01 01:59:28 fs.write: `packages/consuelo-website/src/components/home/FeatureStorySecure.astro`
- 2026-09-01 01:59:57 fs.write: `packages/consuelo-website/src/components/home/FeatureStorySwitch.astro`
- 2026-09-01 02:00:29 fs.write: `packages/consuelo-website/src/components/home/FeatureStoryMemory.astro`
- 2026-09-01 02:02:35 fs.write: `packages/consuelo-website/src/components/home/FeatureStoryObserve.astro`
- 2026-09-01 02:13:06 fs.write: `.task/website/cook-feature-proof-objects/workpad.md`
- 2026-09-01 02:15:28 fs.write: `.task/website/cook-feature-proof-objects/workpad.md`

## workspace-owned: files read

- `packages/consuelo-website/tests/website-structure.test.js`
- `packages/os/scripts/lib/settings-site.ts`
- `packages/os/scripts/memory.js`

- 2026-09-01 02:12:08 apply-patch: `packages/consuelo-website/tests/website-structure.test.js`
- 2026-09-01 02:12:15 apply-patch: `packages/consuelo-website/tests/website-structure.test.js`
- 2026-09-01 02:12:35 apply-patch: `packages/consuelo-website/DESIGN.md`
## Implementation

- CONNECT stays untouched as the approved 20.97s four-agent evidence film.
- REMEMBER now uses the real workspace-memory interaction shape rather than another chat or generic timeline: search field (`meridian rollout`), FIELD/CATEGORY/LIMIT controls, categorized result rows, one selected GET/content record, and a restored context detail for Northstar / Maya / canary -> production.
- CONTROL replaces the illustration with a product-derived workflow proof: workspace rules at left and the real Consuelo lifecycle at right (`session.start` -> `fs.write` -> `code.call` -> `review.run` -> `verify` -> `task.push`). Main release is explicitly marked HUMAN.
- OBSERVE now aggregates synthetic raw trace rows through `src/lib/trace-heatmap.ts` into the same 7-day x 24-hour call/token/cost buckets and the exact level thresholds used by the internal Home heatmap (0.8 / 0.55 / 0.32 / 0.14). It renders 168 focusable cells, the same every-three-hours labels, a real pointer/focus tooltip, and an expanded trace row. Public data is deterministic and sanitized; it does not call the signed internal trace gateway.
- SECURE replaces the illustration with the actual product security model: enabled tool, workspace-scoped node, stored-but-hidden secret value, and browser sealing via X25519 -> HKDF/SHA-256 -> AES-GCM. Secret plaintext is never displayed.
- SWITCH replaces the illustration with one fixed Project Meridian work object while ChatGPT, Codex, Claude, and OpenCode hand off around it. The artifact/memory/tools/workflow/node stay fixed to make portability the visual proof.
- HomeFeaturePreview no longer renders generic FeatureMedia for any chapter; every capability now owns a dedicated evidence object.
- All new examples use synthetic project data only. No customer data, local paths, internal node IDs, real secret values, or provider keys are in public source.

## Validation evidence

- RED: `bun test packages/consuelo-website/tests/website-structure.test.js -t "cook each feature proof object"` failed because `FeatureStoryControl.astro` did not exist. Trace: `trc_df622e03f8e3`.
- GREEN: proof-object contract passes 1/1, 97 assertions; product-heatmap semantic parity contract passes 1/1, 17 assertions. Trace: `trc_f205ebc9063e`.
- Static Astro build succeeds: 24 pages built. Trace: `trc_9791dbc6c1b8`.
- Astro diagnostics succeed with 0 errors / 0 warnings / 24 existing hints. Trace: `trc_68d181f2be41`.
- Full website structure file remains 18 pass / 3 pre-existing unrelated failures in stale hero/header/design-operator assertions, matching the earlier stream baseline. Trace: `trc_21cd807c50f3`.
- The first package build attempt failed because the task worktree lacked `packages/consuelo-website/node_modules`; a task-local ignored symlink to the main checkout package dependencies repaired the environment. A combined check+build then timed out while diagnostics were still running, so diagnostics and build were run separately and both passed. Recovery traces: `trc_62a08db38181`, `trc_9791dbc6c1b8`, `trc_68d181f2be41`.

### Browser proof

- Desktop 1440x900: six chapters, every dedicated proof object present, sticky stage, 0 horizontal overflow, OBSERVE is 877x515 at the shared 2032:1192 ratio, exactly 168 heat cells, hottest bucket Thu Aug 27 16:00 / 11 calls / level 5, CONNECT remains 20.966667s. Trace: `trc_118b5d9d88cf`.
- Heatmap interaction: pointerenter on the hottest cell opens the real tooltip at a viewport-safe position with Thu Aug 27 16:00 / 11 calls / 12.5K tokens / $0.0225. Trace: `trc_b6e3ff2f08f6`.
- Tablet 1024x1366: 2-column chapter layout, sticky evidence, all five new proof objects are 550x323 at the shared 2032:1192 ratio, 0 overflow. Trace: `trc_b650dd905b2c`.
- Mobile 390x844: chapter evidence is static/stacked, all five new proof objects fit the 334px content width, document horizontal overflow is 0; the 24-hour heatmap is intentionally horizontally scrollable inside its own 332px scroller rather than shrinking cells to illegibility. Trace: `trc_edd0108741a4`.
- Reduced motion: all story objects are immediately active, transitions/animations are removed, CONNECT video is hidden and its poster remains visible, 0 overflow. Trace: `trc_43d5e375372e`.

- 2026-09-01 02:13:06 append: `.task/website/cook-feature-proof-objects/workpad.md`

## workspace-owned: validation evidence

- RED: `bun test packages/consuelo-website/tests/website-structure.test.js -t "cook each feature proof object"` failed because `FeatureStoryControl.astro` did not exist. Trace: `trc_df622e03f8e3`.
- GREEN: proof-object contract passes 1/1, 97 assertions; product-heatmap semantic parity contract passes 1/1, 17 assertions. Trace: `trc_f205ebc9063e`.
- Static Astro build succeeds: 24 pages built. Trace: `trc_9791dbc6c1b8`.
- Astro diagnostics succeed with 0 errors / 0 warnings / 24 existing hints. Trace: `trc_68d181f2be41`.
- Full website structure file remains 18 pass / 3 pre-existing unrelated failures in stale hero/header/design-operator assertions, matching the earlier stream baseline. Trace: `trc_21cd807c50f3`.
- The first package build attempt failed because the task worktree lacked `packages/consuelo-website/node_modules`; a task-local ignored symlink to the main checkout package dependencies repaired the environment. A combined check+build then timed out while diagnostics were still running, so diagnostics and build were run separately and both passed. Recovery traces: `trc_62a08db38181`, `trc_9791dbc6c1b8`, `trc_68d181f2be41`.
### Browser proof
- Desktop 1440x900: six chapters, every dedicated proof object present, sticky stage, 0 horizontal overflow, OBSERVE is 877x515 at the shared 2032:1192 ratio, exactly 168 heat cells, hottest bucket Thu Aug 27 16:00 / 11 calls / level 5, CONNECT remains 20.966667s. Trace: `trc_118b5d9d88cf`.
- Heatmap interaction: pointerenter on the hottest cell opens the real tooltip at a viewport-safe position with Thu Aug 27 16:00 / 11 calls / 12.5K tokens / $0.0225. Trace: `trc_b6e3ff2f08f6`.
- Tablet 1024x1366: 2-column chapter layout, sticky evidence, all five new proof objects are 550x323 at the shared 2032:1192 ratio, 0 overflow. Trace: `trc_b650dd905b2c`.
- Mobile 390x844: chapter evidence is static/stacked, all five new proof objects fit the 334px content width, document horizontal overflow is 0; the 24-hour heatmap is intentionally horizontally scrollable inside its own 332px scroller rather than shrinking cells to illegibility. Trace: `trc_edd0108741a4`.
- Reduced motion: all story objects are immediately active, transitions/animations are removed, CONNECT video is hidden and its poster remains visible, 0 overflow. Trace: `trc_43d5e375372e`.
- 2026-09-01 02:13:06 append: `.task/website/cook-feature-proof-objects/workpad.md`
- 2026-09-01 02:14:46 `review.run`: passed — OK
- 2026-09-01 02:15:19 `verify`: passed — OK

## Final gates

- Strict mine-only review: 0 task-owned issues, 0 blockers; one pre-existing project TYPECHECK configuration note (`no projects with 'typecheck' target found`). Trace: `trc_fc975f9ff0e8`.
- Full task verifier: passed and publish-valid across the 10 intended website files; 0 DB risks. Trace: `trc_9bcff80bff8e`.
- Publish boundary remains task -> `stream/website` only. Do not merge stream PR #2337 to main or deploy production from this task.

- 2026-09-01 02:15:28 append: `.task/website/cook-feature-proof-objects/workpad.md`

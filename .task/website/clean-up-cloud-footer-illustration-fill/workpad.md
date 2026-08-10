
## Task plan

### Acceptance criteria
- Clean the existing Consuelo Cloud footer illustration so the inner sash/robe panel is continuously white.
- Clean the outstretched hand so the palm and fingers are continuously white while preserving blue line art.
- Preserve the existing footer composition, typography, globe, character pose, and site layout.
- Update the source asset/generation path rather than replacing the whole page with a screenshot.
- Validate the generated asset, website build, and live rendered footer before calling it shipped.

### Test-first contract
- Change type: visual/source-asset cleanup.
- Existing local pattern: inspect the current SVG source and footer-art generator before editing.
- New or changed tests: no new unit test; this is deterministic visual asset work.
- No-test waiver: validate via SVG/media render inspection, existing website responsive tests if relevant, production build, diff review, and live browser screenshot.

## workspace-owned: files read

- `packages/consuelo-website/package.json`
- `packages/consuelo-website/scripts/generate-footer-art.ts`
- `packages/consuelo-website/tests/footer-art.test.mjs`
- `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-10 00:56:00 fs.write: `.task/website/clean-up-cloud-footer-illustration-fill/workpad.md`
- 2026-08-10 00:56:07 apply-patch: `packages/consuelo-website/tests/footer-art.test.mjs`
- 2026-08-10 00:56:28 apply-patch: `packages/consuelo-website/scripts/generate-footer-art.ts`
- 2026-08-10 00:57:17 apply-patch: `packages/consuelo-website/scripts/generate-footer-art.ts`
- 2026-08-10 00:58:59 apply-patch: `packages/consuelo-website/scripts/generate-footer-art.ts`
- 2026-08-10 00:59:34 fs.write: `.task/website/clean-up-cloud-footer-illustration-fill/workpad.md`

## Implementation and validation

- `media.svg inspect` confirmed `holding-world.svg` is a single Potrace path (no semantic hand/sash subpaths), so the deterministic footer-art generator is the correct ownership layer for targeted fill cleanup.
- Root cause: the existing globe-protection ellipse overlapped the hand, and the generic ink-preservation path retained interior blue hatching in the sash.
- Implementation: tightened the globe exclusion and added targeted clean-white polygon masks for the sash and hand, inset inside the detected body silhouette so outer blue boundary/detail lines remain intact.
- First implementation attempt changed the global ink erosion and regressed outer-robe blue detail; reverted that global behavior and replaced it with the targeted mask.
- Focused red test failed at hand white share 0.488; final focused test passes 3/3.
- Final sampled ratios: hand core 94.05% white; sash upper 99.73%, middle 100%, lower 99.36% white. Outer robe retains 2,745 sampled blue pixels; globe retains 7,039 sampled blue pixels.
- `media.svg verify` reports the source SVG renderable.
- First production build exposed an overly narrow TypeScript inference on `scalePoints`; generalized the helper to accept normalized polygon arrays. Re-run production build passes: Astro check 0 errors / 0 warnings / 24 existing hints and 24 static pages built.
- Generated PNGs remain build artifacts under `public/generated/`; the tracked change is the generator plus regression test, not a baked webpage screenshot.

- 2026-08-10 00:59:34 append: `.task/website/clean-up-cloud-footer-illustration-fill/workpad.md`

## workspace-owned: validation evidence

- 2026-08-10 00:59:59 `review.run`: passed — OK
- 2026-08-10 01:00:00 `review.run`: passed — OK
- 2026-08-10 01:00:10 `verify`: passed — OK


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
- `packages/workspace/scripts/lib/task-workpad.js`

## files changed

- `packages/consuelo-website/scripts/generate-footer-art.ts`
- `packages/consuelo-website/tests/footer-art.test.mjs`

## workspace-owned: files changed

- `packages/consuelo-website/scripts/generate-footer-art.ts`
- `packages/consuelo-website/tests/footer-art.test.mjs`

## workspace-owned: activity log

- 2026-08-10 00:56:00 fs.write: `.task/website/clean-up-cloud-footer-illustration-fill/workpad.md`
- 2026-08-10 00:56:07 apply-patch: `packages/consuelo-website/tests/footer-art.test.mjs`
- 2026-08-10 00:56:28 apply-patch: `packages/consuelo-website/scripts/generate-footer-art.ts`
- 2026-08-10 00:57:17 apply-patch: `packages/consuelo-website/scripts/generate-footer-art.ts`
- 2026-08-10 00:58:59 apply-patch: `packages/consuelo-website/scripts/generate-footer-art.ts`
- 2026-08-10 00:59:34 fs.write: `.task/website/clean-up-cloud-footer-illustration-fill/workpad.md`
- 2026-08-10 01:00:35 fs.write: `.task/website/clean-up-cloud-footer-illustration-fill/workpad.md`
- 2026-08-10 01:02:56 fs.write: `.task/website/clean-up-cloud-footer-illustration-fill/workpad.md`

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
- 2026-08-10 01:00:40 `verify`: passed — OK
- 2026-08-10 01:01:21 `verify`: passed — OK
- 2026-08-10 01:03:03 `verify`: passed — OK

## Final pre-publish status

- Changed `scripts/generate-footer-art.ts` to apply targeted white cleanup to the inner sash and outstretched hand while preserving the Potrace source, outer robe linework, globe detail, and layout.
- Added `tests/footer-art.test.mjs` regression coverage for hand/sash white-fill ratios.
- Validation: focused footer-art test 3/3 pass; final hand white share 94.05%; sash 99.36–100%; `media.svg verify` pass; website production build pass with 0 errors; workspace review 0 issues from this change; full verify publish-valid.
- Recovery: rejected a global erosion approach after it reduced outer-robe blue detail; replaced it with targeted clean-white masks. Fixed a build-only TypeScript inference issue in the polygon scaler and reran all focused validation successfully.
- No known product blocker remains. Next action: promote task PR #1799 to `stream/website`, merge stream to `main`, then verify the live iPad/footer rendering.

- 2026-08-10 01:00:35 append: `.task/website/clean-up-cloud-footer-illustration-fill/workpad.md`

## Final validation

- What changed: the footer-art generator now applies an inset clean-white mask to the character's inner sash and outstretched hand, while leaving the Potrace source SVG, outer robe, globe, pose, typography, and page layout intact.
- Why: the prior globe exclusion overlapped the hand and the generic ink-preservation pass left blue hatching inside areas that are intended to read as solid white fabric/skin.
- Validation: `bun test tests/footer-art.test.mjs` passes 3/3; hand core is 94.05% white and sash bands are 99.36–100% white; `media.svg verify` passes; production Astro build passes with 0 errors; review reports 0 issues from this change; full verify is publish-valid.
- Issues/recovery: a first global erosion adjustment reduced desired outer-robe blue detail and was reverted; the final solution is targeted. A TypeScript polygon inference error found by the build was fixed by generalizing the point-scaling helper.
- Follow-up: no code blocker remains; promote PR #1799 through `stream/website`, merge to `main`, and verify the deployed footer on an iPad viewport.

- 2026-08-10 01:02:56 append: `.task/website/clean-up-cloud-footer-illustration-fill/workpad.md`

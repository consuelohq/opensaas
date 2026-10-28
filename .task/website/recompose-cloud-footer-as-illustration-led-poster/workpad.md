# recompose cloud footer as illustration-led poster

branch: `task/website/recompose-cloud-footer-as-illustration-led-poster`
stream: `stream/website`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1522/recompose-cloud-footer-as-illustration-led-poster
github pr: https://github.com/consuelohq/opensaas/pull/1522
started: 2026-07-16

## acceptance criteria

- [x] The desktop footer reads as an illustration-led poster: compact fitted title, raised/enlarged character, and two-line structural background lettering.
- [x] The character uses a dedicated two-tone editorial asset with white figure areas and the original Consuelo blue ink preserved in the hair, eyelashes, outlines, moon, and hatching.
- [x] Desktop title width is constrained to roughly 35–52% of the viewport and fitted against its actual rendered content rather than raw viewport font sizing.
- [x] Supporting copy uses the uppercase mono poster treatment and the CTA matches the wider reference proportions.
- [x] Desktop metadata uses reference-scale horizontal gutters; the right identity block remains right-aligned and uses a purpose-built portrait badge ratio.
- [x] Mobile hides the background lettering and editorial badge, moves identity metadata to the lower left above the version, and keeps the full character inside the viewport without horizontal overflow.
- [x] The reveal is perceptibly visible with 0.9 viewport remaining, reaches a strong midpoint, and remains fully visible/interactable at the bottom.
- [x] Reduced-motion users receive the complete footer immediately with no interpolation or layout jump.
- [x] Focused source/browser tests, website build, real viewport screenshots, review, and publish verification pass before promotion to `stream/website`.

## plan

1. Capture the live Hermes footer DOM, computed geometry, media behavior, and responsive rules.
2. Add failing source and rendered-browser contracts for composition, color treatment, geometry, metadata, and reveal progress.
3. Derive a deterministic two-tone editorial asset from the existing traced Consuelo source; do not alter the canonical app icon.
4. Recompose `HomeCloudCta` around the poster grid and fit the title using the existing Pretext dependency.
5. Validate desktop, constrained desktop, tablet, mobile, and reduced-motion behavior in the real browser.
6. Run build, review, verify, then merge the task into the existing website stream.

## current status

- Implementation and all validation gates are complete. The task is publish-valid and ready to merge into `stream/website`.

## files changed

- `packages/consuelo-website/public/images/home/consuelo-footer-badge.svg`
- `packages/consuelo-website/public/images/home/holding-world-editorial.png`
- `packages/consuelo-website/scripts/generate-footer-art.ts`
- `packages/consuelo-website/package.json`
- `packages/consuelo-website/src/components/home/HomeCloudCta.astro`
- `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`
- `packages/consuelo-website/tests/homepage-responsive.test.mjs`

## workspace-owned: files changed

- `packages/consuelo-website/public/images/home/consuelo-footer-badge.svg`
- `packages/consuelo-website/src/components/home/HomeCloudCta.astro`

## workspace-owned: activity log

- 2026-07-16 02:33:13 fs.write: `packages/consuelo-website/public/images/home/consuelo-footer-badge.svg`
- 2026-07-16 02:33:49 fs.write: `packages/consuelo-website/src/components/home/HomeCloudCta.astro`

## workspace-owned: validation evidence

- Red source phase: failed on the missing fitted title, two-line ghost lettering, two-tone media path, poster typography, and reveal curve.
- Red browser phase: failed at the approved early-reveal threshold before implementation.
- `bun test tests/homepage-responsive.test.mjs`: 7 passed, 55 assertions.
- `node --test tests/homepage-mobile-layout.test.mjs`: 1 passed, including 390×844 mobile, 768×900 tablet, 1440×900 desktop, pixel-color verification, reveal timing, reduced motion, and overflow checks.
- `bun run build`: Astro check completed with 0 errors and 0 warnings; static build completed with 22 pages. The 24 reported hints are pre-existing package hints.
- Footer-art generator rerun produced the identical SHA-256 `6bfff16d36b9d665954b5c6c19e8f41e5051b28bdfbe0025f60141da719f2716`.
- Generated editorial image: 1831×2063, 602,912 preserved blue pixels and 606,655 white enclosed pixels.
- Built preview remains available at `http://127.0.0.1:3001/`.
- Desktop 1440×900: title 46vw, ghost word 56vw, art 551×621 at natural aspect, reference gutters ~122px, opacity 0.306 with 0.9 viewport remaining, opacity 1 at bottom, no overflow.
- Constrained desktop 1180×900: title 46vw, ghost word 56vw, art remains 551×621 at natural aspect, no overflow.
- Tablet 768×900: title 74vw, art 518×584 at natural aspect, ghost lettering and badge remain visible, no overflow. Metadata rectangles intersect mostly transparent image bounds; version intersects zero visible pixels and the right block intersects ~7% visible pixels.
- Mobile 390×844: title remains two lines, art 375×422 at natural aspect, wordmark and badge hidden, identity moves lower-left, opacity 0.306 with 0.9 viewport remaining, no overflow. Signature intersects zero visible pixels and the version intersects ~2% visible pixels.
- Screenshot evidence:
  - `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-screenshots/consuelo-cloud-poster-desktop-final-2026-07-16T02-47-38.png`
  - `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-screenshots/consuelo-cloud-poster-1180-bottom-2026-07-16T02-41-40.png`
  - `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-screenshots/consuelo-cloud-poster-tablet-bottom-2026-07-16T02-46-59.png`
  - `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-screenshots/consuelo-cloud-poster-mobile-bottom-2026-07-16T02-46-18.png`
  - `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-screenshots/consuelo-cloud-poster-mobile-early-2026-07-16T02-46-34.png`
- Workspace review: passed with 0 task-owned issues and 0 blocking findings. One pre-existing infrastructure note remains because no Nx project exposes a `typecheck` target; the package-level Astro check passed separately.
- Workspace verify: passed in full mode; DB guard found 0 risks and 0 findings; publish-valid stamp written to `.task/website/recompose-cloud-footer-as-illustration-led-poster/verify.json`.
- Verify's registry selected zero automatic suites for these paths, so the focused source/browser suites and package build above are the explicit test evidence.
- 2026-07-16 02:49:12 `review.run`: passed — OK
- 2026-07-16 02:50:39 `review.run`: passed — OK
- 2026-07-16 02:50:54 `verify`: passed — OK
- 2026-07-16 02:51:20 `verify`: passed — OK

## key decisions

- Hermes uses a right-anchored, internally right-aligned identity block; preserve that alignment rather than centering it.
- Hermes uses a dedicated two-tone media asset. The existing Consuelo footer source is a single blue traced path and the current CSS inversion incorrectly turns all of its ink white.
- Preserve Consuelo's blue hair, eyelashes, outlines, and hatching by deriving a white-under-blue editorial render from the existing source instead of recoloring the line art.
- Match Hermes's hierarchy and geometry, but intentionally begin Consuelo's reveal earlier because that is the approved product requirement.

## notes for ko

- Live Hermes desktop reference at 1440×900: title is ~472px wide, character media is ~496×614px, copy begins near 7dvh, metadata gutters are ~8.5vw, and the ghost wordmark is two lines with a smaller second line.
- Live Hermes mobile reference at 390×844: ghost lettering and badge are hidden; the character is bottom-anchored; identity text moves to the lower left above the version.
- Live Hermes reveal stays at zero until the final portion of the scroll. This task will preserve the approved earlier Consuelo reveal rather than copying that timing literally.

## improvements noticed

- none yet

## issues and recovery

- A combined red test call exceeded the workspace runner's internal 30-second wait while the browser test was still running. The source and rendered tests were separated and rerun with explicit budgets.
- The first source-test command placed Bun's working-directory option incorrectly and did not execute the test. It was corrected to use the runtime's `cwd` field.
- CSS Grid's default `min-width: auto` expanded the fitted title to its 925px min-content width. Adding `min-width: 0` made Pretext measure the intended poster column.
- The initial tablet rules constrained image width while keeping a fixed height, distorting the character. A dedicated 601–900px layout now scales the image proportionally.
- `task.call` could not start the preview because the task worktree currently lacks the `task:exec` script. A task-scoped detached `code.call` started the built preview instead.
- `media.svg` resolved the new badge against the main checkout rather than the task worktree. Browser loading and natural dimensions verified the badge in the actual task build.

---

## publish checklist

```bash
bun run task:push -- --message "type(website): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/consuelo-website/package.json`
- `packages/consuelo-website/scripts/generate-brand-assets.ts`
- `packages/consuelo-website/scripts/generate-footer-art.ts`
- `packages/consuelo-website/scripts/generate-social-card.ts`
- `packages/consuelo-website/src/components/home/HomeCloudCta.astro`
- `packages/consuelo-website/src/components/home/HomeHero.astro`
- `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`
- `packages/consuelo-website/tests/homepage-responsive.test.mjs`
- `packages/workspace/senior-engineer.md`

- 2026-07-16 02:49:36 apply-patch: `packages/consuelo-website/scripts/generate-footer-art.ts`

## workspace-owned: test selection

- changed files: `.task/tasks/website/recompose-cloud-footer-as-illustration-led-poster.json`, `.task/website/recompose-cloud-footer-as-illustration-led-poster/current.json`, `.task/website/recompose-cloud-footer-as-illustration-led-poster/evidence-log.json`, `.task/website/recompose-cloud-footer-as-illustration-led-poster/read-log.json`, `.task/website/recompose-cloud-footer-as-illustration-led-poster/session.json`, `.task/website/recompose-cloud-footer-as-illustration-led-poster/verify.json`, `.task/website/recompose-cloud-footer-as-illustration-led-poster/workpad.md`, `packages/consuelo-website/package.json`, `packages/consuelo-website/public/images/home/consuelo-footer-badge.svg`, `packages/consuelo-website/public/images/home/holding-world-editorial.png`, `packages/consuelo-website/scripts/generate-footer-art.ts`, `packages/consuelo-website/src/components/home/HomeCloudCta.astro`, `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`, `packages/consuelo-website/tests/homepage-responsive.test.mjs`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

# Remove cloud asset box seam and fix preview cloud composition

branch: `task/dialer/remove-cloud-asset-box-seam-and-fix-preview-cloud-composition`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2556
started: 2026-09-23

## acceptance criteria

- [x] Identify whether the remaining rectangular seam comes from CSS compositing or from low-alpha pixels baked into the generated cloud assets.
- [x] Remove any full-canvas low-alpha haze from the generated cloud files without damaging the visible cloud silhouettes/dither.
- [x] Keep the hero composition visually equivalent but eliminate visible rectangular image bounds.
- [x] Recompose the preview/feature band so its clouds read as two separate atmospheric edge elements rather than one central clump.
- [x] Keep the preview notice readable and inside its band at desktop/tablet/mobile widths.
- [x] Preserve the current optimized WebP delivery and no-overflow/no-broken-image guarantees.
- [x] Refresh the existing Tailnet preview and merge into stream/dialer.

## plan

1. Measure alpha values on Ko's original generated PNGs and the current WebPs to confirm whether faint nonzero alpha spans the full image rectangle.
2. Add a focused contract that guards against low-alpha canvas haze in the shipped WebPs and requires separated preview cloud positioning.
3. If asset haze is confirmed, rebuild WebPs from the original Downloads PNGs after thresholding only near-transparent pixels, then visually validate the silhouette/dither.
4. Adjust the preview variant to keep one cloud left/bottom and one right/top with more negative space around the notice.
5. Build, refresh Tailnet, inspect desktop/mobile screenshots/DOM, run review/verify, then publish.

## Test-first contract

behavior under test: shipped cloud assets have truly transparent canvas regions instead of faint full-rectangle alpha haze, and the preview band composes two separated edge clouds around the notice.
existing local pattern: packages/consuelo-dialer-website/tests/dialer-landing.test.mjs validates cloud asset delivery and CloudField composition.
new or changed tests: require a generated alpha-report JSON proving all four shipped WebPs have transparent corners/edges below the chosen alpha threshold; require preview variant CSS to place the two clouds on opposite sides with a center-clear composition; preserve existing optimized WebP size guards.
focused red command: bun test packages/consuelo-dialer-website/tests/dialer-landing.test.mjs
expected red failure: current shipped assets were converted without alpha cleanup, and preview CSS currently places two large clouds into overlapping central space.
no-test waiver: not applicable.

## files changed

- `packages/consuelo-dialer-website/public/images/clouds/dialer-cloud-01.webp`
- `packages/consuelo-dialer-website/public/images/clouds/dialer-cloud-02.webp`
- `packages/consuelo-dialer-website/public/images/clouds/dialer-cloud-03.webp`
- `packages/consuelo-dialer-website/public/images/clouds/dialer-cloud-04.webp`
- `packages/consuelo-dialer-website/src/components/visuals/CloudField.astro`
- `packages/consuelo-dialer-website/tests/dialer-landing.test.mjs`
- `packages/consuelo-dialer-website/tests/fixtures/cloud-alpha-report.json`

## key decisions

- Root cause was not just the old CSS mask. Ko's generated PNGs contain substantial near-transparent edge haze: cloud 01 had alpha values up to 5 on its outer border and the other three had alpha up to 1, with tens of thousands of pixels in the 1–12 alpha range. Scaling those assets over a flat blue background makes the canvas boundary visible as a faint rectangle.
- Rebuilt all four WebPs directly from Ko's original Downloads PNGs with alpha <= 12 forced to zero. The exact shipped asset hashes are captured in `cloud-alpha-report.json`; all four decoded WebPs now have cornerMaxAlpha=0 and borderMaxAlpha=0.
- Removed remaining CSS filters from both the cloud images and depth-cloud containers. The generated artwork already supplies the soft/dither treatment, and filters create extra GPU compositing/clipping surfaces that can reveal rectangular bounds.
- Preview clouds are now intentionally smaller and separated: one top-right and one bottom-left, with a strong center radial quiet zone so the notice remains visually isolated.
- Mobile preview keeps the same opposite-edge composition, with most of each cloud pushed outside the band rather than stacking both in the middle.

## notes for ko

- Tailnet preview refreshed at `https://picassos-mac-mini.tail38ed59.ts.net:8767/`.
- Focused contract: 13 tests / 142 assertions / 0 failures.
- Astro check/build: 0 errors, 0 warnings, 2 inherited inline-script hints.
- Rebuilt WebPs are smaller again: ~186 KB, 210 KB, 214 KB, and 241 KB.
- Desktop 1440x900 browser proof: hero cloud/body filters all compute to `none`; all 4 images decode; no broken images; no horizontal overflow.
- Desktop preview geometry: notice spans x=440..1000; right cloud spans x=942..1403; left cloud spans x=56..398. The two clouds no longer overlap into one center clump.
- Mobile 390x844 preview: notice stays fully inside the viewport at x=31..359; right cloud is mostly off the right edge and left cloud mostly off the left edge; no horizontal overflow or broken images.

## improvements noticed

- Keep the alpha-report/hash regression. It catches a class of visual bugs that file-size/signature checks cannot detect.

## errors i ran into

- Fresh task worktree again lacked package-local Astro binaries; recovered with `bun install --cwd packages/consuelo-dialer-website --frozen-lockfile` with no tracked dependency changes.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/consuelo-dialer-website/src/components/home/HomeFeaturePreview.astro`
- `packages/consuelo-dialer-website/src/components/home/PreviewNotice.astro`
- `packages/consuelo-dialer-website/src/components/visuals/CloudField.astro`
- `packages/consuelo-dialer-website/tests/dialer-landing.test.mjs`

- 2026-09-23 01:44:25 apply-patch: `packages/consuelo-dialer-website/tests/dialer-landing.test.mjs`
- 2026-09-23 01:45:24 apply-patch: `packages/consuelo-dialer-website/src/components/visuals/CloudField.astro`

- 2026-09-23 01:47:02 apply-patch: `.task/dialer/remove-cloud-asset-box-seam-and-fix-preview-cloud-composition/workpad.md`

## workspace-owned: validation evidence

- 2026-09-23 01:47:26 `review.run`: passed — OK
- 2026-09-23 01:47:33 `verify`: passed — OK

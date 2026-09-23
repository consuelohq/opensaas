# Optimize cloud loading and reuse clouds in preview band

branch: `task/dialer/optimize-cloud-loading-and-reuse-clouds-in-preview-band`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2554
started: 2026-09-23

## acceptance criteria

- [x] Keep the new generated cloud look while removing the slow/sequential hero pop-in.
- [x] Replace the ~5 MB PNG delivery path with substantially smaller alpha-preserving WebP assets and avoid rendering duplicate haze image elements.
- [x] Load all visible hero clouds immediately with appropriate fetch priority so no lazy cloud appears late.
- [x] Remove the hero CloudField mask/compositing edge that can present as a faint rectangular border; preserve the bottom fade with an overlay instead.
- [x] Reuse the same generated cloud system in the blue preview-notice band and remove its old dither-only cloud image.
- [x] Keep mobile intentionally lighter than desktop and preserve reduced-motion behavior.
- [x] Verify no broken images, no horizontal overflow, no legacy dither art in the preview band, and no mask-image on the hero cloud field.
- [x] Refresh the existing Tailnet preview and merge into stream/dialer.

## plan

1. Extend the focused landing contract for optimized WebP cloud delivery, single-image cloud rendering, preview-band reuse, and mask removal; run it red.
2. Convert the four generated RGBA PNGs to alpha-preserving WebP, compare sizes, then switch CloudField to the optimized files.
3. Add a `variant="preview"` composition that renders only the two preview-band clouds and remove the old dither art from HomeFeaturePreview.
4. Replace the CloudField mask with a blue fade overlay and remove the duplicate blurred image per cloud.
5. Build, refresh Tailnet, inspect desktop/mobile/reduced-motion and network asset sizes, then review/verify/publish.

## Test-first contract

behavior under test: generated clouds load quickly and consistently in the hero and preview-notice band, without duplicate image rendering or the hero mask seam.
existing local pattern: packages/consuelo-dialer-website/tests/dialer-landing.test.mjs owns landing asset/source contracts and browser smoke verifies decoded assets/layout.
new or changed tests: require four `.webp` cloud assets under /images/clouds, require every optimized cloud file to be below 500 KB, require CloudField to render only `cloud-field__body` images (no `cloud-field__haze` image), forbid mask-image/-webkit-mask-image, require eager loading for hero cloud objects, require `CloudField variant="preview"` in HomeFeaturePreview, and forbid its legacy /images/home/dither/cloud-* preview art.
focused red command: bun test packages/consuelo-dialer-website/tests/dialer-landing.test.mjs
expected red failure: current CloudField references PNGs, duplicates every asset into haze + body images, uses mask-image, has lazy far clouds, and HomeFeaturePreview still renders cloud-2.png.
no-test waiver: not applicable.

## files changed

- `packages/consuelo-dialer-website/public/images/clouds/dialer-cloud-01.png` (deleted)
- `packages/consuelo-dialer-website/public/images/clouds/dialer-cloud-02.png` (deleted)
- `packages/consuelo-dialer-website/public/images/clouds/dialer-cloud-03.png` (deleted)
- `packages/consuelo-dialer-website/public/images/clouds/dialer-cloud-04.png` (deleted)
- `packages/consuelo-dialer-website/public/images/home/dither/cloud-1.png` (deleted)
- `packages/consuelo-dialer-website/public/images/home/dither/cloud-2.png` (deleted)
- `packages/consuelo-dialer-website/public/images/home/dither/cloud-3.png` (deleted)
- `packages/consuelo-dialer-website/public/images/home/dither/cloud-4.png` (deleted)
- `packages/consuelo-dialer-website/src/components/home/HomeFeaturePreview.astro`
- `packages/consuelo-dialer-website/src/components/visuals/CloudField.astro`
- `packages/consuelo-dialer-website/tests/dialer-landing.test.mjs`
- `packages/consuelo-dialer-website/public/images/clouds/dialer-cloud-01.webp`
- `packages/consuelo-dialer-website/public/images/clouds/dialer-cloud-02.webp`
- `packages/consuelo-dialer-website/public/images/clouds/dialer-cloud-03.webp`
- `packages/consuelo-dialer-website/public/images/clouds/dialer-cloud-04.webp`


## key decisions

- Converted the generated RGBA PNGs from roughly 2.3–2.5 MB each to 235–309 KB WebP files with alpha preserved. Hero cloud payload is now about 1.1 MB instead of roughly 9.7 MB.
- Removed the duplicate blurred image element from every cloud. Each cloud now uses one image plus a CSS radial glow, cutting hero image elements from eight to four.
- All four hero assets are eager. The two dominant clouds use high fetch priority; the two depth clouds use auto priority.
- Removed `mask-image`, `-webkit-mask-image`, and `mix-blend-mode` from the cloud compositor. The bottom fade is now a normal blue overlay, avoiding the masked GPU seam Ko saw.
- Added `variant="preview"` to CloudField. The preview band renders only clouds 02 and 04, which are already cached from the hero.
- The preview band's old dither image is gone and the retired dither files are deleted from the Dialer package.

## notes for ko

- Tailnet preview refreshed at `https://picassos-mac-mini.tail38ed59.ts.net:8767/`; numeric route remains `http://100.112.173.49:8769/`.
- Focused contract: 10 tests / 117 assertions / 0 failures.
- Astro check/build: 0 errors, 0 warnings, 2 inherited inline-script hints.
- Desktop 1440x900: hero has no border, outline, box-shadow, mask, or WebKit mask; 4 cloud objects = 4 image elements; all WebPs decoded; no broken images; no horizontal overflow.
- Tailnet resource timing: each cloud transferred in about 25 ms locally; browser transfer sizes were roughly 235 KB, 275 KB, 275 KB, and 309 KB.
- Preview band: 2 generated WebP clouds, 0 old dither images, preview notice intact, both assets decoded from the same cloud URLs already used in the hero.
- Mobile 390x844: 2 hero clouds visible / 2 depth clouds hidden, 2 preview clouds visible, no broken images, no horizontal overflow.
- Reduced-motion browser proof: all visible cloud animations compute to `none`.
- Strict review: 0 task issues / 0 blocking issues; one unrelated pre-existing Nx typecheck-target warning.
- Full verify passed with `publishValid=true`.

## improvements noticed

- The previous task's committed PNGs are corrupted on the stream branch (PNG 0x89 became UTF-8 replacement bytes `ef bf bd`). The current Tailnet preview remained correct because it was copied from the pre-push build. This task converts directly from Ko's original Downloads files and will verify the remote WebP blobs after publish.
- The normal `task.push` path also corrupted 3 of the 4 WebP blobs in its commit. This is a workspace binary-serialization bug, not a WebP issue. Recovered with a scoped direct-git commit that staged only the four already-validated local WebPs, preserving Ko as author and `suelo-kiro[bot]` as committer. A fresh remote fetch confirms all four task-branch blobs are valid RIFF Web/P images with intact headers.

## errors i ran into

- First build attempt failed with `astro: command not found`; recovered with `bun install --cwd packages/consuelo-dialer-website --frozen-lockfile` and no tracked dependency changes.
- First WebP conversion attempt used the corrupted PNG files from the stream checkout and failed. Recovered by converting directly from Ko's four original Downloads files.
- `task.push` reproduced binary corruption on the optimized WebPs. Direct-git fallback was required because the workspace facade cannot currently preserve arbitrary binary blobs across its publish path.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/consuelo-dialer-website/src/components/home/HomeFeaturePreview.astro`
- `packages/consuelo-dialer-website/src/components/home/HomeHero.astro`
- `packages/consuelo-dialer-website/src/components/visuals/CloudField.astro`
- `packages/consuelo-dialer-website/src/layouts/MarketingLayout.astro`
- `packages/consuelo-dialer-website/src/styles/global.css`
- `packages/consuelo-dialer-website/src/styles/primitives.css`
- `packages/consuelo-dialer-website/src/styles/tokens.css`
- `packages/consuelo-dialer-website/tests/dialer-landing.test.mjs`

## workspace-owned: files changed

- `packages/consuelo-dialer-website/src/components/visuals/CloudField.astro`

## workspace-owned: activity log

- 2026-09-23 01:34:11 fs.write: `packages/consuelo-dialer-website/src/components/visuals/CloudField.astro`

- 2026-09-23 01:34:20 apply-patch: `packages/consuelo-dialer-website/src/components/home/HomeFeaturePreview.astro`

- 2026-09-23 01:36:09 apply-patch: `.task/dialer/optimize-cloud-loading-and-reuse-clouds-in-preview-band/workpad.md`

## workspace-owned: validation evidence

- 2026-09-23 01:36:20 `review.run`: passed — OK
- 2026-09-23 01:36:26 `verify`: passed — OK

- 2026-09-23 01:36:30 apply-patch: `.task/dialer/optimize-cloud-loading-and-reuse-clouds-in-preview-band/workpad.md`

- 2026-09-23 01:38:01 apply-patch: `.task/dialer/optimize-cloud-loading-and-reuse-clouds-in-preview-band/workpad.md`
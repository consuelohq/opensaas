# stabilize landing typography and refine footer art

branch: `task/website/stabilize-landing-typography-and-refine-footer-art`
stream: `stream/website`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1523/stabilize-landing-typography-and-refine-footer-art
github pr: https://github.com/consuelohq/opensaas/pull/1523
started: 2026-07-16

## acceptance criteria

- [x] Hero and cloud-footer headline sizes are stable from the first rendered frame; no client-side font-size rewrite occurs after paint.
- [x] Authored hero lines remain exactly three lines across desktop, tablet, and mobile without horizontal overflow.
- [x] Cloud title remains one line on desktop/tablet and two lines on mobile without post-load resizing.
- [x] Footer character keeps blue hair, eyelashes, outlines, hatching, and globe while the face, shirt, arm, and hand read as white like the Hermes reference.
- [x] Footer badge presents a clearly legible Consuelo illustration at its rendered size rather than an unreadable crop.
- [x] Focused source/browser tests, build, screenshot matrix, review, and verify pass before promotion to `stream/website`.

## plan

1. Inspect the recording frames, current typography fitting lifecycle, art generator, and badge crop.
2. Add failing contracts for zero post-paint font rewrites, stable first-frame geometry, white garment/hand regions, and legible badge pixels.
3. Replace runtime font fitting with deterministic CSS sizing that preserves authored lines.
4. Refine deterministic art generation and badge composition.
5. Validate first-frame vs settled geometry at desktop, tablet, and mobile, then run build/review/verify and publish.

## current status

- Implementation and all validation gates are complete. The task is publish-valid and ready for `stream/website`.

## test-first contract

- Source contract: hero and cloud headings contain no Pretext import, ResizeObserver, font-ready callback, or inline font-size custom-property write.
- Font contract: the Latin Bodoni and Inter variable files are preloaded in the document head before visible content.
- Browser contract: heading font sizes and boxes are identical at DOM-ready and after the settling window at 390, 768, 1024, 1180, and 1440 widths.
- Art contract: the generated PNG has a valid signature, white face/garment/arm/hand regions, preserved blue hair/linework/globe regions, and a legible generated portrait badge.
- Focused red commands: `bun test tests/homepage-responsive.test.mjs tests/footer-art.test.mjs` and `node --test tests/homepage-mobile-layout.test.mjs`.
- Expected red state: runtime fitters and package dependency remain, font preload is absent, the current binary header is corrupt, and the SVG badge does not satisfy the generated-image contract.

## files changed

- `packages/consuelo-website/package.json`
- `packages/consuelo-website/package-lock.json`
- `packages/consuelo-website/bun.lock`
- `packages/consuelo-website/public/images/home/consuelo-footer-badge.svg` (deleted)
- `packages/consuelo-website/public/images/home/consuelo-footer-badge.png`
- `packages/consuelo-website/public/images/home/holding-world-editorial.png`
- `packages/consuelo-website/scripts/generate-footer-art.ts`
- `packages/consuelo-website/src/components/home/HomeCloudCta.astro`
- `packages/consuelo-website/src/components/home/HomeHero.astro`
- `packages/consuelo-website/src/layouts/MarketingLayout.astro`
- `packages/consuelo-website/tests/footer-art.test.mjs`
- `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`
- `packages/consuelo-website/tests/homepage-responsive.test.mjs`

## workspace-owned: files changed

- `packages/consuelo-website/public/images/home/consuelo-footer-badge.svg` (deleted)

## workspace-owned: activity log

- 2026-07-16 04:12:15 fs.trash: `packages/consuelo-website/public/images/home/consuelo-footer-badge.svg`

## workspace-owned: validation evidence

- `bun test tests/homepage-responsive.test.mjs tests/footer-art.test.mjs`: 10 passed, 81 assertions.
- `node --test tests/homepage-mobile-layout.test.mjs`: 1 passed, covering first-frame versus settled geometry at 390, 768, 1024, 1180, and 1440 widths.
- `bun run build`: Astro check reported 0 errors and 0 warnings; static build completed with 22 pages. Existing package hints remain outside this task.
- Generated editorial art is a valid 1832×2064 PNG. Generated badge is a valid 242×346 PNG.
- Deterministic hashes across consecutive runs:
  - editorial art: `cc30002194ee772829fe3e70fa8a62f211afbc77a0179ac9124a5bfbeb52e13f`
  - badge: `395efd5586ea97882b26fc594d211db4cc90be229e4b9883d5d01be580378d40`
- Rendered pixel evidence at desktop:
  - garment region: 46,239 white samples and 4,336 blue samples
  - hand region: 28,906 white samples and 5,242 blue samples
  - hair region: 67,952 blue samples
  - globe region: 8,402 blue samples
  - badge center: 1,921 blue samples and 8,695 white samples
- Built browser evidence:
  - 1440×900: hero 104px and cloud 65.952px; first and settled boxes identical over 500ms; zero overflow.
  - 768×900: hero 72.576px and cloud 56.5248px; first and settled boxes identical; zero overflow.
  - 390×844: hero 36.855px and cloud 59.28px; hero remains three lines, cloud remains two lines, first and settled boxes identical; zero overflow.
- Preview: `http://127.0.0.1:3002/`.
- Screenshot evidence:
  - `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-screenshots/consuelo-stable-hero-desktop-2026-07-16T04-16-31.png`
  - `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-screenshots/consuelo-clean-footer-desktop-2026-07-16T04-16-57.png`
  - `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-screenshots/consuelo-clean-footer-tablet-2026-07-16T04-18-00.png`
  - `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-screenshots/consuelo-stable-hero-mobile-2026-07-16T04-17-13.png`
  - `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-screenshots/consuelo-clean-footer-mobile-2026-07-16T04-17-34.png`
- Workspace review: passed with 0 task-owned issues and 0 blockers. One pre-existing infrastructure note remains because no Nx project exposes a `typecheck` target; package-level Astro check passed separately.
- Workspace verify: passed in full mode; DB guard found 0 risks and 0 findings; publish-valid stamp written to `.task/website/stabilize-landing-typography-and-refine-footer-art/verify.json`.
- Verify's registry selected zero automatic suites for these paths, so the focused source/art/browser suites and package build above are the explicit test evidence.
- 2026-07-16 04:19:15 `review.run`: passed — OK
- 2026-07-16 04:19:28 `verify`: passed — OK
- 2026-07-16 04:19:45 `verify`: passed — OK

## key decisions

- Do not animate or transition the incorrect first size. Remove the post-paint sizing lifecycle entirely.
- Preserve the approved settled composition with responsive CSS values measured from the prior final state.
- Use preloaded `font-display: block` Latin variable faces so slower cold loads do not visibly swap a fallback heading into the branded font.
- Whiten only thick interior pixels inside garment/arm/hand masks; retain blue perimeter ink and hatching.
- Generate the badge as a zoomed PNG crop from the same deterministic editorial source rather than maintaining a separate unreadable SVG crop.

## notes for ko

- The full MP4 itself was not mounted, so validation used the available representative recording frames plus direct first-frame/settled browser instrumentation.

## improvements noticed

- none yet

## issues and recovery

- The checked-in editorial PNG had a corrupt leading signature (`EF BF BD PNG`) from a prior binary write path. Regeneration through Sharp restored a valid PNG signature.
- Timed-out synchronous generator calls left orphaned child processes, causing false multi-minute generation times. The task-owned PIDs were terminated; a profiled single run showed the actual bottleneck was per-pixel JavaScript polygon math.
- Replacing per-pixel polygon intersection with a pre-rendered one-channel SVG mask reduced generation to roughly 0.5 seconds.
- The first combined cleanup patch missed because it used one context anchor across two files; the files were patched separately with no partial write.
- Lockfile refresh reported existing npm audit findings and a pre-existing duplicate `@tailwindcss/typography` declaration; neither was introduced or changed by this task.

---

## publish checklist

```bash
bun run task:push -- --message "type(website): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-16 03:33:40 apply-patch: `.task/website/stabilize-landing-typography-and-refine-footer-art/workpad.md`

## workspace-owned: files read

- `packages/consuelo-website/public/images/home/holding-world-editorial.png`
- `packages/consuelo-website/scripts/generate-footer-art.ts`
- `packages/consuelo-website/src/components/home/HomeCloudCta.astro`
- `packages/consuelo-website/src/components/home/HomeHero.astro`
- `packages/consuelo-website/src/layouts/MarketingLayout.astro`

- 2026-07-16 04:18:31 apply-patch: `.task/website/stabilize-landing-typography-and-refine-footer-art/workpad.md`

## workspace-owned: test selection

- changed files: `.task/tasks/website/stabilize-landing-typography-and-refine-footer-art.json`, `.task/website/stabilize-landing-typography-and-refine-footer-art/current.json`, `.task/website/stabilize-landing-typography-and-refine-footer-art/evidence-log.json`, `.task/website/stabilize-landing-typography-and-refine-footer-art/read-log.json`, `.task/website/stabilize-landing-typography-and-refine-footer-art/session.json`, `.task/website/stabilize-landing-typography-and-refine-footer-art/verify.json`, `.task/website/stabilize-landing-typography-and-refine-footer-art/workpad.md`, `packages/consuelo-website/bun.lock`, `packages/consuelo-website/package-lock.json`, `packages/consuelo-website/package.json`, `packages/consuelo-website/public/images/home/consuelo-footer-badge.png`, `packages/consuelo-website/public/images/home/consuelo-footer-badge.svg`, `packages/consuelo-website/public/images/home/holding-world-editorial.png`, `packages/consuelo-website/scripts/generate-footer-art.ts`, `packages/consuelo-website/src/components/home/HomeCloudCta.astro`, `packages/consuelo-website/src/components/home/HomeHero.astro`, `packages/consuelo-website/src/layouts/MarketingLayout.astro`, `packages/consuelo-website/tests/footer-art.test.mjs`, `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`, `packages/consuelo-website/tests/homepage-responsive.test.mjs`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

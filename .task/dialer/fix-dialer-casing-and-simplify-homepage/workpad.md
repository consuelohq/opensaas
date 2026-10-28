# Fix Dialer casing and simplify homepage

branch: `task/dialer/fix-dialer-casing-and-simplify-homepage`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2536
started: 2026-09-22

## acceptance criteria

- [x] Make the visible Dialer marketing copy render in conventional proper/title casing rather than the current all-lowercase presentation.
- [x] Remove the entire founder/"Why we built it" section from the homepage.
- [x] Remove the top "Founding agency program · Early access" announcement pill from the hero.
- [x] Keep the main hero CTAs and consolidated product/feature story intact unless needed for the casing fix.
- [x] Preserve desktop/mobile layout and the current Tailnet preview.

## plan

1. Sync the task branch to the current `stream/dialer` state from the previous landing-page pass.
2. Reproduce the lowercase behavior in-browser and inspect source plus computed typography/casing rules.
3. Extend the landing-page contract test first so the current founder section, announcement pill, and lowercase presentation fail.
4. Make the narrow homepage/casing edits.
5. Run focused tests/build and desktop/mobile browser smoke, then publish into `stream/dialer`.

## Test-first contract

behavior under test: the homepage shows properly cased copy, has no founder section, and has no founding-agency announcement pill above the hero.
existing local pattern: `packages/consuelo-dialer-website/tests/dialer-landing.test.mjs` is the source/content contract for this Astro marketing site, with browser smoke used for rendered CSS/layout proof.
new or changed tests: add explicit assertions that the founder component is absent from the homepage, the hero announcement element/copy is absent, and rendered/source casing uses title/sentence case for representative nav and hero strings.
focused red command: `bun test packages/consuelo-dialer-website/tests/dialer-landing.test.mjs`
expected red failure: current stream still renders/imports the founder section and hero announcement pill, and at least one casing assertion reproduces the screenshot behavior.
no-test waiver: not applicable.

## files changed

- `packages/consuelo-dialer-website/public/images/home/dither/cloud-{1,2,3,4}.png`
- `packages/consuelo-dialer-website/src/components/home/DialerFeaturePlaceholder.astro`
- `packages/consuelo-dialer-website/src/components/home/HomeCloudCta.astro`
- `packages/consuelo-dialer-website/src/components/home/HomeFeaturePreview.astro`
- `packages/consuelo-dialer-website/src/components/home/HomeFounderSection.astro` (deleted)
- `packages/consuelo-dialer-website/src/components/home/HomeHero.astro`
- `packages/consuelo-dialer-website/src/data/home-content.ts`
- `packages/consuelo-dialer-website/src/data/pricing-content.ts`
- `packages/consuelo-dialer-website/src/lib/homepage-seo.ts`
- `packages/consuelo-dialer-website/src/pages/index.astro`
- `packages/consuelo-dialer-website/src/pages/pricing.astro`
- `packages/consuelo-dialer-website/tests/dialer-landing.test.mjs`

## key decisions

- There is no steering or CSS rule lowercasing the site. The prior pass removed all-caps styling but authored the replacement headlines in sentence case, which is why the screenshots still visually read as lowercase. This pass uses explicit Title Case for marketing headlines, controls, feature titles, pricing labels, and SEO headline copy while keeping body prose in normal sentence case.
- The founding-agency announcement pill is not required for the page architecture. It duplicated the primary CTA and added an extra hierarchy layer above the hero, so it was removed rather than restyled.
- The founder section was removed completely, including its component and content object; the homepage now moves from hero directly into the consolidated product/features section.

## notes for ko

- Preview refreshed at `https://picassos-mac-mini.tail38ed59.ts.net:8767/` and `http://100.112.173.49:8769/`.
- Focused contract is green: 7 tests / 64 assertions / 0 failures.
- Astro check/build is green: 0 errors, 0 warnings, 2 inherited inline-script hints.
- Browser proof at 1440×900: title-cased hero/nav/buttons/features, no announcement element, no founder section, no horizontal overflow, no feature overflow, no broken images.
- Browser proof at 390×844: no announcement/founder, no horizontal overflow, no feature overflow, no broken images.
- Pricing browser proof: `Dialer Plans`, `1 Line` / `3 Lines`, title-cased subtitles/CTAs, no horizontal overflow, no broken images.

## improvements noticed

- The four Dialer dither-cloud assets were still corrupt on the stream even though the canonical Consuelo-site copies are valid PNGs. Replaced the corrupt copies from the canonical assets and verified the browser now decodes all images.

## errors i ran into

- The fresh worktree did not initially have the Dialer website package dependencies available, so Astro was not found. Recovered with `bun install --cwd packages/consuelo-dialer-website --frozen-lockfile`; it changed no tracked dependency files.
- The first green-test pass exposed two over-specific source assertions (escaped newlines and a generic `eyebrow` check). Tightened them to the actual behavior contract without weakening the founder/announcement/casing requirements.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/consuelo-dialer-website/src/components/home/DialerFeaturePlaceholder.astro`
- `packages/consuelo-dialer-website/src/components/home/HomeCloudCta.astro`
- `packages/consuelo-dialer-website/src/components/home/HomeFeaturePreview.astro`
- `packages/consuelo-dialer-website/src/components/home/HomeHero.astro`
- `packages/consuelo-dialer-website/src/components/site/SiteHeader.astro`
- `packages/consuelo-dialer-website/src/data/home-content.ts`
- `packages/consuelo-dialer-website/src/data/pricing-content.ts`
- `packages/consuelo-dialer-website/src/lib/homepage-seo.ts`
- `packages/consuelo-dialer-website/src/pages/index.astro`
- `packages/consuelo-dialer-website/src/styles/primitives.css`
- `packages/consuelo-dialer-website/src/styles/tokens.css`
- `packages/consuelo-dialer-website/tests/dialer-landing.test.mjs`

## workspace-owned: files changed

- `packages/consuelo-dialer-website/src/components/home/HomeFounderSection.astro` (deleted)

## workspace-owned: activity log

- 2026-09-22 03:09:09 fs.trash: `packages/consuelo-dialer-website/src/components/home/HomeFounderSection.astro`

- 2026-09-22 03:09:17 apply-patch: `packages/consuelo-dialer-website/src/pages/pricing.astro`
- 2026-09-22 03:09:33 apply-patch: `packages/consuelo-dialer-website/tests/dialer-landing.test.mjs`

- 2026-09-22 03:11:51 apply-patch: `packages/consuelo-dialer-website/src/lib/homepage-seo.ts`

- 2026-09-22 03:14:44 apply-patch: `.task/dialer/fix-dialer-casing-and-simplify-homepage/workpad.md`

## workspace-owned: validation evidence

- 2026-09-22 03:14:54 `review.run`: passed — OK
- 2026-09-22 03:15:02 `verify`: passed — OK

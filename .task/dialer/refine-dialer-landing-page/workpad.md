# Refine Dialer landing page

branch: `task/dialer/refine-dialer-landing-page`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2534
started: 2026-09-22

## acceptance criteria

- [x] Remove the source of the forced all-caps presentation and use normal/proper casing across the Dialer marketing site.
- [x] Remove the extra standalone homepage sections added in v1 (technical/product-fact/math/agency-style proof sections) and fold the useful ideas into the existing main product/feature story immediately before FAQ.
- [x] Spend the page's product detail budget in that main feature section, combining CRM embedding, predictive dialing/ringing behavior, inbound routing/callbacks, and other defensible product facts without duplicative sections.
- [x] Replace stale/out-of-date pricing-page product screenshots with explicit neutral placeholder visuals until current demos exist.
- [x] Update the header so it no longer says Demo; use Consuelo Docs and Consuelo Dialer Pricing, keep Features available elsewhere, and replace the treatment beneath Consuelo Dialer with the Consuelo mark.
- [x] Preserve responsive behavior, blue visual language, scroll behavior, and tailnet preview.

## plan

1. Sync this task branch to the current `stream/dialer` head so it includes the landed Dialer site.
2. Locate the exact lowercase rule and the current homepage/header/pricing section composition.
3. Update the existing Dialer landing contract test first and prove it fails for the current behavior.
4. Make the smallest component/data/CSS edits to satisfy the requested hierarchy and casing.
5. Run focused tests/build plus desktop/mobile browser checks, refresh the Tailscale preview, review/verify, and merge back into `stream/dialer`.

## Test-first contract

behavior under test: the Dialer site uses normal casing; header labels and brand mark match the requested navigation; redundant standalone proof/agency/stat sections are absent from the homepage; useful product claims live in the main feature-story section before FAQ; pricing uses placeholder visuals rather than stale screenshots.
existing local pattern: `packages/consuelo-dialer-website/tests/dialer-landing.test.mjs` already acts as a source/content contract for the Astro site.
new or changed tests: extend `dialer-landing.test.mjs` with casing/CSS, header label/brand-mark, homepage section composition/order, and pricing-placeholder assertions.
focused red command: `bun test packages/consuelo-dialer-website/tests/dialer-landing.test.mjs`
expected red failure: current site still contains the lowercase transform/current nav and renders the extra standalone sections plus stale pricing imagery.
no-test waiver: not applicable.

## files changed

- `packages/consuelo-dialer-website/public/images/home/dither/cloud-1.png`
- `packages/consuelo-dialer-website/public/images/home/dither/cloud-2.png`
- `packages/consuelo-dialer-website/public/images/home/dither/cloud-3.png`
- `packages/consuelo-dialer-website/public/images/home/dither/cloud-4.png`
- `packages/consuelo-dialer-website/src/components/home/DialerFeaturePlaceholder.astro`
- `packages/consuelo-dialer-website/src/components/home/HomeAgencySection.astro` (deleted)
- `packages/consuelo-dialer-website/src/components/home/HomeCloudCta.astro`
- `packages/consuelo-dialer-website/src/components/home/HomeDialerStats.astro` (deleted)
- `packages/consuelo-dialer-website/src/components/home/HomeFaq.astro`
- `packages/consuelo-dialer-website/src/components/home/HomeFeaturePreview.astro`
- `packages/consuelo-dialer-website/src/components/home/HomeFounderSection.astro`
- `packages/consuelo-dialer-website/src/components/home/HomeHero.astro`
- `packages/consuelo-dialer-website/src/components/site/SiteHeader.astro`
- `packages/consuelo-dialer-website/src/data/home-content.ts`
- `packages/consuelo-dialer-website/src/data/pricing-content.ts`
- `packages/consuelo-dialer-website/src/data/site-links.ts`
- `packages/consuelo-dialer-website/src/data/site-navigation.ts`
- `packages/consuelo-dialer-website/src/pages/index.astro`
- `packages/consuelo-dialer-website/src/pages/pricing.astro`
- `packages/consuelo-dialer-website/src/styles/primitives.css`
- `packages/consuelo-dialer-website/tests/dialer-landing.test.mjs`


## key decisions

- The useful technical facts are not deleted; they are consolidated into the main feature narrative so the homepage has one coherent product story instead of multiple proof islands.
- No Dialer steering requires lowercase or uppercase presentation. The previous appearance came from page-authored all-caps strings plus CSS `text-transform: uppercase`; both were removed instead of adding a counter-rule.
- The desktop header now follows Consuelo / Docs / Consuelo Dialer / Pricing / Features, and both desktop and mobile brand treatments place the existing Consuelo favicon/mark beneath the Dialer wordmark.
- The stale pricing screenshots were replaced with neutral CSS product-preview placeholders; the plan structure remains grounded in the existing Single / Standard / Power model.
- The duplicated product-facts and founding-agency blocks were deleted. CRM embedding, 3× maximum line fanout, 500ms launch stagger, server-owned lifecycle, inbound/callback architecture, follow-up, and agency/multi-location positioning now live in the six main product stories before FAQ.

## notes for ko

- Tailnet preview refreshed in place: `https://picassos-mac-mini.tail38ed59.ts.net:8767/`.
- Numeric tailnet preview remains: `http://100.112.173.49:8769/`.
- Focused contract: 6 tests / 50 assertions / 0 failures.
- Astro check/build: 0 errors, 0 warnings, 2 inherited inline-script hints; both `/` and `/pricing` built successfully.
- Browser smoke used an isolated temporary profile so the existing headed/authenticated browser was not touched. Desktop 1440×900 and mobile 390×844 both had `scrollWidth === clientWidth`, no forced text transforms, no broken images, and no feature-story overflow. Pricing had three placeholders and no stale `/previews/` images.

## improvements noticed

- The first landing-page clone contained four corrupted dither-cloud PNGs. Their canonical counterparts in `packages/consuelo-website` were valid, so the Dialer copies were repaired; browser verification now reports zero broken images.

## errors i ran into

- `session.start` initially rejected `name`/description fields; retried with the current `title` schema and task creation succeeded.
- The first build attempt failed because the fresh worktree had no Dialer website dependencies installed. `bun install --cwd packages/consuelo-dialer-website --frozen-lockfile` restored the package-local toolchain without changing tracked files.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-09-22 02:26:37 write: `.task/dialer/refine-dialer-landing-page/workpad.md`

## workspace-owned: files changed

- `packages/consuelo-dialer-website/src/components/home/HomeAgencySection.astro` (deleted)
- `packages/consuelo-dialer-website/src/components/home/HomeDialerStats.astro` (deleted)
- `packages/consuelo-dialer-website/src/data/home-content.ts`
- `packages/consuelo-dialer-website/src/data/pricing-content.ts`
- `packages/consuelo-dialer-website/tests/dialer-landing.test.mjs`

## workspace-owned: activity log

- 2026-09-22 02:26:37 fs.write: `.task/dialer/refine-dialer-landing-page/workpad.md`
- 2026-09-22 02:30:54 fs.write: `packages/consuelo-dialer-website/tests/dialer-landing.test.mjs`
- 2026-09-22 02:31:42 fs.write: `packages/consuelo-dialer-website/src/data/home-content.ts`
- 2026-09-22 02:32:13 fs.write: `packages/consuelo-dialer-website/src/data/pricing-content.ts`
- 2026-09-22 02:32:56 fs.trash: `packages/consuelo-dialer-website/src/components/home/HomeDialerStats.astro`
- 2026-09-22 02:32:56 fs.trash: `packages/consuelo-dialer-website/src/components/home/HomeAgencySection.astro`

## workspace-owned: files read

- `packages/consuelo-dialer-website/public/favicon.svg`
- `packages/consuelo-dialer-website/src/components/home/DialerFeaturePlaceholder.astro`
- `packages/consuelo-dialer-website/src/components/home/HomeAgencySection.astro`
- `packages/consuelo-dialer-website/src/components/home/HomeCloudCta.astro`
- `packages/consuelo-dialer-website/src/components/home/HomeDialerStats.astro`
- `packages/consuelo-dialer-website/src/components/home/HomeFaq.astro`
- `packages/consuelo-dialer-website/src/components/home/HomeFeaturePreview.astro`
- `packages/consuelo-dialer-website/src/components/home/HomeHero.astro`
- `packages/consuelo-dialer-website/src/components/site/SiteHeader.astro`
- `packages/consuelo-dialer-website/src/data/home-content.ts`
- `packages/consuelo-dialer-website/src/data/pricing-content.ts`
- `packages/consuelo-dialer-website/src/data/site-links.ts`
- `packages/consuelo-dialer-website/src/data/site-navigation.ts`
- `packages/consuelo-dialer-website/src/layouts/MarketingLayout.astro`
- `packages/consuelo-dialer-website/src/pages/index.astro`
- `packages/consuelo-dialer-website/src/pages/pricing.astro`
- `packages/consuelo-dialer-website/src/styles/primitives.css`
- `packages/consuelo-dialer-website/src/styles/tokens.css`
- `packages/consuelo-dialer-website/tests/dialer-landing.test.mjs`
- `packages/consuelo-website/public/images/home/consuelo-mark.svg`
- `packages/consuelo-website/public/images/logo/logo.svg`
- `packages/consuelo-website/src/components/site/SiteHeader.astro`

- 2026-09-22 02:37:20 apply-patch: `.task/dialer/refine-dialer-landing-page/workpad.md`

## workspace-owned: validation evidence

- 2026-09-22 02:37:32 `review.run`: passed — OK
- 2026-09-22 02:37:44 `verify`: passed — OK

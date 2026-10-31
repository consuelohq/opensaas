# Polish Dialer layout navigation feature grid and footer

branch: `task/website/polish-dialer-layout-navigation-feature-grid-and-footer`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2734
started: 2026-10-31

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `/tmp/consuelo-layout-capture.mjs`
- `packages/dialer-website/animations.md`
- `packages/dialer-website/COMPONENTS.md`
- `packages/dialer-website/DESIGN.md`
- `packages/dialer-website/public/images/technology/wordmarks/pi.svg`
- `packages/dialer-website/scripts/test-marketing-browser.mjs`
- `packages/dialer-website/scripts/test-pricing-browser.mjs`
- `packages/dialer-website/src/components/home/HomeCloudCta.astro`
- `packages/dialer-website/src/components/home/HomeFeaturePreview.astro`
- `packages/dialer-website/src/components/pricing/PricingTechnology.astro`
- `packages/dialer-website/src/components/site/SiteFooter.astro`
- `packages/dialer-website/src/components/site/SiteHeader.astro`
- `packages/dialer-website/src/data/dialer-content.ts`
- `packages/dialer-website/src/data/pricing-content.ts`
- `packages/dialer-website/src/data/site-navigation.ts`
- `packages/dialer-website/src/pages/index.astro`
- `packages/dialer-website/src/pages/pricing.astro`
- `packages/dialer-website/src/styles/pricing.css`
- `packages/dialer-website/src/styles/tokens.css`
- `packages/dialer-website/tests/pricing-refinement.test.ts`

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

- `/tmp/consuelo-layout-capture.mjs`
- `packages/dialer-website/COMPONENTS.md`
- `packages/dialer-website/DESIGN.md`
- `packages/dialer-website/animations.md`
- `packages/dialer-website/public/images/technology/wordmarks/pi.svg`
- `packages/dialer-website/scripts/checkout-browser-fixture.mjs`
- `packages/dialer-website/scripts/test-marketing-browser.mjs`
- `packages/dialer-website/scripts/test-pricing-browser.mjs`
- `packages/dialer-website/src/components/home/HomeCloudCta.astro`
- `packages/dialer-website/src/components/home/HomeFaq.astro`
- `packages/dialer-website/src/components/home/HomeFeaturePreview.astro`
- `packages/dialer-website/src/components/home/HomeHero.astro`
- `packages/dialer-website/src/components/pricing/PricingTechnology.astro`
- `packages/dialer-website/src/components/site/SiteFooter.astro`
- `packages/dialer-website/src/components/site/SiteHeader.astro`
- `packages/dialer-website/src/components/visuals/CloudField.astro`
- `packages/dialer-website/src/data/dialer-content.ts`
- `packages/dialer-website/src/data/pricing-content.ts`
- `packages/dialer-website/src/data/site-links.ts`
- `packages/dialer-website/src/data/site-navigation.ts`
- `packages/dialer-website/src/layouts/MarketingLayout.astro`
- `packages/dialer-website/src/lib/site-smooth-scroll.ts`
- `packages/dialer-website/src/pages/index.astro`
- `packages/dialer-website/src/pages/pricing.astro`
- `packages/dialer-website/src/styles/pricing.css`
- `packages/dialer-website/src/styles/primitives.css`
- `packages/dialer-website/src/styles/tokens.css`
- `packages/dialer-website/tests/interaction-lifecycle.test.ts`
- `packages/dialer-website/tests/pricing-refinement.test.ts`
- `packages/workspace/senior-engineer.md`

## Acceptance and test-first contract
- Keep a visible blue gap below header socials and a matching narrow blue frame on pricing and homepage.
- Exactly four equal feature chapters: inbound, outbound, analytics, AI assistant; retain GHL positioning in copy.
- Returning compact navigation becomes usable at features, hides in hero, supports keyboard and reduced motion.
- Make real technology logos legible; remove visible pause button; pause on hover/focus and reduced motion.
- Restore cloud atmosphere to the existing closing reveal, replace weak CTA copy, add a real grouped footer/logo with valid destinations.
- Rich FAQ answers use short introductions, bullets and numbered steps; no pricing or billing changes.

behavior under test: four equal feature chapters, scroll-triggered returning navigation, pricing header clearance, legible/pause-on-hover logos and responsive accessible footer.
existing local pattern: Playwright marketing browser fixture with blocked external checkout calls, existing rich HomeFaq blocks, CloudField.
new or changed tests: extend existing marketing browser script with geometry/navigation/FAQ/footer assertions; reuse pricing browser suite for purchasing regressions.
focused red command: build baseline then marketing browser --smoke.
expected red failure: current feature count is five, expected four; returning nav absent.
no-test waiver: new unit tests for copy/CSS omitted; browser geometry and interaction proof covers the behavior.

## Plan and boundaries
Current stream/website4747e179 contains approved native Stripe consumer913169b; task2734 started from that stream. Own only packages/dialer-website and task workpad. Leave current backend, calls UI, Stripe catalog and public domain routing untouched. Validate focused red then green, full package build/tests, eight-size marketing/pricing browser suites, strict review and publish-valid verification; merge task to website stream and deploy independent Pages preview.

- 2026-10-31 05:05:19 append: `.task/website/polish-dialer-layout-navigation-feature-grid-and-footer/workpad.md`

## workspace-owned: files changed

- `/tmp/consuelo-layout-capture.mjs`
- `packages/dialer-website/animations.md`
- `packages/dialer-website/COMPONENTS.md`
- `packages/dialer-website/DESIGN.md`
- `packages/dialer-website/public/images/technology/wordmarks/pi.svg`
- `packages/dialer-website/scripts/test-marketing-browser.mjs`
- `packages/dialer-website/scripts/test-pricing-browser.mjs`
- `packages/dialer-website/src/components/home/HomeCloudCta.astro`
- `packages/dialer-website/src/components/home/HomeFeaturePreview.astro`
- `packages/dialer-website/src/components/pricing/PricingTechnology.astro`
- `packages/dialer-website/src/components/site/SiteFooter.astro`
- `packages/dialer-website/src/components/site/SiteHeader.astro`
- `packages/dialer-website/src/data/dialer-content.ts`
- `packages/dialer-website/src/data/pricing-content.ts`
- `packages/dialer-website/src/data/site-navigation.ts`
- `packages/dialer-website/src/pages/index.astro`
- `packages/dialer-website/src/pages/pricing.astro`
- `packages/dialer-website/src/styles/pricing.css`
- `packages/dialer-website/src/styles/tokens.css`
- `packages/dialer-website/tests/pricing-refinement.test.ts`

## workspace-owned: activity log

- 2026-10-31 05:08:19 write: `packages/dialer-website/src/styles/pricing.css`
- 2026-10-31 05:08:19 fs.write: `packages/dialer-website/src/styles/pricing.css`
- 2026-10-31 05:08:19 write: `packages/dialer-website/src/components/pricing/PricingTechnology.astro`
- 2026-10-31 05:08:19 fs.write: `packages/dialer-website/src/components/pricing/PricingTechnology.astro`
- 2026-10-31 05:08:20 write: `packages/dialer-website/src/components/site/SiteHeader.astro`
- 2026-10-31 05:08:20 fs.write: `packages/dialer-website/src/components/site/SiteHeader.astro`
- 2026-10-31 05:09:01 write: `packages/dialer-website/src/components/site/SiteFooter.astro`
- 2026-10-31 05:09:01 fs.write: `packages/dialer-website/src/components/site/SiteFooter.astro`
- 2026-10-31 05:09:02 write: `packages/dialer-website/src/components/home/HomeCloudCta.astro`
- 2026-10-31 05:09:02 fs.write: `packages/dialer-website/src/components/home/HomeCloudCta.astro`
- 2026-10-31 05:09:02 write: `packages/dialer-website/src/pages/index.astro`
- 2026-10-31 05:09:02 fs.write: `packages/dialer-website/src/pages/index.astro`
- 2026-10-31 05:09:02 write: `packages/dialer-website/src/pages/pricing.astro`
- 2026-10-31 05:09:02 fs.write: `packages/dialer-website/src/pages/pricing.astro`
- 2026-10-31 05:09:38 write: `packages/dialer-website/src/styles/pricing.css`
- 2026-10-31 05:09:38 fs.write: `packages/dialer-website/src/styles/pricing.css`
- 2026-10-31 05:09:38 write: `packages/dialer-website/DESIGN.md`
- 2026-10-31 05:09:38 fs.write: `packages/dialer-website/DESIGN.md`
- 2026-10-31 05:09:38 write: `packages/dialer-website/COMPONENTS.md`
- 2026-10-31 05:09:38 fs.write: `packages/dialer-website/COMPONENTS.md`
- 2026-10-31 05:09:39 write: `packages/dialer-website/animations.md`
- 2026-10-31 05:09:39 fs.write: `packages/dialer-website/animations.md`
- 2026-10-31 05:10:17 write: `packages/dialer-website/scripts/test-marketing-browser.mjs`
- 2026-10-31 05:10:17 fs.write: `packages/dialer-website/scripts/test-marketing-browser.mjs`
- 2026-10-31 05:10:17 write: `packages/dialer-website/src/data/dialer-content.ts`
- 2026-10-31 05:10:17 fs.write: `packages/dialer-website/src/data/dialer-content.ts`
- 2026-10-31 05:12:45 write: `packages/dialer-website/src/components/site/SiteFooter.astro`
- 2026-10-31 05:12:45 fs.write: `packages/dialer-website/src/components/site/SiteFooter.astro`
- 2026-10-31 05:12:46 write: `packages/dialer-website/src/styles/tokens.css`
- 2026-10-31 05:12:46 fs.write: `packages/dialer-website/src/styles/tokens.css`
- 2026-10-31 05:12:47 write: `packages/dialer-website/public/images/technology/wordmarks/pi.svg`
- 2026-10-31 05:12:47 fs.write: `packages/dialer-website/public/images/technology/wordmarks/pi.svg`
- 2026-10-31 05:13:43 write: `packages/dialer-website/tests/pricing-refinement.test.ts`
- 2026-10-31 05:13:43 fs.write: `packages/dialer-website/tests/pricing-refinement.test.ts`
- 2026-10-31 05:13:47 write: `packages/dialer-website/scripts/test-marketing-browser.mjs`
- 2026-10-31 05:13:47 fs.write: `packages/dialer-website/scripts/test-marketing-browser.mjs`
- 2026-10-31 05:15:47 write: `packages/dialer-website/src/data/site-navigation.ts`
- 2026-10-31 05:15:47 fs.write: `packages/dialer-website/src/data/site-navigation.ts`
- 2026-10-31 05:15:47 write: `packages/dialer-website/src/components/site/SiteFooter.astro`
- 2026-10-31 05:15:47 fs.write: `packages/dialer-website/src/components/site/SiteFooter.astro`
- 2026-10-31 05:15:48 write: `packages/dialer-website/src/components/home/HomeCloudCta.astro`
- 2026-10-31 05:15:48 fs.write: `packages/dialer-website/src/components/home/HomeCloudCta.astro`
- 2026-10-31 05:15:49 write: `packages/dialer-website/src/styles/pricing.css`
- 2026-10-31 05:15:49 fs.write: `packages/dialer-website/src/styles/pricing.css`
- 2026-10-31 05:17:33 fs.write: `.task/website/polish-dialer-layout-navigation-feature-grid-and-footer/workpad.md`
- 2026-10-31 05:21:36 fs.write: `packages/dialer-website/src/data/dialer-content.ts`
- 2026-10-31 05:21:38 fs.write: `packages/dialer-website/src/data/pricing-content.ts`
- 2026-10-31 05:21:39 fs.write: `packages/dialer-website/scripts/test-pricing-browser.mjs`
- 2026-10-31 05:24:27 fs.write: `.task/website/polish-dialer-layout-navigation-feature-grid-and-footer/workpad.md`
- 2026-10-31 05:25:02 fs.write: `/tmp/consuelo-layout-capture.mjs`

## workspace-owned: validation evidence

- 2026-10-31 05:16:11 `review.run`: passed — OK
- 2026-10-31 05:17:34 `review.run`: passed — OK
- 2026-10-31 05:19:46 `verify`: passed — OK
- 2026-10-31 05:26:34 `verify`: passed — OK

## Implementation and validation checkpoint
- Replaced five asymmetrical chapters with four equal inbound/outbound/analytics/AI-assistant chapters; removed the standalone integration chapter while preserving GoHighLevel context.
- Shared cloud closing section and grouped footer on landing/pricing; footer copy/links in site-navigation data. Kept finite reveal and added keyboard reveal. Document flow prevents clipping on short screens.
- Pricing now leaves header clearance and matches the blue outer frame. Real stack logos enlarged, Pi viewBox cropped without changing geometry/provenance, visible pause removed; hover/focus/reduced-motion pause remains.
- Home FAQs now use the existing paragraph/list/steps model rather than long unbroken answers.
- Browser pretest failed5vs4 as expected before implementation. Focused mobile and all eight plan/billing combinations passed. Full marketing and pricing suites passed all eight geometry viewports; full interaction logs include hover/focus/reduced motion and safe fixture checkout. Awaiting browser cleanup/exit before final gate.
- Package build:0errors/0warnings,7unchanged hints. Unit package tests38pass/278assertions.
- Review strict:0changed findings; existing noNx-typecheck-target diagnostic. Reviewable-file scope excludes Astro/CSS, separately covered by Astro check/build and browser tests.
- Recovery: code.call long browser requests lost OS transport response. Workspace facade recovered on short diagnostic. Re-ran via task-scoped OS background runner with captured logs, no native repository fallback.
- Static image pretest adapted to decode lazy assets before asserting. Updated white-frame ordering assertion for the shared closing wrapper, preserving its intent.

- 2026-10-31 05:17:33 append: `.task/website/polish-dialer-layout-navigation-feature-grid-and-footer/workpad.md`

- 2026-10-31 05:21:36 write: `packages/dialer-website/src/data/dialer-content.ts`

- 2026-10-31 05:21:38 write: `packages/dialer-website/src/data/pricing-content.ts`

- 2026-10-31 05:21:39 write: `packages/dialer-website/scripts/test-pricing-browser.mjs`

## Final acceptance evidence
- All requested layout/footer/navigation/logo changes implemented. Both homepage and pricing FAQs now have structured paragraph/list/steps content; prices and all native Stripe behavior retained.
- Pricing browser suite: all8sizes, outbound/inbound filter, team totals, direct checkout, noJS, keyboard, disclosure pointer selection, native partial/canceled/pending/claimed recovery and hostile destinations pass; /tmp/consuelo-layout-pricing-confirmed.json exitCode0 and cleanup complete.
- The first pricing run failed because its older assertion still tried to click the removed Pause logos button. Replaced that assertion with no visible pause control plus hover/focus pause and resume behavior, preserving reduced-motion proof. No billing implementation changed.
- Final package build0errors/0warnings/7existing hints;38unit tests pass278assertions. First fullverify passed all4requiredsuites, including eight-size marketing and cleanup. Finalverify refreshed after pricing FAQ/test updates.
- Captured desktop/mobile feature/footer screenshots and inspected them. Full hero cloud atmosphere reused at close; normal-flow grouped footer stays available below the reveal. No changes to production routing, backend, calls UI, Stripe products or prices.
- Cloudflare whoami confirmed existing account and Pages permission. Missing unrelated new OAuth scopes do not affect this deployment.

- 2026-10-31 05:24:27 append: `.task/website/polish-dialer-layout-navigation-feature-grid-and-footer/workpad.md`

- 2026-10-31 05:25:02 write: `/tmp/consuelo-layout-capture.mjs`

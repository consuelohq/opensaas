# Refresh social card cache and improve homepage FAQ

branch: `task/consuelo-website/refresh-social-card-cache-and-improve-homepage-faq`
stream: `stream/consuelo-website`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1440/refresh-social-card-cache-and-improve-homepage-faq
github pr: https://github.com/consuelohq/opensaas/pull/1440
started: 2026-07-13

## acceptance criteria

- [x] Give X a fingerprinted social image URL that cannot resolve to the stale sales card.
- [x] Create original editable Consuelo SVG artwork for the hero and Features transition.
- [x] Add a local currentColor pixel arrow to the sign-in action.
- [x] Strengthen mobile header type and icon sizing without horizontal overflow.
- [x] Preserve the three-line mobile hero and first-viewport Features glimpse.
- [x] Make FAQ disclosures mutually exclusive.
- [x] Replace thin FAQ answers with structured mini-doc content and a pricing link.
- [x] Add focused DOM/visual contract coverage.
- [x] Capture before/after desktop and 390x844 mobile screenshots.
- [x] Pass focused tests and the production Astro build.

## plan

1. Capture the current page at the required viewports and add failing contract tests.
2. Build one SVG atmosphere system across the hero and Features transition.
3. Improve FAQ content/rendering and single-open behavior.
4. Fingerprint the social card path and centralize homepage SEO usage.
5. Validate, review, publish, deploy, and smoke production metadata.

## current status

- Implementation, visual inspection, focused tests, and production build are complete.
- Ready for workspace review and publish gates.

## visual artifacts

| viewport | before | after |
| --- | --- | --- |
| 1440x900 | [before desktop](screenshots/before-desktop-1440x900.png) | [after desktop](screenshots/after-desktop-1440x900.png) |
| 390x844 | [before mobile](screenshots/before-mobile-390x844.png) | [after mobile](screenshots/after-mobile-390x844.png) |

## files changed

- `packages/consuelo-website/public/images/home/consuelo-atmosphere.svg`
- `packages/consuelo-website/public/images/home/consuelo-transition.svg`
- `packages/consuelo-website/src/components/icons/PixelArrow.astro`
- `packages/consuelo-website/src/components/home/HomeHero.astro`
- `packages/consuelo-website/src/components/home/HomeFeaturePreview.astro`
- `packages/consuelo-website/src/components/site/SiteHeader.astro`
- `packages/consuelo-website/src/components/home/HomeFaq.astro`
- `packages/consuelo-website/src/data/home-content.ts`
- `packages/consuelo-website/src/lib/homepage-seo.ts`
- `packages/consuelo-website/src/pages/index.astro`
- `packages/consuelo-website/public/consuelo-os-og-20260713.png`
- focused website tests and this task's screenshot artifacts

## validation evidence

- Expected-red social/asset tests failed before implementation.
- `bun test tests/social-card.test.mjs tests/homepage-responsive.test.mjs tests/website-structure.test.js`: 23 passed.
- `node --test tests/homepage-mobile-layout.test.mjs`: passed.
- `node --test tests/site-header.test.mjs`: passed.
- `bun run build`: passed; Astro check reported 0 errors and 95 pages built.
- Playwright visual inspection completed at 1440x900 and 390x844.
- Mobile DOM contract confirms zero horizontal overflow, three headline lines, and the next-section glimpse.

## key decisions

- Reused one SVG vocabulary: halftone clouds for distributed nodes, orbital paths for routing, square markers for machines, and faint workspace labels.
- Kept the center of the hero optically quiet so the headline remains primary.
- Used typed FAQ blocks instead of introducing a runtime Markdown dependency; paragraphs, lists, steps, and links render as semantic HTML.
- Preserved the plain `answer` field for FAQ structured data.
- Changed the social image from `/consuelo-os-og.png` to `/consuelo-os-og-20260713.png` to bypass X's cached image object.
- Limited SVG blur to static glow ellipses and reused one asset per viewport to keep paint/download cost bounded.

## notes for ko

- Fast X retry URL after production deploy: `https://consuelohq.com/?x-card=20260713`.
- The official X Card Validator requires an X login and can request a recrawl: https://cards-dev.twitter.com/validator

## issues and recovery

- The workspace code runner does not expose `apply_patch` inside its sandbox, so edits used the facade's documented `code.call` structured rewrite path.
- The first FAQ browser assertion read the native disclosure state before the toggle event settled; it now waits for the single-open DOM state.
- The legacy website structure/header tests described a removed footer and old header selectors. They were brought forward to the current approved homepage contract.

---

## publish checklist

- [ ] `review.run`
- [ ] `verify`
- [ ] `task.push`
- [ ] `task.pr`
- [ ] merge, Cloudflare deploy, and production smoke

## workspace-owned: validation evidence

- Expected-red social/asset tests failed before implementation.
- `bun test tests/social-card.test.mjs tests/homepage-responsive.test.mjs tests/website-structure.test.js`: 23 passed.
- `node --test tests/homepage-mobile-layout.test.mjs`: passed.
- `node --test tests/site-header.test.mjs`: passed.
- `bun run build`: passed; Astro check reported 0 errors and 95 pages built.
- Playwright visual inspection completed at 1440x900 and 390x844.
- Mobile DOM contract confirms zero horizontal overflow, three headline lines, and the next-section glimpse.
- 2026-07-13 03:01:44 `review.run`: passed — OK
- 2026-07-13 03:02:51 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/consuelo-website/refresh-social-card-cache-and-improve-homepage-faq/current.json`, `.task/consuelo-website/refresh-social-card-cache-and-improve-homepage-faq/screenshots/after-desktop-1440x900.png`, `.task/consuelo-website/refresh-social-card-cache-and-improve-homepage-faq/screenshots/after-mobile-390x844.png`, `.task/consuelo-website/refresh-social-card-cache-and-improve-homepage-faq/screenshots/before-desktop-1440x900.png`, `.task/consuelo-website/refresh-social-card-cache-and-improve-homepage-faq/screenshots/before-mobile-390x844.png`, `.task/consuelo-website/refresh-social-card-cache-and-improve-homepage-faq/session.json`, `.task/consuelo-website/refresh-social-card-cache-and-improve-homepage-faq/workpad.md`, `.task/tasks/consuelo-website/refresh-social-card-cache-and-improve-homepage-faq.json`, `packages/consuelo-website/DESIGN.md`, `packages/consuelo-website/public/consuelo-os-og-20260713.png`, `packages/consuelo-website/public/images/home/consuelo-atmosphere.svg`, `packages/consuelo-website/public/images/home/consuelo-transition.svg`, `packages/consuelo-website/scripts/generate-social-card.ts`, `packages/consuelo-website/src/components/home/HomeFaq.astro`, `packages/consuelo-website/src/components/home/HomeFeaturePreview.astro`, `packages/consuelo-website/src/components/home/HomeHero.astro`, `packages/consuelo-website/src/components/icons/PixelArrow.astro`, `packages/consuelo-website/src/components/site/SiteHeader.astro`, `packages/consuelo-website/src/data/home-content.ts`, `packages/consuelo-website/src/lib/homepage-seo.ts`, `packages/consuelo-website/src/pages/index.astro`, `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`, `packages/consuelo-website/tests/homepage-responsive.test.mjs`, `packages/consuelo-website/tests/site-header.test.mjs`, `packages/consuelo-website/tests/social-card.test.mjs`, `packages/consuelo-website/tests/website-structure.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

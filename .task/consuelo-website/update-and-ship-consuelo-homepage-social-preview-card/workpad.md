# Update and ship Consuelo homepage social preview card

branch: `task/consuelo-website/update-and-ship-consuelo-homepage-social-preview-card`
stream: `stream/consuelo-website`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1430/update-and-ship-consuelo-homepage-social-preview-card
github pr: https://github.com/consuelohq/opensaas/pull/1430
started: 2026-07-12

## acceptance criteria

- [x] Replace the stale sales-infrastructure social card with “Your workspace, connected to every agent.”
- [x] Use the website-owned warm editorial palette and typography.
- [x] Keep the 1200x630 social preview image deterministic and source-controlled.
- [x] Align homepage title, description, Open Graph, and Twitter image metadata.
- [x] Add focused regression coverage and pass the production website build.
- [ ] Publish through the website stream and verify production metadata/image.

## plan

1. Reuse the existing `/og.png` wiring and create an editable deterministic generator.
2. Align homepage metadata and enrich shared social image metadata.
3. Validate the generated image, focused test, built HTML, and production build.
4. Review, verify, push, promote, merge, and smoke production.

## current status

- Implementation and focused validation complete.
- Ready for workspace review and publish gates.

## files changed

- `packages/consuelo-website/package.json`
- `packages/consuelo-website/public/og.png`
- `packages/consuelo-website/scripts/generate-social-card.ts`
- `packages/consuelo-website/src/components/SeoHead.astro`
- `packages/consuelo-website/src/layouts/MarketingLayout.astro`
- `packages/consuelo-website/src/lib/homepage-seo.ts`
- `packages/consuelo-website/src/pages/index.astro`
- `packages/consuelo-website/tests/social-card.test.mjs`

## validation evidence

- `bun test packages/consuelo-website/tests/social-card.test.mjs`: 2 passed.
- `bun run --cwd packages/consuelo-website build`: passed; 94 pages built.
- Built homepage metadata contains the new title, description, absolute `og:image`, image alt text, width 1200, and height 630.
- Visual inspection confirmed the 1200x630 card is legible and uses the website palette.
- `website-structure.test.js` has six existing header/hero contract failures; the failing test and referenced `HomeHero.astro`/`SiteHeader.astro` files are unchanged by this task.

## key decisions

- Reused the established `/og.png` path to avoid cache and routing churn.
- Added a deterministic Sharp/SVG generator that reads the website color tokens instead of generating a new AI visual.
- Centralized homepage SEO copy so the HTML metadata and social-card headline stay aligned.
- Added `og:image:alt`, `og:image:width`, `og:image:height`, and `twitter:image:alt`.

## issues and recovery

- The first anchored patch failed closed on `SeoHead.astro`; exact lines were re-read and the patch was reapplied successfully.
- Package Prettier cannot parse the existing inline PostHog bootstrap in `MarketingLayout.astro`; only safely parseable changed files were formatted, and the Astro production build passed.

---

## publish checklist

- [ ] `review.run`
- [ ] `verify`
- [ ] `task.push`
- [ ] `task.pr`
- [ ] merge and production smoke

- 2026-07-13 00:09:15 write: `.task/consuelo-website/update-and-ship-consuelo-homepage-social-preview-card/workpad.md`

## workspace-owned: files changed

- `packages/consuelo-website/package.json`
- `packages/consuelo-website/public/og.png`
- `packages/consuelo-website/scripts/generate-social-card.ts`
- `packages/consuelo-website/src/components/SeoHead.astro`
- `packages/consuelo-website/src/layouts/MarketingLayout.astro`
- `packages/consuelo-website/src/lib/homepage-seo.ts`
- `packages/consuelo-website/src/pages/index.astro`
- `packages/consuelo-website/tests/social-card.test.mjs`

## workspace-owned: activity log

- 2026-07-13 00:09:15 fs.write: `.task/consuelo-website/update-and-ship-consuelo-homepage-social-preview-card/workpad.md`

## workspace-owned: validation evidence

- `bun test packages/consuelo-website/tests/social-card.test.mjs`: 2 passed.
- `bun run --cwd packages/consuelo-website build`: passed; 94 pages built.
- Built homepage metadata contains the new title, description, absolute `og:image`, image alt text, width 1200, and height 630.
- Visual inspection confirmed the 1200x630 card is legible and uses the website palette.
- `website-structure.test.js` has six existing header/hero contract failures; the failing test and referenced `HomeHero.astro`/`SiteHeader.astro` files are unchanged by this task.
- 2026-07-13 00:10:23 `review.run`: passed — OK
- 2026-07-13 00:11:23 apply-patch: `packages/consuelo-website/scripts/generate-social-card.ts`
- 2026-07-13 00:14:18 `review.run`: passed — OK
- 2026-07-13 00:14:33 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/consuelo-website/update-and-ship-consuelo-homepage-social-preview-card/current.json`, `.task/consuelo-website/update-and-ship-consuelo-homepage-social-preview-card/session.json`, `.task/consuelo-website/update-and-ship-consuelo-homepage-social-preview-card/workpad.md`, `.task/tasks/consuelo-website/update-and-ship-consuelo-homepage-social-preview-card.json`, `packages/consuelo-website/package.json`, `packages/consuelo-website/public/og.png`, `packages/consuelo-website/scripts/generate-social-card.ts`, `packages/consuelo-website/src/components/SeoHead.astro`, `packages/consuelo-website/src/layouts/MarketingLayout.astro`, `packages/consuelo-website/src/lib/homepage-seo.ts`, `packages/consuelo-website/src/pages/index.astro`, `packages/consuelo-website/tests/social-card.test.mjs`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

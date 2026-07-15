# unify brand icons and refine landing interactions

branch: `task/website/unify-brand-icons-and-refine-landing-interactions`
stream: `stream/website`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1499/unify-brand-icons-and-refine-landing-interactions
github pr: https://github.com/consuelohq/opensaas/pull/1499
started: 2026-07-14

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-15 00:39:28 `review.run`: passed — OK
- 2026-07-15 00:42:33 `review.run`: passed — OK
- 2026-07-15 00:44:01 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(website): description" --changed
bun run task:pr
bun run task:finish
```

## Approved implementation contract

- TDD: add focused failing tests before production edits.
- Restore the versioned social card to #0000F2.
- Standardize the canonical black-on-white rounded Consuelo app icon across website, docs, artifacts, and structured data.
- Keep the blue mark only as the editorial footer badge.
- Keep the hero at exactly three authored lines across desktop, constrained desktop, tablet, and mobile using Pretext-backed fitting.
- Rebuild the final cloud panel as a fixed full-viewport reveal beneath the scrolling page, with reduced-motion behavior and complete mobile artwork.
- Validate focused tests, website/docs builds, OS artifact contracts, and browser screenshots before publishing to stream/website.

## Discovery

- Inspect current website components, SEO paths, docs favicon config, artifact favicon contract, and focused test ownership.

## Test-first evidence

- Focused red run: bun test social-card.test.mjs brand-assets.test.mjs homepage-responsive.test.mjs
- Expected failures confirmed: missing 20260714 blue social image, stale blue/sparkle icon assets, no Pretext fitter, and no fixed footer reveal.

- 2026-07-14 23:58:39 apply-patch: `packages/consuelo-website/tests/brand-assets.test.mjs`
- 2026-07-14 23:59:43 apply-patch: `packages/consuelo-website/src/components/home/HomeHero.astro`
- 2026-07-15 00:02:46 apply-patch: `packages/consuelo-website/src/components/home/HomeCloudCta.astro`
- 2026-07-15 00:05:58 apply-patch: `packages/consuelo-website/src/components/home/HomeCloudCta.astro`
- 2026-07-15 00:07:06 apply-patch: `packages/consuelo-website/src/pages/index.astro`
- 2026-07-15 00:09:52 apply-patch: `packages/consuelo-website/tests/homepage-responsive.test.mjs`
- 2026-07-15 00:14:06 apply-patch: `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`
- 2026-07-15 00:15:12 apply-patch: `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`

- 2026-07-15 00:41:41 apply-patch: `packages/consuelo-website/scripts/generate-brand-assets.ts`

## workspace-owned: test selection

- changed files: `.task/tasks/website/unify-brand-icons-and-refine-landing-interactions.json`, `.task/website/unify-brand-icons-and-refine-landing-interactions/current.json`, `.task/website/unify-brand-icons-and-refine-landing-interactions/session.json`, `.task/website/unify-brand-icons-and-refine-landing-interactions/workpad.md`, `packages/consuelo-website/package.json`, `packages/consuelo-website/public/apple-touch-icon-800x800.png`, `packages/consuelo-website/public/apple-touch-icon.png`, `packages/consuelo-website/public/consuelo-os-og-20260714.png`, `packages/consuelo-website/public/favicon-192x192.png`, `packages/consuelo-website/public/favicon-32x32.png`, `packages/consuelo-website/public/favicon-512x512.png`, `packages/consuelo-website/public/favicon.ico`, `packages/consuelo-website/public/favicon.svg`, `packages/consuelo-website/public/logo.svg`, `packages/consuelo-website/public/site.webmanifest`, `packages/consuelo-website/scripts/generate-brand-assets.ts`, `packages/consuelo-website/scripts/generate-social-card.ts`, `packages/consuelo-website/src/components/home/HomeCloudCta.astro`, `packages/consuelo-website/src/components/home/HomeHero.astro`, `packages/consuelo-website/src/lib/homepage-seo.ts`, `packages/consuelo-website/src/lib/site-seo.ts`, `packages/consuelo-website/src/pages/index.astro`, `packages/consuelo-website/tests/brand-assets.test.mjs`, `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`, `packages/consuelo-website/tests/homepage-responsive.test.mjs`, `packages/consuelo-website/tests/social-card.test.mjs`, `packages/documentation/astro.config.mjs`, `packages/documentation/public/favicon.svg`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

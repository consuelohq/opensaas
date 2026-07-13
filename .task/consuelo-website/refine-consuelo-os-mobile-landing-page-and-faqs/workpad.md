# refine Consuelo OS mobile landing page and FAQs

branch: `task/consuelo-website/refine-consuelo-os-mobile-landing-page-and-faqs`
stream: `stream/consuelo-website`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1438/refine-consuelo-os-mobile-landing-page-and-faqs
github pr: https://github.com/consuelohq/opensaas/pull/1438
started: 2026-07-13

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`

## workspace-owned: files changed

- `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`

## workspace-owned: activity log

- 2026-07-13 01:23:19 fs.write: `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`

## workspace-owned: validation evidence

- 2026-07-13 01:41:30 `review.run`: passed — OK
- 2026-07-13 01:42:09 `verify`: passed — OK

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
bun run task:push -- --message "type(consuelo-website): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-13 01:23:19 write: `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`

- 2026-07-13 01:28:12 apply-patch: `packages/consuelo-website/src/components/home/HomeHero.astro`
- 2026-07-13 01:28:14 apply-patch: `packages/consuelo-website/src/components/site/SiteHeader.astro`
- 2026-07-13 01:28:16 apply-patch: `packages/consuelo-website/src/data/home-content.ts`
- 2026-07-13 01:28:21 apply-patch: `packages/consuelo-website/src/components/home/HomeCloudCta.astro`
- 2026-07-13 01:28:25 apply-patch: `packages/consuelo-website/src/layouts/MarketingLayout.astro`
- 2026-07-13 01:28:34 apply-patch: `packages/consuelo-website/src/components/home/HomeFaq.astro`
- 2026-07-13 01:28:35 apply-patch: `packages/consuelo-website/src/components/home/HomeFeaturePreview.astro`
- 2026-07-13 01:30:09 apply-patch: `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`
- 2026-07-13 01:31:14 apply-patch: `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`
- 2026-07-13 01:32:21 apply-patch: `packages/consuelo-website/src/components/site/SiteHeader.astro`
- 2026-07-13 01:37:59 apply-patch: `packages/consuelo-website/tests/homepage-responsive.test.mjs`

## workspace-owned: test selection

- changed files: `.task/consuelo-website/refine-consuelo-os-mobile-landing-page-and-faqs/current.json`, `.task/consuelo-website/refine-consuelo-os-mobile-landing-page-and-faqs/session.json`, `.task/consuelo-website/refine-consuelo-os-mobile-landing-page-and-faqs/workpad.md`, `.task/tasks/consuelo-website/refine-consuelo-os-mobile-landing-page-and-faqs.json`, `packages/consuelo-website/src/components/home/HomeCloudCta.astro`, `packages/consuelo-website/src/components/home/HomeFaq.astro`, `packages/consuelo-website/src/components/home/HomeFeaturePreview.astro`, `packages/consuelo-website/src/components/home/HomeHero.astro`, `packages/consuelo-website/src/components/site/SiteHeader.astro`, `packages/consuelo-website/src/data/home-content.ts`, `packages/consuelo-website/src/layouts/MarketingLayout.astro`, `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`, `packages/consuelo-website/tests/homepage-responsive.test.mjs`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

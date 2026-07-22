# refactor website launch naming

branch: `task/sites/refactor-website-launch-naming`
stream: `stream/sites`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1226/refactor-website-launch-naming
github pr: https://github.com/consuelohq/opensaas/pull/1226
started: 2026-06-27

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

- 2026-06-27 21:10:46 `review.run`: passed — OK
- 2026-06-27 21:10:53 `verify`: passed — OK

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
bun run task:push -- --message "type(sites): description" --changed
bun run task:pr
bun run task:finish
```


## Test-first contract

Behavior under test:
- Public website routes keep their existing shell behavior while code ownership names move from launch-oriented names to site/home/marketing names.
- The homepage is structured around editable home sections so future agents can target the hero or other sections directly.
- Surrounding routes that use the public shell, including 404, terms, privacy, changelog, contact, Mercury, and login/device, keep using the SEO-capable layout and site header/footer after the rename.
- Blog routes and blog back navigation remain intact.
- Key app/docs/login/free/legal/social links remain in typed data modules.

Existing local pattern to follow:
- Astro pages import layout/header/footer/section components directly.
- SEO flows through SeoHead and site-seo from the public shell layout.
- Static marketing copy and links live in src/data typed modules.

New or changed tests:
- Add packages/consuelo-website/tests/website-structure.test.js using Bun test and file/module contract assertions.
- The test intentionally checks paths/import boundaries, critical data exports, SEO layout wiring, and blog route preservation.

Focused red command:
- bun --cwd packages/consuelo-website test tests/website-structure.test.ts

Expected red failure:
- The test fails before implementation because MarketingLayout, components/site, components/home, and the split data modules do not exist yet, and public routes still import launch-named files.


## TDD correction

The initial package-scoped command used a missing package script. Correct focused command is:
- bun test packages/consuelo-website/tests/website-structure.test.js

The first red run also showed the blog route already imports the blog layout through the project alias (`@/layouts/Layout.astro`), not a relative path. The blog assertion was corrected before production edits because preserving the existing alias import is the actual behavior contract.


## TDD correction 2

After implementation, the structure test showed the existing page-section contract includes the hero anchor `intro`. The test was corrected to preserve that existing route/header behavior rather than silently dropping the section.


## Validation correction

Astro check includes package TypeScript files, so the focused Bun contract test lives as JavaScript: `packages/consuelo-website/tests/website-structure.test.js`. This keeps the test executable by Bun while avoiding Bun-only test types inside Astro's TypeScript diagnostics.


## implementation summary

- Renamed public shell layout from `LaunchLayout.astro` to `MarketingLayout.astro`.
- Split first-party components into `src/components/site` for global site chrome and `src/components/home` for homepage sections.
- Split `launch-content.ts` into typed data modules: `site-links.ts`, `site-navigation.ts`, `home-content.ts`, and `mercury-content.ts`.
- Renamed docs navigation data from `launch-docs*` to `docs-navigation*`.
- Updated homepage, legal/changelog/contact/Mercury/login/device/GHL routes to the new imports.
- Preserved the current landing implementation and CSS namespace for behavior compatibility; visual redesign remains separate.
- Added `COMPONENTS.md` to document component ownership and prevent future agents from recreating `launch-*` surfaces.

## validation evidence

- `bun test packages/consuelo-website/tests/website-structure.test.js`: passed — 5 tests, 114 assertions.
- `bun run --cwd packages/consuelo-website build`: passed — Astro check completed with 0 errors and static build generated 94 pages.
- Targeted runtime residue scan: passed — no old `components/launch`, `data/launch-*`, `Launch*` route/component symbols, or `bootLaunchHeroMotion` runtime references remain.

## validation notes

Astro check still reports non-blocking hints from existing code, including deprecated `z` hints in `src/content.config.ts`, unused `stay` in `Navbar.tsx`, and inline script hints. These are not introduced by the structural rename and did not block the build.

## workspace-owned: test selection

- changed files: `.task/sites/refactor-website-launch-naming/current.json`, `.task/sites/refactor-website-launch-naming/session.json`, `.task/sites/refactor-website-launch-naming/workpad.md`, `.task/tasks/sites/refactor-website-launch-naming.json`, `packages/consuelo-website/COMPONENTS.md`, `packages/consuelo-website/src/components/BackButton.astro`, `packages/consuelo-website/src/components/home/HomeFaq.astro`, `packages/consuelo-website/src/components/home/HomeHero.astro`, `packages/consuelo-website/src/components/home/HomeMercuryPromo.astro`, `packages/consuelo-website/src/components/home/HomeOverview.astro`, `packages/consuelo-website/src/components/home/HomePrivacy.astro`, `packages/consuelo-website/src/components/home/HomeStats.astro`, `packages/consuelo-website/src/components/launch/LanguageSelector.astro`, `packages/consuelo-website/src/components/launch/LaunchFaq.astro`, `packages/consuelo-website/src/components/launch/LaunchFooter.astro`, `packages/consuelo-website/src/components/launch/LaunchHeader.astro`, `packages/consuelo-website/src/components/launch/LaunchHero.astro`, `packages/consuelo-website/src/components/launch/LaunchMercuryPromo.astro`, `packages/consuelo-website/src/components/launch/LaunchOverview.astro`, `packages/consuelo-website/src/components/launch/LaunchPrivacy.astro`, `packages/consuelo-website/src/components/launch/LaunchStats.astro`, `packages/consuelo-website/src/components/site/LanguageSelector.astro`, `packages/consuelo-website/src/components/site/SiteFooter.astro`, `packages/consuelo-website/src/components/site/SiteHeader.astro`, `packages/consuelo-website/src/data/docs-navigation-source.json`, `packages/consuelo-website/src/data/docs-navigation.ts`, `packages/consuelo-website/src/data/home-content.ts`, `packages/consuelo-website/src/data/launch-content.ts`, `packages/consuelo-website/src/data/launch-docs-source.json`, `packages/consuelo-website/src/data/launch-docs.ts`, `packages/consuelo-website/src/data/mercury-content.ts`, `packages/consuelo-website/src/data/site-links.ts`, `packages/consuelo-website/src/data/site-navigation.ts`, `packages/consuelo-website/src/layouts/LaunchLayout.astro`, `packages/consuelo-website/src/layouts/MarketingLayout.astro`, `packages/consuelo-website/src/lib/analytics.ts`, `packages/consuelo-website/src/lib/motion.ts`, `packages/consuelo-website/src/pages/404.astro`, `packages/consuelo-website/src/pages/changelog.astro`, `packages/consuelo-website/src/pages/contact.astro`, `packages/consuelo-website/src/pages/ghl.astro`, `packages/consuelo-website/src/pages/index.astro`, `packages/consuelo-website/src/pages/login/device.astro`, `packages/consuelo-website/src/pages/mercury.astro`, `packages/consuelo-website/src/pages/privacy.astro`, `packages/consuelo-website/src/pages/terms.astro`, `packages/consuelo-website/src/styles/blog.css`, `packages/consuelo-website/tests/website-structure.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

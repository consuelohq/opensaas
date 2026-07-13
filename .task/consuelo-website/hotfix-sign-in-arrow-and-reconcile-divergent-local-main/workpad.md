
## Implementation and validation

- Replaced the production 20x16 PixelArrow component in HomeHero with the approved local-main 6x9 rect-based inline arrow.
- Scoped CSS sizes the arrow at 8x12 CSS pixels with crisp edge rendering; the sign-in URL and all hero/background behavior are unchanged.
- Updated homepage regression contracts to reject PixelArrow and require the compact inline SVG.
- Focused verification: 23 tests passed with 345 assertions across homepage responsive, mobile layout, and website structure suites.
- Astro check/build completed with 0 errors and generated 22 routes.
- Local browser verification passed on 1440x900 desktop and iPhone 16 Pro: correct 6x9 viewBox, 8 rects, 8x12 rendered arrow, correct OS URL, and zero horizontal overflow.
- Review and publish-valid verify passed with no issues attributable to this change.

## Follow-up

- After the hotfix reaches main, preserve local commit c53c3aa41c on a backup branch and realign the local main worktree to origin/main. This removes the pull divergence without losing the historical local commit.

## workspace-owned: validation evidence

- 2026-07-13 17:57:00 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/consuelo-website/hotfix-sign-in-arrow-and-reconcile-divergent-local-main/current.json`, `.task/consuelo-website/hotfix-sign-in-arrow-and-reconcile-divergent-local-main/evidence-log.json`, `.task/consuelo-website/hotfix-sign-in-arrow-and-reconcile-divergent-local-main/read-log.json`, `.task/consuelo-website/hotfix-sign-in-arrow-and-reconcile-divergent-local-main/session.json`, `.task/consuelo-website/hotfix-sign-in-arrow-and-reconcile-divergent-local-main/verify.json`, `.task/consuelo-website/hotfix-sign-in-arrow-and-reconcile-divergent-local-main/workpad.md`, `.task/tasks/consuelo-website/hotfix-sign-in-arrow-and-reconcile-divergent-local-main.json`, `packages/consuelo-website/src/components/home/HomeHero.astro`, `packages/consuelo-website/tests/homepage-responsive.test.mjs`, `packages/consuelo-website/tests/website-structure.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

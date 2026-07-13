
## Diagnosis

- Local main is clean but diverged: 1 commit ahead and 6 commits behind origin/main.
- The local-only commit is c53c3aa41c (`feat(website): hermes-style bayer-dithered cloud hero`).
- Origin/main already contains the desired dithered hero/background and feature-strip work through later merged commits.
- The meaningful remaining visual delta is the SIGN IN arrow: local main uses a compact 6x9 inline rect-based arrow; origin/main uses the larger 20x16 PixelArrow component shown in production.
- Hotfix scope is therefore limited to HomeHero arrow markup/sizing plus focused regression expectations. No hero atmosphere, feature preview, navigation, pricing, or font changes are included.

## TDD evidence

- Red: `bun test tests/homepage-responsive.test.mjs` failed because origin/main still rendered PixelArrow.
- Green: focused homepage and website-structure tests pass after restoring the compact inline arrow.

- 2026-07-13 17:49:14 apply-patch: `packages/consuelo-website/src/components/home/HomeHero.astro`
- 2026-07-13 17:49:14 apply-patch: `packages/consuelo-website/tests/homepage-responsive.test.mjs`
- 2026-07-13 17:49:14 apply-patch: `packages/consuelo-website/tests/website-structure.test.js`

## workspace-owned: validation evidence

- 2026-07-13 17:51:52 `review.run`: passed — OK
- 2026-07-13 17:52:05 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/consuelo-website/hotfix-sign-in-arrow-and-reconcile-divergent-local-main/current.json`, `.task/consuelo-website/hotfix-sign-in-arrow-and-reconcile-divergent-local-main/session.json`, `.task/consuelo-website/hotfix-sign-in-arrow-and-reconcile-divergent-local-main/workpad.md`, `.task/tasks/consuelo-website/hotfix-sign-in-arrow-and-reconcile-divergent-local-main.json`, `packages/consuelo-website/src/components/home/HomeHero.astro`, `packages/consuelo-website/tests/homepage-responsive.test.mjs`, `packages/consuelo-website/tests/website-structure.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

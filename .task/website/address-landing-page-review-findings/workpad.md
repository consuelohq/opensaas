# address landing page review findings

branch: `task/website/address-landing-page-review-findings`
stream: `stream/website`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1424/address-landing-page-review-findings
github pr: https://github.com/consuelohq/opensaas/pull/1424
started: 2026-07-11

## acceptance criteria

- [x] Reduced-motion users see a poster image instead of hidden feature video content.
- [x] Homepage component colors use existing semantic design tokens rather than raw hex values.
- [x] Feature preview items cannot render an empty image URL.
- [x] Both install controls share one exported install command and only show copied feedback after a successful clipboard write.
- [x] Every mobile menu link closes the menu before navigation.
- [x] Focused regression tests, build, review, and rendered browser checks pass.

## plan

1. Add focused source-contract assertions for the reported regressions and confirm they fail.
2. Apply the smallest component and data changes using existing tokens and local patterns.
3. Run focused tests, build, review, browser validation, and the full publish gate.

## test-first contract

- Behavior under test: poster fallback under reduced motion, required feature assets, clipboard success gating and label restoration, shared install command, semantic colors, and mobile-menu closure on link selection.
- Existing local pattern: extend `tests/website-structure.test.js`, which already guards the homepage source contract.
- New or changed tests: strengthen the hero, feature panel/media, token, and header assertions in that file.
- Focused red command: `bun test packages/consuelo-website/tests/website-structure.test.js`.
- Expected red failure: current stream code lacks the poster fallback, required asset type, shared command constant, guarded clipboard flow, semantic color references, and menu-link close handler.

## current status

- All seven findings were still valid and are fixed with focused regression coverage. Tests, build, review, and rendered browser checks pass.

## files changed

- `packages/consuelo-website/src/components/home/FeatureMedia.astro`
- `packages/consuelo-website/src/components/home/HomeFaq.astro`
- `packages/consuelo-website/src/components/home/HomeFeaturePreview.astro`
- `packages/consuelo-website/src/components/home/HomeHero.astro`
- `packages/consuelo-website/src/components/site/SiteHeader.astro`
- `packages/consuelo-website/src/data/home-content.ts`
- `packages/consuelo-website/tests/website-structure.test.js`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-07-11 20:36:58 `review.run`: passed — OK
- 2026-07-11 20:37:43 `verify`: passed — OK

## validation evidence

- Red regression run: `bun test packages/consuelo-website/tests/website-structure.test.js` — 15 passed and 3 failed on the expected hero, feature/media, and mobile-header assertions before implementation.
- Green regression run: `bun test packages/consuelo-website/tests/website-structure.test.js` — 18 passed, 0 failed, 311 assertions.
- Build: `bun run --cwd packages/consuelo-website build` — Astro check reported 0 errors and the static build completed with 95 pages.
- Whitespace: `git diff --check` passed.
- Review: `review.run --strict --no-tests` — 0 issues in these changes and 0 blocking issues; one pre-existing project-level notice reports that no Nx typecheck target exists.
- Browser: a successful clipboard write copied `curl -fsSL https://install.consuelohq.com/os | bash`, changed both labels to `COPIED`, then restored `DOWNLOAD LOCALLY` and `COPY`.
- Browser: unavailable and rejected clipboard operations left both labels unchanged and produced no unhandled rejection.
- Browser: the rendered homepage contained 0 images with empty `src`; FAQ and feature description colors resolved to `rgb(70, 70, 168)` from `--site-color-muted`; compiled CSS contained the reduced-motion video rule.
- Browser: selecting the mobile `FEATURES` link navigated to `#features`, set `aria-expanded="false"`, and hid the menu.
- Screenshot: `/tmp/opensaas-screenshots/landing-review-mobile-menu-closed-2026-07-11T20-35-54.png`.

## key decisions

- Use existing `--site-color-muted` for both body-copy colors; no new token is necessary.
- Make `HomeFeaturePreviewItem.assetSrc` required because all six current items already provide valid assets.

## notes for ko

- All seven review findings were still valid; none were skipped.

## improvements noticed

- none yet

## issues and recovery

- The original task PR #1420 had already merged and its remote branch was deleted, so these post-merge review fixes moved to clean follow-up PR #1424 based on the current stream.
- One combined test/build command hit the validation tool's default 30-second timeout while the build was running. The same checks were rerun separately with explicit bounds and passed.

---

## publish checklist

```bash
bun run task:push -- --message "type(website): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-11 20:32:41 apply-patch: `.task/website/address-landing-page-review-findings/workpad.md`
- 2026-07-11 20:32:41 apply-patch: `packages/consuelo-website/tests/website-structure.test.js`
- 2026-07-11 20:33:07 apply-patch: `packages/consuelo-website/src/components/home/FeatureMedia.astro`
- 2026-07-11 20:33:07 apply-patch: `packages/consuelo-website/src/components/home/HomeFaq.astro`
- 2026-07-11 20:33:07 apply-patch: `packages/consuelo-website/src/components/home/HomeFeaturePreview.astro`
- 2026-07-11 20:33:07 apply-patch: `packages/consuelo-website/src/components/home/HomeHero.astro`
- 2026-07-11 20:33:08 apply-patch: `packages/consuelo-website/src/components/site/SiteHeader.astro`
- 2026-07-11 20:33:08 apply-patch: `packages/consuelo-website/src/data/home-content.ts`

## workspace-owned: files read

- none yet

- 2026-07-11 20:37:31 apply-patch: `.task/website/address-landing-page-review-findings/workpad.md`

## workspace-owned: test selection

- changed files: `.task/tasks/website/address-landing-page-review-findings.json`, `.task/website/address-landing-page-review-findings/current.json`, `.task/website/address-landing-page-review-findings/evidence-log.json`, `.task/website/address-landing-page-review-findings/read-log.json`, `.task/website/address-landing-page-review-findings/session.json`, `.task/website/address-landing-page-review-findings/workpad.md`, `packages/consuelo-website/src/components/home/FeatureMedia.astro`, `packages/consuelo-website/src/components/home/HomeFaq.astro`, `packages/consuelo-website/src/components/home/HomeFeaturePreview.astro`, `packages/consuelo-website/src/components/home/HomeHero.astro`, `packages/consuelo-website/src/components/site/SiteHeader.astro`, `packages/consuelo-website/src/data/home-content.ts`, `packages/consuelo-website/tests/website-structure.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

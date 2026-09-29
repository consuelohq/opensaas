# Fit homepage footer on narrow landscape phones

branch: `task/website/fit-homepage-footer-on-narrow-landscape-phones`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2618

## acceptance criteria

- [x] Footer headline, description, buttons and signatures fit 568x320 and 667x375 landscape viewports without clipping or overlap.
- [x] Preserve approved portrait, tablet and desktop page design.
- [ ] Run responsive regression, website build, review and full verification; promote the correction for production.

## plan

1. Extend the existing browser regression to short landscape screens and reproduce clipping.
2. Adapt the existing compact-height footer treatment.
3. Validate and ship through the website stream.

## Test-first contract

behavior under test: A short landscape phone can see the full closing invitation and act on its links without covering footer details.
existing local pattern: homepage-mobile-layout.test.mjs exercises the actual Astro page with Playwright.
new or changed tests: Footer bounds and separate copy/signature rectangles at 568x320 and 667x375.
focused red command: node --test tests/homepage-mobile-layout.test.mjs in the website package.
expected red failure: At 568x320 the footer copy exceeds the available viewport or overlaps the signature.
no-test waiver: not applicable; responsive behavior warrants a real-browser regression.

## files changed

- none yet

## key decisions

Use existing compact title/spacing tokens and place short-height actions side by side when space allows.

## notes for ko

This closes the narrow-landscape review finding before the approved Cloudflare release.

## improvements noticed

Include the smallest landscape phone, beyond portrait and modern large-phone emulation.

## errors i ran into

None.

- 2026-09-29 21:11:24 write: `.task/website/fit-homepage-footer-on-narrow-landscape-phones/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-29 21:11:24 fs.write: `.task/website/fit-homepage-footer-on-narrow-landscape-phones/workpad.md`

## validation evidence

Red: browser regression failed with footer clips below 568x320 (trace trc_d8a558bc365f). After extending the compact query, a second red caught signature overlap. Green: smaller existing spacing/text tokens and inline wrapping actions passed the complete browser regression including both short landscape viewports (trace trc_076f7ea9020d). Website build passed (24 routes), and strict review passed with zero changed issues or blockers. Full verification completed before promotion.

## workspace-owned: validation evidence

Red: browser regression failed with footer clips below 568x320 (trace trc_d8a558bc365f). After extending the compact query, a second red caught signature overlap. Green: smaller existing spacing/text tokens and inline wrapping actions passed the complete browser regression including both short landscape viewports (trace trc_076f7ea9020d). Website build passed (24 routes), and strict review passed with zero changed issues or blockers. Full verification completed before promotion.
- 2026-09-29 21:13:25 `review.run`: passed — OK
- 2026-09-29 21:13:25 `verify`: passed — OK
- 2026-09-29 21:13:42 `verify`: passed — OK

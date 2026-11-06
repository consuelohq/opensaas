# Simplify Dialer landing conversion path and redesign floating navigation

branch: `task/website/simplify-dialer-landing-conversion-path-and-redesign-floating-navigation`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2779
started: 2026-11-06

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/dialer-website/src/components/home/HomeFeaturePreview.astro`
- `packages/dialer-website/src/pages/demo.astro`
- `packages/dialer-website/tests/landing-conversion.test.ts`

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

- none yet

## Acceptance criteria (approved)
- Remove public How it works route/copy and unnecessary exploration links while keeping relevant sales capability proof.
- Route Get started to the existing pricing/plan selection without changing checkout or Stripe billing behavior.
- Add Interactive demo as secondary CTA; prepare a non-broken preview destination while the full guided demo is built separately.
- Reuse the Built for scale section directly below the hero with styling appropriate to the landing page.
- Redesign the scroll navigation: compact, blue without white bleed, left-aligned actual logo, centered relevant nav, right-aligned useful CTA, smooth reduced-motion-safe entry; visible on homepage sections and pricing, hidden at appropriate FAQ boundary.
- Improve footer logo treatment and remove unwanted divider; correct CTA arrow spacing; validate desktop/mobile.
- Diagnose Stripe interstitial flash; make no payment-flow code edits.
- Test, review, verify, promote through stream/website, merge main and deploy Cloudflare only if gates and blast radius allow; verify live.

## Plan
1. Locate the actual deployed Dialer marketing source and distinguish it from the OS homepage. Inspect CSS/DOM, links, checkout redirects, deployment config, and recent commits.
2. Define test-first CTA/navigation/route contracts; run focused red tests before production edits.
3. Implement minimal cohesive landing and pricing UI refresh, preserving other product routes and existing billing behavior.
4. Run targeted tests/build, review/verify, publish/promote, merge and deploy, then smoke-test production; record Stripe investigation only.

## Initial constraints
- Browser profile has an active SingletonLock; do not terminate or alter Ko's existing Chrome/Arc sessions. Use alternative read-only evidence.
- A task has started from stream/website (direct follow-up to current website work) but verify branch/source provenance before editing; current website index in the task worktree describes the OS product, not the Dialer shown live.
- No modifications to Stripe, merchant accounts, GHL installation state, or paid purchases.

## Test-first contract (pending source confirmation)
Behavior under test: home and pricing navigation/CTA/scroll-header contracts; How-it-works link removal; no change to payment redirect behavior.
Existing local pattern: website-structure, site-header, homepage responsive, and pricing-interactions tests; confirm which package owns production Dialer first.
New/changed tests: focused DOM/source assertions and build smoke tests for actual owning package.
Focused red command: to determine after source provenance is confirmed.
Expected red failure: currently-present workflow links or wrong CTA destination and stale floating header markup.
No-test waiver: none for behavior-changing navigation; purely cosmetic CSS can use visual smoke as supplemental validation.

- 2026-11-06 04:48:00 append: `.task/website/simplify-dialer-landing-conversion-path-and-redesign-floating-navigation/workpad.md`

## workspace-owned: files changed

- `packages/dialer-website/src/components/home/HomeFeaturePreview.astro`
- `packages/dialer-website/src/pages/demo.astro`
- `packages/dialer-website/tests/landing-conversion.test.ts`

## workspace-owned: activity log

- 2026-11-06 04:48:00 fs.write: `.task/website/simplify-dialer-landing-conversion-path-and-redesign-floating-navigation/workpad.md`
- 2026-11-06 04:49:30 fs.write: `.task/website/simplify-dialer-landing-conversion-path-and-redesign-floating-navigation/workpad.md`
- 2026-11-06 04:49:31 fs.write: `packages/dialer-website/tests/landing-conversion.test.ts`
- 2026-11-06 04:50:44 fs.write: `.task/website/simplify-dialer-landing-conversion-path-and-redesign-floating-navigation/workpad.md`
- 2026-11-06 04:51:33 fs.write: `packages/dialer-website/src/components/home/HomeFeaturePreview.astro`
- 2026-11-06 04:51:54 fs.write: `packages/dialer-website/src/pages/demo.astro`
- 2026-11-06 04:52:21 fs.write: `.task/website/simplify-dialer-landing-conversion-path-and-redesign-floating-navigation/workpad.md`
- 2026-11-06 04:59:33 fs.write: `.task/website/simplify-dialer-landing-conversion-path-and-redesign-floating-navigation/workpad.md`

## Confirmed source and test-first contract
- The public Dialer website lives in `packages/dialer-website` (not the OS `packages/consuelo-website` package). Latest `stream/website` contains the deployed Dialer landing source; confined edits here.
- Baseline causes: header links and hero CTA go through `/get-started` without plan; this page paints “Opening Stripe Checkout…” then `location.replace('/pricing')`; no Stripe implementation change is required.
- Behavioral contract: marketing CTAs navigate `/pricing` or `/demo`; How-it-works route and links are removed in favor of an inbound redirect; feature capabilities remain accessible via on-page anchors; a genuine logo is in compact scroll nav; the scroll nav can activate on both home and pricing and dismiss before the close; footer has no divider/brand hover underline; technology strip follows hero.
- Test layer: new `tests/landing-conversion.test.ts` source/route assertions, then built HTML contracts and existing marketing/pricing integration tests; Playwright desktop/mobile for real geometry and CTA navigation. This is a content/navigation/scroll behavior change, no waiver.
- Focused red command: `bun test packages/dialer-website/tests/landing-conversion.test.ts`.
- Expected red failure: legacy `/get-started` and `/how-it-works` marketing links, missing demo destination/technology placement, current scroll header and footer divider.
- Existing local patterns: Bun tests in `tests/marketing-contract.test.ts`, `tests/pricing-refinement.test.ts`; compiled Astro dist/browser harness.

- 2026-11-06 04:49:30 append: `.task/website/simplify-dialer-landing-conversion-path-and-redesign-floating-navigation/workpad.md`

- 2026-11-06 04:49:31 write: `packages/dialer-website/tests/landing-conversion.test.ts`

## Focused red evidence
- Command: `bun test packages/dialer-website/tests/landing-conversion.test.ts` in isolated task worktree.
- Expected RED reproduced (exit 1): homepage still linked `/get-started` and `/how-it-works`, no home technology strip; failures prove the test detects the intended changes. Implementation can proceed.

- 2026-11-06 04:50:44 append: `.task/website/simplify-dialer-landing-conversion-path-and-redesign-floating-navigation/workpad.md`

- 2026-11-06 04:50:52 apply-patch: `packages/dialer-website/src/data/dialer-content.ts`
- 2026-11-06 04:50:52 apply-patch: `packages/dialer-website/src/data/site-navigation.ts`
- 2026-11-06 04:50:52 apply-patch: `packages/dialer-website/src/data/site-links.ts`
- 2026-11-06 04:50:52 apply-patch: `packages/dialer-website/src/pages/index.astro`
- 2026-11-06 04:50:52 apply-patch: `packages/dialer-website/src/components/site/SiteFooter.astro`
- 2026-11-06 04:50:52 apply-patch: `packages/dialer-website/src/components/home/HomeCloudCta.astro`
- 2026-11-06 04:50:52 apply-patch: `packages/dialer-website/public/_redirects`
- 2026-11-06 04:50:52 apply-patch: `packages/dialer-website/src/pages/how-it-works.astro`
- 2026-11-06 04:50:59 apply-patch: `packages/dialer-website/src/components/home/HomeHero.astro`
- 2026-11-06 04:51:09 apply-patch: `packages/dialer-website/src/components/pricing/PricingTechnology.astro`
- 2026-11-06 04:51:09 apply-patch: `packages/dialer-website/src/styles/pricing.css`
- 2026-11-06 04:51:33 write: `packages/dialer-website/src/components/home/HomeFeaturePreview.astro`

- 2026-11-06 04:51:46 apply-patch: `packages/dialer-website/src/components/site/SiteHeader.astro`
- 2026-11-06 04:51:54 write: `packages/dialer-website/src/pages/demo.astro`

- 2026-11-06 04:52:03 apply-patch: `packages/dialer-website/tests/marketing-contract.test.ts`
- 2026-11-06 04:52:03 apply-patch: `packages/dialer-website/src/pages/support.astro`
- 2026-11-06 04:52:03 apply-patch: `packages/dialer-website/src/components/home/DialerCallFlow.astro`
- 2026-11-06 04:52:03 apply-patch: `packages/dialer-website/src/components/home/HomeHero.astro`
- 2026-11-06 04:52:14 apply-patch: `packages/dialer-website/tests/landing-conversion.test.ts`
## Implementation status
- Replaced the workflow page with a permanent redirect to the on-page capabilities; added a clearly labeled temporary `/demo` route with conversion links (full interactive demo to follow separately).
- Direct-to-pricing CTAs on hero, menu, closing scene; plan-specific `/get-started?plan=` checkout paths and Stripe launcher deliberately untouched.
- Shared Built for scale strip on home below hero, blue treatment; simplified capabilities into four outcomes with one demo/pricing CTA pair; corrected footer hover/divider.
- Full-width sticky header now shows official mark and on-page/nav CTAs on both home and pricing, and hides upon reaching closing scene.
- Focused red/green: new 5-test conversion contract initially failed before implementation, then passed 5/5 after edits.
- First build blocked by missing project-local dependencies in newly created isolated worktree: `astro: command not found`; installing pinned dependencies without lockfile updates before build.

- 2026-11-06 04:52:21 append: `.task/website/simplify-dialer-landing-conversion-path-and-redesign-floating-navigation/workpad.md`

- 2026-11-06 04:52:54 apply-patch: `packages/dialer-website/tests/pricing-refinement.test.ts`
- 2026-11-06 04:53:11 apply-patch: `packages/dialer-website/scripts/test-marketing-browser.mjs`
- 2026-11-06 04:53:33 apply-patch: `packages/dialer-website/scripts/test-marketing-browser.mjs`
- 2026-11-06 04:56:46 apply-patch: `packages/dialer-website/scripts/test-marketing-browser.mjs`
- 2026-11-06 04:58:33 apply-patch: `packages/dialer-website/scripts/test-marketing-browser.mjs`
## Validation evidence (pre-review)
- `bun install --frozen-lockfile --cwd packages/dialer-website`: success; 667 packages in isolated worktree, lockfile not changed.
- `bun run --cwd packages/dialer-website build`: success; Astro diagnostics 0 errors/0 warnings/7 existing hints; `dist/demo/index.html` built; removed old route from build.
- `bun test packages/dialer-website/tests`: 43/43 passing, 305 assertions; updated one markup-order assertion to select actual rendered markup rather than incidental script query.
- `node packages/dialer-website/scripts/test-marketing-browser.mjs --smoke`: pass for 375px mobile, internal link crawl 113, plan-specific hosted checkout fixture 8 cases, no live payment, lifecycle/analytics pass.
- `node packages/dialer-website/scripts/test-marketing-browser.mjs --desktop-smoke`: pass for 1440px desktop, same hosted checkout fixtures and internal links; additionally verifies pricing sticky header starts hidden, fills viewport from x=0/y=0 after scroll, returns hidden on scroll reset, and homepage bar hides before footer.
- Screenshot review: hero displays matched CTA pair; capability grid is clear and borderless; returning nav contains actual brand mark, center links, and aligned start CTA without white top gap.
- Combined full browser and pricing suites exceeded the OS call timeout when run concurrently; focused desktop/mobile browser checks passed independently. No other background test process remains. Consider sequential full suites after review if needed.
- Stripe code untouched: plan-specific checkout links and `StripeCheckoutLauncher` remain identical; market CTAs now bypass the unselected `/get-started` interstitial by pointing to pricing.

## Current files changed
- Dialer marketing components, data/navigation, homepage, demo placeholder, support backlinks, old-page redirect/removal, CSS shared technology treatment, focused tests and browser regression tests.
- Excludes `packages/consuelo-website` and any payment, service or Marketplace adapter changes.

- 2026-11-06 04:59:33 append: `.task/website/simplify-dialer-landing-conversion-path-and-redesign-floating-navigation/workpad.md`

## workspace-owned: validation evidence

- 2026-11-06 04:59:42 `review.run`: passed — OK
- 2026-11-06 05:00:52 `verify`: passed — OK

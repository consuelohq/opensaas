# Trace actual Dialer page serving lowercase

branch: `task/dialer/trace-actual-dialer-page-serving-lowercase`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2553
started: 2026-09-23

## acceptance criteria

- [x] Identify the exact browser URL/source that is producing Ko's lowercase screenshot on the main Mac.
- [x] Stop treating synthetic Tailnet preview endpoints as proof until the user's actual browser tab is traced.
- [x] Determine whether the visible page comes from a different package, process, build directory, host/path, service worker, or browser-local source.
- [x] Fix the actual source of truth and verify the served page remains correctly cased/typed under an equivalent hostile client-side override.
- [x] Preserve the landing-page layout while changing only the real serving/casing path.

## plan

1. Inspect the currently open Arc/Chrome/Safari tabs whose title contains Consuelo Dialer and capture their exact URLs.
2. Correlate those URLs with Tailscale access logs/processes and response fingerprints.
3. Search the repo and local preview directories for the exact lowercase HTML shown in the screenshot.
4. Only after locating the real source, add a focused regression or record a runtime-only waiver, then fix it.
5. Verify from the same URL/browser surface Ko is using and publish any repo change to stream/dialer.

## Test-first contract

behavior under test: the exact browser URL Ko is viewing serves the current Dialer landing copy/casing from the intended package/build.
existing local pattern: the repo contract already proves uppercase source strings in packages/consuelo-dialer-website; therefore the remaining failure is source/serving identity, not copy transformation.
new or changed tests: first identify the real URL and serving artifact. If the wrong package/path is repo-owned, add a regression that fingerprints the expected hero/nav strings at that surface. If the issue is purely local runtime/browser routing, use exact-browser and exact-response verification instead of inventing another source test.
focused red command: inspect open Dialer browser tabs and fetch/search the exact visible URL/artifact before editing.
expected red failure: the browser-visible page resolves to a different/stale serving source than the uppercase consuelo-dialer-website build previously tested.
no-test waiver: only if the defect is entirely local runtime/browser state and no repo-owned code/config participates.

## Findings

- Ko opened the unique standard-HTTPS path in the real Arc profile; Arc persisted the exact URL `https://picassos-mac-mini.tail38ed59.ts.net/dialer-uppercase-461d6141/`.
- The request reached the dedicated preview server and fetched the fresh HTML/CSS, so this is no longer a stale-origin hypothesis.
- The fresh server HTML contains uppercase source strings while Ko's rendered page still lowercases them and also replaces the Bodoni display face with a sans face. Headless Chromium on the same response renders the intended casing/font.
- This narrows the failure to client-side author styling injected after the page CSS (Arc Boost/extension-class behavior is the leading explanation). The repo currently does not defend source-authored casing or display typography against that class of override.
- Focused regression added first. Red proof: `bun test packages/consuelo-dialer-website/tests/dialer-landing.test.mjs -t "keeps source-authored casing and typography"` fails because no casing firewall / important typography lock exists yet.
- The broader landing test also exposes a pre-existing corrupt PNG failure on the current stream branch; that is unrelated to this casing task and is not the red signal for this change.
- Strengthened the casing firewall to an ID-scoped rule (`#dialer-site-root`) so it outranks later class/element author styles, while preserving intentionally uppercase labels with more-specific component rules.
- Runtime adversarial proof on `https://picassos-mac-mini.tail38ed59.ts.net/dialer-casing-lock-2553/`: after page load, injected `html body .launch-shell * { text-transform: lowercase !important; font-family: Arial, sans-serif !important; }`. Hero/nav/wordmark/CTA still rendered source casing; hero/wordmark stayed Bodoni and nav/CTA stayed mono. Zero broken images.
- Replaced the four pre-existing corrupt Dialer dither PNGs with the canonical OS copies because the package's existing integrity test was red and the preview depended on those same assets. This is a mechanical asset repair, not a design change.

## Validation

- Focused regression: 1 pass / 0 fail.
- Full `packages/consuelo-dialer-website/tests/dialer-landing.test.mjs`: 10 pass / 0 fail / 91 assertions.
- `bun run --cwd packages/consuelo-dialer-website build`: succeeds; Astro check reports 0 errors, 0 warnings, 2 pre-existing inline-script hints.
- Adversarial browser runtime check described above passes on the Tailnet preview.

## files changed

- none yet

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
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

- 2026-09-23 01:21:24 apply-patch: `.task/dialer/trace-actual-dialer-page-serving-lowercase/workpad.md`

## workspace-owned: files read

- `packages/consuelo-dialer-website/package.json`
- `packages/consuelo-dialer-website/src/components/home/HomeHero.astro`
- `packages/consuelo-dialer-website/src/components/site/SiteHeader.astro`
- `packages/consuelo-dialer-website/src/data/home-content.ts`
- `packages/consuelo-dialer-website/src/data/site-navigation.ts`
- `packages/consuelo-dialer-website/src/layouts/MarketingLayout.astro`
- `packages/consuelo-dialer-website/src/styles/tokens.css`
- `packages/consuelo-dialer-website/tests/dialer-landing.test.mjs`
- `packages/workspace/senior-engineer.md`

- 2026-09-23 01:36:41 apply-patch: `packages/consuelo-dialer-website/tests/dialer-landing.test.mjs`

- 2026-09-23 01:37:24 apply-patch: `.task/dialer/trace-actual-dialer-page-serving-lowercase/workpad.md`
- 2026-09-23 01:37:41 apply-patch: `packages/consuelo-dialer-website/src/layouts/MarketingLayout.astro`
- 2026-09-23 01:37:41 apply-patch: `packages/consuelo-dialer-website/src/components/home/HomeHero.astro`
- 2026-09-23 01:37:41 apply-patch: `packages/consuelo-dialer-website/src/components/site/SiteHeader.astro`
- 2026-09-23 01:37:41 apply-patch: `packages/consuelo-dialer-website/src/components/home/HomeFeaturePreview.astro`
- 2026-09-23 01:37:41 apply-patch: `packages/consuelo-dialer-website/src/components/home/HomeFaq.astro`
- 2026-09-23 01:38:27 apply-patch: `packages/consuelo-dialer-website/src/layouts/MarketingLayout.astro`
- 2026-09-23 01:38:27 apply-patch: `packages/consuelo-dialer-website/src/components/home/HomeFeaturePreview.astro`
- 2026-09-23 01:38:27 apply-patch: `packages/consuelo-dialer-website/src/components/home/HomeFaq.astro`
- 2026-09-23 01:39:58 apply-patch: `packages/consuelo-dialer-website/tests/dialer-landing.test.mjs`
- 2026-09-23 01:40:08 apply-patch: `packages/consuelo-dialer-website/src/layouts/MarketingLayout.astro`

- 2026-09-23 01:41:10 apply-patch: `.task/dialer/trace-actual-dialer-page-serving-lowercase/workpad.md`

## workspace-owned: validation evidence

- 2026-09-23 01:41:22 `review.run`: passed — OK
- 2026-09-23 01:41:31 `verify`: passed — OK

- 2026-09-23 01:41:43 apply-patch: `.task/dialer/trace-actual-dialer-page-serving-lowercase/workpad.md`
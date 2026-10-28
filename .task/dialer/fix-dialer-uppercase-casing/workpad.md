# Fix Dialer uppercase casing

branch: `task/dialer/fix-dialer-uppercase-casing`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2548
started: 2026-09-23

## acceptance criteria

- [x] Match the canonical Consuelo OS casing treatment on the Dialer landing page rather than leaving the Dialer-specific title-case/lowercase presentation.
- [x] Primary navigation, wordmark/UI labels, hero CTA, section labels, feature headings, FAQ controls, and footer metadata render uppercase.
- [x] Hero and marketing headings use explicit uppercase source text so stale mixed-case copy cannot visually regress the page.
- [x] Preserve readable prose where the canonical OS page uses sentence copy, but remove the current visually lowercase-heavy hierarchy.
- [x] Verify the rendered desktop and mobile page shows the intended uppercase hierarchy with no overflow regressions.
- [x] Merge the fix into stream/dialer.

## plan

1. Compare current Dialer casing against the canonical Consuelo OS header/hero/FAQ surfaces.
2. Extend the existing landing contract with rendered-source casing assertions and run it red.
3. Apply the smallest CSS/content changes needed to make the visual hierarchy explicitly uppercase.
4. Build, refresh the Tailnet preview, inspect computed styles/text at desktop/mobile, then review/verify and publish.

## Test-first contract

behavior under test: the Dialer landing page visibly renders its primary marketing and UI hierarchy in uppercase instead of the current mixed/lowercase-heavy treatment.
existing local pattern: packages/consuelo-dialer-website/tests/dialer-landing.test.mjs guards visible homepage structure and casing; the canonical Consuelo OS header stores navigation and wordmark labels as uppercase source strings rather than relying on CSS text-transform.
new or changed tests: require an uppercase hero headline, uppercase navigation labels, and uppercase CONSUELO / DIALER wordmark source strings while retaining the existing guard against any lowercase transform.
focused red command: bun test packages/consuelo-dialer-website/tests/dialer-landing.test.mjs
expected red failure: current stream only uppercases a subset of content strings; the hero headline, header nav labels, and wordmark are still mixed case.
no-test waiver: not applicable.

## files changed

- `packages/consuelo-dialer-website/src/data/home-content.ts`
- `packages/consuelo-dialer-website/src/data/site-navigation.ts`
- `packages/consuelo-dialer-website/src/components/site/SiteHeader.astro`
- `packages/consuelo-dialer-website/tests/dialer-landing.test.mjs`
- `packages/consuelo-dialer-website/public/images/home/dither/cloud-1.png`
- `packages/consuelo-dialer-website/public/images/home/dither/cloud-2.png`
- `packages/consuelo-dialer-website/public/images/home/dither/cloud-3.png`
- `packages/consuelo-dialer-website/public/images/home/dither/cloud-4.png`

## key decisions

- Canonical Consuelo OS casing is encoded directly in source strings for nav/wordmark labels, so the Dialer now follows that pattern instead of relying on CSS transforms.
- The main hero headline is now fully uppercase to remove any ambiguity about the user-reported lowercase presentation.
- Subtitle/prose stays readable sentence case; UI hierarchy and primary marketing headline are uppercase.
- Restored the four dither PNGs from the canonical Consuelo site because the stream copies were corrupt and the existing landing regression caught them.

## notes for ko

- Tailnet preview refreshed at https://picassos-mac-mini.tail38ed59.ts.net:8767/.
- Desktop rendered proof (1440x900): hero = STOP PAYING SALES REPS TO LISTEN TO PHONES RING.; nav = CONSUELO / DOCS / PRICING / FEATURES; wordmark = CONSUELO DIALER; CTA = GET EARLY ACCESS; FEATURES and all feature titles uppercase.
- Mobile rendered proof (390x844): hero/nav/wordmark uppercase, no horizontal overflow, no broken images.
- Focused contract: 9 tests, 85 assertions, 0 failures.
- Astro check/build: 0 errors, 0 warnings, 2 inherited inline-script hints.
- Strict workspace review: 0 task issues; full verify passed with publishValid=true.

## improvements noticed

- The existing PNG signature regression test correctly caught that the stream still had corrupt dither assets even after the earlier landing-page merge.

## errors i ran into

- First build attempt failed because Astro dependencies were not linked into this fresh task worktree. Ran `bun install --cwd packages/consuelo-dialer-website --frozen-lockfile`; no tracked dependency files changed.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/consuelo-dialer-website/src/components/home/HomeFaq.astro`
- `packages/consuelo-dialer-website/src/components/home/HomeHero.astro`
- `packages/consuelo-dialer-website/src/components/site/SiteHeader.astro`
- `packages/consuelo-dialer-website/src/data/site-navigation.ts`
- `packages/consuelo-dialer-website/src/styles/primitives.css`
- `packages/consuelo-dialer-website/tests/dialer-landing.test.mjs`
- `packages/consuelo-website/src/components/home/HomeFaq.astro`
- `packages/consuelo-website/src/components/home/HomeHero.astro`
- `packages/consuelo-website/src/components/site/SiteHeader.astro`
- `packages/consuelo-website/src/data/home-content.ts`
- `packages/consuelo-website/src/data/site-navigation.ts`

- 2026-09-23 00:51:25 apply-patch: `packages/consuelo-dialer-website/tests/dialer-landing.test.mjs`

- 2026-09-23 00:51:40 apply-patch: `.task/dialer/fix-dialer-uppercase-casing/workpad.md`
- 2026-09-23 00:51:49 apply-patch: `packages/consuelo-dialer-website/src/data/home-content.ts`
- 2026-09-23 00:51:49 apply-patch: `packages/consuelo-dialer-website/src/data/site-navigation.ts`
- 2026-09-23 00:51:49 apply-patch: `packages/consuelo-dialer-website/src/components/site/SiteHeader.astro`

- 2026-09-23 00:52:53 apply-patch: `.task/dialer/fix-dialer-uppercase-casing/workpad.md`

## workspace-owned: validation evidence

- 2026-09-23 00:53:17 `review.run`: passed — OK
- 2026-09-23 00:53:24 `verify`: passed — OK
- 2026-09-23 00:53:30 apply-patch: `.task/dialer/fix-dialer-uppercase-casing/workpad.md`
- 2026-09-23 00:53:36 `verify`: passed — OK

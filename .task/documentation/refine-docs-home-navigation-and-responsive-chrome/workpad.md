# Refine docs home navigation and responsive chrome

branch: `task/documentation/refine-docs-home-navigation-and-responsive-chrome`
stream: `stream/documentation`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1949/refine-docs-home-navigation-and-responsive-chrome
github pr: https://github.com/consuelohq/opensaas/pull/1949
started: 2026-08-14

## acceptance criteria

- [x] Show the Consuelo mark followed by `/ Docs` in the responsive docs header on every page; `Docs` links to the documentation home route.
- [x] Swap responsive navigation controls: the three-dot control opens the regular docs sidebar, while a two-line hamburger opens the full-screen Build/Learn/Getting started menu.
- [x] Make the regular docs sidebar enter from the left; keep the requested half-width tablet and full-width phone geometry, in-sidebar search, Escape close, focus behavior, and GSAP/reduced-motion handling.
- [x] Remove the two top-of-page divider lines: the nav/header divider and the ContentPanel divider below the page-title block.
- [x] Normalize responsive `On this page` placement so it aligns predictably with the Copy page split control without route-dependent gaps.
- [x] Remove visible Starlight chain-link anchor icons from documentation section headings while preserving heading IDs and deep-link targets.
- [x] Rework the documentation home route into a warmer landing-page composition with clear primary/secondary CTAs and quick navigation rather than only a title plus generic cards.
- [x] Replace the overflowing fenced curl example on the home page with a responsive install-command treatment whose text fits small screens and whose copy icon has no boxed chrome.
- [x] Preserve the launcher editorial cream/brown palette, existing typography, automatic translation, current docs information architecture, and desktop behavior.
- [x] Add deterministic source/browser regression coverage for header identity, swapped triggers, left-side drawer geometry, dividers, TOC/action alignment, hidden heading-link icons, landing CTAs, and install-command overflow/chrome.
- [x] Pass documentation unit/static tests, validation, production build/browser suites, strict review, and full verify before promotion to `stream/documentation`.

## plan

1. Encode the requested responsive shell/home-page changes in the existing foundation and Playwright contracts and capture the expected red failures before production edits.
2. Split the responsive controls by responsibility: a new dots-driven docs-menu trigger owns the Starlight sidebar; the existing Browse/Build overlay moves behind the far-right two-line hamburger.
3. Refine shared chrome styles for `/ Docs`, left-side drawer motion, divider removal, action/TOC alignment, and hidden heading anchor glyphs.
4. Build a dedicated home hero/install-command treatment and simplify the home MDX into a landing-page journey with CTAs plus focused navigation cards.
5. Run focused static/browser checks at desktop, 900px tablet, and 390px phone; then run the complete package/build/review/verify gates and publish through the documentation stream.

## Test-first contract

- Behavior under test: `/ Docs` home link is present across pages; dots open the docs sidebar from the left; a two-line hamburger opens Build/Learn/Getting started; header/content dividers are absent; Copy and `On this page` align; heading chain icons are not rendered visually; home CTAs are present; the install command does not overflow and its copy button is unboxed.
- Existing patterns: `tests/foundation.test.ts` owns source/config/style contracts and `scripts/test-foundation-browser.mjs` owns rendered geometry, responsive interaction, overflow, links, and computed styles.
- Planned test changes: extend those existing contracts instead of adding a second harness. Browser assertions will measure sidebar x/width, Copy/TOC y/height/gap, header/content borders, heading-anchor display, home command scroll width, and copy-button border/background.
- Focused red command: `bun run --cwd packages/documentation test:foundation`; then run the foundation browser script once the static source assertions are red.
- Expected red failures before implementation: SiteTitle is not a `/ Docs` home link; dots still open Browse; hamburger still opens the sidebar and has three lines; sidebar is right-anchored and animates from positive x; ContentPanel/header dividers remain; anchor-link icons remain visible; home has no landing CTAs/custom install command; responsive command/copy chrome is still Expressive Code default.
- No-test waiver: none. This is interactive responsive UI work.

## current status

- Implementation is complete and validated. `/ Docs` is now the shared header identity/home link; dots own the left-side docs drawer; the far-right two-line hamburger owns Build/Learn/Getting started; both top divider lines are removed; responsive Copy/TOC controls share a measured baseline; section heading chain glyphs are hidden; and the docs home now opens with a CTA-driven landing hero plus a responsive one-command install treatment.
- The left drawer remains 50vw at the 900px tablet contract and 100vw at the 390px phone contract, with zero horizontal overflow. Existing sidebar search, Escape close, focus treatment, GSAP motion, automatic language translation, warm launcher palette, and desktop documentation navigation remain intact.
- The install control now wraps safely on narrow screens, has an unboxed copy icon, and its clipboard behavior is covered in the browser regression.

## files changed

- `packages/documentation/src/components/DocsMenuTrigger.astro`
- `packages/documentation/src/components/MobileMenuToggle.astro`
- `packages/documentation/src/components/BrowseMenu.astro`
- `packages/documentation/src/components/Header.astro`
- `packages/documentation/src/components/PageTitle.astro`
- `packages/documentation/src/components/SiteTitle.astro`
- `packages/documentation/src/content/docs/index.mdx`
- `packages/documentation/src/styles/docs.css`
- `packages/documentation/scripts/test-foundation-browser.mjs`
- `packages/documentation/tests/foundation.test.ts`

## workspace-owned: files changed

- `packages/documentation/src/components/DocsMenuTrigger.astro`
- `packages/documentation/src/components/MobileMenuToggle.astro`

## workspace-owned: activity log

- 2026-08-14 08:42:55 fs.write: `packages/documentation/src/components/DocsMenuTrigger.astro`
- 2026-08-14 08:43:17 fs.write: `packages/documentation/src/components/MobileMenuToggle.astro`

## workspace-owned: validation evidence

- Test-first red: the updated foundation contract failed before production edits because `/ Docs`, the swapped controls, left drawer, divider overrides, hidden anchor glyphs, and landing-page install treatment were absent. Trace: `trc_49e4e10b260e`.
- Final documentation static suite: 95/95 tests, 2,898 expectations. Validation also passes for all 105 selected pages and automatic translation. Trace: `trc_7ae50caea75a`.
- Clean isolated production build passed and indexed 117 HTML files. The final Foundation browser gate passes at desktop, 900px tablet, and 390px phone with zero overflow, correct `/ Docs` identity, swapped controls, left drawer geometry, divider removal, aligned TOC actions, hidden heading glyphs, landing CTAs, install-command fit, unboxed copy chrome, working clipboard copy, and automatic Spanish translation. Trace: `trc_16ddec7684be`.
- Latest Connect, Sites, Build, Observe, Secure, and Reference browser suites all pass against the final shared chrome, with zero tablet/mobile overflow. Trace: `trc_15a754a9abdd`.
- 2026-08-14 08:52:58 `review.run`: passed — OK
- 2026-08-14 08:56:13 `verify`: passed — OK
- 2026-08-14 08:57:52 `verify`: passed — OK

## key decisions

- Keep `/ Docs` as one shared home link rather than a breadcrumb fragment so it behaves consistently across every docs route and viewport.
- Move the existing full-screen Build/Learn overlay into Starlight's far-right mobile-menu slot and give sidebar ownership to a new dots trigger, avoiding duplicated overlay logic.
- Hide Starlight's visible `.sl-anchor-link` glyphs but leave heading IDs untouched, so deep URLs still resolve without showing the orange chain icon.
- Use the existing launcher editorial tokens and typography; the home-page improvement comes from hierarchy, spacing, CTAs, and a purpose-built install treatment rather than a new visual system.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- Direct Astro dev/build/browser execution in the task worktree still hits the known documentation `node_modules` symlink compile-metadata failure (`No cached compile metadata found ... /Users/kokayi/Dev/opensaas/...`). Traces: `trc_d0fcaa845c9f`, `trc_baf0f0fb69e7`. As in the prior documentation tasks, an isolated package copy with its own frozen Bun install is the production build/browser source of truth; that path is fully green.
- The first clipboard regression showed the install copy action was not replacing the earlier page-copy contents. The home command now carries an explicit data command used by the delegated copy handler; the rerun passes on tablet and phone. Initial failure: `trc_0fa2b9748511`; recovery: `trc_16ddec7684be`.

---

## publish checklist

```bash
bun run task:push -- --message "type(documentation): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/documentation/README.md`
- `packages/documentation/astro.config.mjs`
- `packages/documentation/package.json`
- `packages/documentation/scripts/test-foundation-browser.mjs`
- `packages/documentation/src/components/BrowseMenu.astro`
- `packages/documentation/src/components/Head.astro`
- `packages/documentation/src/components/Header.astro`
- `packages/documentation/src/components/MobileMenuToggle.astro`
- `packages/documentation/src/components/MobileTableOfContents.astro`
- `packages/documentation/src/components/PageTitle.astro`
- `packages/documentation/src/components/Sidebar.astro`
- `packages/documentation/src/components/SiteTitle.astro`
- `packages/documentation/src/components/mintlify/Card.astro`
- `packages/documentation/src/components/mintlify/CardGroup.astro`
- `packages/documentation/src/content/docs/index.mdx`
- `packages/documentation/src/styles/docs.css`
- `packages/documentation/tests/foundation.test.ts`

- 2026-08-14 08:56:03 apply-patch: `.task/documentation/refine-docs-home-navigation-and-responsive-chrome/workpad.md`

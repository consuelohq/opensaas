# refine mobile docs shell vercel style navigation and editorial theme

branch: `task/documentation/refine-mobile-docs-shell-vercel-style-navigation-and-editorial-theme`
stream: `stream/documentation`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1947/refine-mobile-docs-shell-vercel-style-navigation-and-editorial-theme
github pr: https://github.com/consuelohq/opensaas/pull/1947
started: 2026-08-14

## acceptance criteria

- [x] Keep the existing documentation information architecture and the previous #1943 navigation/translation work intact while refining only docs shell/chrome behavior.
- [x] Make the `Copy page` split control visually one control: equal heights, aligned borders/radii, a single internal divider, and no offset arrow segment on desktop/tablet/mobile.
- [x] On phone-sized screens, show only the Consuelo mark in the docs header; hide the `Consuelo OS` wordmark without changing the font family anywhere.
- [x] Replace the current mobile/tablet `On this page` row with a compact outlined trigger in the page chrome; opening it reveals an animated Vercel-style TOC drawer/sheet instead of reserving an extra horizontal row.
- [x] Replace the cold gray/blue documentation palette with the warm editorial paper/ink palette already used by the Consuelo OS launcher, for both light and dark themes, while preserving accessible contrast and existing typography.
- [x] Make the right-side mobile/tablet hamburger an unboxed icon. It opens the regular documentation navigation; on iPad/tablet it occupies about half the viewport and on phone it occupies the full viewport.
- [x] Put a bordered Search Docs control inside the regular mobile/tablet sidebar instead of relying on the desktop header search placement.
- [x] Add a Vercel-style three-dots Browse trigger on tablet/phone. It opens a full-screen animated overlay that rises from the bottom, with Build, Learn, and Getting started sections.
- [x] In Browse, Build exposes the existing documentation sections in list form. Learn expands/collapses and contains external Changelog, Blog, and Community links plus an internal Templates link to the skill-template catalog.
- [x] Use the canonical Consuelo website links for Changelog, Blog, and Discord Community; show external-link arrows for those three only. Link Templates to `/build/skills/bundled/`.
- [x] In Browse, Getting started, Sign up, and Log in all link to `https://os.consuelohq.com/`. Do not add an Ask AI action.
- [x] Use GSAP for the new tablet/mobile overlay and drawer transitions, with reduced-motion fallbacks and deterministic browser coverage.
- [x] Preserve keyboard accessibility, focus indicators, escape-to-close behavior, scroll locking, and no horizontal overflow on tablet or phone.
- [x] Pass focused static/browser tests, documentation validation, production build, strict review, and full verify before promotion to `stream/documentation`.

## plan

1. Read current Starlight override points for Header, mobile menu toggle, search, and mobile TOC, plus exact launcher tokens and canonical website links.
2. Extend the existing foundation and browser regression contracts before production code; capture the expected red failures for the missing shell behavior and GSAP dependency.
3. Implement the smallest set of Starlight overrides/components and CSS changes: warm palette, aligned page actions, compact header, browse overlay, responsive regular menu, in-sidebar search, and TOC sheet.
4. Run focused static tests and browser tests at desktop, 900px tablet, and 390px phone; validate both dark/light theme rendering and reduced-motion-safe state transitions.
5. Run package validation/build, strict review, full verify, publish the task, merge it into `stream/documentation`, and refresh the stream PR.

## Test-first contract

- Behavior under test: split Copy page geometry is aligned; mobile brand text is hidden; the default mobile TOC row is gone; `On this page` opens a sheet; tablet/phone sidebar contains search; the three-dots Browse overlay contains Build/Learn/Getting started with correct internal/external URLs; the hamburger uses transparent icon-only chrome and opens half-width on tablet/full-width on phone; warm launcher colors are active; GSAP drives open/close animation with reduced-motion support.
- Existing patterns: `tests/foundation.test.ts` owns source/config/dependency contracts and `scripts/test-foundation-browser.mjs` owns rendered shell geometry, responsive navigation, focus, and overflow checks.
- Planned test changes: update those two existing tests rather than adding a parallel harness. Browser assertions will check component visibility, target URLs, overlay/sidebar geometry, split-button bounding boxes, body scroll lock, Escape close, and representative computed palette values.
- Focused red command: `bun run --cwd packages/documentation test:foundation`; then `bun run --cwd packages/documentation test:browser` once source contracts are red.
- Expected red failures before implementation: no GSAP dependency; no Header/MobileTableOfContents override; SiteTitle has no phone-only label hiding; default Starlight mobile TOC occupies its own row; no Browse overlay/three-dots trigger; Search remains header-owned; hamburger keeps default boxed/circular chrome; docs use cold Starlight palette; copy split control segments can resolve to mismatched geometry.
- No-test waiver: none. These are interactive responsive UI changes.

## discovery

- PR #1943 is already merged into `main`, so this task starts from a mainline that includes the prior mobile accordion, theme rail, automatic translation, Sites promotion, focus cleanup, and Connect IA work.
- The remote `stream/documentation` branch has not been rebased/fast-forwarded after that merge and is currently diverged from main. This task will be promoted through the normal task lifecycle rather than rewriting stream history.
- Current custom docs chrome overrides PageTitle, Sidebar, SiteTitle, ThemeSelect, MobileMenuFooter, Footer, Head, and LanguageSelect. Header and mobile TOC still use Starlight defaults and are the likely source of the white circular hamburger and extra `On this page` row.
- `PageTitle.astro` implements Copy page as two independently bordered controls (`button` + `details > summary`), which allows default details/summary box metrics to make the arrow segment look offset.
- Current mobile Sidebar uses the earlier accordion navigation but does not own Search. The mobile footer already keeps GitHub and the display rail inline.
- Existing tests intentionally forbid GSAP and must be updated before adding the requested animation dependency.

## current status

- Implementation is complete and validated. The responsive docs shell now uses the launcher paper/ink palette, aligned split page actions, a phone logo-only brand, Vercel-style Browse and TOC overlays, an icon-only hamburger, and a responsive regular-menu drawer with in-sidebar search.
- The regular menu drawer is 50vw on the 900px tablet test and 100vw on the 390px phone test. Both use GSAP transitions with reduced-motion fallbacks.
- Existing automatic browser-language translation, mobile accordion navigation, Sites promotion, Connect IA, and desktop documentation behavior remain covered and passing.

## files changed

- `packages/documentation/astro.config.mjs`
- `packages/documentation/bun.lock`
- `packages/documentation/package.json`
- `packages/documentation/scripts/test-foundation-browser.mjs`
- `packages/documentation/src/components/PageTitle.astro`
- `packages/documentation/src/components/Sidebar.astro`
- `packages/documentation/src/components/SiteFooter.astro`
- `packages/documentation/src/components/SiteTitle.astro`
- `packages/documentation/src/content/docs/tools/tool-list.mdx`
- `packages/documentation/src/styles/docs.css`
- `packages/documentation/tests/foundation.test.ts`
- `packages/documentation/tests/navigation-memory.test.ts`
- `packages/documentation/src/components/BrowseMenu.astro`
- `packages/documentation/src/components/Header.astro`
- `packages/documentation/src/components/MobileMenuToggle.astro`
- `packages/documentation/src/components/MobileTableOfContents.astro`
- `packages/documentation/src/components/MobileTocList.astro`


## workspace-owned: files changed

- `.task/documentation/refine-mobile-docs-shell-vercel-style-navigation-and-editorial-theme/workpad.md`
- `packages/documentation/src/components/BrowseMenu.astro`
- `packages/documentation/src/components/Header.astro`
- `packages/documentation/src/components/MobileMenuToggle.astro`
- `packages/documentation/src/components/MobileTableOfContents.astro`
- `packages/documentation/src/components/MobileTocList.astro`
- `packages/documentation/src/styles/docs.css`

## workspace-owned: activity log

- 2026-08-14 07:48:04 fs.write: `.task/documentation/refine-mobile-docs-shell-vercel-style-navigation-and-editorial-theme/workpad.md`
- 2026-08-14 07:50:59 fs.write: `packages/documentation/src/components/Header.astro`
- 2026-08-14 07:52:37 fs.write: `packages/documentation/src/components/BrowseMenu.astro`
- 2026-08-14 07:52:57 fs.write: `packages/documentation/src/components/MobileMenuToggle.astro`
- 2026-08-14 07:53:20 fs.write: `packages/documentation/src/components/MobileTocList.astro`
- 2026-08-14 07:53:38 fs.write: `packages/documentation/src/components/MobileTableOfContents.astro`
- 2026-08-14 07:55:31 fs.write: `packages/documentation/src/styles/docs.css`
- 2026-08-14: read current docs package guidance, PageTitle, Sidebar, mobile footer, foundation tests, browser tests, and stream status.
- 2026-08-14: started isolated documentation task from current main and verified #1943 is merged.

## workspace-owned: validation evidence

- Test-first red: the focused foundation contract failed before implementation because the Header/MobileMenu/TOC overrides, GSAP dependency, Browse shell, sidebar search, mobile brand behavior, and launcher palette did not exist. Trace: `trc_4ca29032e34c`.
- Static documentation suite + validation + translation: 94/94 tests, 2,869 expectations, 105 selected pages, translation contract green. Trace: `trc_a4b8e674b7a1`.
- Clean-copy production/browser gate: Astro/Cloudflare build passed with 117 indexed HTML files; Foundation, Connect, Sites, Build, Observe, Secure, and Reference browser suites all passed. Tablet/mobile horizontal overflow is zero and automatic Spanish translation remains green. Trace: `trc_404a58e31aa1`.
- Focused responsive shell checks pass for Copy split alignment, launcher colors, full-screen Browse, full-width TOC sheet, 50vw/100vw regular drawer, in-sidebar Search, correct external/internal Browse URLs, Escape close, and footer controls. Trace: `trc_f82b095da919`.
- 2026-08-14 08:08:54 `review.run`: passed — OK
- 2026-08-14 08:09:03 `verify`: passed — OK
- 2026-08-14 08:10:21 `verify`: passed — OK
- 2026-08-14 08:12:46 `verify`: passed — OK

## key decisions

- Reuse Consuelo's launcher palette tokens rather than inventing a new color system.
- Reuse the current docs registry for Build/list content; do not duplicate navigation labels/URLs by hand when the registry can supply them.
- Keep translation automatic and untouched; this task is shell/UI only.
- Use custom Starlight override components rather than brittle global DOM surgery where an override point exists.
- Keep desktop chrome at the 72rem breakpoint and treat phone + iPad/tablet as the responsive shell requested here.
- Refresh the stale Tool List in this task because the current 159-tool manifest made the canonical static/browser gate fail before it could validate the requested shell changes.

## notes for ko

- The previous docs change is already on main. This follow-up is isolated in PR #1947 and will be promoted back through the same documentation stream.

## improvements noticed

- none yet.

## issues and recovery

- `stream.context` still reports the old stream as far behind because the stream branch itself was not moved after its PR merged. GitHub confirms #1943 is merged; current main is the correct implementation baseline for this follow-up.
- Direct browser startup in the task worktree reproduces the known Astro/Vite compile-metadata problem caused by the documentation `node_modules` symlink resolving into the main checkout. Trace: `trc_eda45c002057`. An isolated clean package copy with its own Bun install is therefore the browser/build source of truth.
- The first clean browser pass exposed an unrelated baseline failure: Tool List still documented 154 tools while the current generated OS manifest contains 159. The page was regenerated from the canonical manifest; the full unmodified browser gate now passes.
- Responsive drawer debugging found the initial CSS `translateX(100%)` was compounding with GSAP's percentage transform. Removing the CSS transform leaves GSAP as the sole transform owner and produces exact tablet/phone drawer geometry. Trace: `trc_0fe1d3740c10`.

---

## publish checklist

```bash
bun run task:push -- --message "feat(documentation): refine mobile docs shell" --changed
bun run task:pr
bun run task:finish
```

- 2026-08-14 07:48:04 write: `.task/documentation/refine-mobile-docs-shell-vercel-style-navigation-and-editorial-theme/workpad.md`

## workspace-owned: files read

- `packages/consuelo-website/src/data/site-links.ts`
- `packages/consuelo-website/src/data/site-navigation.ts`
- `packages/consuelo-website/src/pages/os/launcher.astro`
- `packages/consuelo-website/src/styles/tokens.css`
- `packages/documentation/node_modules/@astrojs/starlight/components/Header.astro`
- `packages/documentation/node_modules/@astrojs/starlight/components/MobileMenuToggle.astro`
- `packages/documentation/node_modules/@astrojs/starlight/components/MobileTableOfContents.astro`
- `packages/documentation/node_modules/@astrojs/starlight/components/Search.astro`
- `packages/documentation/node_modules/@astrojs/starlight/components/Sidebar.astro`
- `packages/documentation/scripts/test-foundation-browser.mjs`
- `packages/documentation/src/components/PageTitle.astro`
- `packages/documentation/src/components/Sidebar.astro`
- `packages/documentation/src/components/SiteTitle.astro`
- `packages/documentation/src/content/docs/tools/tool-list.mdx`
- `packages/documentation/src/lib/docs-navigation.ts`
- `packages/documentation/src/styles/docs.css`
- `packages/documentation/tests/foundation.test.ts`
- `packages/documentation/tests/navigation-memory.test.ts`
- `packages/os/scripts/lib/launcher-onboarding.ts`

- 2026-08-14 08:10:05 apply-patch: `.task/documentation/refine-mobile-docs-shell-vercel-style-navigation-and-editorial-theme/workpad.md`

- 2026-08-14 08:10:15 apply-patch: `.task/documentation/refine-mobile-docs-shell-vercel-style-navigation-and-editorial-theme/workpad.md`

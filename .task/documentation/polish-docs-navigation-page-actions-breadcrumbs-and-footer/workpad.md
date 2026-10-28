# Polish docs navigation, page actions, breadcrumbs, and footer

branch: `task/documentation/polish-docs-navigation-page-actions-breadcrumbs-and-footer`
stream: `stream/documentation`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1504/polish-docs-navigation-page-actions-breadcrumbs-and-footer
github pr: https://github.com/consuelohq/opensaas/pull/1504
started: 2026-07-15

## acceptance criteria

- [x] Change only `packages/documentation/**` plus task metadata.
- [x] The docs-root sidebar renders seven direct section links; clicking Start, Connect, Build with OS, Sites, Observe, Secure, or Reference navigates to that section overview rather than toggling a dropdown.
- [x] Every section route opens the focused, fully expanded section sidebar with an All documentation link.
- [x] Remove pointer-triggered blue focus rings while preserving a clear keyboard-only focus state.
- [x] Make documentation cards use one thicker accent border on hover/focus-visible without a doubled white/blue outline.
- [x] Rebuild the page-action split button to match the Vercel pattern: icons, title plus explanatory subtext, and Copy page/View as Markdown/Open in ChatGPT/Open in Claude only.
- [x] Add generated breadcrumbs from the navigation registry.
- [x] Add a generated documentation footer registry from the navigation model, with seven generated sections, white category labels, muted links, four columns on wide screens, and two columns on mobile.
- [x] Preserve the existing canonical Markdown endpoints and AI clipboard handoff behavior.
- [x] Verify the footer adds enough end-of-page scroll runway for the right-side table of contents to select the final heading.

## plan

1. Extend the navigation helpers so global section links, breadcrumbs, and footer columns derive from one registry.
2. Add browser and unit contracts first, confirm the focused red failures, then implement the smallest matching UI changes.
3. Replace the global Sidebar rendering, refine local active/focus styling, rebuild PageTitle actions, and add a Footer override.
4. Run focused tests, production build, browser checks at desktop/tablet/mobile, review, and full verify.
5. Push and merge the task into `stream/documentation`.

## Test-first contract

- Behavior under test: direct top-level navigation, expanded section navigation, registry-derived breadcrumbs/footer, accessible split-button menu, card hover/focus styling, and final-heading TOC activation at the bottom of a page.
- Existing pattern: `tests/foundation.test.ts` for pure navigation/source contracts and `scripts/test-foundation-browser.mjs` for rendered browser behavior.
- New or changed tests: extend both existing files; avoid introducing another browser harness.
- Focused red command: `bun run --cwd packages/documentation test:foundation && bun run --cwd packages/documentation test:browser`.
- Expected red failure: current root sidebar is seven `<details>` toggles, no breadcrumb/footer override exists, page-action menu has no item descriptions/icons, card hover remains a one-pixel border, and the final TOC item lacks footer runway.

## current status

- Implementation and focused validation are complete.
- The documentation stream was seven commits behind `main`; `stream.sync` merged and pushed current `main` into `stream/documentation` without conflicts before final boundary validation.
- Strict review and full publish verification passed with zero findings from this change.
- Ready to push, merge into `stream/documentation`, and clean up the task worktree.

## files changed

- `packages/documentation/src/components/Footer.astro`
- `packages/documentation/src/components/PageTitle.astro`
- `packages/documentation/src/components/Sidebar.astro`

## workspace-owned: files changed

- `packages/documentation/src/components/Footer.astro`
- `packages/documentation/src/components/PageTitle.astro`
- `packages/documentation/src/components/Sidebar.astro`

## workspace-owned: activity log

- 2026-07-15 01:47:28 fs.write: `.task/documentation/polish-docs-navigation-page-actions-breadcrumbs-and-footer/workpad.md`
- 2026-07-15 01:49:39 fs.write: `packages/documentation/src/components/Sidebar.astro`
- 2026-07-15 01:50:14 fs.write: `packages/documentation/src/components/PageTitle.astro`
- 2026-07-15 01:50:38 fs.write: `packages/documentation/src/components/Footer.astro`

## workspace-owned: validation evidence

- 2026-07-15 02:00:43 `review.run`: passed — OK
- 2026-07-15 02:00:55 `verify`: passed — OK
- 2026-07-15 02:01:38 `verify`: passed — OK

## key decisions

- The global docs sidebar will not expose collapsible children. It will render seven direct links with chevrons; the destination section owns the expanded local tree.
- Breadcrumbs and footer columns will be computed from `docs-navigation.ts`, not duplicated in page content.
- The footer will override Starlight’s Footer while preserving native pagination.
- Pointer focus will be neutralized with `:focus:not(:focus-visible)`; keyboard focus remains explicit.
- The page action menu will use local inline SVG icons rather than adding a component library.

## notes for ko

- Scope is only the Astro/Starlight documentation package. No landing-page package changes.
- Root navigation now behaves as seven direct destinations. The focused section tree appears only after navigation into a section.
- The generated footer intentionally omits duplicate `Overview` links because each white category heading already links to its section overview.

## improvements noticed

- Starlight’s default active sidebar item uses a filled accent background. The requested visual direction is better served by a quieter tinted background plus a thicker accent edge.

## issues and recovery

- `fs.read` could not follow the symlinked Starlight package. Used a task-scoped Bun read probe instead.
- A direct runtime import of Starlight’s internal icon module failed from the temporary code-call directory. Read the module source and extracted supported icon names instead; production code does not depend on private icon internals for the action menu.
- The task inherited an absolute `node_modules` symlink, causing Astro compile-metadata path failures. Removed only the worktree symlink and ran the standalone documentation package's `bun install`; no package or lockfile changes resulted.
- The first boundary check correctly found that `stream/documentation` was stale relative to `main`. Synced the stream, then reran the boundary check against `origin/stream/documentation` successfully.
- Instant programmatic scrolling can skip Starlight IntersectionObserver transitions. The browser contract now simulates natural incremental scrolling before asserting that the final ToC heading remains active at the page bottom.


## implementation and validation

- TDD red: the focused foundation test failed because registry-derived global links, breadcrumbs, and footer exports did not exist.
- TDD green: 12 foundation tests passed with 292 assertions.
- Root navigation renders seven direct links and zero root dropdown groups; clicking Start navigates to `/start/`, where the local section tree is fully expanded.
- The page action split button uses local SVG icons and explanatory subtext while preserving canonical Markdown copy and web handoffs.
- Breadcrumbs and the seven-column registry are derived from `docs-navigation.ts`; the registry renders as four columns on desktop and two on mobile.
- Card hover uses one 2px accent border with no shadow; pointer focus rings are removed while keyboard focus remains visible.
- Browser regression passed with zero tablet/mobile horizontal overflow, canonical Markdown copy, correct breadcrumbs, generated registry, and final ToC activation after natural scrolling.
- Documentation validation passed for 109 curated pages.
- Translation test passed.
- Production build passed; Pagefind indexed 111 HTML files.
- Package-boundary validation passed against `origin/stream/documentation` and confirmed only `packages/documentation/**` plus task metadata changed.

---

## publish checklist

```bash
bun run task:push -- --message "fix(documentation): polish docs navigation and chrome" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/documentation/README.md`
- `packages/documentation/astro.config.mjs`
- `packages/documentation/scripts/check-package-boundary.mjs`
- `packages/documentation/scripts/test-foundation-browser.mjs`
- `packages/documentation/src/components/PageTitle.astro`
- `packages/documentation/src/components/Sidebar.astro`
- `packages/documentation/src/components/mintlify/Card.astro`
- `packages/documentation/src/content/docs/build/tools/how-tools-work.mdx`
- `packages/documentation/src/lib/docs-navigation.ts`
- `packages/documentation/src/styles/docs.css`
- `packages/documentation/tests/foundation.test.ts`
- `packages/workspace/senior-engineer.md`

## workspace-owned: test selection

- changed files: `.task/documentation/polish-docs-navigation-page-actions-breadcrumbs-and-footer/current.json`, `.task/documentation/polish-docs-navigation-page-actions-breadcrumbs-and-footer/evidence-log.json`, `.task/documentation/polish-docs-navigation-page-actions-breadcrumbs-and-footer/read-log.json`, `.task/documentation/polish-docs-navigation-page-actions-breadcrumbs-and-footer/session.json`, `.task/documentation/polish-docs-navigation-page-actions-breadcrumbs-and-footer/verify.json`, `.task/documentation/polish-docs-navigation-page-actions-breadcrumbs-and-footer/workpad.md`, `.task/tasks/documentation/polish-docs-navigation-page-actions-breadcrumbs-and-footer.json`, `packages/documentation/astro.config.mjs`, `packages/documentation/scripts/test-foundation-browser.mjs`, `packages/documentation/src/components/Footer.astro`, `packages/documentation/src/components/PageTitle.astro`, `packages/documentation/src/components/Sidebar.astro`, `packages/documentation/src/components/mintlify/Card.astro`, `packages/documentation/src/lib/docs-navigation.ts`, `packages/documentation/src/styles/docs.css`, `packages/documentation/tests/foundation.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

# Refine desktop docs homepage toward Vercel

branch: `task/docs/refine-desktop-docs-homepage-toward-vercel`
stream: `stream/docs`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1986/refine-desktop-docs-homepage-toward-vercel
github pr: https://github.com/consuelohq/opensaas/pull/1986
started: 2026-08-15

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/documentation/scripts/test-foundation-browser.mjs`
- `packages/documentation/src/components/PageTitle.astro`
- `packages/documentation/src/components/Sidebar.astro`
- `packages/documentation/src/styles/docs.css`
- `packages/documentation/tests/foundation.test.ts`


## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-15 02:18:20 fs.write: `.task/docs/refine-desktop-docs-homepage-toward-vercel/workpad.md`
- 2026-08-15 02:31:01 fs.write: `.task/docs/refine-desktop-docs-homepage-toward-vercel/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 02:35:24 `review.run`: passed — OK
- 2026-08-15 02:35:24 `review.run`: passed — OK
- 2026-08-15 02:35:33 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(docs): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: Desktop docs at >=72rem use a calmer Vercel-like geometry: 18rem left rail with compact 14px navigation, no vertical rail dividers, 15rem article TOC with neutral active state, no homepage TOC, a two-column home intro/quick-start row, smaller home headline/actions, and the existing card grid promoted higher. Tablet/mobile layout remains on the existing <=71.999rem path.
existing local pattern: packages/documentation/tests/foundation.test.ts asserts static source/CSS contracts for docs chrome and the landing page; browser verification is performed separately against a local Astro build.
new or changed tests: extend foundation.test.ts with source assertions for desktop-only rail widths/divider removal/neutral TOC active state, compact desktop global nav, homepage grid wrappers/layout, hidden home right rail, and smaller neutral CTA styling.
focused red command: bun test tests/foundation.test.ts
expected red failure: new assertions for home-quick-start/home-card-section wrappers and the desktop geometry selectors fail before implementation.
no-test waiver: not applicable; static source contract plus browser verification are appropriate for this layout-only change.

- 2026-08-15 02:18:20 append: `.task/docs/refine-desktop-docs-homepage-toward-vercel/workpad.md`

## Implementation outcome

- Kept `src/content/docs/index.mdx` canonical and unchanged. The desktop-only quick start is rendered from `PageTitle.astro` at >=72rem, while the original MDX quick-start stays visible on tablet/mobile and is hidden only on desktop with the home-shell selector.
- Desktop home now uses a 288px left rail, no right TOC, a 920px inner canvas at x=312 on a 1280px viewport, a 56.32px/56.32px headline with -0.03em tracking, a 2-column 436px/48px/436px hero, 36px 14/500 CTAs, and cards beginning around y=547 instead of the live ~y=953.
- Desktop article pages now use a 240px right TOC with no vertical divider; the TOC title is 14/400 and the active scrollspy state is neutral high-contrast + 500 weight instead of orange.
- Desktop global nav is 14/400 with 36px rows and a subtle neutral hover surface; both long desktop rail dividers are removed.
- Mobile/tablet presentation was verified against live production. At 390x844 and 820x900 the hero, headline, CTA positions/sizes, canonical quick-start heading, and install-command geometry matched production; the desktop duplicate remains `display:none` below 72rem.
- Test-first gate: the new source contract failed before implementation, then passed after the desktop changes.
- Validation: `bun test tests/foundation.test.ts` PASS (16/16, 453 expects); `bun run validate` PASS (105 selected pages); `bun run build` PASS; `bun run test:browser` PASS with tablet/mobile overflow 0.
- Local worktree initially inherited a symlinked `node_modules` cache that made Astro resolve stale absolute paths. For validation only, the symlink was removed and `bun install --frozen-lockfile` recreated local dependencies; dependency manifests/lockfiles were not changed.

- 2026-08-15 02:31:01 append: `.task/docs/refine-desktop-docs-homepage-toward-vercel/workpad.md`

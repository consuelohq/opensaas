# Refine desktop docs homepage toward Vercel

branch: `task/documentation/refine-desktop-docs-homepage-toward-vercel`
stream: `stream/documentation`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1992/refine-desktop-docs-homepage-toward-vercel
github pr: https://github.com/consuelohq/opensaas/pull/1992
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

- 2026-08-15 02:38:22 fs.write: `.task/documentation/refine-desktop-docs-homepage-toward-vercel/workpad.md`
- 2026-08-15 02:40:43 fs.write: `.task/documentation/refine-desktop-docs-homepage-toward-vercel/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 02:41:09 `verify`: passed — OK

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
bun run task:push -- --message "type(documentation): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: Desktop docs at >=72rem use a calmer Vercel-like geometry: 18rem left rail with compact 14px navigation, no vertical rail dividers, 15rem article TOC with neutral active state, no homepage TOC, a two-column home intro/quick-start row, smaller home headline/actions, and the existing card grid promoted higher. Tablet/mobile layout remains on the existing <=71.999rem path.
existing local pattern: packages/documentation/tests/foundation.test.ts asserts static source/CSS contracts for docs chrome and the landing page; scripts/test-foundation-browser.mjs verifies rendered responsive behavior.
new or changed tests: extend foundation.test.ts with source assertions for desktop-only rail widths/divider removal/neutral TOC active state, compact desktop global nav, homepage two-column layout, hidden home right rail, and smaller neutral CTA styling; update browser regression expectations for the approved neutral sidebar hover and visible responsive install-command variant.
focused red command: bun test tests/foundation.test.ts
expected red failure: new assertions for the desktop quick-start/home shell and compact rail selectors fail before implementation.
no-test waiver: not applicable; static source contract plus browser verification are appropriate for this layout-only change.

- 2026-08-15 02:38:22 append: `.task/documentation/refine-desktop-docs-homepage-toward-vercel/workpad.md`

## Implementation outcome

- Implemented on the active `stream/documentation` lineage. The canonical `src/content/docs/index.mdx` remains unchanged; desktop gets a duplicate quick-start presentation from `PageTitle.astro`, while tablet/mobile keep the existing MDX quick-start and the duplicate remains hidden below 72rem.
- Desktop home at 1280px now measures: 288px left rail, 992px main pane, no right TOC, 920px inner canvas at x=312, 436px/48px/436px two-column hero, H1 56.32px/56.32px with -0.03em tracking, 36px 14/500 actions, Pick Up heading around y=492, and first card around y=547 (live production before this pass was around y=953).
- Desktop article TOC is 240px with no vertical divider; title is 14/400 and active scrollspy is neutral high-contrast + 500 weight instead of orange. Desktop left-nav links are 14/400 with 36px rows and a subtle neutral hover surface. Both long desktop rail divider rules are removed.
- Tablet/mobile behavior is preserved on the existing <=71.999rem path. Browser regression reports zero horizontal overflow on tablet and mobile, and manual comparisons at 390x844 and 820x900 kept the existing hero/CTA/quick-start geometry while the desktop-only duplicate stayed hidden.
- Test-first gate was observed: the new focused foundation contract failed before implementation on the missing desktop geometry, then passed after implementation.
- Validation passed: `bun test tests/foundation.test.ts` (16/16, 453 expects), `bun run validate` (105 selected pages), `bun run build`, and `bun run test:browser` (tablet/mobile overflow 0).
- The task worktree initially inherited a symlinked documentation `node_modules` that could resolve stale absolute Astro cache paths. For local validation only, the symlink was replaced with `bun install --frozen-lockfile`; manifests and lockfiles were not changed.

- 2026-08-15 02:40:43 append: `.task/documentation/refine-desktop-docs-homepage-toward-vercel/workpad.md`

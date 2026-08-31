# Yoink Vercel responsive docs patterns for mobile and iPad

branch: `task/documentation/yoink-vercel-responsive-docs-patterns-for-mobile-and-ipad`
stream: `stream/documentation`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2008/yoink-vercel-responsive-docs-patterns-for-mobile-and-ipad
github pr: https://github.com/consuelohq/opensaas/pull/2008
started: 2026-08-15

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-15 03:57:27 fs.write: `.task/documentation/yoink-vercel-responsive-docs-patterns-for-mobile-and-ipad/workpad.md`
- 2026-08-15 03:58:16 fs.write: `.task/documentation/yoink-vercel-responsive-docs-patterns-for-mobile-and-ipad/workpad.md`
- 2026-08-15 04:04:47 fs.write: `.task/documentation/yoink-vercel-responsive-docs-patterns-for-mobile-and-ipad/workpad.md`

## workspace-owned: validation evidence

- none yet

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

behavior under test: below the desktop breakpoint, article pages keep the global documentation drawer rather than swapping to section-only navigation; mobile and iPad typography/control sizing/canvas spacing match the approved Vercel-derived responsive targets while desktop remains unchanged.
existing local pattern: packages/documentation/tests/foundation.test.ts provides static CSS/component contracts and packages/documentation/scripts/test-foundation-browser.mjs provides viewport/browser regression coverage.
new or changed tests: add static assertions for responsive type/control/drawer rules and browser assertions at 390x844 and 820x1180 covering global drawer persistence on article routes, responsive H1/H2/control metrics, partial-width drawer, and zero overflow.
focused red command: bun test tests/foundation.test.ts
expected red failure: new responsive contract assertions fail because current mobile/tablet CSS still has oversized headings/buttons and section-only article drawer behavior.
no-test waiver: not applicable.

## Approved responsive targets

- Keep desktop behavior from the previous Vercel-inspired pass intact.
- Mobile/iPad use one global docs drawer on every route. Current section auto-expands and current page is highlighted; no section-only `← All documentation` mode below desktop.
- Mobile article hierarchy approximately H1 28-30/34-38 and H2 21-22/28; iPad article H1 38-40/46-48 and H2 24-26/32-34; body copy stays 16/27.2.
- Tablet homepage H1 comes down from ~65.6 to ~48-52 with comfortable line-height; mobile homepage H1 gets more breathing room without becoming smaller than necessary.
- Tablet homepage canvas uses ~24px gutters rather than the current 704px cap.
- Responsive CTAs/page actions become more compact and lighter; drawer rows settle around 36px with neutral active surfaces.
- Phone drawer becomes partial-width (~75vw) with ~400px max, backdrop/elevation, ~200ms drawer motion and ~300ms scrim; remove broad responsive page entrance animation and keep ~150ms control transitions.

- 2026-08-15 03:57:27 append: `.task/documentation/yoink-vercel-responsive-docs-patterns-for-mobile-and-ipad/workpad.md`

focused red result: confirmed. `bun test tests/foundation.test.ts` failed before production edits because `expandCurrentSidebarPath` did not exist yet; this is the first new responsive navigation contract.

- 2026-08-15 03:58:16 append: `.task/documentation/yoink-vercel-responsive-docs-patterns-for-mobile-and-ipad/workpad.md`

## Implementation summary

- Responsive article drawer now always renders the full global documentation tree, auto-expands the current section/path, and highlights the current page. The section-only rail remains desktop-only.
- Phone drawer is 75vw with a 25rem max, tablet caps at 400px, with neutral elevation/scrim and 220ms open / 200ms close motion.
- Responsive whole-page entrance animation is disabled; interactive chrome uses 150ms transitions.
- Mobile article H1/H2 targets are 30/36 and 22/28; iPad targets are 40/48 and 24/32; body stays 16/27.2.
- Homepage responsive H1 is 44.8/52 on phone and 48/56 on iPad; iPad home canvas no longer inherits the old narrow cap and responsive gutters are ~24px.
- Responsive CTAs, Copy page, page actions, Search Docs, and On this page use smaller 14/500 neutral chrome.
- Desktop >=72rem rules remain on the prior approved path.

## Validation

- `bun test tests/foundation.test.ts`: 18 passed, 478 assertions.
- `bun run validate`: passed, 105 selected docs pages.
- `bun run build`: passed; existing non-fatal `Entry docs → 404 was not found.` remains on stderr.
- `bun run test:browser`: passed at 820x1180 tablet and 390x844 mobile with zero horizontal overflow, full global article drawer persistence/current-page highlighting, responsive type/control measurements, desktop regressions, and automatic translation coverage.
- `git diff --check`: passed.

- 2026-08-15 04:04:47 append: `.task/documentation/yoink-vercel-responsive-docs-patterns-for-mobile-and-ipad/workpad.md`

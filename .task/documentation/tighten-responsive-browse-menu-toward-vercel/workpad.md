# Tighten responsive Browse menu toward Vercel

branch: `task/documentation/tighten-responsive-browse-menu-toward-vercel`
stream: `stream/documentation`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2022/tighten-responsive-browse-menu-toward-vercel
github pr: https://github.com/consuelohq/opensaas/pull/2022
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

- 2026-08-15 04:41:33 fs.write: `.task/documentation/tighten-responsive-browse-menu-toward-vercel/workpad.md`
- 2026-08-15 04:46:55 fs.write: `.task/documentation/tighten-responsive-browse-menu-toward-vercel/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 04:46:36 `review.run`: passed — OK
- 2026-08-15 04:46:48 `verify`: passed — OK

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

behavior under test: responsive Browse opens with Build and Learn collapsed, uses no section divider rules, and uses a tighter Vercel-derived mobile/tablet scale for navigation text and auth buttons while preserving routes, links, accessibility, and desktop docs behavior.
existing local pattern: packages/documentation/tests/foundation.test.ts owns source/style contracts and packages/documentation/scripts/test-foundation-browser.mjs owns responsive rendered state, geometry, overflow, and interactions.
new or changed tests: add source assertions for collapsed-by-default Browse groups and divider-free/tighter chrome; extend browser assertions to verify both groups are closed on first open, smaller responsive label/button metrics, and unchanged zero-overflow/links.
focused red command: bun test tests/foundation.test.ts from packages/documentation, followed by bun run test:browser once the source contract is red.
expected red failure: current Browse marks Learn open by default, renders divider borders between sections, and uses larger typography/button geometry than the new responsive targets.
no-test waiver: none; this changes interactive responsive navigation behavior and visual geometry.

## Acceptance criteria

- [ ] Browse starts fully collapsed on phone and iPad/tablet, including Learn.
- [ ] No separator/divider rules between Browse sections.
- [ ] Build/Learn/Getting started text hierarchy is smaller and denser, closer to Vercel mobile Browse.
- [ ] Sign up / Log in controls are shorter with smaller type and tighter radius/padding.
- [ ] Existing links, external-link indicators, Escape/focus/scroll-lock behavior, and desktop docs remain intact.
- [ ] Browser coverage passes at 390x844 and 820x1180 with zero horizontal overflow.
- [ ] Ship through stream/documentation and merge the stream PR to main.

- 2026-08-15 04:41:33 append: `.task/documentation/tighten-responsive-browse-menu-toward-vercel/workpad.md`

## workspace-owned: files read

- `packages/documentation/README.md`
- `packages/documentation/scripts/test-foundation-browser.mjs`
- `packages/documentation/src/components/BrowseMenu.astro`
- `packages/documentation/src/styles/docs.css`
- `packages/documentation/tests/foundation.test.ts`

- 2026-08-15 04:42:12 apply-patch: `packages/documentation/tests/foundation.test.ts`
- 2026-08-15 04:42:12 apply-patch: `packages/documentation/scripts/test-foundation-browser.mjs`
- 2026-08-15 04:42:56 apply-patch: `packages/documentation/src/components/BrowseMenu.astro`

## Implementation

- Removed the default `open` state from Learn so both Build and Learn start collapsed.
- Removed the Browse header divider and group dividers.
- Tightened responsive Browse typography to 16/24 section labels, 15/24 expanded links, and 14px/500 auth buttons.
- Reduced Browse auth actions to 36px height with 6px radius and 150ms neutral transitions.
- Tightened body/group/getting-started spacing without changing links, overlay behavior, or desktop docs.

## Validation evidence

- Test-first red: `bun test tests/foundation.test.ts` failed on the new collapsed/divider-free/compact Browse contract before production edits. Trace `trc_1e947f36f63a`.
- Focused green: 19 tests passed, 488 expectations. Trace `trc_b68829320cbc`.
- Direct task-worktree browser run reproduced the known Astro compile-metadata failure caused by the task-created `packages/documentation/node_modules` symlink. Traces `trc_ecd7da89df05` and `trc_9212a3b371b6`.
- Clean isolated package validation with a frozen Bun install passed the full browser regression at 820x1180 and 390x844, zero overflow, plus automatic Spanish translation. Trace `trc_b6eb9a9b0d7b`.
- `bun run validate` passed for 105 selected pages. Trace `trc_5ce1502041eb`.
- Clean isolated production build passed and indexed 117 HTML files; existing non-fatal `Entry docs → 404 was not found.` remains. Trace `trc_ea1f7a4ab25c`.
- `review.run --no-tests` passed with zero task issues; only the existing no-typecheck-target warning remains. Trace `trc_67f2623eaa86`.
- Full `verify` passed with `publishValid: true` and all three changed documentation files included. Trace `trc_cda4f45593dc`.

## Current status

- [x] Browse starts collapsed on phone and iPad/tablet.
- [x] Browse section/header dividers are removed.
- [x] Browse labels and auth controls use the tighter Vercel-derived scale.
- [x] Existing links, interactions, translation, and desktop behavior remain covered.
- [x] Responsive browser regression passes at 390x844 and 820x1180 with zero overflow.
- [ ] Publish to stream/documentation and merge to main.

- 2026-08-15 04:46:55 append: `.task/documentation/tighten-responsive-browse-menu-toward-vercel/workpad.md`

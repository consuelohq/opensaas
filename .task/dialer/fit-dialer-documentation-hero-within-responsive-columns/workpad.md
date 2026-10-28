# Branch 2 final visual repair

Own only packages/dialer-documentation PageTitle copy and browser geometry coverage. Preserve all other agents and production domains. Direct follow-up to the unshipped docs clone in stream PR #2650; do not mutate the already-merged task PR #2648.

## Test-first contract
behavior under test: homepage headline and actions fit their grid column at desktop and all supported mobile/landscape sizes.
existing pattern: the package's production-preview Playwright harness.
new tests: assert home-copy scroll width does not exceed available width at desktop and the seven viewport sizes; save homepage screenshots as evidence.
focused red command: bun run --cwd packages/dialer-documentation test:browser
expected red: long More conversations. headline exceeds its desktop grid column.
no-test waiver: none for responsive behavior; final change may be copy-only if shorter equivalent wording resolves all sizes without altering CSS.

Current preview source 04417289a7fc9e0a91f9f755944e222fff46d54d, worker a9e133b6-9977-4176-a918-8c22b71bd6e9. Source/build hash and all 30 public pages passed. Visual inspection then found home hero ink crowding its adjacent setup column. Existing subpage overflow checks did not cover homepage text.

Red reproduced: desktop homepage text width 508px exceeded 436px column. Changed the first title line to Talk more. while preserving existing typography.

## workspace-owned: validation evidence

- 2026-10-28 21:37:51 `review.run`: passed — OK
- 2026-10-28 21:38:28 `review.run`: passed — OK
Green: Astro build and browser matrix pass (30 guides, seven homepage/subpage viewports, WebKit short landscape, search/themes/clipboard/Markdown/menus). Visually inspected desktop and 320px homepage screenshots. Strict review: zero blocking findings; inherited missing project typecheck target remains disclosed.
- 2026-10-28 21:38:45 `verify`: passed — OK

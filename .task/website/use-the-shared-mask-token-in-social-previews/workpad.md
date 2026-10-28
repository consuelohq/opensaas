# Use the shared mask token in social previews

branch: `task/website/use-the-shared-mask-token-in-social-previews`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2620

## acceptance criteria

- [x] Renderer reads the existing opaque-mask and brand tokens instead of duplicating constant colors.
- [x] The generated home social image retains identical pixels and the approved page remains unchanged.
- [ ] Review/verify pass and the correction is promoted for the production release.

## plan

1. Extract renderer constants through readToken.
2. Render the home card and compare pixels with the committed asset; inspect the scoped diff.
3. Review, verify and promote.

## Test-first contract

behavior under test: Shared CSS token values drive browser-rendered social masks and background while preserving the asset appearance.
existing local pattern: readToken already reads on-brand color in generate-social-card.ts.
new or changed tests: Pixel comparison against the committed home PNG; no constant-mirroring unit test.
focused red command: Inspection found raw #000 mask stops rather than the shared token.
expected red failure: Renderer duplicates the mask constant instead of reading its token.
no-test waiver: Constant-for-constant extraction; a real render and pixel comparison provide direct validation.

## files changed

- none yet

## key decisions

Keep current image paths, approved typography, card content and pixels. Read the existing brand token too so renderer colors remain centralized.

## notes for ko

The approved page and card appearance are unchanged. This completes the final renderer review correction before production.

## improvements noticed

Shared artwork should use the same token source as the page.

## errors i ran into

None.

- 2026-09-29 21:22:08 write: `.task/website/use-the-shared-mask-token-in-social-previews/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-29 21:22:08 fs.write: `.task/website/use-the-shared-mask-token-in-social-previews/workpad.md`

## validation evidence

The real renderer produced the home social PNG and its decoded pixels match the previously built committed PNG exactly. Strict review and verification follow before promotion. No generated asset or page source changes are needed.

## workspace-owned: validation evidence

The real renderer produced the home social PNG and its decoded pixels match the previously built committed PNG exactly. Strict review and verification follow before promotion. No generated asset or page source changes are needed.
- 2026-09-29 21:22:50 `review.run`: passed — OK
- 2026-09-29 21:22:50 `verify`: passed — OK
- 2026-09-29 21:23:10 `verify`: passed — OK

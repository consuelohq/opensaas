# Move preview clouds 15 percent closer

branch: `task/dialer/move-preview-clouds-15-percent-closer`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2559
started: 2026-09-23

## acceptance criteria

- [x] Move the two large preview/features clouds 15 percentage points closer to center.
- [x] Preserve their current large scale, opacity, alpha cleanup, and opposite-edge framing.
- [x] Keep desktop/mobile free of horizontal overflow and broken images.
- [x] Refresh the Tailnet preview and merge into stream/dialer.

## plan

1. Lock the new desktop offsets in the focused landing test and run it red.
2. Change only the preview offset variables from -20%/-18% to -5%/-3%.
3. Re-run focused tests, build, refresh Tailnet, and verify desktop/mobile geometry.
4. Review/verify and merge.

## Test-first contract

behavior under test: large preview clouds sit 15 percentage points closer to the center than the current placement without changing their size.
existing local pattern: preview positioning is controlled by --preview-right-offset and --preview-left-offset in CloudField.astro; dialer-landing.test.mjs already locks the large preview widths.
new or changed tests: require --preview-right-offset: -5% and --preview-left-offset: -3%.
focused red command: bun test packages/consuelo-dialer-website/tests/dialer-landing.test.mjs
expected red failure: current offsets are -20% and -18%.
no-test waiver: not applicable.

## files changed

- `packages/consuelo-dialer-website/src/components/visuals/CloudField.astro`
- `packages/consuelo-dialer-website/tests/dialer-landing.test.mjs`

## key decisions

- Interpreted "15% closer" as 15 percentage points inward from each desktop/tablet edge: right -20% -> -5%, left -18% -> -3%.
- Kept cloud sizes unchanged. Mobile receives the same 15vw inward shift while retaining its large 44rem/38rem assets.

## notes for ko

- Preview refreshed at `https://picassos-mac-mini.tail38ed59.ts.net:8767/`.
- Focused test: 13/13 passing, 144 assertions.
- Astro check/build: 0 errors, 0 warnings, 2 inherited hints.
- Desktop 1440x900: right cloud moved from x≈761 to x≈565; left cloud from x≈-133 to x≈63. No overflow or broken images.
- Mobile 390x844: both clouds moved inward by 15vw; no overflow or broken images.

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/consuelo-dialer-website/src/components/visuals/CloudField.astro`
- `packages/consuelo-dialer-website/tests/dialer-landing.test.mjs`

- 2026-09-23 01:58:17 apply-patch: `.task/dialer/move-preview-clouds-15-percent-closer/workpad.md`
- 2026-09-23 01:58:23 apply-patch: `packages/consuelo-dialer-website/tests/dialer-landing.test.mjs`
- 2026-09-23 01:58:38 apply-patch: `packages/consuelo-dialer-website/src/components/visuals/CloudField.astro`

- 2026-09-23 01:59:24 apply-patch: `.task/dialer/move-preview-clouds-15-percent-closer/workpad.md`

## workspace-owned: validation evidence

- 2026-09-23 01:59:38 `review.run`: passed — OK
- 2026-09-23 01:59:46 `verify`: passed — OK

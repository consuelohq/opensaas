# Brighten and reveal right preview cloud

branch: `task/dialer/brighten-and-reveal-right-preview-cloud`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2561
started: 2026-09-23

## acceptance criteria

- [x] Make the right preview/features cloud visibly whiter without reintroducing the rectangular seam.
- [x] Reveal more of that right cloud directly under the preview notice/email by bringing it slightly farther inward.
- [x] Keep the left cloud, cloud sizes, alpha-cleaned WebPs, and notice readability unchanged.
- [x] Keep desktop/mobile free of horizontal overflow and broken images.
- [x] Refresh the Tailnet preview and merge into stream/dialer.

## plan

1. Add a focused source contract for the right preview cloud visibility/position and run it red.
2. Raise only the right preview cloud above the blue quiet-zone overlay, increase its opacity, and move it 5 percentage points inward.
3. Keep image filters off so the seam fix remains intact.
4. Build, refresh Tailnet, inspect desktop/mobile geometry, then review/verify and publish.

## Test-first contract

behavior under test: the right preview cloud is brighter and more visible beneath the preview notice/email while retaining the cleaned asset/no-filter seam fix.
existing local pattern: preview composition lives in CloudField.astro; the blue quiet-zone overlay is z-index 3 and currently suppresses both clouds.
new or changed tests: require the right preview cloud to use opacity 0.8, z-index 5, and a right offset of 0%, while preserving no CSS filter on cloud images.
focused red command: bun test packages/consuelo-dialer-website/tests/dialer-landing.test.mjs
expected red failure: current right preview cloud is opacity 0.68, sits below the quiet-zone overlay, and uses right offset -5%.
no-test waiver: not applicable.

## files changed

- `packages/consuelo-dialer-website/src/components/visuals/CloudField.astro`
- `packages/consuelo-dialer-website/tests/dialer-landing.test.mjs`

## key decisions

- Did not add image filters or alter the cleaned WebP assets, preserving the seam fix.
- Raised only the right preview cloud above the blue quiet-zone overlay (`z-index: 5`) so its native white detail is no longer blue-washed.
- Increased only the right preview cloud opacity from 0.68 to 0.8.
- Moved only the right preview cloud another 5 percentage points inward (`right: -5% -> 0%`); left cloud remains unchanged.
- Mobile gets the equivalent additional 5vw inward shift.

## notes for ko

- Preview refreshed at `https://picassos-mac-mini.tail38ed59.ts.net:8767/`.
- Focused test: 13/13 passing, 147 assertions.
- Astro check/build: 0 errors, 0 warnings, 2 inherited hints.
- Desktop 1440x900: right preview cloud spans x=500..1364 while the notice spans x=440..1000, so the cloud is now clearly present directly under the email side of the notice. Computed opacity=0.8, z-index=5, image filter=none.
- Mobile 390x844: right cloud moved inward to x=127..831; no overflow or broken images.

## improvements noticed

- none yet

## errors i ran into

- The first green run exposed an over-broad test regex: it matched the unrelated glow's blur filter because the markup occurrence of `cloud-field__body` preceded the stylesheet. Narrowed the assertion to the actual `.cloud-field__body { ... }` rule and reran green.

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

- 2026-09-23 02:10:31 apply-patch: `.task/dialer/brighten-and-reveal-right-preview-cloud/workpad.md`
- 2026-09-23 02:10:59 apply-patch: `packages/consuelo-dialer-website/tests/dialer-landing.test.mjs`
- 2026-09-23 02:11:13 apply-patch: `packages/consuelo-dialer-website/src/components/visuals/CloudField.astro`
- 2026-09-23 02:11:29 apply-patch: `packages/consuelo-dialer-website/tests/dialer-landing.test.mjs`

- 2026-09-23 02:12:22 apply-patch: `.task/dialer/brighten-and-reveal-right-preview-cloud/workpad.md`

## workspace-owned: validation evidence

- 2026-09-23 02:12:32 `review.run`: passed — OK
- 2026-09-23 02:12:41 `verify`: passed — OK

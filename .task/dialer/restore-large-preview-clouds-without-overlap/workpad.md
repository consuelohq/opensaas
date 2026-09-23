# Restore large preview clouds without overlap

branch: `task/dialer/restore-large-preview-clouds-without-overlap`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2557
started: 2026-09-23

## acceptance criteria

- [x] Restore the preview/features clouds to the large scale Ko liked before the previous cleanup.
- [x] Keep the alpha-edge seam fix and optimized WebP assets unchanged.
- [x] Preserve the improved opposite-edge composition so the large clouds frame the preview notice rather than clumping in the center.
- [x] Keep desktop and mobile free of horizontal overflow and broken images.
- [x] Refresh the existing Tailnet preview and merge into stream/dialer.

## plan

1. Add a focused regression that locks the preview clouds back to the earlier large scale while retaining opposite-edge offsets.
2. Run the focused test red against the current reduced cloud sizes.
3. Restore the larger desktop/tablet/mobile preview dimensions and push more of each cloud offscreen so size returns without overlap.
4. Build, refresh Tailnet, inspect preview geometry on desktop/mobile, then review/verify and publish.

## Test-first contract

behavior under test: the preview/features band uses large atmospheric clouds again while preserving the separated left/right framing introduced by the seam fix.
existing local pattern: CloudField.astro owns the preview variant dimensions and offsets; dialer-landing.test.mjs already guards preview cloud separation.
new or changed tests: require the desktop preview widths to return to the previous large values (right: min(67vw, 54rem), left: min(55vw, 46rem)) while retaining opposite-edge offset variables.
focused red command: bun test packages/consuelo-dialer-website/tests/dialer-landing.test.mjs
expected red failure: current preview widths are clamp(18rem, 32vw, 30rem) and clamp(16rem, 27vw, 25rem), which are the smaller values Ko disliked.
no-test waiver: not applicable.

## files changed

- `packages/consuelo-dialer-website/src/components/visuals/CloudField.astro`
- `packages/consuelo-dialer-website/tests/dialer-landing.test.mjs`

## key decisions

- The previous cleanup overcorrected the clump problem by shrinking the clouds. The actual problem was overlap/placement, not scale.
- Restored the earlier large desktop sizes: right cloud `min(67vw, 54rem)`, left cloud `min(55vw, 46rem)`.
- Pushed the larger clouds farther outside opposite edges instead of reducing them: desktop offsets are -20% right / -18% left.
- Restored the larger mobile treatment too (44rem right / 38rem left), but pushed them mostly offscreen so only large atmospheric slices frame the notice.
- Kept the alpha-cleaned WebPs and seam fix unchanged.

## notes for ko

- Tailnet preview refreshed at `https://picassos-mac-mini.tail38ed59.ts.net:8767/`.
- Focused test: 13/13 passing, 142 assertions.
- Astro check/build: 0 errors, 0 warnings, 2 inherited hints.
- Desktop 1440x900: right cloud is 864px wide and left cloud 648px wide; both are large again. Notice stays centered; no horizontal overflow or broken images.
- Mobile 390x844: right cloud is 704px wide and left cloud 535px wide, with most of each pushed outside opposite viewport edges; no overflow or broken images.

## improvements noticed

- none yet

## errors i ran into

- Fresh task worktree again lacked package-local Astro binaries; recovered with `bun install --cwd packages/consuelo-dialer-website --frozen-lockfile` and no tracked dependency changes.

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

- 2026-09-23 01:52:27 apply-patch: `.task/dialer/restore-large-preview-clouds-without-overlap/workpad.md`
- 2026-09-23 01:52:31 apply-patch: `packages/consuelo-dialer-website/tests/dialer-landing.test.mjs`
- 2026-09-23 01:52:47 apply-patch: `packages/consuelo-dialer-website/src/components/visuals/CloudField.astro`

- 2026-09-23 01:53:52 apply-patch: `.task/dialer/restore-large-preview-clouds-without-overlap/workpad.md`

## workspace-owned: validation evidence

- 2026-09-23 01:54:03 `review.run`: passed — OK
- 2026-09-23 01:54:10 `verify`: passed — OK

# fix mobile hero overflow and footer artwork rendering

branch: `task/website/fix-mobile-hero-overflow-and-footer-artwork-rendering`
stream: `stream/website`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1811/fix-mobile-hero-overflow-and-footer-artwork-rendering
github pr: https://github.com/consuelohq/opensaas/pull/1811
started: 2026-08-10

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/consuelo-website/public/images/home/holding-world-white-fill-mask.svg`

## workspace-owned: files changed

- `packages/consuelo-website/public/images/home/holding-world-white-fill-mask.svg`

## workspace-owned: activity log

- 2026-08-10 01:43:45 fs.write: `.task/website/fix-mobile-hero-overflow-and-footer-artwork-rendering/workpad.md`
- 2026-08-10 01:46:56 fs.write: `packages/consuelo-website/public/images/home/holding-world-white-fill-mask.svg`
- 2026-08-10 01:51:16 fs.write: `.task/website/fix-mobile-hero-overflow-and-footer-artwork-rendering/workpad.md`
- 2026-08-10 01:52:55 fs.write: `.task/website/fix-mobile-hero-overflow-and-footer-artwork-rendering/workpad.md`

## workspace-owned: validation evidence

- 2026-08-10 01:52:35 `review.run`: passed — OK
- 2026-08-10 01:52:36 `review.run`: passed — OK
- 2026-08-10 01:53:03 `verify`: passed — OK

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
bun run task:push -- --message "type(website): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/consuelo-website/scripts/generate-footer-art.ts`
- `packages/consuelo-website/src/components/home/HomeHero.astro`
- `packages/consuelo-website/src/components/site/SiteHeader.astro`
- `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`
- `packages/workspace/senior-engineer.md`

## Acceptance criteria

- Replace the visible hard-edged hand/sash whitening workaround with a cleaner vector/source-aware footer-art treatment that preserves blue line art while making the intended hand and sash read as continuous white shapes.
- Confirm the user's current screenshot is not stale-cache behavior; keep the deployed asset versioning/cache bust intact.
- Fix the real narrow-mobile hero overflow on representative phone widths without shrinking tablet/desktop presentation.
- Modernize stale mobile hero tests to the current two-line rotating-assistant contract and assert no horizontal text overflow.
- Run focused tests, website build, review, verify, promote through stream/website to main, deploy production, and verify live mobile/footer behavior.

## Plan

1. Inspect the current footer SVG/generator and mobile hero test/CSS contracts.
2. Add failing regression coverage for smooth footer white regions and narrow-phone no-overflow/current two-line hero behavior.
3. Implement the smallest source/generator and mobile CSS/test changes.
4. Run focused tests and production build, then review/verify/publish/deploy/live verify.

## Test-first contract

- Footer behavior: generated art must keep hand/sash predominantly white without rectangular/polygon clipping seams or excessive blue gaps; preserve globe/robe blue detail. Follow existing `footer-art.test.mjs` pixel-region pattern.
- Mobile behavior: 320/360/375/390/430px hero headings must use the current two `.os-hero__heading-line` structure, remain stable without JS sizing variables, and each nowrap line must satisfy `scrollWidth <= clientWidth` (small tolerance acceptable for antialiasing/subpixel layout).
- Existing tests to change: `footer-art.test.mjs` and `homepage-mobile-layout.test.mjs`.
- Focused red commands will be run only after destructive-literal safety inspection of the selected test sources/package scripts.

## Current status

- User screenshot inspected visually: it already shows the new white hand/sash fill, so it is not simply the pre-fix cached image. The visible issue is the hard-edged generator mask itself.
- `media.svg inspect` confirms `holding-world.svg` is still a single Potrace path (1 path, no semantic hand/sash elements), so the previous fix did not modify the SVG source structure.

- 2026-08-10 01:43:45 append: `.task/website/fix-mobile-hero-overflow-and-footer-artwork-rendering/workpad.md`

- 2026-08-10 01:45:32 apply-patch: `packages/consuelo-website/tests/footer-art.test.mjs`
- 2026-08-10 01:45:32 apply-patch: `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`
- 2026-08-10 01:46:56 write: `packages/consuelo-website/public/images/home/holding-world-white-fill-mask.svg`

- 2026-08-10 01:48:45 apply-patch: `packages/consuelo-website/scripts/generate-footer-art.ts`
- 2026-08-10 01:48:45 apply-patch: `packages/consuelo-website/src/components/home/HomeHero.astro`
- 2026-08-10 01:48:46 apply-patch: `packages/consuelo-website/src/components/home/HomeCloudCta.astro`
- 2026-08-10 01:48:46 apply-patch: `packages/consuelo-website/tests/homepage-responsive.test.mjs`
- 2026-08-10 01:48:46 apply-patch: `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`
- 2026-08-10 01:49:28 apply-patch: `packages/consuelo-website/scripts/generate-footer-art.ts`
- 2026-08-10 01:49:28 apply-patch: `packages/consuelo-website/tests/footer-art.test.mjs`
- 2026-08-10 01:49:55 apply-patch: `packages/consuelo-website/src/components/home/HomeHero.astro`
- 2026-08-10 01:50:11 apply-patch: `packages/consuelo-website/src/components/home/HomeHero.astro`

- 2026-08-10 01:50:46 apply-patch: `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`
## Implementation and focused validation

- Red footer evidence: `bun test tests/footer-art.test.mjs` failed because `holding-world-white-fill-mask.svg` did not exist; current generator only had inline polygon masks.
- Red mobile evidence: `node --test tests/homepage-mobile-layout.test.mjs` failed at 320px with a hero line requiring 337px inside a 291px box.
- Footer implementation: added semantic curved SVG masks (`holding-world-body-fill-mask.svg` and `holding-world-white-fill-mask.svg`) and changed the generator to render those masks instead of inline polygon regions. The tighter mask owns `sash-fill` and `hand-fill`; the broad mask preserves body/robe white underlay while keeping line art.
- Cache handling: bumped the footer artwork URL from `v=20260810-white-fill` to `v=20260810-smooth-fill` so browsers cannot reuse the previous polygon-rendered PNG.
- Mobile implementation: phone-only hero font is now `clamp(2rem, 10vw, 3.2rem)`; tablet/desktop sizing is unchanged.
- Stale mobile test repair: updated the old 36.075px/three-line hero assertions to the current two `.os-hero__heading-line` contract, added no-overflow checks at 320/360/375/390/430, and updated mobile header expectations to current DOCS/CONSUELO OS/CLOUD navigation.
- Green focused evidence: footer-art suite 4/4 pass; homepage mobile integration 1/1 pass.
- Tooling recovery: `media.svg create` resolves relative outputs against the repo root rather than the task worktree. The accidental untracked root mask file was immediately copied into the task, removed via the OS Mac recovery surface, and root status was verified clean before continuing. Subsequent media writes used an absolute task-worktree path.

- 2026-08-10 01:51:16 append: `.task/website/fix-mobile-hero-overflow-and-footer-artwork-rendering/workpad.md`

## Final validation

- SVG masks: `media.svg inspect` confirms the clean mask contains semantic curved `sash-fill` and `hand-fill` paths and the body mask contains curved `body-fill`, `arm-fill`, and `forearm-fill` paths; no polygon remnants remain in the generator or masks.
- Footer regression: `bun test tests/footer-art.test.mjs` passes 4/4.
- Mobile regression/integration: `node --test tests/homepage-mobile-layout.test.mjs` passes 1/1, including no-overflow checks at 320/360/375/390/430 and current two-line/header contracts.
- Responsive source contract: `bun test tests/homepage-responsive.test.mjs` passes 8/8.
- Generated raster metrics: hand core 94.24% white; sash upper 100%, middle 99.99%, lower 99.32%; outer robe retains 11.08% blue; globe retains 30.34% blue.
- Production build: `bun run --cwd packages/consuelo-website build` passes; Astro check reports 0 errors / 0 warnings / 24 existing hints and 24 pages build successfully.
- Review: strict mine-only review reports 0 issues / 0 blocking issues from our changes; one existing project typecheck configuration note remains unrelated.
- Publish test selection: 0 suites selected by workspace mapping. All user-impacting focused tests were run explicitly after safety inspection.
- Root checkout is clean after media-tool recovery; all task changes are isolated to this task worktree.
- Next: full verifier, push task PR #1811, promote through stream/website, deploy production, then live mobile/cache-key verification.

- 2026-08-10 01:52:55 append: `.task/website/fix-mobile-hero-overflow-and-footer-artwork-rendering/workpad.md`

# retune landing typography and complete footer illustration fill

branch: `task/website/retune-landing-typography-and-complete-footer-illustration-fill`
stream: `stream/website`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1524/retune-landing-typography-and-complete-footer-illustration-fill
github pr: https://github.com/consuelohq/opensaas/pull/1524
started: 2026-07-16

## acceptance criteria

- [x] Preserve the no-flash font lifecycle with no client-side font-size mutation after first paint.
- [x] Reduce the hero, cloud title, and character artwork by roughly 2–4% across desktop, tablet, and mobile.
- [x] Preserve exactly three hero lines and one desktop/tablet or two mobile cloud-title lines without overflow.
- [x] Render a complete white face/body/sleeve/forearm/hand underlay while preserving blue hair, eyelashes, outlines, hatching, and globe detail.
- [x] Make the footer badge legible with a tighter face/upper-body crop.
- [x] Generate binary assets during dev/build from the committed SVG source and keep generated files out of Git.
- [x] Pass focused source, pixel, rendered-browser, build, deterministic-generation, review, and publish-verification gates.

## plan

1. Compare ports 301 and 302 at identical viewport sizes and isolate optical scale from runtime sizing behavior.
2. Add failing contracts for smaller stable sizing, complete white body coverage, preserved blue detail, and generated-asset durability.
3. Retune CSS sizing without reintroducing runtime fitting.
4. Replace partial ink whitening with a white body underlay plus blue linework overlay.
5. Validate desktop, tablet, mobile, build, review, and publish lifecycle.

## current status

- Implementation and all validation gates are complete. The task is ready to publish into `stream/website`.

## files changed

- `packages/consuelo-website/.gitignore`
- `packages/consuelo-website/package.json`
- `packages/consuelo-website/public/images/home/consuelo-footer-badge.png` (deleted)
- `packages/consuelo-website/public/images/home/holding-world-editorial.png` (deleted)
- `packages/consuelo-website/scripts/generate-footer-art.ts`
- `packages/consuelo-website/src/components/home/HomeCloudCta.astro`
- `packages/consuelo-website/src/components/home/HomeHero.astro`
- `packages/consuelo-website/tests/footer-art.test.mjs`
- `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`
- `packages/consuelo-website/tests/homepage-responsive.test.mjs`

## workspace-owned: files changed

- `packages/consuelo-website/public/images/home/consuelo-footer-badge.png` (deleted)
- `packages/consuelo-website/public/images/home/holding-world-editorial.png` (deleted)

## workspace-owned: activity log

- 2026-07-16 05:57:49 fs.write: `.task/website/retune-landing-typography-and-complete-footer-illustration-fill/workpad.md`
- 2026-07-16 06:02:35 fs.write: `.task/website/retune-landing-typography-and-complete-footer-illustration-fill/workpad.md`
- 2026-07-16 06:08:06 fs.trash: `packages/consuelo-website/public/images/home/holding-world-editorial.png`
- 2026-07-16 06:08:07 fs.trash: `packages/consuelo-website/public/images/home/consuelo-footer-badge.png`

## workspace-owned: validation evidence

- `bun test tests/homepage-responsive.test.mjs tests/footer-art.test.mjs`: 11 passed, 90 assertions.
- `node --test tests/homepage-mobile-layout.test.mjs`: 1 passed, including first-frame versus settled geometry at 390, 768, 1024, 1180, and 1440 widths.
- `bun run build`: Astro check completed with 0 errors and 0 warnings; static build produced 22 pages. Existing package hints remain outside this task.
- Consecutive generator runs were byte-for-byte deterministic:
  - editorial art: `4f73ff2f1933343ad0cb77b74ebef1cab27168db7ed8ed271ab193867bfcb09c`
  - badge: `ff95321aff31f1cc81c34240e09f51727227217b1257bb134d34f941158fa0ef`
- Generated binaries are valid ignored files under `public/generated/`; dev/start/build invoke `generate:footer-art` before Astro.
- Final art pixel evidence:
  - hair: 67,952 blue samples
  - face: 49,791 white and 28,730 blue samples
  - outer robe: 20,775 white and 2,785 blue samples (87.7% white)
  - sleeve: 36,362 white and 2,278 blue samples (92.4% white)
  - forearm: 21,229 white and 2,427 blue samples (89.7% white)
  - palm: 3,938 white and 3,501 blue samples
  - globe: 8,402 blue samples
  - badge center: 7,169 white and 3,895 blue samples
- Built preview: `http://127.0.0.1:3003/`.
- Desktop 1440×900: hero 100px, cloud title 63.36px, art 534×603, first/settled geometry identical over 500ms, zero overflow.
- Tablet 768×900: hero 71.04px, cloud title 54.528px, art 503×567, first/settled geometry identical, zero overflow.
- Mobile 390×844: hero 36.075px on three lines, cloud title 57.33px on two lines, art 360×405, first/settled geometry identical, badge hidden, zero overflow.
- Screenshot evidence:
  - `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-screenshots/consuelo-retuned-footer-desktop-2026-07-16T06-10-38.png`
  - `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-screenshots/consuelo-retuned-footer-tablet-2026-07-16T06-12-45.png`
  - `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-screenshots/consuelo-retuned-footer-mobile-2026-07-16T06-13-29.png`
- Workspace review: passed with 0 task-owned issues and 0 blockers. One pre-existing infrastructure note remains because no Nx project exposes a `typecheck` target; the package-level Astro check passed separately.
- Workspace verify: passed in full mode; DB guard found 0 risks and 0 findings; publish-valid stamp written to `.task/website/retune-landing-typography-and-complete-footer-illustration-fill/verify.json`.
- Verify's registry selected zero automatic suites for these paths, so the focused source/pixel/browser suites and package build above are the explicit test evidence.
- 2026-07-16 06:16:32 `review.run`: passed — OK
- 2026-07-16 06:16:54 `verify`: passed — OK
- 2026-07-16 06:17:28 `verify`: passed — OK

## key decisions

- Keep the stable CSS-only font lifecycle; do not restore Pretext or any post-paint measurement.
- Apply a modest optical reduction because direct measurements showed ports 301 and 302 already used nearly identical layout boxes.
- Generate a broad white body silhouette with a stronger closure radius, then overlay preserved thin blue ink rather than selectively whitening isolated pixels.
- Move generated PNGs to ignored `public/generated/` and regenerate before dev/build to eliminate repeated binary corruption during branch transport.

## notes for ko

- The preview on port 3003 is the approved middle state: smaller than port 302 while retaining its stable first paint.

## improvements noticed

- none yet

## issues and recovery

- The prior tracked PNGs were corrupt again after branch promotion, beginning with a UTF-8 replacement sequence instead of the PNG signature. The task removes them from Git and makes generation part of dev/build.
- Initial body underlay preserved too little blue robe detail. Increasing the interior threshold to radius 3 restored the linework while retaining 88–92% white coverage in the large body regions.

---

## publish checklist

```bash
bun run task:push -- --message "type(website): description" --changed
bun run task:pr
bun run task:finish
```

## approved follow-up contract

- Preserve the no-flash font lifecycle from the stabilized build.
- Retune hero and cloud-title sizing toward the responsive visual scale shown on port 301.
- Keep authored line counts stable with zero post-paint font-size mutation.
- Replace the partial interior whitening with a clean white silhouette/underlay for face, torso, sleeve, forearm, and hand while preserving blue hair, lashes, outlines, hatching, and globe.
- Validate desktop, tablet, and mobile against ports 301/302 plus the Hermes reference.

## discovery

- Read current typography CSS, art generator, tests, and senior-engineer standards before production edits.
- Measure port 301 and port 302 rendered geometry to derive the target scale rather than guessing.
- Add focused red contracts before implementation.

- 2026-07-16 05:57:49 append: `.task/website/retune-landing-typography-and-complete-footer-illustration-fill/workpad.md`

## workspace-owned: files read

- `packages/consuelo-website/scripts/generate-footer-art.ts`
- `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`
- `packages/workspace/senior-engineer.md`

## test-first contract

- Typography behavior: first-frame and settled geometry remain identical, while the hero uses `clamp(2.15rem, 9.25vw, 6.25rem)` and the cloud title/art use the approved 3–4% optical reduction at desktop, tablet, and mobile.
- Artwork behavior: the generator builds a white body silhouette under face, torso, sleeve, forearm, and hand, then preserves blue hair, lashes, thin outlines, hatching, and globe detail above it.
- Binary durability: generated PNGs live under ignored `public/generated/`; dev and build invoke the generator, and committed source remains text-only.
- Existing pattern: extend `homepage-responsive.test.mjs`, `footer-art.test.mjs`, and the rendered browser matrix in `homepage-mobile-layout.test.mjs`.
- Focused red command: `bun test tests/homepage-responsive.test.mjs tests/footer-art.test.mjs` followed by `node --test tests/homepage-mobile-layout.test.mjs`.
- Expected red state: current CSS values are larger, outer robe/sleeve/palm white coverage is insufficient, generated assets are still tracked at the old paths, and dev/build do not generate them.

- 2026-07-16 06:02:35 append: `.task/website/retune-landing-typography-and-complete-footer-illustration-fill/workpad.md`

- 2026-07-16 06:03:18 apply-patch: `packages/consuelo-website/tests/homepage-responsive.test.mjs`
- 2026-07-16 06:03:18 apply-patch: `packages/consuelo-website/tests/footer-art.test.mjs`
- 2026-07-16 06:03:18 apply-patch: `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`
- 2026-07-16 06:04:33 apply-patch: `packages/consuelo-website/package.json`
- 2026-07-16 06:04:33 apply-patch: `packages/consuelo-website/.gitignore`
- 2026-07-16 06:04:33 apply-patch: `packages/consuelo-website/src/components/home/HomeHero.astro`
- 2026-07-16 06:04:33 apply-patch: `packages/consuelo-website/src/components/home/HomeCloudCta.astro`
- 2026-07-16 06:04:33 apply-patch: `packages/consuelo-website/scripts/generate-footer-art.ts`

- 2026-07-16 06:06:22 apply-patch: `packages/consuelo-website/scripts/generate-footer-art.ts`
- 2026-07-16 06:07:09 apply-patch: `packages/consuelo-website/scripts/generate-footer-art.ts`

- 2026-07-16 06:14:20 apply-patch: `.task/website/retune-landing-typography-and-complete-footer-illustration-fill/workpad.md`

## workspace-owned: test selection

- changed files: `.task/tasks/website/retune-landing-typography-and-complete-footer-illustration-fill.json`, `.task/website/retune-landing-typography-and-complete-footer-illustration-fill/current.json`, `.task/website/retune-landing-typography-and-complete-footer-illustration-fill/evidence-log.json`, `.task/website/retune-landing-typography-and-complete-footer-illustration-fill/read-log.json`, `.task/website/retune-landing-typography-and-complete-footer-illustration-fill/session.json`, `.task/website/retune-landing-typography-and-complete-footer-illustration-fill/verify.json`, `.task/website/retune-landing-typography-and-complete-footer-illustration-fill/workpad.md`, `packages/consuelo-website/.gitignore`, `packages/consuelo-website/package.json`, `packages/consuelo-website/public/images/home/consuelo-footer-badge.png`, `packages/consuelo-website/public/images/home/holding-world-editorial.png`, `packages/consuelo-website/scripts/generate-footer-art.ts`, `packages/consuelo-website/src/components/home/HomeCloudCta.astro`, `packages/consuelo-website/src/components/home/HomeHero.astro`, `packages/consuelo-website/tests/footer-art.test.mjs`, `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`, `packages/consuelo-website/tests/homepage-responsive.test.mjs`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

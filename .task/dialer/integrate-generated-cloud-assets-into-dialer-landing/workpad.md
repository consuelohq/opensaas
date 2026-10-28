# Integrate generated cloud assets into Dialer landing

branch: `task/dialer/integrate-generated-cloud-assets-into-dialer-landing`
stream: `stream/dialer`
pr: https://github.com/consuelohq/opensaas/pull/2552
started: 2026-09-23

## acceptance criteria

- [x] Import the four newest generated transparent PNGs from Ko's Downloads folder into the Dialer website under stable cloud asset names.
- [x] Replace the legacy dither-only hero clouds with a reusable layered CloudField treatment built around the new cloud silhouettes.
- [x] Use the new assets as atmospheric objects: varied scale/depth/opacity, subtle glow, edge texture, cropped off-screen placement, and a protected negative-space zone behind the hero copy.
- [x] Keep cloud motion extremely subtle and disable it for prefers-reduced-motion.
- [x] Compose mobile separately with fewer/larger cropped clouds rather than merely shrinking desktop.
- [x] Preserve the current Consuelo OS-derived hero spacing, CTA, casing, feature transition, and overall blue visual language.
- [x] Keep desktop/mobile free of horizontal overflow and broken images.
- [x] Refresh the existing Tailnet preview only; do not deploy public DNS/production hosting.

## plan

1. Confirm the four newest Downloads images are valid RGBA PNGs and record their dimensions.
2. Add a focused landing-page contract for the new cloud asset names/component and run it red against the current dither-only hero.
3. Copy the four generated PNGs into the Dialer package and implement a reusable CloudField.astro using layered body/glow treatment and intentional desktop/mobile composition.
4. Replace the legacy hero cloud markup/CSS with CloudField while preserving the canonical hero structure.
5. Run focused tests/build, refresh the Tailnet preview, inspect desktop/mobile browser rendering and assets, then review/verify and merge to stream/dialer.

## Test-first contract

behavior under test: the Dialer hero renders the four newly generated transparent cloud assets through a reusable CloudField component instead of the legacy dither-only cloud PNGs, with reduced-motion and mobile-specific composition hooks.
existing local pattern: packages/consuelo-dialer-website/tests/dialer-landing.test.mjs guards source/assets for the landing page and browser smoke proves rendered layout and image decoding.
new or changed tests: require CloudField.astro, require four stable /images/clouds/dialer-cloud-0N.png asset references, forbid /images/home/dither/cloud-* references in HomeHero.astro, require cloud body/glow classes, reduced-motion handling, and a mobile rule that hides at least one cloud.
focused red command: bun test packages/consuelo-dialer-website/tests/dialer-landing.test.mjs
expected red failure: current hero directly references four legacy /images/home/dither/cloud-*.png assets and has no CloudField component/layering contract.
no-test waiver: not applicable.

## files changed

- `packages/consuelo-dialer-website/public/images/clouds/dialer-cloud-01.png`
- `packages/consuelo-dialer-website/public/images/clouds/dialer-cloud-02.png`
- `packages/consuelo-dialer-website/public/images/clouds/dialer-cloud-03.png`
- `packages/consuelo-dialer-website/public/images/clouds/dialer-cloud-04.png`
- `packages/consuelo-dialer-website/public/images/home/dither/cloud-1.png`
- `packages/consuelo-dialer-website/public/images/home/dither/cloud-2.png`
- `packages/consuelo-dialer-website/public/images/home/dither/cloud-3.png`
- `packages/consuelo-dialer-website/public/images/home/dither/cloud-4.png`
- `packages/consuelo-dialer-website/src/components/home/HomeHero.astro`
- `packages/consuelo-dialer-website/src/components/visuals/CloudField.astro`
- `packages/consuelo-dialer-website/tests/dialer-landing.test.mjs`

## key decisions

- Keep the generated PNGs at full fidelity for this visual pass rather than immediately recompressing the dither/detail-heavy artwork. The four source files total roughly 5 MB and can be optimized separately once the composition is approved.
- Each cloud is rendered as the generated body plus a blurred duplicate haze and a CSS lavender glow. This preserves the generated silhouette/detail while adding the soft luminous depth missing from the old dither-only treatment.
- Desktop uses four independent depth layers with asymmetric off-screen cropping; mobile intentionally uses only the two strongest clouds.
- A centered radial quiet-zone sits below the hero content and above the cloud layers so atmospheric detail frames the headline instead of competing with it.
- Drift is deliberately tiny over 24–34 seconds and is fully disabled under prefers-reduced-motion.
- The legacy dither cloud files were corrupt again in this stream. They still support the blue feature-preview band, so they were restored from the canonical Consuelo website instead of being deleted.

## notes for ko

- Confirmed the four newest image downloads are the ChatGPT Image Sept 22 2026 from LAND PNGs. All four are RGBA with alpha. Dimensions: one 1254x1254 and three 1774x887.
- Tailnet preview refreshed in place: `https://picassos-mac-mini.tail38ed59.ts.net:8767/`; numeric route remains `http://100.112.173.49:8769/`.
- Focused red reproduced the missing CloudField contract and the pre-existing corrupt dither assets. Green: 10 tests / 101 assertions / 0 failures.
- Astro check/build: 0 errors, 0 warnings, 2 inherited inline-script hints; both site routes built successfully.
- Desktop browser proof at 1440x900: four cloud objects rendered, all four new assets decoded at native dimensions, no broken images, no horizontal overflow, hero copy unchanged.
- Mobile browser proof at 390x844: two clouds rendered, two depth clouds hidden, no broken images, no horizontal overflow.
- Reduced-motion browser proof: media query active and all visible cloud animations compute to `none`.
- Strict review: 0 task issues / 0 blocking issues; one unrelated pre-existing Nx typecheck-target warning.
- Full verify passed with `publishValid=true`.

## improvements noticed

- The prior PNG-signature regression correctly caught the stale/corrupt dither assets again. Keeping that guard continues to pay off.

## errors i ran into

- First build attempt failed with `astro: command not found` in the fresh task worktree. Recovered with `bun install --cwd packages/consuelo-dialer-website --frozen-lockfile`; it changed no tracked dependency files.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/consuelo-dialer-website/src/components/home/HomeHero.astro`
- `packages/consuelo-dialer-website/src/pages/index.astro`
- `packages/consuelo-dialer-website/tests/dialer-landing.test.mjs`

## workspace-owned: files changed

- `packages/consuelo-dialer-website/src/components/visuals/CloudField.astro`

## workspace-owned: activity log

- 2026-09-23 01:21:59 fs.write: `packages/consuelo-dialer-website/src/components/visuals/CloudField.astro`

- 2026-09-23 01:22:09 apply-patch: `packages/consuelo-dialer-website/src/components/home/HomeHero.astro`

- 2026-09-23 01:24:20 apply-patch: `.task/dialer/integrate-generated-cloud-assets-into-dialer-landing/workpad.md`

## workspace-owned: validation evidence

- 2026-09-23 01:24:34 `review.run`: passed — OK
- 2026-09-23 01:24:41 `verify`: passed — OK

- 2026-09-23 01:24:47 apply-patch: `.task/dialer/integrate-generated-cloud-assets-into-dialer-landing/workpad.md`
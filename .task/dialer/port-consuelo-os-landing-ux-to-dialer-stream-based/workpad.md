# Port Consuelo OS landing UX to Dialer stream based

branch: `task/dialer/port-consuelo-os-landing-ux-to-dialer-stream-based`
stream: `stream/dialer`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2546/port-consuelo-os-landing-ux-to-dialer-stream-based
github pr: https://github.com/consuelohq/opensaas/pull/2546
started: 2026-09-23

## acceptance criteria

- [x] Use the canonical Consuelo OS landing page as the UX source of truth instead of redesigning the Dialer page independently.
- [x] Port the canonical hero typography/spacing and one-button CTA composition; remove secondary CTA, arrows, and proof line.
- [x] Use the OS casing hierarchy: title-case hero plus uppercase CTA/UI/feature labels and titles.
- [x] Port the preview notice, blue preview band, centered CONSUELO DIALER / MEMBER? SIGN IN identity, and large FEATURES heading.
- [x] Remove the added Early Product Preview / sales-phone header / early-access control / What the Dialer Does / Phone Layer hierarchy.
- [x] Port the canonical final reveal spacing, button sizing, version/signature treatment, and footer metadata without the illustration.
- [x] Keep desktop/mobile free of horizontal overflow and broken assets.
- [x] Refresh the Tailnet preview and publish only the Dialer-site delta into stream/dialer.

## plan

1. Start from stream/dialer and preserve the focused red contract.
2. Transfer the OS-derived Dialer implementation through workspace fs tools.
3. Restore the four corrupt Dialer dither assets from the valid canonical copies.
4. Run focused tests, Astro check/build, desktop/mobile browser smoke, review, and verify.
5. Publish task -> stream/dialer and clean up the superseded main-based task.

## current status

- Implementation complete and browser-verified; ready for final review/verify and publish.

## files changed

- `packages/consuelo-dialer-website/src/components/home/HomeCloudCta.astro`
- `packages/consuelo-dialer-website/src/components/home/HomeFaq.astro`
- `packages/consuelo-dialer-website/src/components/home/HomeFeaturePreview.astro`
- `packages/consuelo-dialer-website/src/components/home/HomeHero.astro`
- `packages/consuelo-dialer-website/src/components/home/PreviewNotice.astro`
- `packages/consuelo-dialer-website/src/data/home-content.ts`
- `packages/consuelo-dialer-website/src/pages/index.astro`
- `packages/consuelo-dialer-website/tests/dialer-landing.test.mjs`

## workspace-owned: files changed

- `packages/consuelo-dialer-website/src/components/home/HomeCloudCta.astro`
- `packages/consuelo-dialer-website/src/components/home/HomeFaq.astro`
- `packages/consuelo-dialer-website/src/components/home/HomeFeaturePreview.astro`
- `packages/consuelo-dialer-website/src/components/home/HomeHero.astro`
- `packages/consuelo-dialer-website/src/components/home/PreviewNotice.astro`
- `packages/consuelo-dialer-website/src/data/home-content.ts`
- `packages/consuelo-dialer-website/src/pages/index.astro`
- `packages/consuelo-dialer-website/tests/dialer-landing.test.mjs`

## workspace-owned: activity log

- 2026-09-23 00:40:02 fs.write: `.task/dialer/port-consuelo-os-landing-ux-to-dialer-stream-based/workpad.md`
- 2026-09-23 00:40:23 fs.write: `packages/consuelo-dialer-website/tests/dialer-landing.test.mjs`
- 2026-09-23 00:40:40 fs.write: `packages/consuelo-dialer-website/src/components/home/HomeHero.astro`
- 2026-09-23 00:40:41 fs.write: `packages/consuelo-dialer-website/src/components/home/HomeFeaturePreview.astro`
- 2026-09-23 00:40:41 fs.write: `packages/consuelo-dialer-website/src/components/home/PreviewNotice.astro`
- 2026-09-23 00:40:41 fs.write: `packages/consuelo-dialer-website/src/components/home/HomeCloudCta.astro`
- 2026-09-23 00:40:42 fs.write: `packages/consuelo-dialer-website/src/components/home/HomeFaq.astro`
- 2026-09-23 00:40:42 fs.write: `packages/consuelo-dialer-website/src/data/home-content.ts`
- 2026-09-23 00:40:42 fs.write: `packages/consuelo-dialer-website/src/pages/index.astro`

## workspace-owned: validation evidence

- Focused red reproduced the old two-CTA/proof-line/custom-shell state plus corrupt PNG signatures.
- Green focused contract: 9 tests, 85 assertions, 0 failures.
- Astro check/build: 0 errors, 0 warnings, 2 inherited inline-script hints.
- Tailnet desktop (1440x900): Bodoni loaded, one GET EARLY ACCESS CTA, no proof line, preview notice + CONSUELO DIALER / MEMBER? SIGN IN + FEATURES present, no old hierarchy strings, no broken images, no horizontal overflow.
- Tailnet mobile (390x844): clientWidth=scrollWidth=390, no broken images, no feature overflow.
- 2026-09-23 00:42:08 `review.run`: passed — OK
- 2026-09-23 00:43:03 `verify`: passed — OK

## key decisions

- Reuse canonical OS structure and measurements before inventing Dialer-specific layout.
- Keep Dialer-specific product content, but use canonical OS visual hierarchy and casing.
- Final reveal truthfully uses CONSUELO DIALER V0.0.1 and MIT LICENSE • 2026 from repo package metadata; no decorative illustration.
- The first task was superseded because it was created from main and polluted the stream-targeted diff with unrelated main commits. This task was created with startFrom=stream specifically to prevent that.

## notes for ko

- Preview: https://picassos-mac-mini.tail38ed59.ts.net:8767/
- Hero now matches the OS composition much more closely: one canonical-width white CTA, Bodoni display treatment, no extra proof copy or decorative arrows.
- White section now follows OS order: blue preview band + preview notice -> centered product identity/sign-in -> FEATURES -> feature stories.
- End section now follows the Consuelo Cloud spacing/metadata language without carrying over the illustration.

## improvements noticed

- The Dialer dither-cloud files were corrupt on stream. Added a test for the PNG signature of all four assets so this cannot silently regress.
- Task creation supports `startFrom: "stream"` via task.start; use that for future stream-targeted tasks instead of starting from main and manually merging the stream.

## issues and recovery

- Fresh worktree needed `bun install --cwd packages/consuelo-dialer-website --frozen-lockfile` before Astro was available; no tracked dependency files changed.
- Superseded task #2545 was intentionally not published after review exposed unrelated main commits in its diff. Replacement task #2546 starts directly from stream/dialer.

---

## publish checklist

```bash
bun run task:push -- --message "type(dialer): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: the Dialer homepage follows the canonical Consuelo OS landing-page composition for hero actions, preview transition, feature identity/header, and final CTA/footer metadata while retaining Dialer-specific content.
existing local pattern: packages/consuelo-dialer-website/tests/dialer-landing.test.mjs is the source/content contract; browser smoke is used for rendered layout, overflow, fonts, and asset proof. Canonical reference components live under packages/consuelo-website/src/components/home.
new or changed tests: assert the hero proof/secondary CTA are gone; a Dialer preview notice exists; the white feature shell contains CONSUELO DIALER / MEMBER? SIGN IN / FEATURES and excludes the added early-access/product-layer hierarchy; the final CTA carries Dialer version/footer metadata without the illustration; cloud assets have valid PNG signatures.
focused red command: bun test packages/consuelo-dialer-website/tests/dialer-landing.test.mjs
expected red failure: stream baseline still contains the two hero CTAs + proof line, custom feature header/early-access controls, lacks the OS-style preview notice/identity structure, and uses the independent Dialer final section.
no-test waiver: not applicable.

## transfer note

This replacement task was intentionally started with startFrom=stream because the first task was created from main and therefore carried unrelated main commits into a stream-targeted diff. The implementation is being transferred unchanged through workspace fs tools before publish.

- 2026-09-23 00:40:02 append: `.task/dialer/port-consuelo-os-landing-ux-to-dialer-stream-based/workpad.md`

- 2026-09-23 00:40:23 write: `packages/consuelo-dialer-website/tests/dialer-landing.test.mjs`

- 2026-09-23 00:40:40 write: `packages/consuelo-dialer-website/src/components/home/HomeHero.astro`

- 2026-09-23 00:40:40 write: `packages/consuelo-dialer-website/src/components/home/HomeFeaturePreview.astro`

- 2026-09-23 00:40:41 write: `packages/consuelo-dialer-website/src/components/home/PreviewNotice.astro`

- 2026-09-23 00:40:41 write: `packages/consuelo-dialer-website/src/components/home/HomeCloudCta.astro`

- 2026-09-23 00:40:42 write: `packages/consuelo-dialer-website/src/components/home/HomeFaq.astro`

- 2026-09-23 00:40:42 write: `packages/consuelo-dialer-website/src/data/home-content.ts`

- 2026-09-23 00:40:42 write: `packages/consuelo-dialer-website/src/pages/index.astro`

## workspace-owned: files read

- none yet

- 2026-09-23 00:41:57 apply-patch: `.task/dialer/port-consuelo-os-landing-ux-to-dialer-stream-based/workpad.md`

# refine docs landing hero and CTA layout

branch: `task/documentation/refine-docs-landing-hero-and-cta-layout`
stream: `stream/documentation`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1952/refine-docs-landing-hero-and-cta-layout
github pr: https://github.com/consuelohq/opensaas/pull/1952
started: 2026-08-14

## acceptance criteria

- [x] Remove the visible `CONSUELO OS DOCUMENTATION` kicker from the docs home hero.
- [x] Change the docs home hero to `Digital workers built on Consuelo` and force the intended two-line composition: `Digital workers` / `built on Consuelo` without horizontal overflow on phone or tablet.
- [x] Change the home CTA layout to the compact Vercel-like wrapped button row: primary `Get started` and secondary actions flow naturally instead of making the primary action full-width on mobile.
- [x] Preserve the existing warm editorial palette, current fonts, install command treatment, responsive docs navigation, and automatic translation behavior.
- [x] Add deterministic source/browser regression coverage for the exact hero copy, removed kicker, two-line geometry, and mobile CTA row layout.
- [x] Pass focused docs tests, rendered browser validation, strict review, and full verify before promotion to `stream/documentation`.

## plan

1. Extend the existing foundation and browser contracts first, then capture the expected red failure.
2. Simplify the home hero markup in `PageTitle.astro`, change the home frontmatter title, and update the responsive CTA/hero CSS without touching fonts or the broader docs shell.
3. Run the focused test green, then the rendered mobile/tablet browser check and broader documentation validation.
4. Inspect the diff, run strict review/full verify, push the task, and promote it into the documentation stream.

## Test-first contract

- Behavior under test: the home hero has no documentation kicker; its accessible heading is `Digital workers built on Consuelo`; the heading renders as exactly two explicit line spans; phone/tablet layouts do not overflow; and the mobile CTA layout places `Get started` beside `Connect an agent` with `Browse tools` wrapping naturally below instead of making the primary CTA full-width.
- Existing local pattern: `packages/documentation/tests/foundation.test.ts` owns source/style contracts and `packages/documentation/scripts/test-foundation-browser.mjs` owns responsive geometry/overflow checks.
- New or changed tests: extend those two existing contracts only.
- Focused red command: `bun run --cwd packages/documentation test:foundation`.
- Expected red failure: current source still contains `docs-home-kicker`, renders one `{title}` node instead of two explicit title-line spans, keeps the old frontmatter title, and the phone CSS forces the primary CTA across both grid columns.
- No-test waiver: none; this is responsive UI behavior.

## current status

- Discovery is complete. The requested behavior is owned by `PageTitle.astro`, `src/content/docs/index.mdx`, and the home CTA/hero rules in `src/styles/docs.css`; the existing foundation and browser tests are the correct regression surfaces.
- Test-first red captured with `bun run --cwd packages/documentation test:foundation`: 14 passed / 1 failed. The failure is the intended source contract showing the legacy kicker, old title rendering, and full-width mobile primary CTA are still present. Trace: `trc_bdb26fb7ee57`.
- Implementation is complete. The hero now renders exactly `Digital workers` / `built on Consuelo`, the documentation kicker is removed, and the CTAs use the compact wrapped flex layout instead of a full-width primary row on phones.
- Focused green: `bun run --cwd packages/documentation test:foundation` passes 15/15 tests with 434 expectations. Trace: `trc_80941cd6d503`.
- Clean isolated browser validation passes at tablet and phone sizes with zero horizontal overflow, the exact two hero lines, no legacy kicker, the intended CTA row/wrap geometry, working install-copy behavior, and automatic Spanish translation. Trace: `trc_342facc12947`.
- Workspace browser verification against the same isolated dev server confirms a 402px phone viewport renders `Digital workers` and `built on Consuelo` as two non-overflowing lines; `Get started` and `Connect an agent` share the first row and `Browse tools` wraps below; document overflow is 0. Browser screenshot: `/tmp/opensaas-screenshots/127.0.0.1-2026-08-14T09-32-51.png`. Traces: `trc_b89af7c6be04`, `trc_9d15d1edddc1`.
- Documentation validator passes all 105 selected pages and the isolated production build completes with 117 indexed HTML files. Trace: `trc_96501d4863ae`.
- Strict review against `origin/stream/documentation` passes with 0 owned issues, 0 blockers, and 0 documentation opportunities. Trace: `trc_cb5c846d613d`.
- Full verify against `origin/stream/documentation` passes with `publishValid: true`. Trace: `trc_7661ee6301c4`.

## files changed

- `packages/documentation/src/components/PageTitle.astro`
- `packages/documentation/src/content/docs/index.mdx`
- `packages/documentation/tests/foundation.test.ts`
- `packages/documentation/scripts/test-foundation-browser.mjs`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-08-14 09:34:15 `review.run`: passed — OK
- 2026-08-14 09:34:25 `verify`: passed — OK
- 2026-08-14 09:35:19 `verify`: passed — OK

## key decisions

- Use explicit title line spans rather than relying on viewport-dependent natural wrapping. That preserves the requested two-line composition across device widths.
- Keep the existing three CTA labels/targets; only change their responsive layout so it follows the compact wrapped Vercel pattern.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- The first post-implementation foundation run still failed because the new source assertion looked for the home-title CSS in global `docs.css`, but those rules correctly live in the scoped `PageTitle.astro` style block. Updated the assertion to inspect the owning component instead; no production change was needed. Trace: `trc_2cc400920ebf`.
- Direct browser validation in the task worktree reproduced the existing Astro compile-metadata failure caused by the documentation `node_modules` symlink resolving into the main checkout. Trace: `trc_b72426b7eb65`. Recovery used an isolated copy of `packages/documentation` with its own frozen Bun install plus the generated OS tool manifest; that browser run is green. The first isolated `validate` attempt also lacked the root `package.json`; copying that read-only root contract into the temp verification tree resolved it. Trace: `trc_3423d9ebcf70`.

---

## publish checklist

```bash
bun run task:push -- --message "type(documentation): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/documentation/README.md`
- `packages/documentation/package.json`
- `packages/documentation/scripts/lib/documentation-browser-test.mjs`
- `packages/documentation/scripts/test-foundation-browser.mjs`
- `packages/documentation/scripts/validate-documentation.mjs`
- `packages/documentation/src/components/PageTitle.astro`
- `packages/documentation/src/content/docs/index.mdx`
- `packages/documentation/src/styles/docs.css`
- `packages/documentation/tests/foundation.test.ts`
- `packages/os/skills/task/SKILL.md`

- 2026-08-14 09:33:55 apply-patch: `.task/documentation/refine-docs-landing-hero-and-cta-layout/workpad.md`

- 2026-08-14 09:34:40 apply-patch: `.task/documentation/refine-docs-landing-hero-and-cta-layout/workpad.md`


## Acceptance criteria

- Version the deployed footer artwork URL so browsers with the previous 4-hour cached PNG fetch the newly cleaned image immediately.
- Do not change the illustration, layout, typography, or generator output itself.
- Preserve the existing generated asset path semantics apart from a deterministic cache-busting query.
- Validate the focused source contract, website build, main promotion, production deploy, and live iPad-rendered image pixels.

## Test-first contract

- Change type: one-line asset URL/cache-key change.
- Use the existing homepage responsive source-contract test to require a versioned `holding-world-editorial.png` URL before editing the component.
- Red command: `bun test tests/homepage-responsive.test.mjs`; expected failure is the new versioned-URL assertion against the current unversioned source.
- Green validation: rerun that focused suite, production build, review, verify, then live browser pixel sampling.

## Current status

- Root cause confirmed from prior task: origin serves the cleaned image, but the page references an unchanged URL with `Cache-Control: public, max-age=14400, must-revalidate`, so an existing browser can keep the old artwork for four hours.

## workspace-owned: files read

- `packages/consuelo-website/src/components/home/HomeCloudCta.astro`
- `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`
- `packages/consuelo-website/tests/homepage-responsive.test.mjs`

- 2026-08-10 01:14:26 apply-patch: `packages/consuelo-website/tests/homepage-responsive.test.mjs`
## Final validation

- Product change: `HomeCloudCta.astro` now requests `/generated/holding-world-editorial.png?v=20260810-white-fill`, forcing browsers that cached the old unversioned PNG to fetch the cleaned deployment immediately.
- Contract updates: both homepage source/integration assertions expect the versioned URL. A stale `your true assistant` assertion discovered in the responsive suite was corrected to the already-shipped `your digital worker` copy; no product copy changed in this task.
- Red evidence: before the component edit, the new cache-key assertion failed as intended.
- Green evidence: `bun test tests/homepage-responsive.test.mjs` passes 8/8; production `bun run --cwd packages/consuelo-website build` passes with Astro 0 errors / 0 warnings / 24 existing hints and 24 pages built.
- Pre-existing issue: the broader `homepage-mobile-layout.test.mjs` integration test fails earlier at its unchanged hero font-size assertion (line 137), before reaching the footer `artSrc` assertion. This task does not alter hero sizing; the footer source contract is covered by the green responsive suite and production build.
- Next: review/verify, merge through `stream/website`, production Cloudflare deploy, then fresh iPad DOM/pixel verification on the normal versioned URL.

- 2026-08-10 01:15:14 append: `.task/website/bust-cloud-footer-artwork-cache/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-10 01:15:14 fs.write: `.task/website/bust-cloud-footer-artwork-cache/workpad.md`

## workspace-owned: validation evidence

- 2026-08-10 01:15:42 `review.run`: passed — OK
- 2026-08-10 01:15:42 `review.run`: passed — OK
- 2026-08-10 01:15:53 `verify`: passed — OK

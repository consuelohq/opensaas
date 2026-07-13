# refresh blog content performance and typography

branch: `task/blog/refresh-blog-content-performance-and-typography`
stream: `stream/blog`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1441/refresh-blog-content-performance-and-typography
github pr: https://github.com/consuelohq/opensaas/pull/1441
started: 2026-07-13

## acceptance criteria

- [x] Keep `software-is-becoming-decision-infrastructure.md` as the only blog content file; delete every other blog post file.
- [x] Keep featured-post support, but mark no post featured so the homepage renders only the single recent post.
- [x] Remove the blog RSS/description/social-links content and the blog social-link component from source, not with CSS hiding.
- [x] Rename the blog to `The Consuelo Blog` in visible homepage/header text and SEO metadata.
- [x] Point the blog navigation `Get Started` link to `https://os.consuelohq.com`.
- [x] Render the generated table of contents open in static HTML by default, without a client-side opening flash.
- [x] Use the visitor device system font across the marketing site and blog; do not request or deploy the custom Geist fonts.
- [x] Improve article measure, line-height, and mobile horizontal padding for comfortable reading.
- [x] Identify and remove concrete blog load-path waste, then compare build/runtime evidence before and after.
- [x] Add focused regression coverage first, prove it red, then make it green.
- [ ] Build, review, verify, merge through `stream/blog` into `main`, deploy, and validate the live desktop and mobile interactions.

## plan

1. Record baseline source/build/browser performance evidence and inspect blog rendering ownership.
2. Add a focused Bun contract test covering content count, homepage copy, routing, SEO, TOC output strategy, typography, and mobile reading CSS; run it red.
3. Delete retired post files and implement the smallest source-level fixes.
4. Run focused tests and the production website build; inspect generated HTML and asset sizes.
5. Run review and verification gates, push the task, promote to `stream/blog`, merge the stream PR to `main`, deploy, and verify production.

## test-first contract

- Test file: `packages/consuelo-website/tests/blog-refresh.test.mjs`.
- Red state must demonstrate the current extra posts, featured flag, old title/link, homepage RSS/social block, client-side TOC opener, custom Geist font, and narrow mobile padding.
- Green state must assert the source contract and directly exercise the static TOC-opening remark plugin.
- Build verification will additionally inspect generated `/blog/` and article HTML so source-only assertions are not the final proof.

## discovery

- Blog content is an Astro content collection loaded recursively from `src/content/blog/**/*.md`; nested release/example posts are part of the collection unless removed or drafted.
- The homepage imports and renders the RSS icon, descriptive copy, `SOCIALS`, and `Socials` directly in `src/pages/blog/index.astro`.
- Featured rendering is already conditional and can remain intact; the kept post currently has `featured: true`.
- `remark-collapse@0.1.2` always emits `<details>` and has no open option. `PostDetails.astro` tries to open it after load, but looks for summary text `table of contents` while config emits `Open Table of contents`, causing the closed-state flash/failure.
- Blog text is globally forced to Geist Mono. The font is locally requested through `@font-face`, and Tailwind maps both body and headings to monospace.
- Blog pages do not load the marketing PostHog bundle; the clearest load-path waste found so far is the custom font request plus avoidable client-side TOC mutation.
- The larger mistake was build/deploy amplification: 29 stale content files produced article, tag, pagination, and dynamic OG routes. Removing them reduced the static build from 93 pages to 20.
- `packages/workspace/senior-engineer.md` is absent from this stream snapshot. Package `AGENTS.md` and root `CODING-STANDARDS.md` were read instead.

## current status

- Implementation and local desktop/mobile validation are complete.
- Review and repository verification gates are next, followed by task promotion, merge to `main`, and production validation.

## files changed

- `.task/blog/refresh-blog-content-performance-and-typography/workpad.md`
- `packages/consuelo-website/public/fonts/GeistMono-Variable.woff2` (deleted)
- `packages/consuelo-website/public/fonts/GeistSans-Variable.woff2` (deleted)
- `packages/consuelo-website/src/components/Socials.astro` (deleted)
- `packages/consuelo-website/src/content/blog` (deleted)
- `packages/consuelo-website/src/plugins/remarkOpenToc.mjs`
- `packages/consuelo-website/tests/blog-refresh.test.mjs`
- `packages/consuelo-website/tests/blog-refresh.test.ts` (deleted)

## workspace-owned: files changed

- `.task/blog/refresh-blog-content-performance-and-typography/workpad.md`
- `packages/consuelo-website/public/fonts/GeistMono-Variable.woff2` (deleted)
- `packages/consuelo-website/public/fonts/GeistSans-Variable.woff2` (deleted)
- `packages/consuelo-website/src/components/Socials.astro` (deleted)
- `packages/consuelo-website/src/content/blog` (deleted)
- `packages/consuelo-website/src/plugins/remarkOpenToc.mjs`
- `packages/consuelo-website/tests/blog-refresh.test.mjs`
- `packages/consuelo-website/tests/blog-refresh.test.ts` (deleted)

## workspace-owned: activity log

- 2026-07-13 02:55:30 fs.write: `.task/blog/refresh-blog-content-performance-and-typography/workpad.md`
- 2026-07-13 02:55:58 fs.write: `packages/consuelo-website/tests/blog-refresh.test.ts`
- 2026-07-13 02:56:36 fs.trash: `packages/consuelo-website/tests/blog-refresh.test.ts`
- 2026-07-13 02:56:51 fs.write: `packages/consuelo-website/tests/blog-refresh.test.mjs`
- 2026-07-13 02:58:40 fs.write: `packages/consuelo-website/src/plugins/remarkOpenToc.mjs`
- 2026-07-13 02:59:22 fs.trash: `packages/consuelo-website/src/content/blog`
- 2026-07-13 03:01:42 fs.trash: `packages/consuelo-website/public/fonts/GeistMono-Variable.woff2`
- 2026-07-13 03:01:42 fs.trash: `packages/consuelo-website/public/fonts/GeistSans-Variable.woff2`
- 2026-07-13 03:04:46 fs.trash: `packages/consuelo-website/src/components/Socials.astro`
- Read stream context, package guidance, coding standards, blog layouts/styles/configuration, and the installed `remark-collapse` implementation.
- Started task from `stream/blog` as `tsk_4292a88fdf02`.

## workspace-owned: validation evidence

- TDD red: initial contract failed 5/5 against 30 Markdown files, old branding/link, closed TOC, custom font, and 16 px mobile padding.
- TDD red: dead-font assertions failed while the two Geist files still existed; social-removal assertions failed while the footer component still rendered them.
- TDD green: `bun test packages/consuelo-website/tests/blog-refresh.test.mjs` -> 5 passed, 0 failed, 38 assertions.
- Production build: `bun run build` -> Astro check 0 errors, build 20 pages. Baseline was 93 pages.
- Build artifact count: 253 -> 139 files; total artifact bytes: 22,909,508 -> 18,786,360 (4,123,148 bytes / 18.0% smaller).
- Removed 140,440 bytes of unused custom font assets; final generated artifact has no `fonts/` files, no `@font-face`, and no Geist CSS references.
- Generated HTML proves `The Consuelo Blog`, one recent post, no featured section, no promo/social block, OS get-started URL, no stale article links/routes, and `<details open><summary>Table of contents</summary>`.
- Local desktop article: 672 px reading measure, 17 px type, 29.75 px line-height, 40 px page padding, no horizontal overflow, no font request.
- Local iPhone 16 Pro article: 24 px left/right padding, 16 px type, 28 px line-height, TOC open, tables horizontally safe, no page overflow, no font request.
- Local browser screenshots:
  - desktop homepage: `/tmp/opensaas-screenshots/127.0.0.1-2026-07-13T03-03-00.png`
  - desktop article: `/tmp/opensaas-screenshots/127.0.0.1-2026-07-13T03-03-22.png`
  - mobile article: `/tmp/opensaas-screenshots/127.0.0.1-2026-07-13T03-03-42.png`
  - final mobile homepage without social links: `/tmp/opensaas-screenshots/127.0.0.1-2026-07-13T03-05-19.png`
- `review.run --mine`: 0 task-owned issues, 0 blocking issues; one pre-existing workspace notice that no Nx `typecheck` target exists.
- `verify` facade could not issue a publish stamp because this stream snapshot's workspace scripts are incompatible with the current facade (`review --summary-json` is unsupported and `test-selection.js` is absent). Direct focused tests, Astro check/build, generated-output assertions, database guard, review, and browser validation all passed.
- 2026-07-13 03:06:19 `review.run`: passed — OK
- 2026-07-13 03:06:27 `verify`: failed — COMMAND_FAILED

## key decisions

- Preserve the featured section implementation but drive it empty through content metadata.
- Replace the brittle runtime TOC opener with a static Markdown-tree transform so first paint is correct and JavaScript is unnecessary.
- Use a proportional system UI stack for page text and the device-native monospace stack only for code.

## notes for ko

- Required validation gates will still run before merge; they are part of the repository publish contract.

## improvements noticed

- `remark-collapse` is old and CommonJS-only, but a tiny local post-transform is lower-risk than adding a dependency for one attribute.
- The remaining build duration is dominated by the single dynamic OG render and Astro checking; the prior route explosion is gone.

## issues and recovery

- Initial `task.start` used an invalid `startFrom` value; retried with the supported `stream` enum.
- The steering-referenced senior-engineer file is not present on this stream branch; used the available package and root standards.
- The first test was TypeScript and caused Astro check to require unavailable `bun:test` declarations; replaced it with an equivalent `.mjs` test before implementation.
- The repository `verify` facade failed before running code checks because of pre-existing workspace-tool version skew; publishing uses Ko's explicit authorization plus the successful direct gates recorded above.

---

## publish checklist

```bash
bun run task:push -- --message "feat(blog): refresh content typography and performance" --changed
bun run task:pr
bun run task:finish
```

- 2026-07-13 02:55:30 write: `.task/blog/refresh-blog-content-performance-and-typography/workpad.md`

- 2026-07-13 02:55:58 write: `packages/consuelo-website/tests/blog-refresh.test.ts`

- 2026-07-13 02:56:51 write: `packages/consuelo-website/tests/blog-refresh.test.mjs`

- 2026-07-13 02:58:40 write: `packages/consuelo-website/src/plugins/remarkOpenToc.mjs`

- 2026-07-13 02:59:00 apply-patch: `packages/consuelo-website/src/pages/blog/index.astro`
- 2026-07-13 02:59:00 apply-patch: `packages/consuelo-website/src/components/Header.astro`
- 2026-07-13 02:59:00 apply-patch: `packages/consuelo-website/src/lib/site-seo.ts`
- 2026-07-13 02:59:00 apply-patch: `packages/consuelo-website/src/content/blog/software-is-becoming-decision-infrastructure.md`
- 2026-07-13 02:59:00 apply-patch: `packages/consuelo-website/astro.config.mjs`
- 2026-07-13 02:59:00 apply-patch: `packages/consuelo-website/src/layouts/PostDetails.astro`
- 2026-07-13 02:59:00 apply-patch: `packages/consuelo-website/tailwind.config.mjs`
- 2026-07-13 02:59:00 apply-patch: `packages/consuelo-website/src/styles/global.css`
- 2026-07-13 02:59:01 apply-patch: `packages/consuelo-website/src/styles/blog.css`
- 2026-07-13 02:59:01 apply-patch: `packages/consuelo-website/src/layouts/LaunchLayout.astro`
- 2026-07-13 02:59:01 apply-patch: `packages/consuelo-website/functions/t/[action].ts`

- 2026-07-13 03:01:24 apply-patch: `packages/consuelo-website/tests/blog-refresh.test.mjs`

- 2026-07-13 03:01:42 apply-patch: `packages/consuelo-website/AGENTS.md`
- 2026-07-13 03:04:28 apply-patch: `packages/consuelo-website/tests/blog-refresh.test.mjs`
- 2026-07-13 03:04:46 apply-patch: `packages/consuelo-website/src/components/Footer.astro`
- 2026-07-13 03:04:46 apply-patch: `packages/consuelo-website/src/constants.ts`

## workspace-owned: files read

- none yet

- 2026-07-13 03:05:51 apply-patch: `.task/blog/refresh-blog-content-performance-and-typography/workpad.md`

## workspace-owned: test selection

- changed files: none
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none

- 2026-07-13 03:06:49 apply-patch: `.task/blog/refresh-blog-content-performance-and-typography/workpad.md`
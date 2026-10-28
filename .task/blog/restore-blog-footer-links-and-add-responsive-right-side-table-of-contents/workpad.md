# restore blog footer links and add responsive right-side table of contents

branch: `task/blog/restore-blog-footer-links-and-add-responsive-right-side-table-of-contents`
stream: `stream/blog`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1454/restore-blog-footer-links-and-add-responsive-right-side-table-of-contents
github pr: https://github.com/consuelohq/opensaas/pull/1454
started: 2026-07-13

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/consuelo-website/tests/blog-refresh.test.mjs`
- `packages/consuelo-website/tests/blog-toc-responsive.test.mjs`

## workspace-owned: files changed

- `packages/consuelo-website/tests/blog-refresh.test.mjs`
- `packages/consuelo-website/tests/blog-toc-responsive.test.mjs`

## workspace-owned: activity log

- 2026-07-13 17:01:23 fs.write: `packages/consuelo-website/tests/blog-refresh.test.mjs`
- 2026-07-13 17:04:08 fs.write: `packages/consuelo-website/tests/blog-toc-responsive.test.mjs`

## workspace-owned: validation evidence

- 2026-07-13 17:17:11 `review.run`: passed — OK
- 2026-07-13 17:17:25 `verify`: passed — OK
- 2026-07-13 17:17:54 `verify`: passed — OK

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
bun run task:push -- --message "type(blog): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: TDD red evidence

- 2026-07-13 16:58:36 `bash -lc git log --oneline -- packages/consuelo-website/src/components/Socials.astro packages/consuelo-website/src/components/Footer.astro packages/consuelo-website/src/pages/blog/index.astro | head -20 && printf '\n--- previous Socials ---\n' && git show b225c285^:packages/consuelo-website/src/components/Socials.astro 2>/dev/null || true && printf '\n--- previous Footer ---\n' && git show b225c285^:packages/consuelo-website/src/components/Footer.astro 2>/dev/null | sed -n '1,220p'`: failed exit 1 trace: `trc_1f15c56859b5`
  - output: error: Script not found "task:exec"

## workspace-owned: files read

- `packages/consuelo-website/astro.config.mjs`
- `packages/consuelo-website/package.json`
- `packages/consuelo-website/src/components/LinkButton.astro`
- `packages/consuelo-website/src/components/ShareLinks.astro`
- `packages/consuelo-website/src/components/site/LanguageSelector.astro`
- `packages/consuelo-website/tests/homepage-mobile-layout.test.mjs`

- 2026-07-13 17:08:25 apply-patch: `packages/consuelo-website/tests/blog-refresh.test.mjs`

## workspace-owned: test selection

- changed files: `.task/blog/restore-blog-footer-links-and-add-responsive-right-side-table-of-contents/current.json`, `.task/blog/restore-blog-footer-links-and-add-responsive-right-side-table-of-contents/evidence-log.json`, `.task/blog/restore-blog-footer-links-and-add-responsive-right-side-table-of-contents/read-log.json`, `.task/blog/restore-blog-footer-links-and-add-responsive-right-side-table-of-contents/session.json`, `.task/blog/restore-blog-footer-links-and-add-responsive-right-side-table-of-contents/workpad.md`, `.task/tasks/blog/restore-blog-footer-links-and-add-responsive-right-side-table-of-contents.json`, `packages/consuelo-website/astro.config.mjs`, `packages/consuelo-website/src/assets/icons/IconDiscord.svg`, `packages/consuelo-website/src/components/ArticleToc.astro`, `packages/consuelo-website/src/components/BackButton.astro`, `packages/consuelo-website/src/components/Footer.astro`, `packages/consuelo-website/src/components/Header.astro`, `packages/consuelo-website/src/components/SeoHead.astro`, `packages/consuelo-website/src/components/Socials.astro`, `packages/consuelo-website/src/constants.ts`, `packages/consuelo-website/src/content/blog/software-is-becoming-decision-infrastructure.md`, `packages/consuelo-website/src/layouts/Layout.astro`, `packages/consuelo-website/src/layouts/PostDetails.astro`, `packages/consuelo-website/src/plugins/remarkOpenToc.mjs`, `packages/consuelo-website/src/styles/blog.css`, `packages/consuelo-website/tests/blog-refresh.test.mjs`, `packages/consuelo-website/tests/blog-toc-responsive.test.mjs`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

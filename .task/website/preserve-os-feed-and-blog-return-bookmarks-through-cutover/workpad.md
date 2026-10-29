# Preserve OS feed and blog return bookmarks through cutover

branch: `task/website/preserve-os-feed-and-blog-return-bookmarks-through-cutover`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2669
started: 2026-10-29

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(website): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: legacy root RSS URL redirects to OS feed; blog post Home link returns to /about/ after visiting the mounted blog index.
existing local pattern: Pages redirect map; site base helper; BackButton sessionStorage history.
new or changed tests: extend existing public mount browser flow with blog-to-post-back interaction; source redirect contract plus real Pages preview proof.
focused red command: browser flow against current OS preview; source fixture for missing /rss.xml redirect.
expected red failure: post back link overwritten to /; legacy feed redirect absent.
no-test waiver: none.

## Scope

Address PR 2663 comments 4409007261 and 4409007267 only. Public bookmark compatibility; no authority/runtime or provider state changes. Review/full verify and stream publication, then exact-head main merge once CI/review is complete.

- 2026-10-29 05:31:25 append: `.task/website/preserve-os-feed-and-blog-return-bookmarks-through-cutover/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-29 05:31:25 fs.write: `.task/website/preserve-os-feed-and-blog-return-bookmarks-through-cutover/workpad.md`
- 2026-10-29 05:35:46 fs.write: `.task/website/preserve-os-feed-and-blog-return-bookmarks-through-cutover/workpad.md`

## Evidence

Missing feed mapping failed the focused test red. Mounted browser lifecycle reproduced stored backUrl='/' red; after fixing write/read normalization the mobile and desktop blog-to-post Home flow passes with '/about/'. Full mounted browser contract (docs/search, Markdown, media, authority redirects, sitemap, RSS channel) passes at 375px and 1440px. OS preview 5812ad5c-8ff8-4876-adc1-16c643e90dd9 contains the blog fix. Actual Pages deployment 660f51f1.consuelo-dialer-website-preview.pages.dev returns HTTP 302 from /rss.xml to the OS /about/rss.xml with redirect following disabled.

- 2026-10-29 05:35:46 append: `.task/website/preserve-os-feed-and-blog-return-bookmarks-through-cutover/workpad.md`

## workspace-owned: validation evidence

- 2026-10-29 05:37:39 `verify`: passed — OK

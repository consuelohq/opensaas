# Publish product-owned Dialer sitemaps at the primary domain

branch: `task/website/publish-product-owned-dialer-sitemaps-at-the-primary-domain`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2671
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

behavior under test: root sitemap URLs publish Dialer URLs (pricing, setup, guides), exclude callbacks/auth and OS pages, and production robots advertises the root sitemap while preview stays noindex.
existing local pattern: OS website already uses @astrojs/sitemap; Dialer has explicit production/preview site configuration.
new or changed tests: built sitemap ownership/content contract and real Pages preview HTTP/XML probe.
focused red command: built marketing sitemap contract; current preview /sitemap-index.xml wrongly redirects to OS.
expected red failure: no generated Dialer sitemap and an OS sitemap redirect.
no-test waiver: none.

## Scope

Address PR 2663 thread PRRT_kwDORPzu_c6xb0nu / comment 4409210267. Existing Dialer website only: use its package manager for the sitemap integration, remove conflicting redirects, add production robots sitemap line, exclude callback/auth paths. Keep OS /about sitemap intact and auth/runtime/provider state untouched. Review/full verify, publish/promote, resolve finding and finish approved phased activation.

- 2026-10-29 06:09:06 append: `.task/website/publish-product-owned-dialer-sitemaps-at-the-primary-domain/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-29 06:09:06 fs.write: `.task/website/publish-product-owned-dialer-sitemaps-at-the-primary-domain/workpad.md`
- 2026-10-29 06:12:59 fs.write: `.task/website/publish-product-owned-dialer-sitemaps-at-the-primary-domain/workpad.md`

## Evidence

Expected-red built contract found no root sitemap. Reused the existing locked @astrojs/sitemap integration through Bun (dependency was already present, so no package/lockfile change). Production build and all 14 delivery/release tests passed, including canonical root URLs, robots advertisement and callback/auth/OS exclusion. Preview build and the same 14 tests passed with noindex retained. Actual Pages deployment 6c34f911 serves both sitemap XML URLs with HTTP 200, no redirect, and pricing/get-started/guides entries. The OS namespace sitemap remains unchanged.

- 2026-10-29 06:12:59 append: `.task/website/publish-product-owned-dialer-sitemaps-at-the-primary-domain/workpad.md`

## workspace-owned: validation evidence

- 2026-10-29 06:14:29 `verify`: passed — OK

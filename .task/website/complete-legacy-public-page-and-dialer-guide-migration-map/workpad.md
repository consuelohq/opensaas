# Complete legacy public page and Dialer guide migration map

branch: `task/website/complete-legacy-public-page-and-dialer-guide-migration-map`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2670
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

behavior under test: every displaced static OS page remains reachable after the root cutover; old Dialer guides reach curated Dialer docs rather than unrelated OS pages.
existing local pattern: Cloudflare Pages redirect map and standalone docs legacyRedirects.
new or changed tests: derive OS-only static routes from source and require migration coverage; explicitly verify legacy Dialer guide destinations and matching Markdown URLs.
focused red command: Bun source-catalog marketing contract and legacy docs mapping tests.
expected red failure: /mercury, /tags, /features and legacy Dialer guide destinations are missing/misrouted.
no-test waiver: none.

## Scope

Address PR 2663 threads PRRT_kwDORPzu_c6xbg2_ and PRRT_kwDORPzu_c6xbg3E. Public page/doc migration only. Keep shared Dialer paths owned by Dialer, canonical auth redirects unchanged, provider callback relay intact, and all auth/runtime/provider state untouched. Verify, publish/promote, resolve fixed findings, merge exact source after CI, then activate os-mounted and dialer phases with public-only workflow targets.

- 2026-10-29 05:51:17 append: `.task/website/complete-legacy-public-page-and-dialer-guide-migration-map/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-29 05:51:17 fs.write: `.task/website/complete-legacy-public-page-and-dialer-guide-migration-map/workpad.md`
- 2026-10-29 05:59:43 fs.write: `.task/website/complete-legacy-public-page-and-dialer-guide-migration-map/workpad.md`

## Live redirect evidence and scope pressure

Source-catalog red found missing /mercury, /features, /tags and /ghl. The completed map preserves all OS-only static pages, dynamic tags/blog image prefixes and sitemap URLs; /ghl goes to current onboarding rather than the retired CRM OAuth flow. Pages preview 9904e8b3 returned expected 302 locations for tested routes. Five old Dialer guide routes and two GoHighLevel setup routes now target curated Dialer pages. Live docs HTML redirects worked, but Markdown aliases returned HTTP 200 with an HTML meta refresh. Explicit red asserted the required 308. Add declarative 308 Markdown redirects in the adapter configuration so static hosting preserves protocol semantics; use the existing normalized Markdown destination helper. No live/auth runtime changes.

## Final focused evidence

Live Pages preview 9904e8b3 passes redirects for Mercury (both slash forms), Features, tags, OG image prefix and sitemap; /ghl and /ghl/ normalize to current /get-started onboarding. Live docs preview 91b08f0a-bb45-423b-b17b-d70cce5c5d72 now returns real HTTP 308 with matching curated Markdown locations for all five retired Dialer guides. HTML aliases return 301 to curated Dialer pages. Source-derived static OS page inventory and all Markdown mapping tests pass. No production routes or authority state changed.

- 2026-10-29 05:59:43 append: `.task/website/complete-legacy-public-page-and-dialer-guide-migration-map/workpad.md`

## workspace-owned: validation evidence

- 2026-10-29 06:01:35 `verify`: passed — OK

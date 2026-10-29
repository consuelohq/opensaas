# Link website Docs directly to the Dialer documentation

branch: `task/website/link-website-docs-directly-to-the-dialer-documentation`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2674
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

## Acceptance criteria

- Every website Docs link opens https://docs.consuelohq.com/ directly on desktop and mobile.
- Contextual setup and SDK links target the corresponding real documentation pages.
- Remove the redundant /guides page and its sitemap entry. Permanently redirect /guides, /guides/, /docs and /docs/ to the canonical documentation root.
- Keep the current layout and the deployed OS/auth/backend surfaces unchanged. One sequential website task, then stream review, merge, website-only automatic deployment and live redirect/navigation checks.

## Test-first contract

behavior under test: Canonical documentation navigation and removal of the redundant guides destination.
existing local pattern: marketing-contract.test.ts verifies built public destinations/sitemaps; test-marketing-browser.mjs checks responsive navigation and real links.
new or changed tests: Update the existing delivery contract and browser navigation assertions for the canonical external docs destination and legacy redirect map. No separate unit tests for this small link correction.
focused red command: Build the unchanged website, then bun test packages/dialer-website/tests/marketing-contract.test.ts.
expected red failure: Current built pages still contain /guides links, a generated guides page, and guides sitemap entry; canonical redirects are absent.
no-test waiver: Additional standalone tests would mirror this low-impact edit; existing integration/delivery checks are sufficient.

## Current source

stream/website is synchronized with main ccffa45a4d3c9c03fc74453705afde51a4c579d9. Public phase remains dialer. Other open website tasks have separate ownership; preserve them.

- 2026-10-29 17:26:18 append: `.task/website/link-website-docs-directly-to-the-dialer-documentation/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-29 17:26:18 fs.write: `.task/website/link-website-docs-directly-to-the-dialer-documentation/workpad.md`
- 2026-10-29 17:30:52 fs.write: `.task/website/link-website-docs-directly-to-the-dialer-documentation/workpad.md`

## workspace-owned: validation evidence

- 2026-10-29 17:27:45 `review.run`: passed — OK
- 2026-10-29 17:30:34 `verify`: passed — OK

## Validation and publication

- Confirmed red: updated existing delivery tests failed on the current guides sitemap entry and old navigation (8 passed, 2 failed).
- Production Astro build passed with 0 errors/warnings; delivery tests pass 10/10 (75 assertions). No rendered /guides page or source navigation links remain; old URL references are limited to redirects and their existing delivery assertions.
- Confirmed live destination pages /, /start/, /start/install/ and /reference/sdk/ return 200 on docs.consuelohq.com.
- Strict review passed with zero blockers. Full verify completed 2026-10-29T17:30:34Z: all four website registry suites and DB guard passed, publishValid true. Browser contract checks the direct Docs href at every viewport.
- Files are scoped entirely to packages/dialer-website plus task evidence. No release workflow, OS authentication, backend, phone, or billing changes.

- 2026-10-29 17:30:52 append: `.task/website/link-website-docs-directly-to-the-dialer-documentation/workpad.md`

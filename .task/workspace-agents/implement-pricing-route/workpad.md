# implement pricing route

branch: `task/workspace-agents/implement-pricing-route`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1380/implement-pricing-route
github pr: https://github.com/consuelohq/opensaas/pull/1380
started: 2026-07-08

## acceptance criteria

- [x] Add a new `/pricing` Astro route in `packages/consuelo-website`.
- [x] Match the Hermes pricing page structure: branded full-page background, centered hero, white pricing panel, four desktop cards, stacked mobile cards.
- [x] Render the exact requested hero, panel account text, plan names, prices, subtitles, badges, image labels, and bullet copy.
- [x] Visually highlight one paid plan, using Plus as the Hermes-like highlighted plan.
- [x] Keep pricing difference focused on credits, not feature gating.
- [x] Do not wire `/pricing` into homepage, header, footer, or navigation data.
- [x] Do not add FAQs, credit explainers, billing logic, checkout logic, or long pricing sections.
- [x] Validate route structure and package build.

## plan

1. Inspect website design rules, existing marketing layout, homepage/header patterns, feature artwork placeholders, data modules, and website tests.
2. Add typed pricing copy data in `src/data/pricing-content.ts`.
3. Replace the existing `/pricing` Mercury redirect with the requested pricing page using `MarketingLayout` and `SiteHeader`, but no footer or new nav link.
4. Extend `website-structure.test.js` to protect the new route contract and ensure navigation remains untouched.
5. Run focused test, package build, browser preview checks, and review.

## Test-first contract

- Behavior under test: `/pricing` exists, uses the SEO-capable marketing layout and site header, renders the requested four-card Hermes-like pricing contract, preserves the requested image-label order, and does not add pricing to existing nav data.
- Existing local pattern followed: `packages/consuelo-website/tests/website-structure.test.js` static source assertions for route and content contracts.
- New test: `should expose the Hermes-style pricing route without wiring it into shared navigation`.
- Focused red command: `bun test packages/consuelo-website/tests/website-structure.test.js -t Hermes-style pricing route`.
- Expected red failure observed before implementation: missing `src/data/pricing-content.ts`.

## current status

- Implementation complete.
- Validation passed against route-specific test and website build.
- Browser preview confirmed desktop four-column card grid, mobile single-column stack, exact image-label order, Plus highlight, and no pricing links in header/footer.

## files changed

- `.task/tasks/workspace-agents/implement-pricing-route.json`
- `.task/workspace-agents/implement-pricing-route/current.json`
- `.task/workspace-agents/implement-pricing-route/evidence-log.json`
- `.task/workspace-agents/implement-pricing-route/read-log.json`
- `.task/workspace-agents/implement-pricing-route/session.json`
- `.task/workspace-agents/implement-pricing-route/workpad.md`
- `packages/consuelo-website/public/_redirects`
- `packages/consuelo-website/src/data/pricing-content.ts`
- `packages/consuelo-website/src/pages/pricing.astro`
- `packages/consuelo-website/tests/website-structure.test.js`

## workspace-owned: files changed

- `.task/tasks/workspace-agents/implement-pricing-route.json`
- `.task/workspace-agents/implement-pricing-route/current.json`
- `.task/workspace-agents/implement-pricing-route/evidence-log.json`
- `.task/workspace-agents/implement-pricing-route/read-log.json`
- `.task/workspace-agents/implement-pricing-route/session.json`
- `.task/workspace-agents/implement-pricing-route/workpad.md`
- `packages/consuelo-website/public/_redirects`
- `packages/consuelo-website/src/data/pricing-content.ts`
- `packages/consuelo-website/src/pages/pricing.astro`
- `packages/consuelo-website/tests/website-structure.test.js`

## workspace-owned: activity log

- 2026-07-08 23:51:26 fs.write: `.task/workspace-agents/implement-pricing-route/workpad.md`
- 2026-07-09 00:09:11 fs.write: `packages/consuelo-website/public/_redirects`
- 2026-07-09 00:29:04 fs.write: `packages/consuelo-website/public/_redirects`
- Added focused structure test for route/content/nav contract.
- Added pricing content data module.
- Built static site and verified `/pricing/index.html` generation.
- Read website design rules, tokens, primitives, marketing layout, site header, current pricing redirect, feature artwork placeholder context, site links/navigation, and structure tests.
- Replaced `/pricing` redirect route with the Hermes-style pricing page.
- Served the built `dist` locally for browser checks, captured desktop/mobile screenshots, then stopped the temporary server.
- Started task branch from `main` because the default stream was materially behind main for this isolated website route work.

## workspace-owned: validation evidence

- `bun test packages/consuelo-website/tests/website-structure.test.js -t Hermes-style pricing route` -> pass, 1 pass, 22 assertions.
- `bun --cwd packages/consuelo-website prettier --check src/pages/pricing.astro src/data/pricing-content.ts` -> pass.
- `bun run --cwd packages/consuelo-website build` -> pass; generated `/pricing/index.html`; 95 pages built.
- `browser.test http://127.0.0.1:4328/pricing/` desktop -> screenshot `/tmp/opensaas-screenshots/127.0.0.1-2026-07-08T23-47-42.png`.
- `browser.eval` desktop -> `cardCount: 4`, image labels `[NO LOCK-IN, STAYS LOCKED, READ RECEIPTS, READ RECEIPTS]`, highlighted `[Plus]`, four computed grid columns, no pricing nav links.
- `browser.test http://127.0.0.1:4328/pricing/` mobile -> screenshot `/tmp/opensaas-screenshots/127.0.0.1-2026-07-08T23-47-57.png`.
- `browser.eval` mobile -> one computed grid column, image-label order preserved.
- `review.run --base origin/main --no-tests` -> 0 issues in my changes; 1 pre-existing project typecheck note: no projects with `typecheck` target found.
- 2026-07-08 23:51:43 `verify`: passed — OK
- 2026-07-09 00:09:54 `verify`: passed — OK
- 2026-07-09 00:24:34 `verify`: passed — OK
- 2026-07-09 00:29:45 `verify`: passed — OK

## key decisions

- Kept `/pricing` routable but did not link it from homepage, header, footer, or navigation data.
- Used CSS artwork placeholders with visible labels for the pricing image slots because final pricing image assets are not in the repo.
- Highlighted Plus as the single paid highlighted plan, matching the Hermes reference structure.
- Kept the page focused: no FAQ, no credits explainer, no billing or checkout logic.
- Used `siteLinks.login` for SIGN IN and avoided changing `siteLinks.pricing` because nav wiring is intentionally out of scope.

## notes for ko

- `/pricing` now replaces the prior redirect-to-Mercury behavior with the requested pricing page.
- Local preview URL used for validation was temporary: `http://127.0.0.1:4328/pricing/`; the server was stopped after checks.

## improvements noticed

- Existing `src/pages/pricing.astro` was only a Mercury redirect. This task replaces that redirect with a real page while keeping nav untouched.

## issues and recovery

- `explore` failed during discovery, so repo discovery recovered with focused `code.call` scans and direct file reads.
- First `code.call` attempt used the example-only `codeFile` shape and failed validation; recovered by using the supported inline `code` field.
- First `fs.write` for `pricing.astro` failed because the existing redirect file already existed; recovered by reading it and overwriting with `force: true`.
- Full `website-structure.test.js` had unrelated pre-existing failures against current main expectations before implementation; validation used the focused route contract plus package build.
- Initial `review.run` against `origin/stream/workspace-agents` reported unrelated stream delta issues because this task started from `main`; reran review against `origin/main`, which found 0 issues in my changes.

---

## publish checklist

```bash
bun run task:push -- --message "feat(website): add pricing route" --changed
bun run task:pr -- --task-only
bun run task:finish
```

- 2026-07-08 23:51:26 write: `.task/workspace-agents/implement-pricing-route/workpad.md`

## workspace-owned: test selection

- changed files: `.task/workspace-agents/implement-pricing-route/workpad.md`, `packages/consuelo-website/public/_redirects`, `packages/consuelo-website/tests/website-structure.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

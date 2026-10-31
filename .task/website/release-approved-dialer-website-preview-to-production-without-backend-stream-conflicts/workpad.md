# Release approved Dialer website preview to production without backend stream conflicts

branch: `task/website/release-approved-dialer-website-preview-to-production-without-backend-stream-conflicts`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2745
started: 2026-10-31

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

## Release acceptance criteria
- Publish the current `stream/website` Dialer site (source 10163382dc1a022c6d8fcf8e28894323fc51be87) unchanged in content to the production `consuelo-website` Cloudflare Pages project, serving `consuelohq.com` and `www.consuelohq.com`.
- Keep production routing, auth, docs, OS Workers, billing backend, carrier, and unrelated stream changes untouched.
- Maintain a durable main-backed website-only release commit, avoiding conflicts between the full website stream PR #2683 and newer Dialer backend code on main.
- Confirm production indexable canonical URL, homepage, pricing, FAQ, and checkout navigation without purchases; capture deployment and rollback IDs.

## Plan
1. Snapshot the precise 70-file `packages/dialer-website` tree changes from `origin/stream/website` into this isolated main-based worktree.
2. Re-run existing package tests (38 targeted assertions suites) and Astro production build; inspect production output and compare preview contracts.
3. Review/verify changes, push the isolated task branch, open a website-only main PR and merge only on current checks. Do not promote unrelated stream/backend conflicts.
4. Verify the GitHub production release (website surface only), Cloudflare deployment ID, and browser homepage/pricing at desktop/mobile; log result in Linear.

## Test-first contract
- Behavior under test: the exact already-tested Dialer website source publishes to production with `PUBLIC_SITE_CHANNEL=production`, canonical links, production robots and functioning pricing links.
- Existing pattern: `packages/dialer-website/tests/*.test.ts`, `bun run build`, `test-marketing-browser.mjs`, `test-pricing-browser.mjs`, and deployed browser smoke.
- New or changed tests: none; this is an exact snapshot publication, not new feature code.
- No-test waiver (new red test): source is taken byte-for-byte from the already-green stream and copied as a single release unit. Creating another failing test for unchanged code would be artificial. Instead run the full website suite, production Astro build, and browser verification before and after publication. If compatibility with current main breaks, stop and add a focused failing test before editing implementation.
- Pre-cutover production Cloudflare Pages deployment: `ef3818f7-6947-4160-adf9-83ff8dc32c6f` (branch main, Pages project consuelo-website).
- User explicitly approved publishing the current launch pricing despite known outstanding DEV-1644–1647 product acceptance work. No Stripe charges or carrier calls will be initiated by this task.

- 2026-10-31 06:38:24 append: `.task/website/release-approved-dialer-website-preview-to-production-without-backend-stream-conflicts/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-10-31 06:38:24 fs.write: `.task/website/release-approved-dialer-website-preview-to-production-without-backend-stream-conflicts/workpad.md`
- 2026-10-31 06:41:44 fs.write: `.task/website/release-approved-dialer-website-preview-to-production-without-backend-stream-conflicts/workpad.md`
- 2026-10-31 06:43:12 fs.write: `.task/website/release-approved-dialer-website-preview-to-production-without-backend-stream-conflicts/workpad.md`
- 2026-10-31 06:44:27 fs.write: `.task/website/release-approved-dialer-website-preview-to-production-without-backend-stream-conflicts/workpad.md`

## Validation decision update — 2026-10-31
- Mirror of 70 website files from stream source verified in the isolated main-based task. Full production Astro build succeeds, canonical pricing `https://consuelohq.com/pricing`, robots allow indexing, 0 Astro errors/warnings (7 informational hints).
- First `bun test tests` failed because dist was absent. Built production first, then `PUBLIC_SITE_CHANNEL=production bun test tests` passed **38/38, 279 assertions**.
- Homepage Playwright verification passed eight widths 320–1440 and all interaction flows with mocked checkout. Pricing verification passed all eight widths and reached a terminal assertion expecting preview `noindex,nofollow`, although the production page correctly emits `index,follow,max-image-preview:large`.
- This is a test harness environment mismatch, not a page defect. **Additional test-first contract:** change the existing pricing browser assertion to expect the production robots value only when `PUBLIC_SITE_CHANNEL=production` and preview value otherwise. Red command already reproduced using `PUBLIC_SITE_CHANNEL=production node scripts/test-pricing-browser.mjs` (after eight passing viewport checks; failed line 459). No other page or checkout code changes. Rerun pricing browser check and full release gate after test fix.

- 2026-10-31 06:41:44 append: `.task/website/release-approved-dialer-website-preview-to-production-without-backend-stream-conflicts/workpad.md`

- 2026-10-31 06:41:47 apply-patch: `packages/dialer-website/scripts/test-pricing-browser.mjs`

## workspace-owned: validation evidence

- 2026-10-31 06:43:01 `review.run`: passed — OK
- 2026-10-31 06:44:22 `verify`: passed — OK

## Final pre-publication validation
- `PUBLIC_SITE_CHANNEL=production bun test tests`: **38 pass, 0 fail, 279 assertions** across 8 files.
- `PUBLIC_SITE_CHANNEL=production bun run build`: successful static site with 10 pages, 0 errors/warnings (7 existing informational hints); production robots `Allow: /` and sitemap/SEO canonical match `https://consuelohq.com`.
- Marketing Playwright browser: **8/8 responsive viewports pass** (320,375,430,568,667,768,1024,1440); plan setup, CTA, cloud assets, FAQ/animation lifecycle and 113 internal link checks pass; checkout fixture prevented live charges.
- Pricing Playwright: all eight viewport/layout checks passed; initial production run then red on preview-only robots assertion. Updated **only the browser test harness** to assert the correct SEO value per channel. Production pricing `--smoke` passed 375px and 1440px, team/add-on selection, simulated Stripe checkout, canceled/partial recovery, duplicate-payment prevention, keyboard, no-JS and FAQ. No external charges.
- Strict `review.run` against `origin/main`: **0 blocking issues**, 1 pre-existing Nx typecheck-target discovery notice, covered by explicit Astro check/build.
- Source remains a direct mirror of stream website package except the production/preview browser test assertion. The full stream PR #2683 remains dirty due to unrelated backend conflicts; use a main-based website-only PR for source integrity.
- Rollback snapshot is Cloudflare Pages ID `ef3818f7-6947-4160-adf9-83ff8dc32c6f`; no production mutation yet.

- 2026-10-31 06:43:12 append: `.task/website/release-approved-dialer-website-preview-to-production-without-backend-stream-conflicts/workpad.md`

## Full repository verification
`verify` (base `origin/main`) completed successfully on 2026-10-31: `passed=true`, `publishValid=true`; critical test-selection rule `dialer-website-package` ran frozen install, production/preview package build, marketing delivery tests and eight-viewport browser tests, all passed. DB guard passed with zero risks. 70 website files selected, no failing suites. Strict review has zero blocking changes; separate full production-channel package and pricing browser checks also passed. Ready for website-only main-targeted publication.

- 2026-10-31 06:44:27 append: `.task/website/release-approved-dialer-website-preview-to-production-without-backend-stream-conflicts/workpad.md`

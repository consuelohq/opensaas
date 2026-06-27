# address website review comments

branch: `task/sites/address-website-review-comments`
stream: `stream/sites`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1228/address-website-review-comments
github pr: https://github.com/consuelohq/opensaas/pull/1228
started: 2026-06-27

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-06-27 21:55:37 `review.run`: passed — OK
- 2026-06-27 21:55:43 `verify`: passed — OK

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
bun run task:push -- --message "type(sites): description" --changed
bun run task:pr
bun run task:finish
```


## Test-first contract

Behavior under test:
- Review-comment fixes preserve the structural website refactor while correcting concrete link, route, analytics, and FAQ rendering defects.
- Home FAQ answers that intentionally contain trusted markup render as HTML instead of escaped text.
- Privacy CTA routes to the local privacy page.
- GoHighLevel OAuth redirect uses the production callback host, not a transient github.dev URL.
- Mobile menu removes the desktop Docs item using the actual label case.
- Contact route uses contact-focused FAQ content rather than Mercury FAQ content.
- Privacy and device-code routes opt out of analytics, and shared analytics only initializes after explicit cookie acceptance.
- GHL redirect remains covered by the structure test as a dedicated noindex redirect using shared site links.
- Test names follow the repo's should ... when ... convention.

Existing local pattern to follow:
- Website route contracts are guarded in packages/consuelo-website/tests/website-structure.test.js.
- Static copy and links are typed data modules under src/data.
- MarketingLayout owns SeoHead, analytics bootstrapping, and the marketing page frame.

New or changed tests:
- Extend website-structure.test.js to cover CodeRabbit's actionable comments and rename existing test cases to should/when form.

Focused red command:
- bun test packages/consuelo-website/tests/website-structure.test.js

Expected red failure:
- Current code should fail on FAQ rich answer rendering, privacy CTA href, github.dev OAuth redirect, mobile Docs filtering, contact FAQ data source, analytics opt-out/consent gating, and GHL redirect coverage.


## implementation summary

- Addressed CodeRabbit actionable comments from PR #1227.
- Rendered trusted internal home FAQ answer markup with `set:html` so the GHL link is clickable.
- Pointed the homepage privacy CTA to `siteLinks.privacy`.
- Rebuilt `ghlMarketplaceUrl` from `URLSearchParams` and production `https://app.consuelohq.com/api/oauth/callback`, removing the transient github.dev callback.
- Fixed the mobile menu Docs filter to match the actual `Docs` label.
- Added `contact-content.ts` and moved contact page FAQ away from Mercury-specific FAQ copy.
- Added `analyticsEnabled` to `MarketingLayout`, opted privacy and device-code routes out, and gated PostHog init until explicit accepted consent.
- Renamed website structure tests to the repo's `should ... when ...` convention.
- Kept `/ghl` as a lean noindex meta-refresh redirect rather than putting it on `MarketingLayout`; this avoids unnecessary analytics/header/cookie chrome on an install redirect while still testing it for shared site-link usage and no launch-era import regression.

## validation evidence

- Red: `bun test packages/consuelo-website/tests/website-structure.test.js` failed before production edits on the expected review-comment contracts.
- Green: `bun test packages/consuelo-website/tests/website-structure.test.js` passed — 7 tests, 136 assertions.
- Green: `bun run --cwd packages/consuelo-website build` passed — Astro check completed with 0 errors and static build generated 94 pages.

## review comment classification

- CodeRabbit: all 8 actionable comments addressed, except the literal suggestion to put `/ghl` into the shared marketing-shell matrix; addressed with a more appropriate redirect-route contract because `/ghl` is a noindex OAuth redirect.
- CodeRabbit nitpick: addressed by renaming test cases to `should ... when ...` form.
- Codex: no Codex review comments were present on PR #1227. The PR had skipped Claude checks and a Qodo paused notice, but no actionable Codex review body/comments.

## workspace-owned: test selection

- changed files: `.task/sites/address-website-review-comments/current.json`, `.task/sites/address-website-review-comments/session.json`, `.task/sites/address-website-review-comments/workpad.md`, `.task/tasks/sites/address-website-review-comments.json`, `packages/consuelo-website/src/components/home/HomeFaq.astro`, `packages/consuelo-website/src/data/contact-content.ts`, `packages/consuelo-website/src/data/home-content.ts`, `packages/consuelo-website/src/data/site-links.ts`, `packages/consuelo-website/src/data/site-navigation.ts`, `packages/consuelo-website/src/layouts/MarketingLayout.astro`, `packages/consuelo-website/src/pages/contact.astro`, `packages/consuelo-website/src/pages/login/device.astro`, `packages/consuelo-website/src/pages/privacy.astro`, `packages/consuelo-website/tests/website-structure.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

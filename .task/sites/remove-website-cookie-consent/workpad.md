# remove website cookie consent

branch: `task/sites/remove-website-cookie-consent`
stream: `stream/sites`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1230/remove-website-cookie-consent
github pr: https://github.com/consuelohq/opensaas/pull/1230
started: 2026-06-27

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/consuelo-website/src/components/CookieConsent.tsx` (deleted)
- `packages/consuelo-website/src/components/ui/Toast.astro` (deleted)

## workspace-owned: files changed

- `packages/consuelo-website/src/components/CookieConsent.tsx` (deleted)
- `packages/consuelo-website/src/components/ui/Toast.astro` (deleted)

## workspace-owned: activity log

- 2026-06-27 22:38:02 fs.trash: `packages/consuelo-website/src/components/CookieConsent.tsx`
- 2026-06-27 22:41:45 fs.trash: `packages/consuelo-website/src/components/ui/Toast.astro`

## workspace-owned: validation evidence

- 2026-06-27 22:49:37 `review.run`: passed — OK
- 2026-06-27 22:52:37 `review.run`: passed — OK
- 2026-06-27 22:52:56 `verify`: passed — OK

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
- MarketingLayout initializes PostHog by default whenever the PostHog key is configured.
- The marketing shell no longer renders or references the cookie consent banner text, accept/decline buttons, or consent localStorage key.
- Privacy and device-code pages use the default marketing analytics path instead of explicit analytics opt-outs.
- Privacy-page copy no longer claims a cookie banner, Decline action, consent-status cookies, or consent as the analytics legal basis.
- The old React CookieConsent component is removed if it is unused.

Existing local pattern to follow:
- Website route and shell contracts live in packages/consuelo-website/tests/website-structure.test.js.
- MarketingLayout owns SeoHead, analytics bootstrapping, and the global public-site frame.
- Privacy policy copy is inline in src/pages/privacy.astro.

New or changed tests:
- Update website-structure.test.js to assert analytics initializes by default and no consent screen artifacts remain.

Focused red command:
- bun test packages/consuelo-website/tests/website-structure.test.js

Expected red failure:
- Current code should fail because MarketingLayout gates PostHog on consuelo-cookie-consent, renders the banner text, privacy/device routes pass analyticsEnabled={false}, and privacy copy still references the banner/Decline flow.


## implementation summary

- Removed the inline cookie consent banner from `MarketingLayout.astro`.
- Removed the `analyticsEnabled` opt-out prop and initialized PostHog by default whenever `posthogKey` is configured.
- Removed the previous localStorage consent gate and declined-consent opt-out path.
- Removed `analyticsEnabled={false}` from privacy and login/device routes.
- Updated privacy copy so it no longer claims there is a cookie banner, Decline flow, consent-status cookie, or consent-gated analytics behavior.
- Removed unused cookie consent surfaces: `src/components/CookieConsent.tsx` and `src/components/ui/Toast.astro`.
- Removed unused `optOut` helper from `src/lib/analytics.ts`.
- Updated `website-structure.test.js` to lock the default-on analytics behavior and absence of consent-banner artifacts.

## validation evidence

- Red: `bun test packages/consuelo-website/tests/website-structure.test.js` failed before production edits because consent gating and banner artifacts still existed.
- Green: `bun test packages/consuelo-website/tests/website-structure.test.js` passed — 7 tests, 146 assertions.
- Green: residue scan passed — no source references remain for `CookieConsent`, `consuelo-cookie-consent`, `cookie-banner`, `analyticsEnabled`, `optOut(`, the banner text, or stale banner/Decline/consent-status privacy copy.
- Green: `bun run --cwd packages/consuelo-website build` passed — Astro check completed with 0 errors and static build generated 94 pages.

## notes for ko

- PostHog now initializes by default on marketing-layout pages when configured.
- The device-code page is also back on the default marketing layout. That means pageview URLs behave like other marketing pages again; this matches the requested default-on analytics posture.
- The privacy page now says users can control analytics storage through browser controls rather than through an on-site banner.

## workspace-owned: test selection

- changed files: `.task/sites/remove-website-cookie-consent/current.json`, `.task/sites/remove-website-cookie-consent/session.json`, `.task/sites/remove-website-cookie-consent/workpad.md`, `.task/tasks/sites/remove-website-cookie-consent.json`, `packages/consuelo-website/src/components/CookieConsent.tsx`, `packages/consuelo-website/src/components/ui/Toast.astro`, `packages/consuelo-website/src/layouts/MarketingLayout.astro`, `packages/consuelo-website/src/layouts/SiteLayout.astro`, `packages/consuelo-website/src/lib/analytics.ts`, `packages/consuelo-website/src/pages/login/device.astro`, `packages/consuelo-website/src/pages/privacy.astro`, `packages/consuelo-website/tests/website-structure.test.js`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional


## final validation gates

- `review.run`: passed with 0 issues from this change. One pre-existing workspace finding remains: no project with an nx `typecheck` target.
- `verify`: passed and wrote a publish-valid stamp.
- Fixed the review finding in `src/lib/analytics.ts` by typing the global PostHog client instead of using `window as any`.

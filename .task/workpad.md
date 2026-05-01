# polish launch motion backgrounds and mobile menu

branch: `task/website/polish-launch-motion-backgrounds-and-mobile-menu`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/255
started: 2026-05-01

## acceptance criteria

- [x] Source branch includes the deployed GSAP launch website changes and DashboardDemo ReactElement build fix.
- [x] Hero GIF media loads after the tab/link snippet block begins its reveal, not during the initial text reveal.
- [x] Hero GIF frame background is transparent and avoids the gray panel/border feel.
- [x] Silver glint flash is removed from nav, announcement, links, FAQ, buttons, stats, footer, and Mercury UI.
- [x] SVG/chart hover uses tracing/draw motion instead of a silver mask.
- [x] FAQ items use the same split-line reveal base and keep open/close animation.
- [x] Mercury hosted calling sections use the normal transparent section style while retaining button hover transitions.
- [x] Mobile menu/sidebar links are clickable and page-section items appear in the mobile drawer.
- [x] Build passes.
- [x] Browser verification covers desktop home, desktop Mercury, and mobile menu.

## plan

1. Rehydrate task branch with the currently deployed GSAP website source so this task does not regress the live launch work.
2. Remove glint tokens from interactive surfaces and keep only transition-based hover states.
3. Defer hero media GIF src/srcset assignment until the demo/media timeline point.
4. Make hero/stat media backgrounds transparent and attach hover motion to chart tracing.
5. Add FAQ split-line wrappers and improve mobile drawer page-section links.
6. Validate with website build, browser smoke, deploy, then publish source.

## files changed

- `packages/consuelo-website/bun.lock`
- `packages/consuelo-website/package.json`
- `packages/consuelo-website/src/components/DashboardDemo.tsx`
- `packages/consuelo-website/src/components/scripts/LaunchGsapMotion.astro`
- `packages/consuelo-website/src/lib/launch-motion.ts`
- `packages/consuelo-website/src/components/launch/LaunchFaq.astro`
- `packages/consuelo-website/src/components/launch/LaunchFooter.astro`
- `packages/consuelo-website/src/components/launch/LaunchHeader.astro`
- `packages/consuelo-website/src/components/launch/LaunchHero.astro`
- `packages/consuelo-website/src/components/launch/LaunchMercuryPromo.astro`
- `packages/consuelo-website/src/components/launch/LaunchOverview.astro`
- `packages/consuelo-website/src/components/launch/LaunchPrivacy.astro`
- `packages/consuelo-website/src/components/launch/LaunchStats.astro`
- `packages/consuelo-website/src/layouts/LaunchLayout.astro`
- `packages/consuelo-website/src/pages/mercury.astro`

## key decisions

- The remote `stream/website` ref was stale relative to the previously deployed PR 251 code, so this task starts from stream and restores the deployed website package before applying polish fixes.
- Removed live `silver-glint` data-motion tokens from markup instead of tuning glint speed; ko wants transitions and SVG tracing, not the flat silver mask.
- Deferred hero GIF loading by storing GIF URLs in data attributes and assigning src/srcset from the GSAP media reveal timeline.
- Added mobile page-section links inside the drawer and hid the sticky mobile page nav so the sidebar/drawer owns mobile navigation.

## notes for ko

- Live production deploy is Cloudflare Pages main: `https://cb21d5f9.consuelo-website.pages.dev`.
- The DashboardDemo ReactElement fix from the previous live deploy is now in this task branch source.
- Remaining review failure is pre-existing workspace tooling: no Nx project with `typecheck` target found. Review reports `0 yours`.

## improvements noticed

- `@tailwindcss/typography` is still duplicated in the website package manifest. Bun warns, but it is unrelated to this motion polish.

## validation

- `cd packages/consuelo-website && bun install --frozen-lockfile && bun run build` passed.
- `bun run review -- --base origin/stream/website --no-tests --quiet` returned `0 yours`, `1 pre-existing` Nx typecheck target issue.
- Deployed with `bun run website:deploy -- --skip-build`.
- `curl -I -L https://consuelohq.com` returned HTTP/2 200.
- `curl -I -L https://consuelohq.com/mercury/` returned HTTP/2 200.
- Browser verified desktop homepage screenshot: `/tmp/opensaas-screenshots/consuelohq.com-2026-05-01T03-14-14.png`.
- Browser verified Mercury screenshot: `/tmp/opensaas-screenshots/consuelohq.com-2026-05-01T03-14-23.png`.
- Browser verified mobile menu screenshot: `/tmp/opensaas-screenshots/consuelohq.com-2026-05-01T03-15-21.png`.
- Mobile drawer opens and shows `mobile navigation` plus `mobile page navigation` with Intro / What is Consuelo? / Proof / Privacy / FAQ / Mercury / Waitlist.
- Browser errors and console checks returned no output.

- 2026-05-01 03:21:06 write: `.task/workpad.md`
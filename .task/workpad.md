# gsap motion system and homepage delight

branch: `task/website/gsap-motion-system-and-homepage-delight`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/251
started: 2026-05-01

## acceptance criteria

- [x] GSAP is the animation layer for homepage and mercury.
- [x] No new animation package is introduced beyond GSAP unless required by GSAP integration.
- [x] Global motion init is centralized, reusable, and data-attribute driven.
- [x] Homepage hero uses masked line reveal on load.
- [x] Overview and mercury content use scroll-triggered line/section reveal.
- [x] Proof/stats/chart visuals use draw-path/bar-draw/count-up style motion.
- [x] Product screenshot frame gets silver scanline/glint and subtle commit-square twinkles.
- [x] Header nav/mobile menu/anchor scroll are GSAP-driven.
- [x] FAQ expand/collapse is animated with GSAP.
- [x] Mercury mirrors homepage motion primitives.
- [x] Reduced motion disables scrub/smooth/looping effects and uses instant or simple opacity reveal.
- [x] Mobile scroll and anchor navigation remain usable.
- [x] Black/white theme remains dominant with restrained silver glints.
- [x] Build passes.
- [x] Browser verification covers desktop and mobile.

## plan

1. Read repo standards, launch/mercury files, and official GSAP skill docs.
2. Add GSAP dependency only if missing.
3. Add centralized launch motion entrypoint and data-motion hooks across launch components.
4. Implement guarded GSAP timelines, ScrollTrigger reveals, glints, FAQ, nav, tabs, stats, and mercury primitives.
5. Validate with build/review and browser checks where available.
6. Push through task workflow for review.

## files changed

- `packages/consuelo-website/package.json`
- `packages/consuelo-website/bun.lock`
- `packages/consuelo-website/src/components/scripts/LaunchGsapMotion.astro`
- `packages/consuelo-website/src/lib/launch-motion.ts`
- `packages/consuelo-website/src/layouts/LaunchLayout.astro`
- `packages/consuelo-website/src/components/launch/LaunchHeader.astro`
- `packages/consuelo-website/src/components/launch/LaunchHero.astro`
- `packages/consuelo-website/src/components/launch/LaunchOverview.astro`
- `packages/consuelo-website/src/components/launch/LaunchStats.astro`
- `packages/consuelo-website/src/components/launch/LaunchPrivacy.astro`
- `packages/consuelo-website/src/components/launch/LaunchFaq.astro`
- `packages/consuelo-website/src/components/launch/LaunchMercuryPromo.astro`
- `packages/consuelo-website/src/components/launch/LaunchFooter.astro`
- `packages/consuelo-website/src/pages/mercury.astro`

## key decisions

- Use one shared launch motion module loaded from `LaunchLayout.astro`, with Astro markup exposing `data-motion` hooks.
- Use GSAP public package guidance from GreenSock skills: core, timeline, ScrollTrigger, plugins, performance, utilities, and framework cleanup.
- `workspace stream.sync` failed because `origin/stream/website` was missing; `task.start` bootstrapped `stream/website` from main and opened PR 251.

## notes for ko

- The uploaded handoff is the task spec and visual direction.
- The missing `design` skill was checked in the skill catalog and no readable skill resource exists.

## improvements noticed

- Mercury hero copy had a trailing `.,`; fixed while adding motion hooks.
- Existing package manifest has duplicate `@tailwindcss/typography`; Bun warned during `bun add`, but this task did not change that unrelated duplication.
- Raw shell was used once for a large multi-file patch and Playwright smoke because the exposed workspace connector only provides `sandbox_exec`; typed task commands were used for normal reads/build/review.

## validation

- `cd packages/consuelo-website && bun run build` passed. Existing warnings/hints only.
- Workspace review: `YOUR CHANGES: clean`; command exits nonzero due pre-existing stream issue: no Nx project with `typecheck` target.
- Preview smoke: `/` and `/mercury/` returned 200.
- Playwright smoke passed for desktop/mobile home + mercury, including tab click, FAQ click, mobile menu open, and scroll.

## errors i ran into

- `workspace stream.sync '{"area":"website"}'` returned `origin/stream/website is missing`; task creation handled stream bootstrap.

---

## publish checklist

```bash
workspace task.push '{"branch":"task/website/gsap-motion-system-and-homepage-delight","message":"feat(website): add gsap launch motion system","changed":true}'
workspace task.pr '{"branch":"task/website/gsap-motion-system-and-homepage-delight"}'
workspace task.finish '{"branch":"task/website/gsap-motion-system-and-homepage-delight"}'
```

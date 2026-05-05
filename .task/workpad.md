# fix mobile proof svg trigger timing

branch: `task/website/fix-mobile-proof-svg-trigger-timing`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/329
started: 2026-05-05

## acceptance criteria

- [x] Wave/joyplot proof SVG no longer starts from the whole proof section trigger.
- [x] Bar chart animation waits for the bar chart card/viewport position on mobile.
- [x] Square grid animation waits for the square chart card/viewport position on mobile.
- [x] Square grid animation is visibly animated, not only a subtle opacity fade.
- [x] Ambient loop remains chart-local and starts only after that chart finishes its draw.
- [x] Reduced motion still shows the final state immediately.
- [x] No global scroll hijack, scrub, pinning, or mobile drawer behavior changes.
- [x] `cd packages/consuelo-website && bun run build` passes.
- [x] `workspace review.run` passes against `stream/website`.
- [x] Website deploy runs before push.
- [ ] Stream review PR is created/refreshed for ko.

## plan

1. Keep the existing proof SVG visual design and hero boot untouched.
2. Replace the single proof-section ScrollTrigger with per-chart ScrollTriggers.
3. Make the mobile trigger later and based on each chart root, not the parent stats section.
4. Add square scale animation so the heatmap reads as animating when it enters.
5. Validate build, review, deploy, then publish into the stream review PR.

## files changed

- pending

## key decisions

- Root cause: the prior implementation gathered every path/bar/square in `section` and played one timeline from `trigger: section`; on mobile the stacked lower charts had already animated before they reached the viewport.
- Fix: select `.launch-stats__chart[data-motion="svg-grid"]` roots and build an independent timeline + `ScrollTrigger` per chart.
- Mobile trigger is `start: 'top 72%'` on each chart root. Desktop uses `top 70%`.
- Square grid now starts at `scale: 0.42` plus low opacity and animates to final opacity/scale when its own card enters, preserving the existing 0.1/0.4/0.8 negative-space final states.
- Added `transform-box`/`transform-origin` for square SVG rects so scale happens around each square center.

## notes for ko

- This directly addresses the mobile review: bar and square no longer share the wave chart's trigger.
- The wave should now also feel later because its own chart top must reach the mobile threshold.
- Public host check after deploy returned HTTP 200 and found 414 `svg-square` markers.
- Direct Pages deploy URL returned by deploy: `https://552e91af.consuelo-website.pages.dev`.

## improvements noticed

- The browser facade still reports `about:blank` in this session, so source/build/deploy/curl checks remain more reliable than its screenshots for this website.
- Website package lockfiles remain out of sync with package.json; `npm install --no-package-lock --no-save` is still needed to hydrate package-local validation without staging lock changes.

## errors i ran into

- `workspace fs.patch` rejected a multiline CSS patch; used a task-scoped Python edit instead.
- First build failed with `astro: command not found`; hydrated package-local dependencies with `npm install --no-package-lock --no-save` and reran the exact build command.

---

## validation log

- `cd packages/consuelo-website && bun run build` — passed after dependency hydration; existing warnings only.
- `workspace review.run '{"branch":"task/website/fix-mobile-proof-svg-trigger-timing","base":"stream/website","noTests":true}'` — passed.
- `bun run website:deploy` — passed; deploy URL `https://552e91af.consuelo-website.pages.dev`.
- `curl -I https://consuelohq.com` — HTTP 200.
- `curl -sL https://consuelohq.com` — found 414 `svg-square` markers.

## publish checklist

```bash
bun run task:push -- --message "fix(website): tune mobile proof svg triggers" --changed
bun run task:pr
bun run task:finish
```

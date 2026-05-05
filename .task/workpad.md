# svg draw proof motion only

branch: `task/website/svg-draw-proof-motion-only`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/327
started: 2026-05-05

## acceptance criteria

- [x] Phase 1 hero boot remains intact.
- [x] Only SVG/proof/data visual motion is added.
- [x] Stats/proof SVG draws on viewport entry.
- [x] Joyplot lines draw with layered depth.
- [x] Bars grow from baseline with tasteful stagger.
- [x] Square grid preserves negative space and does not end fully filled.
- [x] Ambient loop keeps the SVG mostly present and only subtly redraws/glints the last ~10%.
- [x] Reduced motion skips animation and shows final state.
- [x] Mobile remains native-scroll only with no pin/scrub/global scroll handling.
- [x] `cd packages/consuelo-website && bun run build` passes.
- [x] `workspace review.run` passes against `stream/website`.
- [x] Website deploy runs before push.
- [x] Browser screenshot command is captured after deploy.
- [ ] Mobile visual viewport check: browser facade does not expose viewport command in this session.
- [ ] Stream review PR is created/refreshed for ko.

## plan

1. Preserve Phase 1 hero boot code and avoid hero markup/choreography changes.
2. Add meaningful data-motion hooks to `LaunchStats.astro` SVG path, bar, square, and section elements only.
3. Extend `motion.ts` with a scoped proof SVG setup that waits until the hero is stable/idle, uses ScrollTrigger once for initial reveal, then starts a low-intensity ambient loop.
4. Wire the proof SVG motion boot after the existing hero boot call.
5. Validate with website build, workspace review, deploy, and browser screenshot.

## files changed

- `.task/current.json`
- `.task/evidence-log.json`
- `.task/read-log.json`
- `.task/workpad.md`
- `.task/tasks/website/svg-draw-proof-motion-only.json`
- `packages/consuelo-website/src/components/launch/LaunchStats.astro`
- `packages/consuelo-website/src/lib/motion.ts`
- `packages/consuelo-website/src/pages/index.astro`

## key decisions

- Treat `LaunchStats.astro` as the proof/data SVG area because homepage renders it with `sectionId="proof"`.
- Keep hero boot markup and choreography untouched; new proof motion is initialized from a separate exported function.
- Delay proof setup by 720ms plus idle/RAF and use only section-scoped ScrollTrigger so below-fold work does not run during hero boot.
- Use existing deterministic SVG data for final square opacity. The heatmap ends with 0.1, 0.4, and 0.8 opacity groups instead of all squares fully filled.
- Keep mobile simple: no scrub, no pinning, no smoother, no scroll hijack.

## notes for ko

- Animated section: homepage `LaunchStats` proof area (`sectionId="proof"`, `data-motion-section="proof-svg"`).
- Animated visuals: joyplot polylines (`data-motion="svg-path"`), heatmap squares (`data-motion="svg-square"`), and thin bars (`data-motion="svg-bar"`).
- Deployment returned `https://1778cb52.consuelo-website.pages.dev`, but that direct Pages URL is Cloudflare Access protected. Public `https://consuelohq.com` returned HTTP 200 and contains the new `proof-svg` and `svg-path` markup.
- Browser facade opened `consuelohq.com` and screenshot command produced `/tmp/opensaas-screenshots/phase-2-svg-proof-home-2026-05-05T22-38-03.png`, but the browser open payload reported `about:blank`. Curl verified public HTML instead.
- `browser.viewport` is not available in this workspace session, so Ko should inspect mobile manually after deploy.

## improvements noticed

- Decision engine state initially contained stale prior validation evidence, so implementation evidence came from explicit reads plus required validation gates.
- Website package lockfiles are out of sync with `package.json`; `astro` was unavailable until dependencies were hydrated with `npm install --no-package-lock --no-save`.

## errors i ran into

- Initial package-level `packages/consuelo-website/AGENTS.md` read failed because the file does not exist.
- First build failed with `astro: command not found` because package dependencies were not installed in the task worktree.
- `bun install --frozen-lockfile` and `npm ci` failed due existing lockfile/package mismatch (`gsap` missing from npm lock and Bun lock wanted changes). Used `npm install --no-package-lock --no-save` for local validation only; no lockfile changes are staged.
- `workspace confirm '{"verify":true}'` timed out after review/build/deploy had already passed.
- Browser facade returned `about:blank` for both `https://consuelohq.com` and the direct Pages URL, despite command success and screenshot output.

---

## validation log

- `cd packages/consuelo-website && bun run build` — passed after local dependency hydration; existing warnings only.
- `workspace review.run '{"branch":"task/website/svg-draw-proof-motion-only","base":"stream/website","noTests":true}'` — passed.
- `bun run website:deploy` — passed; deploy URL `https://1778cb52.consuelo-website.pages.dev`.
- `curl -I https://consuelohq.com` — HTTP 200.
- `curl -sL https://consuelohq.com` — found `proof-svg` and 28 `data-motion="svg-path"` markers.
- `workspace browser.screenshot '{"name":"phase-2-svg-proof-home","full":true}'` — produced `/tmp/opensaas-screenshots/phase-2-svg-proof-home-2026-05-05T22-38-03.png`.

## publish checklist

```bash
bun run task:push -- --message "feat(website): add svg proof draw motion" --changed
bun run task:pr
bun run task:finish
```

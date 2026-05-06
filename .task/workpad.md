# restore square heatmap svg only

branch: `task/website/restore-square-heatmap-svg-only`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/333
started: 2026-05-05

## acceptance criteria

- [x] Only the proof SVG/data visual animation is touched.
- [x] Square proof graphic remains a 23x18 heatmap grid.
- [x] Each square remains 4x4, spaced by 7px.
- [x] Deterministic pseudo-random opacity plus center-distance boost remains in `LaunchStats.astro`.
- [x] Final opacity buckets remain 0.1, 0.4, and 0.8.
- [x] Every square starts at `opacity = restingOpacity * 0.12` and `scale = 0.42`.
- [x] SVG squares use `transform-box: fill-box` and `transform-origin: 50% 50%`.
- [x] Dim/mid/bright square groups animate to scale 1 with center-based stagger and grid [18, 23].
- [x] Dim starts at 0, mid at 0.08, bright at 0.14.
- [x] Ambient loop runs after draw on only a small mid/bright subset, about 10% max.
- [x] Ambient pulse goes to scale 1.08 and opacity +0.18 capped at 0.92, then returns to rest.
- [x] Wave and bar motion are not redesigned.
- [x] Build passes.
- [x] Workspace review passes.
- [x] Website deploy runs from this worktree before publish.
- [x] Wait after deploy and verify production.
- [ ] Task branch is pushed/promoted.
- [ ] Task worktree is cleaned up after merge proof.

## plan

1. Start task from `stream/website` and preserve the existing square heatmap implementation.
2. Read relevant launch stats/motion files and keep the scope to proof SVG only.
3. Remove unused helper leftovers from the square heatmap implementation.
4. Validate build and review.
5. Deploy from this task worktree before push.
6. Wait for deployment propagation, verify production, push, promote to stream review PR, and finish cleanup.

## files changed

- `packages/consuelo-website/src/lib/motion.ts`
- `.task/workpad.md`

## key decisions

- Current `stream/website` already contains the intended square heatmap bloom from the earlier square task, including heatmap metadata, center-based stagger, and ambient square breathing.
- This task keeps that implementation and only removes two unused helper leftovers in `motion.ts`.
- No hero, copy, mobile drawer, wave, or bar redesign is in scope.

## notes for ko

- I found an already-open empty task PR #330 with the same intent; I started the requested new task branch as #333 and kept this one focused.
- The visual behavior is still the original liked effect: center-out square bloom into sparse heatmap, then a small subset of active cells softly pulse.
- Deployed from this task worktree before push: `https://e6128dec.consuelo-website.pages.dev`.

## improvements noticed

- The website package still often needs dependency hydration in fresh worktrees before `bun run build`.

## errors i ran into

- First attempt to remove unused helpers removed required helper lines as well; I restored `getChartSquares` and `getHeatmapGrid`, then reread the range and inspected the diff.
- Empty `fs.patch` content is rejected; used a temp content file.
- Initial build failed with `astro: command not found`; fixed by `npm install --no-package-lock --no-save` in the package.

---

## wait plan

Wait reason: Cloudflare Pages production propagation after worktree deploy.
Duration: 30 seconds.
Resume action: run `curl -I https://consuelohq.com` and browser open for `https://consuelohq.com`.
Expected signal: HTTP 200 and browser page loads without errors.
Fallback: if missing, wait once more or stop with deploy evidence.

## validation log

- `cd packages/consuelo-website && bun run build` — first attempt failed because `astro` was missing.
- `cd packages/consuelo-website && npm install --no-package-lock --no-save && bun run build` — passed with existing warnings.
- `workspace review.run '{"branch":"task/website/restore-square-heatmap-svg-only","base":"stream/website","noTests":true}'` — passed; review reported 0 yours and one pre-existing Nx typecheck-target note.
- `bun run website:deploy` from task worktree — passed; deploy `https://e6128dec.consuelo-website.pages.dev`.
- Waited 30 seconds after deploy.
- `curl -I -L https://consuelohq.com` — HTTP/2 200.
- `workspace browser.open '{"url":"https://consuelohq.com","full":true}'` — loaded homepage and captured `/tmp/opensaas-screenshots/consuelohq.com-2026-05-05T23-59-19.png`.
- `workspace browser.raw '{"args":["errors"]}'` — clean.
- `workspace browser.raw '{"args":["console"]}'` — clean.

## publish checklist

```bash
bun run task:push -- --message "fix(website): restore square heatmap svg motion" --changed
bun run task:pr
bun run task:finish
```
- 2026-05-05 23:55:50 patch lines 1-45: `.task/workpad.md`
- 2026-05-06 00:01:19 patch lines 1-86: `.task/workpad.md`
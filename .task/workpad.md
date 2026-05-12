# tune digital eguide reader shell motion

branch: `task/workspace-agents/tune-digital-eguide-reader-shell-motion`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/376
started: 2026-05-12

## acceptance criteria

- [x] Tune ScrollSmoother motion so the shell uses medium desktop smoothing and stronger touch smoothing.
- [x] Increase tap-to-read movement from 45vh to 88vh.
- [x] Animate tap navigation with custom GSAP tweening against `smoother.scrollTop` using `power3.inOut`.
- [x] Add a subtle bottom-right back-to-top affordance after the reader scrolls beyond the first page section.
- [x] Patch the existing Prospect Theory artifact to test the behavior live.

## research notes

- GSAP ScrollSmoother uses native scroll and moves the content with transforms; fixed controls should live outside the smoother wrapper.
- `smooth` controls catch-up duration in seconds.
- `smoothTouch` defaults to no smoothing on touch; specifying a short number enables touch smoothing without making the swipe feel too disconnected.
- `normalizeScroll: true` helps with mobile address bar resize/synchronization and iOS jitter behaviors.
- ScrollSmoother `scrollTo` can jump or use configured smoothing; custom animation should tween `smoother.scrollTop` for a controlled duration/ease.

## files changed

- `packages/consuelo-design/templates/digital-eguides/reader-shell.md`
- `packages/consuelo-design/templates/digital-eguides/README.md`

## key decisions

- Keep ScrollSmoother native-scroll architecture.
- Use `smooth: 0.65` and `smoothTouch: 0.28` as a more controlled baseline.
- Use `normalizeScroll: true` to reduce mobile viewport/address-bar jitter.
- Make tap-to-read nearly one viewport with `88vh`, then animate with `power3.inOut` over `0.95s` so the movement is visible.
- Add a transparent back-to-top control outside the smoother wrapper, marked `data-no-tap-scroll`.

## validation

- Direct dry-run contains `smooth: 0.65`, `smoothTouch: 0.28`, `normalizeScroll: true`, `88vh`, `reader-back-to-top`, `power3.inOut`, and `ScrollTrigger.maxScroll(window)`.
- `consuelo-design check --json` passed.
- `git diff --check` passed.
- Live Prospect Theory artifact was patched and served through the existing Tailscale direct URL.
- `curl` direct artifact returned `200 text/html` and included `research-shell-v2`, `reader-back-to-top`, `0.88`, `power3.inOut`, `normalizeScroll: true`, and the Prospect Theory title.
- Browser verification confirmed `window.__readerShell.version === "research-shell-v2"`, ScrollSmoother is active, `smooth() === 0.65`, and the back-to-top button exists.
- Right-side tap moved from `0` to `557`, matching `0.88 * viewport height` in the test viewport.
- Back-to-top became visible after scrolling, then clicking it returned the page to `0` and hid the button.

## notes for ko

- The live Prospect Theory artifact is patched now.
- Future generated e-guides will get the tuned reader-shell instructions from the template once this PR lands.

## improvements noticed

- A future deterministic wrapper tool could apply the reader shell to an existing artifact without hand-patching HTML, but the current requested behavior can be achieved through the template and Open Design operator flow.

## errors i ran into

- `explore` returned unrelated website/docs chunks for this narrow template change, so file/context evidence was collected directly from the known reader shell template and prior workpad.
- 2026-05-12 06:58:11 patch lines 1-45: `.task/workpad.md`

## durable Tailscale archive follow-up

- Changed `design.publish` so local file and directory targets are materialized under the Open Design archive before Tailscale Serve registration.
- Archive artifact files now live under `.od/consuelo/archive/artifacts/<published-path>/index.html`.
- Tailscale Serve routes artifact paths to the managed archive server on port `53935`, not directly to a local file path or one-off temporary HTTP server.
- The archive server serves `/design-wiki` and artifact paths through the same tailnet server.
- Archive entries now store `sourceTarget` and `artifactPath` so the original source and durable archived copy are both visible.
- Added a `/__health` endpoint to the archive server so startup does not depend on the wiki HTML already existing.

## durable Tailscale archive validation

- Fake Tailscale publish with a local HTML file passed.
- Verified `design.publish` returns target `http://127.0.0.1:53935` for the artifact route.
- Verified archive JSON stores `sourceTarget: /tmp/durable-artifact.html`.
- Verified archive JSON stores `artifactPath: artifacts/daily/durable-artifact/index.html`.
- Verified the copied artifact exists under the archive.
- Verified the managed archive server serves both `/design-wiki` and `/daily/durable-artifact`.
- `bun --check packages/workspace/scripts/consuelo-design.ts` passed.
- `bun --check packages/workspace/scripts/lib/facade/schemas.ts` passed.
- `bun run generate-docs` passed.
- `bun run generate-types` passed.
- `git diff --check` passed.
- Added archive-server compatibility probing: `ensureArchiveServer` now treats either `/__health` or an existing `/design-wiki` response as a live archive server, so a previously running archive server on port 53935 does not cause a duplicate-spawn failure.
- Re-ran fake Tailscale durable publish after this change; it passed and served wiki + artifact from the managed archive server.

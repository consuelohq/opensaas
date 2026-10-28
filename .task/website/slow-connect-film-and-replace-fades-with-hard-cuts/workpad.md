# slow connect film and replace fades with hard cuts

branch: `task/website/slow-connect-film-and-replace-fades-with-hard-cuts`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2351
started: 2026-09-01

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

## Acceptance criteria

- Replace the current inter-agent crossfades with straight editorial cuts; no dissolves, wipes, flashes, or full-frame transition cards between ChatGPT, Grok, Codex, and OpenCode.
- Give each agent an establishing beat before the answer/token stream starts so a first-time viewer can identify the interface and label before activity begins.
- Slow the overall film enough to read as evidence rather than a montage, while keeping the loop compact enough for homepage use.
- Keep Ko's real recordings as the only product footage; do not reconstruct UI or fake output.
- Keep the surface tag and sequence metadata stable at the beginning of each scene instead of animating/fading them in over the footage.
- Preserve the existing intro/outro editorial language, responsive website playback, and reduced-motion poster fallback.
- Publish only to `stream/website`; do not merge the website stream to main or deploy production.

## Plan

1. Inspect the current HyperFrames composition and deterministic source timing from the previous fade pass.
2. Recut each proxy to a longer start/establishing beat plus a readable answer beat.
3. Remove video/overlay opacity crossfades and use non-overlapping scene timings for true hard cuts.
4. Hold overlays stable from the first scene frame; retain only restrained motion inside the intro/outro.
5. Render/inspect boundaries, verify final media and website playback, then review/verify/promote to `stream/website`.

## Test-first contract

behavior under test: subjective editorial pacing and transition grammar for real screen-recording footage. The failure is perceptual: crossfades blend two dense interfaces and the current 0.75s establishing beat does not provide enough orientation before token activity.
existing local pattern: `motion/connect/source-timing.json` is the reproducible timing contract; HyperFrames render/check plus rendered boundary-frame inspection and browser playback are the deterministic validation gates.
new or changed tests: none required unless the website media/data contract changes. This iteration changes only the motion composition/timing and rendered media.
focused red command: not applicable to subjective transition quality; current source contract itself records the undesired `interAgentFade: 0.3` and `startBeatDuration: 0.75` state.
expected red failure: current composition contains GSAP opacity fades on every agent video/overlay and overlapping scene windows.
no-test waiver: visual-only media recut. Compensate with source-timing assertions, HyperFrames validation/render, ffprobe, boundary-frame inspection, website build, and live browser playback/reduced-motion verification.

- 2026-09-01 00:01:41 append: `.task/website/slow-connect-film-and-replace-fades-with-hard-cuts/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-01 00:01:41 fs.write: `.task/website/slow-connect-film-and-replace-fades-with-hard-cuts/workpad.md`
- 2026-09-01 00:08:43 fs.write: `.task/website/slow-connect-film-and-replace-fades-with-hard-cuts/workpad.md`
- 2026-09-01 00:19:45 fs.write: `.task/website/slow-connect-film-and-replace-fades-with-hard-cuts/workpad.md`

## Implementation and validation

- Replaced the 0.30s inter-agent crossfades with true non-overlapping scene cuts. The composition no longer animates video/overlay opacity at agent boundaries, and the intro/result cards also cut directly into/out of product footage.
- Increased each agent's establishing/start beat from 0.75s to 1.25s and the answer beat from 2.75s to 3.05s. Each agent scene is now 4.30s instead of 3.50s.
- Overall film duration increased from 15.8s to 20.95s. Scene boundaries are 1.45 / 5.75 / 10.05 / 14.35 / 18.65 seconds, with no overlap between adjacent product clips.
- Surface tag, capture note, and sequence strip are stable from the first frame of each agent scene rather than fading/sliding in over the footage. Intro/outro retain their internal editorial motion only.
- Rebuilt all four local proxies from Ko's untouched recordings using accurate post-input seeking, normalized to 2032x1192 / 30fps. Each proxy probes at 4.30s.
- HyperFrames check passes with 0 runtime/layout/motion errors and 13/13 contrast checks; the existing non-blocking dense-track maintainability warning remains. Trace: `trc_741ad3c04a02`.
- HyperFrames rendered the revised film successfully at 2032x1192 / 30fps / 20.97s, ~1.68 MB. Render trace: `trc_894d900c7018`.
- Website MP4 now uses that render; SHA-256 `46fd8ceb7b7fb47ce837b72faa733c7011887af0ee81682dd7514630dbccdfea`.
- Poster now comes from 0.70s into the first ChatGPT establishing beat (global t=2.15s), before the answer/token jump, rather than from the busy response portion. Poster is valid WebP 2032x1192; SHA-256 `92eea7f6e0002b46bbdc5e39257734a3a26a01d86730ea0eb97c26f2c682d2e0`.
- Focused CONNECT website structure contract passes 1/1 with 44 assertions. Trace: `trc_aad75e67bfcc`.
- Production website build passes after adding the same ignored task-local website `node_modules` symlink used by prior website media tasks: Astro 0 errors / 0 warnings / 24 existing hints, 24 pages built. Trace: `trc_4cc3b77f3675`.
- Task website preview at `http://127.0.0.1:4324/` loads the new 20.966667s media, readyState 4, 2032x1192, autoplaying with no media error. Trace: `trc_cea128182c79`.
- Reduced-motion verification still hides video and shows the calm updated poster. Trace: `trc_4989bcd639fa`.

## Errors / recovery

- The first proxy pass used input-side ffmpeg seeking and exposed a VFR timestamp edge case on OpenCode (14.6s output instead of ~4.3s). Rebuilt all proxies with accurate post-input seeking; all now probe at the intended 4.30s.
- Initial website build could not resolve the package-local `astro` binary because task bootstrap does not link `packages/consuelo-website/node_modules`. Added an ignored symlink to the main checkout's existing package dependencies and the build passed.
- HyperFrames Studio preview injected `data-hf-id` attributes/formatting and generated preview thumbnails into the editable source tree. After visual inspection, restored `index.html` and `source-timing.json` from `origin/stream/website`, reapplied only the intended timing/hard-cut edits deterministically, removed generated thumbnails/renders, and stopped the background Studio preview. The public MP4 had already been rendered from the clean pre-Studio composition.

- 2026-09-01 00:08:43 append: `.task/website/slow-connect-film-and-replace-fades-with-hard-cuts/workpad.md`

## workspace-owned: validation evidence

- 2026-09-01 00:15:54 `review.run`: passed — OK
- 2026-09-01 00:15:55 `review.run`: passed — OK
- 2026-09-01 00:18:57 `verify`: passed — OK

## Final gates

- Strict mine-only review: 0 task-owned issues, 0 blockers. The first review call hit a transient upstream 502; the single retry completed successfully. Review trace: `trc_6c85c7197386`.
- Full task verifier: passed, publish-valid, 4 intended product files, 0 task-owned review findings, 0 DB risks. Verify trace: `trc_7ec0a5453c35`.
- Binary publish guard: do not use `task.push` for this task. A prior CONNECT media task demonstrated that the GitHub-API task publish path can transform binary MP4/WebP bytes. Commit and push this task through normal Git binary transport from the scoped task worktree, then use the normal `task.pr` promotion lifecycle and verify the remote stream blobs byte-for-byte afterward.

- 2026-09-01 00:19:45 append: `.task/website/slow-connect-film-and-replace-fades-with-hard-cuts/workpad.md`

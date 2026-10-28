# refine connect evidence film pacing and transitions

branch: `task/website/refine-connect-evidence-film-pacing-and-transitions`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2348
started: 2026-08-31

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/consuelo-website/motion/connect/source-timing.json`

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

- [ ] Keep the existing opening and closing editorial cards substantially intact.
- [ ] Remove the opaque blue sliding interstitials between agent scenes; transitions between ChatGPT, Grok, Codex, and OpenCode should read as soft dissolves/fades.
- [ ] Remove the full-frame blue border/bar around the real screen recordings while preserving the useful editorial outlines on labels/sequence metadata.
- [ ] For each agent, show a brief authentic start beat, cut out most waiting/thinking time, then show the real answer/token stream long enough to register the final output.
- [ ] Do not invent or reconstruct agent UI/output; all agent scenes must come from Ko's real recordings.
- [ ] Keep the website's existing CONNECT feature copy/agent list unless the footage itself requires a truthful metadata correction.
- [ ] Validate the revised composition, final media, responsive website playback, and reduced-motion poster before promoting to stream/website.

## Plan

1. Probe the four raw recording durations and sample late-response windows to locate the real answer/token-stream portions.
2. Recut each source into a short start beat plus a late answer beat, preserving the raw recording geometry.
3. Replace opaque wipe interstitials with restrained crossfades and remove the scene-frame blue bar while retaining editorial labels/outlines.
4. Render and inspect key snapshots plus the full film; iterate timing if the answer output is not legible.
5. Replace website MP4/poster, run focused website/build/HyperFrames checks, verify browser playback on desktop/tablet/phone/reduced-motion, then publish to stream/website only.

## Test-first contract

behavior under test: subjective editorial pacing/transition treatment of real screen-recording footage; no deterministic unit test can prove that token-stream beats are visually legible or that the fade feels correct.
existing local pattern: website structure contract already verifies CONNECT media presence and truthful four-agent sequence; HyperFrames check/snapshot and browser playback are the deterministic visual/runtime gates.
new or changed tests: none required unless implementation changes the website media/data contract.
focused red command: not applicable for the visual-only recut.
expected red failure: not applicable.
no-test waiver: approved for the visual-only film recut; compensate with raw-source timing evidence, HyperFrames check + snapshots, final ffprobe, production website build, and responsive/reduced-motion browser verification.

- 2026-08-31 23:25:15 append: `.task/website/refine-connect-evidence-film-pacing-and-transitions/workpad.md`

## workspace-owned: files changed

- `packages/consuelo-website/motion/connect/source-timing.json`

## workspace-owned: activity log

- 2026-08-31 23:25:15 fs.write: `.task/website/refine-connect-evidence-film-pacing-and-transitions/workpad.md`
- 2026-08-31 23:27:19 write: `packages/consuelo-website/motion/connect/source-timing.json`
- 2026-08-31 23:27:19 fs.write: `packages/consuelo-website/motion/connect/source-timing.json`
- 2026-08-31 23:32:41 fs.write: `.task/website/refine-connect-evidence-film-pacing-and-transitions/workpad.md`
- 2026-08-31 23:40:52 fs.write: `.task/website/refine-connect-evidence-film-pacing-and-transitions/workpad.md`

## workspace-owned: files read

- `packages/os/skills/browser/SKILL.md`

## Implementation and validation

- Recut each real recording into a 0.75s start beat plus a 2.75s answer beat, removing the long waiting/thinking middle. Answer anchors were chosen from the raw masters by probing the actual token/output onset: ChatGPT 19.55s, Grok 25.85s, Codex 18.75s, OpenCode 10.95s.
- The four normalized local proxies are 2032x1192 / 30fps / 3.5s each. The internal skip from start beat to answer beat is a direct editorial cut; no fake/reconstructed UI is used.
- Removed the opaque blue transition-wipe system entirely. Agent scenes now overlap by 0.30s and crossfade with GSAP opacity fades. The intro and outro remain, with the intro dissolving into ChatGPT and OpenCode dissolving into the result card.
- Removed the 12px blue full-frame scene border and its edge bars. The smaller label, capture-note, and sequence-strip outlines remain.
- Updated source timing contract in `motion/connect/source-timing.json` so the recut is reproducible from Ko's untouched Desktop masters.
- HyperFrames check passes: runtime 0 issues, layout 0 issues, contrast 13/13; one non-blocking timeline-density maintainability warning remains for the four overlay clips. Trace: `trc_5903a21dcf41`.
- Final HyperFrames render: 15.8s, H.264, 2032x1192, 30fps, ~3.5MB. Render trace: `trc_7c8eb380d004`.
- Rendered-output OCR verifies the response portion is actually visible for ChatGPT, Grok, Codex, and OpenCode rather than only their thinking/waiting states. Main proof trace: `trc_6c32d8d0bf5e`; OpenCode late-answer proof: `trc_3b9a4c852652`.
- Rendered transition sampling shows no brand-blue fullscreen frame or blue edge bar at the inter-agent fade points; blue fraction at 4.20s / 7.40s / 10.60s / 13.80s is 0.000 with edge-blue 0.000. The blue result card remains intentionally blue. Trace: `trc_02c38221cfa4`.
- Website MP4 replaced with the revised 15.8s render. SHA-256: `308f1753947eb9e41ff453920f5b0141e7738ec481b64d78b71e83d55792e944`. New poster is derived from the ChatGPT answer beat; SHA-256: `1e8edca97e4ca070cbe72a3924d4020d77ea53e112f33625ff7e1680a443cc11`. Probe trace: `trc_7c8e9e8d5508`.
- Focused CONNECT structure contract passes: 1 pass / 19 filtered / 0 fail. The first combined test/build attempt failed only because the task worktree lacked package-local `node_modules`; the focused test itself passed. Trace: `trc_2807ddafcc1e`.
- Recovery: added an ignored task-local `packages/consuelo-website/node_modules` symlink to the main checkout's existing website dependencies; no dependency files changed. Production website build then passed with Astro 0 errors / 0 warnings / 24 existing hints and all 24 pages built. Trace: `trc_578173985474`.
- Browser verification on the task worktree at `127.0.0.1:4324`: desktop loads the new 15.8s video at 2032x1192, readyState 4, autoplaying, no media error, zero horizontal overflow. Trace: `trc_5d9ad517f162`. Mobile 402x874 also has zero horizontal overflow and the same 1.7048 media ratio, with active playback and no error. Trace: `trc_e089b5549bfe`.
- Reduced-motion verification still hides the video and keeps the updated poster visible. Trace: `trc_1866ea9b63e8`.
- Desktop screenshot evidence: `/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-screenshots/connect-film-refined-desktop-2026-08-31T23-32-11.png`.

## Errors / recovery

- `fs.apply-patch` is not present in this task manifest, so the composition edit was performed through task-scoped `code.call` with exact-string assertions.
- First composition edit attempt intentionally aborted before write because an assertion expected eight `data-duration="3.50"` occurrences while only four had been replaced; reran with per-selector expected counts and wrote only after all assertions passed.
- First HyperFrames check caught overlap errors because crossfading adjacent overlay text created simultaneous labels. Fixed by crossfading only the recordings while ending each overlay exactly when the next overlay begins; the next check passed with zero layout issues.
- FFmpeg on this machine lacks `libwebp`; poster generation recovered by extracting a PNG frame with ffmpeg and encoding WebP through the website's existing `sharp` dependency.

- 2026-08-31 23:32:41 append: `.task/website/refine-connect-evidence-film-pacing-and-transitions/workpad.md`

## workspace-owned: validation evidence

- 2026-08-31 23:38:14 `review.run`: passed — OK
- 2026-08-31 23:38:14 `review.run`: passed — OK
- 2026-08-31 23:40:45 `verify`: passed — OK
- 2026-08-31 23:40:45 `verify`: passed — OK
- 2026-08-31 23:40:56 `verify`: passed — OK

## Final gates

- Strict mine-only review completed with 0 task-owned issues and 0 blockers; reported findings are unrelated pre-existing repo lint/typecheck debt. The first review attempt timed out at 120s; one retry with the normal extended task timeout completed successfully. Review trace: `trc_a73033530e30` (timeout trace: `trc_edc701a0042b`).
- Full verifier passed and is publish-valid: 4 product files in scope, 0 task-owned review issues, 0 DB risks. Trace: `trc_735578f3d712`.

- 2026-08-31 23:40:52 append: `.task/website/refine-connect-evidence-film-pacing-and-transitions/workpad.md`

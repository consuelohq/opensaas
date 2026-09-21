# finish connect four-agent film

branch: `task/website/finish-connect-four-agent-film`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2346
started: 2026-08-31

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- `packages/consuelo-website/motion/connect/.gitignore`
- `packages/consuelo-website/motion/connect/index.html`
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

## workspace-owned: files read

- `packages/consuelo-design/upstream/open-design/prompt-templates/video/hyperframes-saas-product-promo-30s.json`
- `packages/consuelo-website/DESIGN.md`
- `packages/consuelo-website/scripts/generate-footer-art.ts`
- `packages/consuelo-website/src/data/home-content.ts`
- `packages/consuelo-website/tests/website-structure.test.js`

## Acceptance criteria

- [ ] CONNECT uses the four real recordings Ko made: ChatGPT, Grok, Codex, and OpenCode.
- [ ] Each agent scene starts just before the first visible response/tool activity so the sequence feels synchronized rather than showing dead setup time.
- [ ] The final film is an authored HyperFrames composition, not a raw concatenation: Consuelo blue/white editorial system, restrained figure/run metadata, and consistent editorial transitions around real product footage.
- [ ] The film stays legible and compelling without audio; no generated product UI, fake telemetry, sci-fi HUDs, circuitry, or unrelated decorative imagery.
- [ ] The website evidence sequence truthfully labels ChatGPT / Grok / Codex / OpenCode while the broader CONNECT copy may continue to mention Claude as a supported surface.
- [ ] The final website MP4 and poster are valid web media, reduced-motion still resolves to the poster, and desktop/tablet/phone layouts remain overflow-free.
- [ ] Publish to `stream/website` only. Do not merge the stream to main or deploy production.

## Plan

1. Lock the truthful four-agent content contract in the existing CONNECT structure test and prove it red against the current Claude/Cursor sequence.
2. Prepare a source-first HyperFrames composition using the four untouched Desktop recordings as local inputs; use a 2032x1192 canvas and normalize the 2030px recordings without distortion.
3. Trim each source to the response/tool-activity moment, add the editorial figure/run layer, and render a ~14-16 second muted film plus poster.
4. Replace the existing CONNECT MP4/poster and update only the evidence sequence labels needed to match the film.
5. Run HyperFrames/media QA, focused website test/build, and browser verification including reduced motion.
6. Review/verify and promote to `stream/website`; preserve binary bytes with the known binary-safe Git fallback rather than `task.push` for MP4/WebP.

## Test-first contract

behavior under test: the CONNECT evidence figure truthfully identifies the four agent surfaces shown in the final film and retains the existing real-media/reduced-motion contract.
existing local pattern: `packages/consuelo-website/tests/website-structure.test.js` already owns the CONNECT documentary evidence contract and exact sequence labels.
new or changed tests: update that focused CONNECT test to require ChatGPT, Grok, Codex, and OpenCode and reject stale Claude/Cursor entries from the evidence sequence. Generated motion/media itself is validated by HyperFrames lint/validate/inspect, ffprobe, browser playback, and the production website build rather than pixel-level unit tests.
focused red command: `bun test tests/website-structure.test.js -t "should give CONNECT a documentary evidence figure while keeping the six-feature grid responsive"` from `packages/consuelo-website` after the expectation update and before production/data edits.
expected red failure: current `home-content.ts` still contains evidence sequence labels Claude and Cursor and does not contain Grok/OpenCode.
no-test waiver: only for the generated MP4/WebP and HyperFrames render output. Their replacement proof is deterministic renderer validation + ffprobe + browser playback; the website data contract remains test-first.

## Key decisions

- Claude is intentionally deferred from this film because Ko's subscription lapsed. Do not block this task on restoring Claude access. The current evidence set is ChatGPT + Grok + Codex + OpenCode.
- Keep the existing broad marketing body copy mentioning Claude; only the evidence sequence must describe what the viewer actually sees.
- Primary transition language is editorial/page-like blue rule or push/reveal. Product footage remains the evidence; motion graphics are framing, not the subject.
- Raw Desktop masters stay untouched and out of Git.
- Prior W2 publication proved `task.push` can corrupt MP4/WebP binary bytes. Final binary publication must use a scoped normal Git binary commit/push fallback and then the normal `task.pr` promotion lifecycle unless that publish bug is fixed during this task (it is not in scope).

## Errors / tooling notes

- Before this task, `artifacts.renderHyperframes` failed with `Open Design root is missing required files` even though the vendored HyperFrames source exists at `packages/consuelo-design/upstream/open-design`. Treat this as a facade path-resolution bug, not missing HyperFrames. Recover with the local HyperFrames CLI/source workflow instead of retrying the same facade payload.

- 2026-08-31 23:01:24 append: `.task/website/finish-connect-four-agent-film/workpad.md`

## workspace-owned: files changed

- `packages/consuelo-website/motion/connect/.gitignore`
- `packages/consuelo-website/motion/connect/index.html`
- `packages/consuelo-website/motion/connect/source-timing.json`

## workspace-owned: activity log

- 2026-08-31 23:01:24 fs.write: `.task/website/finish-connect-four-agent-film/workpad.md`
- 2026-08-31 23:01:37 apply-patch: `packages/consuelo-website/tests/website-structure.test.js`
- 2026-08-31 23:02:16 apply-patch: `packages/consuelo-website/tests/website-structure.test.js`
- 2026-08-31 23:05:22 write: `packages/consuelo-website/motion/connect/.gitignore`
- 2026-08-31 23:05:22 fs.write: `packages/consuelo-website/motion/connect/.gitignore`
- 2026-08-31 23:05:26 write: `packages/consuelo-website/motion/connect/source-timing.json`
- 2026-08-31 23:05:26 fs.write: `packages/consuelo-website/motion/connect/source-timing.json`
- 2026-08-31 23:07:29 write: `packages/consuelo-website/motion/connect/index.html`
- 2026-08-31 23:07:29 fs.write: `packages/consuelo-website/motion/connect/index.html`
- 2026-08-31 23:07:36 apply-patch: `packages/consuelo-website/src/data/home-content.ts`
- 2026-08-31 23:09:01 apply-patch: `packages/consuelo-website/motion/connect/index.html`
- 2026-08-31 23:10:00 apply-patch: `packages/consuelo-website/motion/connect/index.html`
- 2026-08-31 23:12:27 apply-patch: `packages/consuelo-website/motion/connect/.gitignore`
- 2026-08-31 23:12:55 apply-patch: `packages/consuelo-website/motion/connect/index.html`
- 2026-08-31 23:16:36 fs.write: `.task/website/finish-connect-four-agent-film/workpad.md`
- 2026-08-31 23:17:12 fs.write: `.task/website/finish-connect-four-agent-film/workpad.md`

## Implementation and validation

- Built a source-first HyperFrames composition at `packages/consuelo-website/motion/connect/` using the four untouched Desktop masters as documentary inputs. Raw recordings remain outside Git.
- Local ignored proxies normalize the four sources to 2032x1192 / 30fps without cropping. OpenCode's 2018x1206 capture is fit-to-height and padded horizontally; Grok/Codex receive the two missing horizontal pixels as padding.
- Current response-activity trim anchors: ChatGPT 3.7s, Grok 3.8s, Codex 4.7s, OpenCode 4.7s. The source timing contract is recorded in `motion/connect/source-timing.json` so later refinements are deterministic.
- Final composition duration: 15.2s at 2032x1192 / 30fps. Sequence: intro → ChatGPT → Grok → Codex → OpenCode → result card. Each real recording is framed with restrained FIG/surface metadata and a consistent blue editorial wipe; there is no generated product UI or fake telemetry.
- HyperFrames `check --json` passes: runtime 0 issues, layout 0 issues, contrast 13/13 passed. Lint has two non-blocking maintainability warnings (`timeline_track_too_dense`) because four evidence overlays and five short transition clips intentionally share tracks in this compact 15.2s composition. Splitting them into sub-compositions would add structure without improving this small film. Trace: `trc_954a7ad79720`.
- HyperFrames transition-aware inspect passes with 0 errors; its only remaining warning is the intentional overlap while the opaque intro wipe covers the intro card. Trace: `trc_be17e81ab162`.
- Final HyperFrames render: `motion/connect/rendered/connect-film.mp4` (ignored generated output), 15.2s / about 2.4 MB. Render trace: `trc_6c29ac2eab0a`.
- Website media replacement: `public/media/home/connect-live-session.mp4` is H.264 2032x1192, 30fps, 15.2s, 2,476,160 bytes. Poster is a 49,992-byte WebP derived from the 1.6s ChatGPT evidence frame. Media probe trace: `trc_77a81b896de6`.
- Focused CONNECT contract is green: 1 pass / 19 filtered / 0 fail / 44 assertions. It now requires the truthful evidence sequence ChatGPT / Grok / Codex / OpenCode and preserves the broad marketing body copy that can still mention Claude. Trace: `trc_01dc02678c9c`.
- Production website build passes: Astro check reports 0 errors / 0 warnings / 24 existing hints and all 24 pages build. Trace: `trc_6cfeb39acd15`.
- Build recovery: the first build failed because package-local `node_modules` was absent from the task worktree (`astro: command not found`, trace `trc_60cf82781c85`). Added an ignored task-local symlink to the main checkout's existing website dependencies; no dependency files changed.
- Browser verification from the task worktree on `127.0.0.1:4324`: desktop 1440 uses 3 feature columns, iPad 1024 uses 2, phone 402 uses 1; all report zero horizontal overflow and preserve the 1.7048 media ratio. The final video loads H.264 2032x1192 with duration 15.2s, plays when the figure is in view, and reports no media error. Desktop trace `trc_f63966e2c4a7`; iPad trace `trc_f0ae1eb9aa89`; phone trace `trc_d8f7bf52530c`.
- Browser reduced-motion verification: `prefers-reduced-motion: reduce` hides the video and keeps the new poster visible. Trace: `trc_0bf8f2ef0c65`.

## Tooling / side effects

- `artifacts.renderHyperframes` failed before task creation with `Open Design root is missing required files` even though the vendored Open Design/HyperFrames source exists. The task recovered with the installed `npx hyperframes` CLI and repo-backed composition source rather than retrying the broken facade.
- `npx hyperframes init --skip-skills` unexpectedly populated/updated HyperFrames-related user-level skill folders under `~/.claude/skills` and `~/.agents/skills`. Those files are outside the repo and were left untouched rather than deleting or reverting user-level state without approval.
- Known publish incident remains relevant: `task.push` previously corrupted MP4/WebP bytes. This task will use a scoped normal non-force Git binary commit/push fallback after review/verify, then return to the typed `task.pr` / `task.finish` lifecycle and verify remote stream bytes.

- 2026-08-31 23:16:36 append: `.task/website/finish-connect-four-agent-film/workpad.md`

## workspace-owned: validation evidence

- 2026-08-31 23:16:57 `review.run`: passed — OK
- 2026-08-31 23:17:06 `verify`: passed — OK
- 2026-08-31 23:17:16 `verify`: passed — OK

## Final gates

- Strict mine-only review: 0 task-owned issues, 0 blockers; one unrelated pre-existing Nx typecheck-target note remains. Trace: `trc_3b9ec28b23bc`.
- Full task verifier passed and was publish-valid with no DB risks and no task-owned review findings. Initial final-gate trace: `trc_6d6d7fc766f8`.

- 2026-08-31 23:17:12 append: `.task/website/finish-connect-four-agent-film/workpad.md`

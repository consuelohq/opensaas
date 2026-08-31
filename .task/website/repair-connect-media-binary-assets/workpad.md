# repair connect media binary assets

branch: `task/website/repair-connect-media-binary-assets`
stream: `stream/website`
pr: https://github.com/consuelohq/opensaas/pull/2342
started: 2026-08-31

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

- Replace the corrupted CONNECT MP4 and poster currently committed on `stream/website` with valid binary assets derived from Ko's untouched final raw recording.
- Preserve the existing W2 component/data wiring and file paths.
- Prove the MP4 has a decodable H.264 video stream at 2032x1192 and the poster is a valid WebP.
- Prove the exact Tailscale preview URL loads and plays the corrected video.
- Publish only to `stream/website`; do not merge the stream to main or deploy production.

## Test-first contract

behavior under test: the committed CONNECT media blobs are real decodable binary media, not UTF-8-corrupted payloads introduced by the task publish path.
existing local pattern: W2's website structure contract protects the file paths and component wiring; runtime media validity is best proven with `ffprobe` plus browser playback.
new or changed tests: no source test change. This repair changes generated binary assets only; the existing focused source contract remains unchanged.
focused red command: `ffprobe -v error -show_entries stream=codec_name,width,height -show_entries format=duration,size -of json packages/consuelo-website/public/media/home/connect-live-session.mp4` on the task's stream-derived starting state.
expected red failure: the corrupted stream blob reports no video streams and no duration.
no-test waiver: binary/generated-media repair. Replacement validation is exact ffprobe decoding, WebP inspection, focused website contract, build, and live browser playback.

## Incident evidence

- The W2 task-local MP4 was valid at about 3.13 MB with H.264 2032x1192 / ~39.9s.
- After `task.push` + task PR promotion, `origin/stream/website` contains a ~5.67 MB MP4 that ffprobe recognizes only as an MP4 container with zero streams/duration. The WebP also inflated from the generated local artifact.
- This size expansion is consistent with binary bytes being corrupted by the normal task publish path. Do not route these replacement binaries through `task.push`; use a scoped normal Git binary commit/push fallback, then continue the task PR lifecycle.

- 2026-08-31 22:00:27 append: `.task/website/repair-connect-media-binary-assets/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-31 22:00:27 fs.write: `.task/website/repair-connect-media-binary-assets/workpad.md`
- 2026-08-31 22:18:37 fs.write: `.task/website/repair-connect-media-binary-assets/workpad.md`

## workspace-owned: validation evidence

- 2026-08-31 22:04:54 `review.run`: passed — OK
- 2026-08-31 22:04:54 `review.run`: passed — OK
- 2026-08-31 22:09:09 `review.run`: passed — OK
- 2026-08-31 22:09:10 `review.run`: passed — OK
- 2026-08-31 22:17:50 `review.run`: passed — OK
- 2026-08-31 22:18:18 `verify`: passed — OK
- 2026-08-31 22:18:18 `verify`: passed — OK
- 2026-08-31 22:18:18 `verify`: passed — OK

## Validation and recovery

- Red reproduction on stream-derived task start: ffprobe found zero video streams and no duration in the committed 5,670,554-byte MP4 (`trc_5870ffe2a8d0`).
- Replacement derived from the untouched Desktop master: H.264, 2032x1192, 39.868s, 3,131,404 bytes; poster is valid VP8 WebP 2032x1192 (`trc_45187944088c`).
- Focused CONNECT website contract passes 1/1 with 40 assertions (`trc_b4aa5ddc9e88`).
- Strict review reports 0 task-owned issues / 0 blockers; unrelated pre-existing repo lint/typecheck findings remain (`trc_5e36c1054486`).
- Full verifier passes and is publish-valid with only the two intended media files as product changes (`trc_b08ba4e088e7`).
- The normal `task.push` path is intentionally bypassed for this repair because the immediately preceding W2 publication demonstrably transformed valid binary media into larger invalid blobs. The fallback is a normal non-force Git commit/push from the scoped task worktree, preserving Git's binary transport, followed by the normal `task.pr` promotion lifecycle.

- 2026-08-31 22:18:37 append: `.task/website/repair-connect-media-binary-assets/workpad.md`

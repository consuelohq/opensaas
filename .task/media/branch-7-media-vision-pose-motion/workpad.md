# Branch 7 media vision pose motion

branch: `task/media/branch-7-media-vision-pose-motion`
stream: `stream/media`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1204/branch-7-media-vision-pose-motion
github pr: https://github.com/consuelohq/opensaas/pull/1204
started: 2026-06-24

## acceptance criteria

- [x] Start from `stream/media` and keep Branch 1-6 green.
- [x] Implement MediaPipe pose profile metadata without installing or invoking MediaPipe.
- [x] Keep OpenCV motion generic and separate from semantic pose.
- [x] Add explicit MediaPipe model bundle boundaries and no implicit model downloads.
- [x] Add structured missing-MediaPipe and missing-model errors.
- [x] Add pose-track fixture output with 33 landmark slots per detected pose frame.
- [x] Add pose-derived angle and sports metrics surfaces.
- [x] Do not implement overlays, export, artifact handoff, storage-budget model accounting, full sports-science planning, or research ingest.

## plan

1. Verify branch includes `origin/stream/media` before editing.
2. Inspect tests 23-24 and current media vision implementation.
3. Add only Branch 7 exports and fixture builders in `vision.ts`.
4. Run focused Branch 7 tests, full media vision, and Branch 1-6 scripts.
5. Run review, then push PR to `stream/media`.

## current status

- Implementation complete locally.
- Branch initially bootstrapped from main by task tool; corrected by non-destructive merge from `origin/stream/media` before editing.
- Awaiting review and publish.

## files changed

- `packages/os/scripts/lib/media/vision.ts`

## workspace-owned: files changed

- `.task/media/branch-7-media-vision-pose-motion/workpad.md`
- `.task/tasks/media/branch-7-media-vision-pose-motion.json`

## workspace-owned: activity log

- Loaded senior-engineer file metadata; full content call was blocked by safety, checksum/stat full-read check passed.
- Started task PR #1204 targeting `stream/media`.
- Merged `origin/stream/media` into task branch before implementation.
- Added MediaPipe pose profile constants, model bundle metadata, fixture pose-track output, missing dependency/model errors, angle measure surface, and sports metrics surface.

## workspace-owned: validation evidence

`bun --cwd packages/os test tests/media/23-vision-pose-mediapipe.test.ts tests/media/24-motion-track.test.ts`
- pass: 2 files, 5 tests

`bun run --cwd packages/os typecheck`
- pass: workspace script syntax checks passed

Branch 1-7 accumulated scripts all passed:
- `media:test:manifest`: 3 files, 13 tests
- `media:test:deps`: 3 files, 11 tests
- `media:test:contracts`: 5 files, 16 tests
- `media:test:core`: 5 files, 15 tests
- `media:test:ingest`: 4 files, 15 tests
- `media:test:youtube`: 2 files, 6 tests
- `media:test:audio`: 1 file, 9 tests
- `media:test:vision`: 4 files, 10 tests

## key decisions

- Pose remains semantic MediaPipe/body-landmark tooling layered on top of media-vision-light.
- Generic OpenCV motion remains separate from semantic pose and sports metrics.
- MediaPipe model bundles are declared explicitly and `implicitModelDownloads` remains false.
- Pose-derived angle measurement consumes `media.pose-track.v1`, not raw video.
- Sports metrics surfaces consume `media.pose-track.v1` and/or `media.motion-track.v1`.

## notes for ko

- No research ingest files were modified.
- No overlays/export/artifact handoff/storage-budget implementation was added.

## improvements noticed

- Future Branch 8 may want to move some fixture result builders into narrower modules once overlays/sports-science grow, but keeping them in `vision.ts` is the least disruptive Branch 7 change.

## issues and recovery

- The task tool created the branch from `main` even though it targeted `stream/media`. Recovered by merging `origin/stream/media` into the task branch before edits.

---

## publish checklist

```bash
bun run task:push -- --message "type(media): add pose vision surfaces" --changed
bun run task:pr
bun run task:finish
```

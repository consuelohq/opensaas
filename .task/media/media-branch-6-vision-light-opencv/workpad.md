# Media branch 6 vision-light OpenCV

## Acceptance criteria
- Start from `stream/media`.
- Target tests 21-22: scene detect + vision-light/OpenCV subset.
- Keep Branch 1-5 green: manifest, deps, contracts, core, ingest, audio.
- Implement deterministic scene detection and generic OpenCV/light-vision surfaces.
- Keep OpenCV as generic vision/motion only.
- Use opencv-python-headless profile handling and structured missing-cv2 dependency errors.
- Do not implement MediaPipe pose, sports metrics, overlays, export, artifact handoff, or research ingest.

## Test-first contract
Behavior under test:
- `media.scene.detect` uses `media-vision-light`, emits `media.scene-detect-result.v1`, and returns deterministic shot boundaries/candidate moments from fixture frame-difference samples.
- `visionLightProfile` models OpenCV as generic motion/computer vision, depends on `python3`, `numpy`, and `opencv-python-headless`, and excludes `opencv-python` and `mediapipe`.
- OpenCV-backed generic tools expose scene, motion, object, and camera fixture surfaces without pose-landmark semantics.
- Missing cv2 dependency errors are structured and point to `opencv-python-headless` / `media-vision-light`.

## Red evidence
- `bun --cwd packages/os test tests/media/21-scene-detect.test.ts tests/media/22-vision-light-opencv.test.ts` failed before implementation with 5 failed tests because `vision.ts` only exported `visionMediaModuleBoundary` and was missing the Branch 6 exports.

## Implementation notes
- Implemented `packages/os/scripts/lib/media/vision.ts` with deterministic fixture builders for scene detection, optical-flow-style motion tracks, object tracks, and camera motion segments.
- Added `sceneDetectEffect`, `sceneDetectForCli`, `motionTrackEffect`, `objectTrackEffect`, and `cameraMotionEffect` as Effect-returning surfaces.
- Added `visionLightProfile`, OpenCV tool roles, required profile/dependency constants, and `missingOpenCvError`.
- Strengthened tests 21-22 to assert actual fixture outputs, not only export presence.
- Did not implement MediaPipe pose, angle metrics, sports-science metrics, overlays, export, artifact handoff, or research ingest.
- No native tools were downloaded or installed. Actual downloaded size: 0 MB.

## Validation log
- Safety preflight: scanned Branch 1-6 target media tests for destructive command literals; no hits.
- Focused green: `bun --cwd packages/os test tests/media/21-scene-detect.test.ts tests/media/22-vision-light-opencv.test.ts` passed, 2 files / 5 tests.
- Branch 1 regression: `bun run --cwd packages/os media:test:manifest` passed, 3 files / 13 tests.
- Branch 1 regression: `bun run --cwd packages/os media:test:deps` passed, 3 files / 11 tests.
- Branch 2 regression: `bun run --cwd packages/os media:test:contracts` passed, 5 files / 16 tests.
- Branch 3 regression: `bun run --cwd packages/os media:test:core` passed, 5 files / 15 tests.
- Branch 4 regression: `bun run --cwd packages/os media:test:ingest` passed, 4 files / 15 tests.
- Branch 5 regression: `bun run --cwd packages/os media:test:audio` passed, 1 file / 9 tests.
- Static validation: `bun run --cwd packages/os typecheck` passed.
- Broad vision status: `bun run --cwd packages/os media:test:vision` is expected-red outside Branch 6; tests 21-22 pass and tests 23-24 remain future scope.
- Broad media status: `bun run --cwd packages/os media:test` remains expected-red outside Branch 6: 31 files, 24 passed / 7 failed; 103 tests, 89 passed / 14 failed.

## Current status
Branch 6 is ready for diff inspection and review. Target OpenCV/vision-light tests are green, Branch 1-5 suites are green, typecheck passes, and remaining red tests are future branch scope.

## workspace-owned: validation evidence

- 2026-06-24 01:09:09 `review.run`: passed — OK

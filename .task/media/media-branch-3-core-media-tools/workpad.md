# Media branch 3 core media tools

## Acceptance criteria
- Start from `stream/media`.
- Make media core tests 11-15 green:
  - probe
  - frames extract
  - timeline validate
  - compose
  - qa
- Make the core fixture path in test 30 pass when ffmpeg/ffprobe are available.
- Keep scope narrow: no media ingest, YouTube search, audio, vision, overlays, export, artifact handoff, or research ingest edits.
- Preserve Branch 1/2 manifest, dependency, schema, and CLI envelope contracts.

## Test-first contract
Behavior under test:
- `media.probe` uses ffprobe JSON output and normalizes it into `media.asset.v1`.
- `media.frames.extract` plans/runs ffmpeg frame extraction and writes `media.frame-manifest.v1`.
- `media.timeline.validate` validates timeline JSON and returns field-path errors plus reference collection.
- `media.compose` validates a timeline, builds a deterministic ffmpeg plan for vertical MP4 output, renders a draft, and returns `media.render-result.v1` metadata.
- `media.qa` uses ffprobe/filesystem checks to emit render-result-compatible QA status.
- `scripts/media.ts` routes core CLI commands to these implementations and returns JSON envelopes only.

Existing pattern to follow:
- Branch 2 established Effect-returning module surfaces and CLI adapter exports.
- Branch 2 also created shared schemas, media fs/process services, and structured error types.
- Tests 11-15 encode function-level contracts; test 30 encodes runtime fixture behavior with generated tiny media.

Focused red command:
- `bun run --cwd packages/os media:test:core`
- `bun --cwd packages/os test tests/media/30-fixtures-integration.test.ts`

Expected red failure before implementation:
- placeholder modules return MEDIA_NOT_IMPLEMENTED or miss required exports such as buildFrameExtractionPlan/buildComposePlan/buildQaChecks.
- CLI commands currently return missing-input envelopes rather than real tool output.

## Plan
1. Run focused red tests.
2. Implement focused helpers in probe/frames/timeline/compose/qa without touching ingest or later surfaces.
3. Route CLI commands in scripts/media.ts to the core adapters.
4. Run focused core tests and fixture integration.
5. Run Branch 1/2 regressions, typecheck, broad expected-red media suite, review, push, and promote to stream/media.

## Validation log
- Red evidence: `bun run --cwd packages/os media:test:core` failed before implementation with 5 failed files / 11 failed tests. Expected failures were missing branch-3 helper exports and placeholder implementations.
- Red evidence: `bun --cwd packages/os test tests/media/30-fixtures-integration.test.ts` failed before implementation at `media.probe`, because the CLI still returned the placeholder missing-input path.
- Green focused evidence: `bun run --cwd packages/os media:test:core` passed, 5 files / 15 tests.
- Green fixture evidence: `bun --cwd packages/os test tests/media/30-fixtures-integration.test.ts` passed, 1 file / 2 tests, including generated tiny mp4 core pipeline.
- Regression evidence: `bun run --cwd packages/os media:test:contracts` passed, 5 files / 16 tests.
- Regression evidence: `bun run --cwd packages/os media:test:manifest` passed, 3 files / 13 tests.
- Regression evidence: `bun run --cwd packages/os media:test:deps` passed, 3 files / 11 tests.
- Static validation: `bun run --cwd packages/os typecheck` passed.
- Broad suite status: `bun run --cwd packages/os media:test` remains expected-red outside Branch 3, 31 files / 100 tests, 18 files passed / 13 failed, 64 passed / 36 failed.


## Implementation notes
- Implemented branch-3 core helpers and CLI routing for probe, frames extract, timeline validate, compose, and QA.
- Kept source capture, media ingest, YouTube, audio, vision, overlay, export, and artifact handoff out of scope.
- Kept research ingest untouched.
- Compose MVP uses FFmpeg scale/pad and MP4 encode only; local FFmpeg lacks drawtext, so deterministic overlay handoff is represented as metadata while advanced overlays remain Branch 8 scope.
- Module code avoids Bun globals where imported under Vitest; Bun process execution remains isolated in the media process service.

## workspace-owned: validation evidence

- 2026-06-23 23:42:23 `review.run`: passed — OK
- 2026-06-23 23:43:56 `review.run`: passed — OK


## Final validation evidence
- `bun run --cwd packages/os media:test:core`: passed, 5 files / 15 tests.
- `bun --cwd packages/os test tests/media/30-fixtures-integration.test.ts`: passed, 1 file / 2 tests, including the generated tiny MP4 core pipeline.
- `bun run --cwd packages/os media:test:contracts`: passed, 5 files / 16 tests.
- `bun run --cwd packages/os media:test:manifest`: passed, 3 files / 13 tests.
- `bun run --cwd packages/os media:test:deps`: passed, 3 files / 11 tests.
- `bun run --cwd packages/os typecheck`: passed.
- `bun run --cwd packages/os media:test`: expected-red outside Branch 3, 31 files / 100 tests, 18 files passed / 13 failed, 64 passed / 36 failed.
- `review.run --base origin/stream/media --no-tests`: passed with 0 issues from this branch. One pre-existing warning remains in `scripts/media.ts`.

## Review notes
- First review flagged missing local error handling in the new async core command router. Fixed with a local structured try/catch in `handleCoreCommand`.
- Final review after fix has 0 blocking issues and 0 branch-owned findings.

## Current status
Branch 3 is ready to push/promote to `stream/media`. Core media tools and the core fixture integration path are green; remaining red tests are intentionally reserved for future branches.

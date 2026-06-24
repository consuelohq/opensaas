# Media branch 5 audio transcription

## Acceptance criteria
- Start from `stream/media`.
- Target test 20: `bun run --cwd packages/os media:test:audio`.
- Keep Branch 1-4 green: manifest, deps, contracts, core, ingest.
- Implement deterministic audio extraction, normalization, fixture-first transcription, transcript schemas, explicit model-download boundaries, and media-audio dependency/profile handling.
- Do not touch research ingest.
- Do not implement vision, overlays, export, or artifact handoff yet.

## Test-first contract
Behavior under test:
- `scripts/lib/media/audio.ts` exposes Effect-returning extraction, normalization, and transcription functions plus CLI adapters.
- Audio extraction is deterministic and plans/runs `ffmpeg` into a declared output path.
- Audio normalization is deterministic and plans/runs `sox`; it requires the `media-audio` profile.
- Transcription defaults to fixture mode and can emit both segment-level and word-level transcript structures.
- Whisper modes are declared but do not implicitly download models; non-fixture modes require explicit model refs.
- `MediaTranscriptSchema`, `MediaTranscriptSegmentSchema`, and `MediaTranscriptWordSchema` validate useful transcript contracts.
- Audio CLI commands return structured JSON envelopes and do not route into research ingest.

Existing pattern to follow:
- Branch 2 established Effect/schema/service boundaries and CLI envelope style.
- Branch 3 implemented core CLI adapters using live media process services.
- Branch 4 kept media ingest owned by media and research ingest untouched.

New or changed tests:
- Strengthen `packages/os/tests/media/20-audio-transcribe.test.ts` to assert plans, fixture transcript normalization, structured errors for implicit model downloads, schema accept/reject behavior, and CLI JSON envelopes.

Focused red command:
- `bun run --cwd packages/os media:test:audio`

Expected red failure before implementation:
- `audio.ts` currently only exports a boundary placeholder and lacks required functions/constants/planners.
- transcript schemas are currently passthrough and do not expose segment/word schemas.
- CLI does not route audio commands yet.

## Plan
1. Strengthen the audio test suite first.
2. Run focused red `media:test:audio`.
3. Implement transcript schemas and media audio module.
4. Route audio CLI commands in `scripts/media.ts`.
5. Run focused audio tests, Branch 1-4 regression suites, typecheck, broad expected-red media suite, review, push and promote to `stream/media`.

## Validation log

- Red evidence: strengthened `bun run --cwd packages/os media:test:audio` failed before implementation with 9 failed tests: missing audio exports/constants/plans, weak transcript segment/word schemas, and missing audio CLI routing.
- Focused green: `bun run --cwd packages/os media:test:audio` passed, 1 file / 9 tests.
- Branch 1 regression: `bun run --cwd packages/os media:test:manifest` passed, 3 files / 13 tests.
- Branch 1 regression: `bun run --cwd packages/os media:test:deps` passed, 3 files / 11 tests.
- Branch 2 regression: `bun run --cwd packages/os media:test:contracts` passed, 5 files / 16 tests.
- Branch 3 regression: `bun run --cwd packages/os media:test:core` passed, 5 files / 15 tests.
- Branch 4 regression: `bun run --cwd packages/os media:test:ingest` passed, 4 files / 15 tests.
- Static validation: `bun run --cwd packages/os typecheck` passed.
- Broad suite status: `bun run --cwd packages/os media:test` remains expected-red outside Branch 5, 31 files / 103 tests, 22 passed / 9 failed, 84 passed / 19 failed.

## Implementation notes
- Implemented media audio extraction and normalization plan builders with explicit ffmpeg/sox command plans and no model downloads.
- Implemented fixture-first transcript generation with segment-level and word-level data.
- Added stricter transcript schemas for transcript, segment, and word contracts.
- Added model-selection guardrails: whisper modes require an explicit model ref and never implicitly download.
- Routed `media audio transcribe --mode fixture` through the CLI JSON envelope.
- Kept research ingest untouched; no vision, overlays, export, or artifact handoff behavior was implemented.

## workspace-owned: validation evidence

- 2026-06-24 00:51:33 `review.run`: passed — OK

- Review: `review.run --base origin/stream/media --no-tests` passed with 0 branch-owned issues. One pre-existing `ERROR_HANDLING` warning remains in `packages/os/scripts/media.ts` from stream base.

## Current status
Branch 5 is ready to push/promote to `stream/media`. Audio/transcription tests are green, Branch 1-4 suites are green, typecheck passes, and remaining red media tests are future branch scope.

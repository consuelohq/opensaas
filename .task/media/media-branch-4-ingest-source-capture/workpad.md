# Media branch 4 ingest source capture

## Acceptance criteria
- Start from `stream/media`.
- Make Branch 4 ingest tests green: `media:test:ingest` covering tests 16-19.
- Keep Branch 1-3 green: manifest, deps, contracts, core.
- Keep `media.sourceCapture` / `source.capture` internal-only and absent from manifests, workflows, runbooks, and package scripts.
- Implement `media.ingest` as the visible media ingest boundary.
- Preserve actual source media asset contracts; do not route through `research.ingest` and do not emit research packet artifacts as primary output.
- Keep research ingest untouched.

## Test-first contract
Behavior under test:
- Internal media source-capture module files exist and keep process execution isolated.
- `media.ingest` exports planning, Effect, CLI, mapping, assertion, and expected layout boundaries.
- Media ingest planning for video URLs uses `media-youtube`, `yt-dlp`, `assets/source.mp4`, and `source.info.json` without research artifacts.
- Source capture results map into `media.ingest-manifest.v1` and `media.asset.v1` with `rights.status = needs-review` and provenance.
- Transcript-only capture is rejected with a structured missing-source-media error.
- YouTube fixture normalization and scoring are deterministic and fixture-only.
- yt-dlp info/subtitle fixtures normalize to provenance-first media ingest output.

Existing pattern to follow:
- Branch 1 created media manifests, workflow/runbook, dependency catalog, installer and doctor.
- Branch 2 created Effect/schema/service boundaries and CLI envelope style.
- Branch 3 created core media tool implementations and kept later areas red.
- Use Effect below CLI boundaries. Isolate process execution in media process/source-capture process services.

Focused red command:
- `bun run --cwd packages/os media:test:ingest`

Expected red failure before implementation:
- `scripts/lib/media/source-capture/*` files are missing or empty.
- `scripts/lib/media/ingest.ts` lacks planning/mapping/assertion exports.
- `scripts/lib/media/youtube.ts` lacks fixture normalization/scoring exports.

## Plan
1. Run focused red `media:test:ingest`.
2. Implement source-capture internal modules with typed planning/schema/provenance/checksum/bundle helpers.
3. Implement `media.ingest` planning, mapping, assertion, and CLI adapter surface without real network calls in tests.
4. Implement `youtube.ts` fixture normalization/scoring/yt-dlp info and transcript helpers.
5. Route CLI `ingest`/`clip search` only as needed for package surface, without broad scope.
6. Run ingest focused tests, Branch 1-3 regressions, typecheck, broad expected-red media suite, review, push and promote.


## workspace-owned: validation evidence

- 2026-06-24 00:06:17 `review.run`: passed — OK

## Implementation notes
- Implemented media-owned internal source-capture planning/schema/provenance/checksum/bundle helpers under `packages/os/scripts/lib/media/source-capture`.
- Implemented `media.ingest` planning, source-asset assertion, source-capture-to-media mapping, expected media layout, and Effect CLI adapter surface.
- Implemented YouTube fixture normalization, deterministic scoring fields, yt-dlp info normalization, and transcript-ref extraction in `youtube.ts`.
- Kept source capture internal-only; no manifest/workflow/package-script exposure was added.
- Kept research ingest untouched.
- No native tools were downloaded or installed. Actual downloaded size: 0 MB.

## Validation log
- Red evidence: `bun run --cwd packages/os media:test:ingest` initially failed with 3 failed files / 11 failed tests. Expected failures were missing media ingest/youtube exports and layout/mapping behavior.
- Focused green: `bun run --cwd packages/os media:test:ingest` passed, 4 files / 15 tests.
- Branch 1 regression: `bun run --cwd packages/os media:test:manifest` passed, 3 files / 13 tests.
- Branch 1 regression: `bun run --cwd packages/os media:test:deps` passed, 3 files / 11 tests.
- Branch 2 regression: `bun run --cwd packages/os media:test:contracts` passed, 5 files / 16 tests.
- Branch 3 regression: `bun run --cwd packages/os media:test:core` passed, 5 files / 15 tests.
- Static validation: `bun run --cwd packages/os typecheck` passed.
- Broad suite status: `bun run --cwd packages/os media:test` remains expected-red outside Branch 4, 31 files / 100 tests, 21 files passed / 10 failed, 75 passed / 25 failed.
- Review: `review.run --base origin/stream/media --no-tests` passed with 0 blocking issues.

## Current status
Branch 4 is ready to push/promote to `stream/media`. Target ingest tests are green, Branch 1-3 suites are green, and remaining red media tests are future branch scope.

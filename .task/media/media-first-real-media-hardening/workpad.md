# Media first real media hardening

## Acceptance criteria

- Work from stream/media after stream/media was merged to main.
- Use a real downloaded media file for validation.
- Run the media stack end to end as far as the current system supports: source file -> probe -> frames -> timeline validate -> compose -> qa -> export.
- Fix bugs discovered by the real-media run.
- Keep rights/provenance as needs-review.
- Do not touch research ingest.
- Push a new reviewable task PR to stream/media.

## Test-first contract

Behavior under test:
- The real-media pipeline should work with a real MP4, not only generated ffmpeg fixtures.
- CLI commands should accept realistic paths, write JSON-only stdout in --json mode, and return structured errors when inputs are invalid.
- The output render should pass qa and export packaging.

Existing pattern to follow:
- Media commands expose Effect-returning library functions and CLI adapters in scripts/media.ts.
- Existing tests use generated tiny fixtures; this task adds real-media smoke coverage and hardens bugs found during the manual real-media run.

New or changed tests:
- Add a focused real-media fixture smoke test when a stable downloaded asset can be represented without committing large media.
- Otherwise add unit/CLI regression tests for any bugs found during the real run.

Focused red command:
- Download a real MP4 to /tmp, then run probe, frames extract, timeline validate, compose, qa, and export through scripts/media.ts.

Expected red failure:
- Unknown until the first real-media run; record each observed failure before fixing.


## Bugs found and fixed

1. `media.ingest` was visible in manifests but missing from `scripts/media.ts` routing and help.
   - Fixed by adding the CLI route for `ingest`.
   - Added regression coverage for URL dry-run planning and local file ingest.

2. Local media ingest had no materialization path.
   - Fixed by copying local source media into `assets/source.mp4`.
   - Writes `source.info.json`, `media-asset.json`, and `ingest-manifest.json`.
   - Adds sha256 and byte-size metadata.

3. URL ingest execution existed only as a plan.
   - Fixed by executing `yt-dlp` through the existing source-capture process service.
   - Captured directory is mapped into media ingest artifacts.
   - Post-download media asset check remains the required success condition.

4. `yt-dlp` sidecar/subtitle failures could abort media capture.
   - Fixed by making sidecar errors tolerant with `--ignore-errors` and relying on the required source media check.

5. MediaError details were lost when errors crossed the Effect runtime boundary.
   - Fixed by serializing media-ingest errors inside `ingestMediaForCli` before `Effect.runPromise`.
   - Added regression coverage for structured CLI ingest errors.

## Real media validation

Downloaded real MP4 source:
- `https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4`

Real MP4 pipeline passed:
- ingest local file
- probe
- frames extract
- timeline validate
- compose
- qa
- export

Live YouTube validation:
- `media.ingest` with `yt-dlp` succeeded against a public YouTube source after sidecar tolerance.
- Captured source media at `/tmp/yt-1782508323791/assets/source.mp4`.
- Downstream pipeline passed: probe, frames extract, timeline validate, compose, qa, export.

## Validation evidence

- `bun test tests/media/17-media-ingest-source-capture.test.ts` passed: 8 tests.
- `bun run media:test` passed: 31 files, 107 tests.
- `bun run typecheck` passed.

## Scope guardrails

- Did not touch research ingest.
- Did not commit real media files.
- Kept rights/provenance as `needs-review`.
- URL execution uses existing source-capture process service instead of shelling from the CLI.

## workspace-owned: validation evidence

- `bun test tests/media/17-media-ingest-source-capture.test.ts` passed: 8 tests.
- `bun run media:test` passed: 31 files, 107 tests.
- `bun run typecheck` passed.
- 2026-06-26 21:13:25 `review.run`: passed — OK
- 2026-06-26 21:13:46 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/media/media-first-real-media-hardening/current.json`, `.task/media/media-first-real-media-hardening/session.json`, `.task/media/media-first-real-media-hardening/workpad.md`, `.task/tasks/media/media-first-real-media-hardening.json`, `packages/os/scripts/lib/media/ingest.ts`, `packages/os/scripts/lib/media/source-capture/plan.ts`, `packages/os/scripts/media.ts`, `packages/os/tests/media/17-media-ingest-source-capture.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

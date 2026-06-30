# Improve media SVG conversion quality

Goal: add explicit trace engine control and optional SVGO optimization.

Scope: traceEngine auto/color/mono, optimize flag, vtracer install via cargo, svgo install via brew.

## workspace-owned: validation evidence

- 2026-06-27 19:41:40 `review.run`: passed — OK
Validation:
- Focused SVG suite: bun --cwd packages/os test tests/media/31-svg-convert.test.ts passed 7 tests.
- Full media suite: bun run --cwd packages/os media:test passed 32 files / 111 tests.
- Typecheck: bun run --cwd packages/os typecheck passed.
- Review: review.run --base origin/stream/media passed with 0 blocking issues.
- 2026-06-27 19:42:37 `verify`: passed — OK
- 2026-06-27 19:47:55 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/media/improve-media-svg-conversion-quality-and-optimization/current.json`, `.task/media/improve-media-svg-conversion-quality-and-optimization/session.json`, `.task/media/improve-media-svg-conversion-quality-and-optimization/verify.json`, `.task/media/improve-media-svg-conversion-quality-and-optimization/workpad.md`, `.task/tasks/media/improve-media-svg-conversion-quality-and-optimization.json`, `packages/os/scripts/lib/media/dependency-catalog.ts`, `packages/os/scripts/lib/media/schema.ts`, `packages/os/scripts/lib/media/svg.ts`, `packages/os/scripts/media.ts`, `packages/os/tests/media/31-svg-convert.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

## Final agent update

What changed:
- Added explicit `--trace-engine auto|color|mono` support for `media.svg.convert`.
- `auto` prefers vtracer when installed and falls back to ffmpeg + potrace.
- `color` requires vtracer and returns install guidance.
- `mono` forces the current ffmpeg + potrace path.
- Added opt-in `--optimize` with SVGO and clear install guidance.
- Added `traceEngine` and `optimized` metadata to `media.svg-result.v1`.
- Updated dependency catalog install guidance: `cargo install vtracer`, `brew install svgo`.

Why it changed:
- AI-generated images need color vector tracing when possible.
- The current machine still has a working monochrome fallback.
- Optimization should remain explicit until we tune outputs against real generated images.

Validation:
- `bun --cwd packages/os test tests/media/31-svg-convert.test.ts`: 7 passed.
- `bun run --cwd packages/os media:test`: 32 files / 111 tests passed.
- `bun run --cwd packages/os typecheck`: passed.
- `review.run --base origin/stream/media`: 0 blocking issues.

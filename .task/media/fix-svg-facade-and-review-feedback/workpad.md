# Fix SVG facade and review feedback

## Test-first contract

Behavior under test:
- `media.svg.convert` facade calls validate with `MediaSvgConvertInput` and pass `input`, `out`, `strategy`, `traceEngine`, and `optimize` flags to the media CLI.
- `strategy=both` writes the requested `--out` file while also producing wrapper and traced references.
- invalid `--strategy` fails fast with a validation error instead of silently doing `both`.
- `media svg` without `convert` returns help instead of a missing-input conversion error.
- malformed/truncated JPEG input returns a media validation error without throwing a RangeError.
- generated workspace type stubs expose `media.svg.convert`.

Existing pattern:
- Media tool behavior lives in `tests/media/31-svg-convert.test.ts`.
- Facade planning behavior lives in `tests/facade/facade.test.ts`.
- Input schemas and type signatures live in `scripts/lib/facade/schemas.ts`.
- Generated surfaces come from `generate-tool-manifest`, `generate-types`, and `generate-docs`.

Focused red commands:
- `bun --cwd packages/os test tests/media/31-svg-convert.test.ts`
- `bun --cwd packages/os test tests/facade/facade.test.ts -t "media.svg.convert"`

Expected red failure:
- generated workspace type surface missing `media.svg.convert`;
- facade schema missing `MediaSvgConvertInput`;
- command plan omits SVG arguments;
- both mode does not create the requested `--out` file;
- invalid strategy is accepted.

## Validation update

Focused red was confirmed before implementation:
- media SVG test failed on `both` not writing requested `--out`, invalid strategy fallback, bare `svg` routing, and missing generated workspace type surface.
- focused facade test failed because `MediaSvgConvertInput` was missing and command arguments were not passed through.

Implementation fixed:
- `both` writes traced SVG to requested `--out` and wrapper to the derived `.wrapper.svg` path.
- invalid strategy and trace engine now fail with `MEDIA_VALIDATION_ERROR`.
- truncated JPEG parsing is bounds guarded and returns validation failure instead of `RangeError`.
- bare `media svg` returns help unless subcommand is `convert`.
- facade registry has `MediaSvgConvertInput`.
- manifest has facade argument mappings for input/out/strategy/traceEngine/optimize.
- generated tool manifest, workflow bundle, docs, and workspace type stubs were regenerated.

Green validation:
- `bun --cwd packages/os test tests/media/31-svg-convert.test.ts`: 11 passed.
- `bun --cwd packages/os test tests/facade/facade.test.ts -t media.svg.convert`: 6 passed.
- `bun run --cwd packages/os media:test`: 32 files / 115 tests passed.
- `bun run --cwd packages/os typecheck`: passed.

Caveat:
- Full `tests/facade/facade.test.ts` still exposes pre-existing missing facade input schemas for many non-SVG media tools. This task only fixes `media.svg.convert`, the specific tool from the review comments.

## workspace-owned: validation evidence

- 2026-06-27 20:06:38 `review.run`: passed — OK
- 2026-06-27 20:06:59 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/media/fix-svg-facade-and-review-feedback/current.json`, `.task/media/fix-svg-facade-and-review-feedback/session.json`, `.task/media/fix-svg-facade-and-review-feedback/workpad.md`, `.task/tasks/media/fix-svg-facade-and-review-feedback.json`, `packages/os/TOOLS.md`, `packages/os/manifests/tool.manifest.json`, `packages/os/manifests/workflow-bundles.json`, `packages/os/scripts/lib/facade/schemas.ts`, `packages/os/scripts/lib/media/svg.ts`, `packages/os/scripts/media.ts`, `packages/os/src/generated/workspace.d.ts`, `packages/os/tests/facade/__snapshots__/facade.test.ts.snap`, `packages/os/tests/facade/facade.test.ts`, `packages/os/tests/media/31-svg-convert.test.ts`, `packages/os/tooling/media-tool-manifest.json`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

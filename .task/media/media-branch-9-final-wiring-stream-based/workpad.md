# Media branch 9 final wiring stream based

## Acceptance criteria

- Start from current stream/media, not main.
- Implement final media export package surface.
- Add media artifact handoff adapter without Office imports.
- Keep storage/model-bundle budgets explicit.
- Wire manifest-exposed final commands in scripts/media.ts: export, overlay render, breakdown plan.
- Keep research.ingest untouched.
- Validate full media suite and typecheck.

## Test-first contract

Behavior under test:
- media.export produces deterministic media.export-package.v1 packages with required files and provenance.
- media.artifacts converts media render results into artifact.manifest.v1-compatible handoff manifests.
- CLI routes manifest-exposed final surfaces for export, overlay render, and breakdown plan.
- dependency catalog exposes model bundles separately so large model downloads are never implicit.

Focused red evidence from previous malformed task before implementation:
- media:test:render failed on missing exportPackageEffect/exportPackageForCli and loose MediaExportPackageSchema.
- media:test:handoff failed on missing artifacts.ts and missing mediaModelBundles export.

Implementation notes:
- The first task branch was created from main by default; I repaired locally, then abandoned it because task.push requires remote branch sync.
- This task branch was created with startFrom=stream and patch-applied so it is correctly stacked on stream/media.
- Added packages/os/scripts/lib/media/artifacts.ts.
- Replaced export.ts stub with deterministic export package builder/effect/CLI adapter.
- Tightened MediaExportPackageSchema.
- Added mediaModelBundles export.
- Added final CLI routing and CLI parity tests.

## Validation

Pending in this corrected task session.


## Validation evidence

- bun run --cwd packages/os media:test passed: 31 files, 104 tests.
- bun run --cwd packages/os typecheck passed: workspace script syntax checks passed.

## Scope guardrails

- research.ingest untouched.
- media artifact handoff does not import Office or Consuelo Design.
- no dependency profiles added.
- branch is correctly based on stream/media via task.start startFrom=stream.

## workspace-owned: validation evidence

- bun run --cwd packages/os media:test passed: 31 files, 104 tests.
- bun run --cwd packages/os typecheck passed: workspace script syntax checks passed.
- 2026-06-26 15:53:34 `review.run`: passed — OK
- 2026-06-26 15:54:05 `verify`: passed — OK

## workspace-owned: test selection

- changed files: `.task/media/media-branch-9-final-wiring-stream-based/current.json`, `.task/media/media-branch-9-final-wiring-stream-based/session.json`, `.task/media/media-branch-9-final-wiring-stream-based/workpad.md`, `.task/tasks/media/media-branch-9-final-wiring-stream-based.json`, `packages/os/scripts/lib/media/artifacts.ts`, `packages/os/scripts/lib/media/dependency-catalog.ts`, `packages/os/scripts/lib/media/export.ts`, `packages/os/scripts/lib/media/schema.ts`, `packages/os/scripts/media.ts`, `packages/os/tests/media/27-export-package.test.ts`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

# Media branch 2 Effect schemas CLI envelope

## Acceptance criteria
- Start from `stream/media` after Branch 1 landed.
- Make media tests 06-10 green:
  - Effect architecture and service boundaries
  - media asset/timeline/render-result and final schema exports
  - media CLI JSON envelope for core commands
- Keep scope narrow: no real probe/frames/compose/qa processing, no media ingest implementation, no YouTube/audio/vision/render/export behavior.
- Add only skeletal module boundaries needed by the executable architecture contract.
- Do not touch or refactor research ingest.

## Test-first contract
Behavior under test:
- Media modules exist with Effect-returning domain functions and CLI adapter exports.
- External process execution is isolated to `scripts/lib/media/process.ts` and `source-capture/process.ts`.
- `Effect.runPromise` is only used at the CLI entrypoint boundary.
- Media schemas validate the final-state contracts used by later branches.
- `scripts/media.ts` returns structured JSON envelopes for core commands and missing dependency errors.

Existing pattern to follow:
- Branch 1 added `scripts/media.ts`, dependency catalog, install plan, doctor, manifests and runbook.
- Existing tests define the final schema fixture shapes in `packages/os/tests/media/helpers.ts`.
- Use Effect below CLI boundaries, but do not implement heavy media processing in this branch.

Focused red command:
- `bun run --cwd packages/os media:test:contracts`

Expected red failure before implementation:
- missing schema/process/fs/probe/frames/timeline/compose/qa/ingest/youtube/audio/vision/overlays/export/source-capture files
- dependency module importing child_process directly
- missing schema exports
- media CLI only supports doctor/install and rejects core commands

## Plan
1. Run focused red suite.
2. Add schema/errors/process/fs service boundaries and schema exports.
3. Refactor dependency checks to route process execution through media process service and remove `Effect.runPromise` from library code.
4. Add skeletal core/later media modules with required exports and Effect-returning stubs.
5. Extend `scripts/media.ts` to produce structured JSON envelopes for branch-2 CLI commands.
6. Run focused contracts suite, prior branch suites, typecheck, review, then push to stream/media.

## Validation log
- Red evidence: `bun run --cwd packages/os media:test:contracts` failed before implementation with 5 failed files / 16 failed tests. Expected failures: missing media schema/service modules and CLI core command envelope support.
- Green focused branch-2 evidence: `bun run --cwd packages/os media:test:contracts` passed, 5 files / 16 tests.
- Regression evidence: `bun run --cwd packages/os media:test:manifest` passed, 3 files / 13 tests.
- Regression evidence: `bun run --cwd packages/os media:test:deps` passed, 3 files / 11 tests.
- Static validation: `bun run --cwd packages/os typecheck` passed.
- Broad suite status: `bun run --cwd packages/os media:test` remains expected-red outside branch 2, 31 files / 100 tests, 12 files passed / 19 failed, 52 passed / 48 failed.

## Implementation notes
- Added branch-2 schema and service boundaries under `packages/os/scripts/lib/media`.
- Added final-state schema exports in `schema.ts` without implementing later render/audio/vision/export behavior.
- Added process and filesystem service boundaries; process execution is isolated to `process.ts` and `source-capture/process.ts`.
- Refactored dependency checks to avoid direct process execution in `dependencies.ts` so architecture tests enforce the boundary.
- Extended `scripts/media.ts` to return structured JSON envelopes for branch-2 CLI commands.
- Kept research ingest untouched.

## Scope control
- Core processing tests 11-15 remain red except the required surface-export checks that overlap with branch 2.
- Source-capture boundary test 16 passes because architecture now creates the internal module boundary, but media ingest behavior test 17 remains red for Branch 4.
- No native media packages were installed or downloaded. Actual downloaded size: 0 MB.

## workspace-owned: validation evidence

- 2026-06-23 22:57:24 `review.run`: passed — OK
- 2026-06-23 22:58:23 `review.run`: passed — OK

## Review evidence
- First review found two blocking process-boundary async error-handling issues in new code. Fixed with explicit local try/catch inside both async process runners.
- Revalidation after fix: `bun run --cwd packages/os media:test:contracts` passed, 5 files / 16 tests.
- Revalidation after fix: `bun run --cwd packages/os typecheck` passed.
- Final review: `review.run --base origin/stream/media --no-tests` passed with 0 blocking issues on this branch. One pre-existing warning remains in `scripts/media.ts` from the stream base.

## Agent-authored implementation update

What changed:
- Added the Branch 2 media schema and service spine under packages/os/scripts/lib/media.
- Added final-state media schema exports for asset, timeline, render result, dependency report, ingest manifest, frame manifest, transcript, pose track, motion track, overlay, breakdown plan, and export package.
- Added process, filesystem, errors, and placeholder media module boundaries required by the Effect architecture contract.
- Updated media dependency checks to avoid direct process execution in the dependency module.
- Updated media install dry-run output to include the shared JSON ok envelope field.
- Extended packages/os/scripts/media.ts to return structured JSON envelopes for doctor, install, and core command error paths.

Why it changed:
- Branch 2 is the contract/runtime spine needed before core media processing starts in Branch 3.
- The implementation keeps heavy behavior intentionally out of scope while giving later agents stable schemas, services, and CLI envelopes to build against.
- Research ingest remains untouched, and source capture remains internal-only.

Validation run:
- bun run --cwd packages/os media:test:contracts: passed, 5 files / 16 tests.
- bun run --cwd packages/os media:test:manifest: passed, 3 files / 13 tests.
- bun run --cwd packages/os media:test:deps: passed, 3 files / 11 tests.
- bun run --cwd packages/os typecheck: passed.
- bun run --cwd packages/os media:test: expected red outside Branch 2, 31 files / 100 tests, 12 files passed / 19 failed, 52 passed / 48 failed.
- review.run --base origin/stream/media --no-tests: passed with 0 blocking issues on this branch.

Issues and follow-ups:
- No native media tools were installed or downloaded. Actual downloaded size is 0 MB.
- Core media behavior, media ingest, YouTube, audio, vision, render/export, and artifact handoff remain intentionally red for future branches.
- One review warning is pre-existing from stream/media and was not introduced by this task.

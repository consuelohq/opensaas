# add media final state tdd suites

branch: `task/os/add-media-final-state-tdd-suites`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/1192
started: 2026-06-23

taskSession: `tsk_a6eb11929316`

## acceptance criteria

- [ ] Add full final-state media TDD suites under `packages/os/tests/media`.
- [ ] Suites encode final OS-native media architecture: manifests, package boundaries, dependencies, installer/doctor, Effect architecture, contracts, CLI, media core, YouTube, audio, OpenCV, MediaPipe, overlays, sports-science, export, artifact handoff, storage budget, integration fixtures.
- [ ] Tests are executable and detailed enough for later agents to make one suite/layer green at a time.
- [ ] Tests fail for missing media implementation/contracts, not syntax/import mistakes.
- [ ] No media implementation under `packages/workspace` or `office`.
- [ ] Push task branch and route through OS stream/review path.

## Test-first contract

Behavior under test:

- The repo has a final-state executable specification for OS-native media tooling.
- `media` is a first-class OS tool family with its own manifest source and generated full manifest inclusion.
- Runtime dependencies are modeled explicitly by profiles, commands, installers, and storage budgets rather than being hidden in package dependencies.
- Effect owns library internals; process, fs, and dependency side effects are injectable services; CLI is the only `Effect.runPromise` boundary.
- Final media contracts are versioned and strict: asset, timeline, render-result, dependency report, ingest/frame/transcript/pose/motion/overlay/export/breakdown artifacts.
- Agents can later work suite-by-suite: manifest/deps, Effect/contracts, core tools, YouTube, audio, vision, overlays/export, artifact handoff.

Existing local pattern to follow:

- `packages/os/tests/tool-manifest.test.ts` checks manifest/source/generated surfaces.
- `packages/os/tests/workflow-intent.test.ts` checks workflow intent bundles.
- `packages/os/tests/installer-runtime-dependencies.test.ts` checks installer dry-run/dependency behavior.
- `packages/os/scripts/lib/code-call/service.ts` and `packages/os/scripts/lib/fs/read.ts` show Effect service style.

New tests:

- `packages/os/tests/media/00-manifest-taxonomy.test.ts` through `28-fixtures-integration.test.ts` plus shared `helpers.ts`.
- `packages/os/tests/media/README.md` with suite ownership map for follow-up agents.

Focused red command:

```bash
bun --cwd packages/os test tests/media
```

Expected red failure:

- The new suite should compile, then fail on missing `packages/os/tooling/media-tool-manifest.json`, missing `packages/os/scripts/media.ts`, missing media schemas/dependency catalog/tools/contracts, and absent generated manifest/workflow surfaces.

## notes

- This task intentionally writes red executable contracts. Full green is not the goal for this task.
- Validation should prove the tests run and fail for expected missing media surfaces.

- 2026-06-23 17:13:46 write: `.task/os/add-media-final-state-tdd-suites/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-06-23 17:13:46 fs.write: `.task/os/add-media-final-state-tdd-suites/workpad.md`


## implementation summary

Created the final-state OS media TDD suite under `packages/os/tests/media` with ordered suites `00` through `28` plus shared helpers and README.

Added package scripts for the media facade and suite slices:

- `media`, `media:doctor`, `media:install`
- `media:test`, `media:test:manifest`, `media:test:deps`, `media:test:contracts`, `media:test:core`, `media:test:youtube`, `media:test:audio`, `media:test:vision`, `media:test:render`, `media:test:handoff`

The tests intentionally encode the full target surface before implementation:

- manifest taxonomy and generated full/core manifest behavior
- OS package boundaries and no workspace/office media ownership
- media workflow/runbook routing on the OS stream
- native/runtime dependency catalog and installer/doctor behavior
- Effect module boundaries and service injection
- strict versioned schemas for media assets, timelines, render results, ingest/frame/transcript/pose/motion/overlay/export/breakdown artifacts
- JSON CLI envelope behavior
- media-core tools: probe, frames extract, timeline validate, compose, QA
- YouTube search/ingest, audio/transcription, OpenCV vision-light, MediaPipe pose, overlays, sports-science metrics, export, artifact handoff, storage budgets, generated fixture integration

## validation evidence

- `bun run --cwd packages/os typecheck`
  - result: pass
  - evidence: workspace script syntax checks passed

- `bun --cwd packages/os test tests/media/01-package-boundaries.test.ts`
  - result: pass
  - evidence: 1 file, 4 tests passed

- `bun --cwd packages/os test tests/media`
  - result: expected red
  - evidence: 29 files executed, 88 tests total, 5 passed, 83 failed
  - expected failure reasons: missing final media implementation surfaces such as `tooling/media-tool-manifest.json`, `scripts/lib/media/*`, `scripts/media.ts`, `runbooks/media.json`, generated media workflow/manifest surfaces, and schema/tool contracts.

This task is intentionally not making the media implementation green. The desired handoff state is executable contract tests that future agents can satisfy suite-by-suite.

## review notes

- A typed `git.diff` call was blocked by the platform wrapper, so diff/status inspection used read-only `code.call` fallback: `git diff --stat`, `git diff --name-status`, and `git status --short`.
- Current changed surfaces are `packages/os/package.json`, `packages/os/tests/media/*`, and task metadata/workpad.
- No production media implementation was added.

## workspace-owned: validation evidence

- `bun run --cwd packages/os typecheck`
  - result: pass
  - evidence: workspace script syntax checks passed
- `bun --cwd packages/os test tests/media/01-package-boundaries.test.ts`
  - result: pass
  - evidence: 1 file, 4 tests passed
- `bun --cwd packages/os test tests/media`
  - result: expected red
  - evidence: 29 files executed, 88 tests total, 5 passed, 83 failed
  - expected failure reasons: missing final media implementation surfaces such as `tooling/media-tool-manifest.json`, `scripts/lib/media/*`, `scripts/media.ts`, `runbooks/media.json`, generated media workflow/manifest surfaces, and schema/tool contracts.
This task is intentionally not making the media implementation green. The desired handoff state is executable contract tests that future agents can satisfy suite-by-suite.
- 2026-06-23 17:24:12 `review.run`: passed — OK
- 2026-06-23 17:25:34 `review.run`: passed — OK


## review evidence

- `review.run` against `origin/stream/os`
  - result: pass
  - files reviewed: 30 changed OS files
  - blocking issues: 0
  - trace: `trc_d1d7b8736357`

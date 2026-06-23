# Media branch 1 manifest and dependencies

## Acceptance criteria
- Create and use stream/media as the base stream for media implementation work.
- Make media tests 00-05 green:
  - manifest taxonomy
  - package boundaries
  - workflow intent/runbook routing
  - runtime dependency catalog
  - installer dry-run plan
  - doctor dependency report
- Keep source capture internal-only and out of manifests/workflows/scripts.
- Do not modify research ingest.
- Do not implement actual media processing in this branch.
- Report local downloads/installs and estimated size.

## Test-first contract
Behavior under test:
- OS has a first-class media manifest source and generated media workflow bundle.
- Media dependency profiles model native/runtime tools outside package.json.
- Install dry-runs and doctor produce structured JSON.
- Media workflow intent resolves through task-intent aliases.

Existing pattern to follow:
- packages/os/scripts/generate-tool-manifest.ts combines source manifests into full/core/workflow manifests.
- packages/os/scripts/task-intent.js resolves workflow bundles from manifests/workflow-bundles.json.
- OS facade scripts use packages/os/scripts/*.ts entrypoints and JSON output.

Focused red command:
- bun --cwd packages/os run media:test:manifest
- bun --cwd packages/os run media:test:deps

Expected red failure before implementation:
- missing tooling/media-tool-manifest.json
- missing media workflow/runbook
- missing scripts/lib/media/dependency-catalog.ts, install-plan.ts, dependencies.ts
- missing scripts/media.ts

## Plan
1. Add dedicated media tool manifest source and generated full/core/workflow outputs.
2. Add media workflow config and OS runbook.
3. Add dependency catalog with profiles, estimated sizes, required commands, and optional tool boundaries.
4. Add install-plan builder and doctor dependency checker.
5. Add scripts/media.ts CLI for doctor/install JSON paths needed by PR1.
6. Run focused media manifest/deps tests, typecheck, review, push to stream/media.

## Downloads / installs
- Planned for Branch 1: none. This branch only adds dependency catalog, install dry-run planning, and doctor checks.
- Actual installs performed: none.
- Actual downloaded size: 0 MB.
- Catalog profile estimates for future install tracking:
  - media-core: 320 MB
  - media-youtube: 35 MB
  - media-audio: 60 MB
  - media-vision-light: 410 MB
  - media-vision-pose: 670 MB
  - media-render-advanced: 140 MB

## Validation log
- First attempted red command used wrong Bun argument order: `bun --cwd packages/os run ...` only printed package scripts. Correct command is `bun run --cwd packages/os ...`.
- `bun run --cwd packages/os media:test:manifest`: pass, 3 files / 13 tests.
- `bun run --cwd packages/os media:test:deps`: pass, 3 files / 11 tests.
- `bun run --cwd packages/os generate-tool-manifest`: pass, wrote full/core/workflow manifests.
- `bun run --cwd packages/os generate-types`: pass.
- `bun run --cwd packages/os generate-docs`: pass.
- `bun run --cwd packages/os typecheck`: pass.
- `bun run --cwd packages/os media:test`: expected red outside PR1 scope, 31 files / 100 tests, 6 files passed / 25 failed, 29 passed / 71 failed.
- `review.run --base origin/stream/media --no-tests`: pass, 0 blocking issues.

## workspace-owned: validation evidence

- 2026-06-23 22:42:01 `review.run`: passed — OK

## Agent-authored implementation update

What changed:
- Created the new stream/media branch through task.start and branched PR1 from it.
- Added packages/os/tooling/media-tool-manifest.json as the dedicated source manifest for visible media tools.
- Added media to the generated full manifest and workflow bundles while keeping media tools out of the core manifest by default.
- Added the OS media workflow aliases and runbook ordering for deterministic media work.
- Added media runtime dependency catalog, install dry-run planner, doctor dependency report, and the initial scripts/media.ts CLI for PR1 commands only.
- Updated task-intent and facade schema signatures so workflow=media is accepted.
- Regenerated tool manifest, workflow bundles, generated type stubs, and TOOLS.md.

Why it changed:
- Branch 1 needed to make the executable media manifest/dependency contract green before any processing implementation starts.
- The branch keeps source capture internal-only by not adding any source.capture tool, script, workflow, or manifest entry.
- The branch intentionally avoids installing native media tooling; it models future downloads and reports profile estimates instead.

Validation run:
- bun run --cwd packages/os media:test:manifest: passed, 13 tests.
- bun run --cwd packages/os media:test:deps: passed, 11 tests.
- bun run --cwd packages/os generate-tool-manifest: passed.
- bun run --cwd packages/os generate-types: passed.
- bun run --cwd packages/os generate-docs: passed.
- bun run --cwd packages/os typecheck: passed.
- bun run --cwd packages/os media:test: expected red outside Branch 1, with later media suites still failing for missing implementation.
- review.run --base origin/stream/media --no-tests: passed with 0 blocking issues.

Issues and follow-ups:
- No native packages were installed. Actual downloaded size is 0 MB.
- Later branches still need to implement contracts, core media processing, internal media source capture, ingest, vision/audio/render/export, and artifact handoff.
- The full media suite remains intentionally red outside the PR1 suites.

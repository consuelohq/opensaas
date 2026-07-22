# Add media SVG conversion tool

branch: `task/media/add-media-svg-conversion-tool`
stream: `stream/media`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/1220/add-media-svg-conversion-tool
github pr: https://github.com/consuelohq/opensaas/pull/1220
started: 2026-06-27

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- none yet

## workspace-owned: validation evidence

- 2026-06-27 18:57:41 `review.run`: passed — OK
- 2026-06-27 18:59:12 `review.run`: passed — OK
- 2026-06-27 18:59:39 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(media): description" --changed
bun run task:pr
bun run task:finish
```
# media SVG convert tool

## Acceptance criteria
- Add visible media.svg.convert tool to media manifest and generated manifests.
- Add media.svg-result.v1 schema/result.
- Support exact SVG wrapper strategy.
- Support vector trace SVG strategy with vtracer when available and ffmpeg + potrace fallback.
- Add CLI route for svg convert.
- Keep optimization out of scope.

## Test-first contract
Focused test: packages/os/tests/media/31-svg-convert.test.ts
Focused red command: bun --cwd packages/os test tests/media/31-svg-convert.test.ts
Expected red: missing svg module/schema/manifest/CLI route.

## Validation evidence
- Red test captured: `bun --cwd packages/os test tests/media/31-svg-convert.test.ts` failed for missing manifest entry, missing svg module, and missing CLI route.
- Focused green: `bun --cwd packages/os test tests/media/31-svg-convert.test.ts` passed 5 tests.
- Full media green: `bun run --cwd packages/os media:test` passed 32 files / 109 tests.
- Typecheck green: `bun run --cwd packages/os typecheck` passed.

## Implementation notes
- Added `media.svg.convert` as the single visible tool.
- Added wrapper strategy that embeds the source PNG/JPEG as an SVG image tag for exact fidelity.
- Added trace strategy with vtracer preferred and ffmpeg + potrace fallback.
- Default/auto strategy normalizes to both so users get exact wrapper and vector trace outputs.
- Optimization is intentionally deferred.

## Final validation evidence
- `bun --cwd packages/os test tests/media/31-svg-convert.test.ts`: passed 5 tests.
- `bun run --cwd packages/os media:test`: passed 32 files / 109 tests.
- `bun run --cwd packages/os typecheck`: passed.
- `review.run --base origin/stream/media`: passed with 0 blocking issues.
- Pre-existing review note remains in `packages/os/scripts/media.ts`; not introduced by this task.

## workspace-owned: test selection

- changed files: `.task/media/add-media-svg-conversion-tool/current.json`, `.task/media/add-media-svg-conversion-tool/session.json`, `.task/media/add-media-svg-conversion-tool/workpad.md`, `.task/tasks/media/add-media-svg-conversion-tool.json`, `packages/os/manifests/tool.manifest.json`, `packages/os/manifests/workflow-bundles.json`, `packages/os/package.json`, `packages/os/scripts/lib/media/dependency-catalog.ts`, `packages/os/scripts/lib/media/schema.ts`, `packages/os/scripts/lib/media/svg.ts`, `packages/os/scripts/media.ts`, `packages/os/tests/media/31-svg-convert.test.ts`, `packages/os/tests/media/helpers.ts`, `packages/os/tooling/media-tool-manifest.json`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed code selected zero suites; add a discoverable test or explicit rule when this is not intentional

# Regenerate canonical Consuelo brand assets from stream

branch: `task/workspace-agents/regenerate-canonical-consuelo-brand-assets-from-stream`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2223/regenerate-canonical-consuelo-brand-assets-from-stream
github pr: https://github.com/consuelohq/opensaas/pull/2223
started: 2026-08-26

## acceptance criteria

- [x] Regenerated raster assets decode as valid images.
- [x] Focused canonical brand test passes after regeneration.
- [x] Task starts from `stream/workspace-agents` so its code diff is limited to the brand repair.

## plan

1. Reproduce the corrupt raster failure on the stream baseline.
2. Regenerate from the existing canonical Astro brand generator.
3. Validate every generated image, inspect the task diff, run verify, and merge to the stream.

## current status

- Regeneration and focused validation are complete; preparing formal verify/publish.

## files changed

- `packages/consuelo-website/public/apple-touch-icon-800x800.png`
- `packages/consuelo-website/public/apple-touch-icon.png`
- `packages/consuelo-website/public/favicon-192x192.png`
- `packages/consuelo-website/public/favicon-32x32.png`
- `packages/consuelo-website/public/favicon-512x512.png`
- `packages/consuelo-website/public/favicon.ico`
- task metadata/workpad files under `.task/`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-26 15:27:46 fs.write: `.task/workspace-agents/regenerate-canonical-consuelo-brand-assets-from-stream/workpad.md`

## workspace-owned: validation evidence

- 2026-08-26 15:31:11 `verify`: passed — OK
- 2026-08-26 15:31:12 `verify`: passed — OK

## key decisions

- The stream and main have identical canonical brand generator/source/test files, so regenerating from the stream produces the same current Astro brand asset without importing main history.
- The raster files were corrupt; the generator/source mark is unchanged.

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- The first task was accidentally started from `main`, making its task→stream PR include the 18 commits by which the stream trails main. It was not merged. This replacement task starts from the stream and isolates only the six raster outputs.

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## Test-first contract

behavior under test: canonical generated Consuelo raster brand assets are valid decodable images matching the black Consuelo mark on a rounded white app tile.
existing local pattern: `packages/consuelo-website/scripts/generate-brand-assets.ts` is the canonical generator and `packages/consuelo-website/tests/brand-assets.test.mjs` validates its raster/visual contract.
new or changed tests: no new test is required; the existing focused brand-assets test directly covers the corruption regression.
focused red command: `bun test packages/consuelo-website/tests/brand-assets.test.mjs -t "should use the black Consuelo mark on a rounded white app tile"`
expected red failure: `sharp` rejects the corrupt tracked raster asset as unsupported image format.
no-test waiver: not applicable.

## Acceptance criteria
- All canonical generated PNG outputs decode at their expected dimensions and ICO has a valid header.
- The focused canonical brand test passes after regeneration.
- Task diff against `stream/workspace-agents` contains only regenerated brand raster outputs plus task metadata.
- The task merges cleanly into `stream/workspace-agents` without importing unrelated main history.

- 2026-08-26 15:27:46 append: `.task/workspace-agents/regenerate-canonical-consuelo-brand-assets-from-stream/workpad.md`

- 2026-08-26 15:28:30 apply-patch: `.task/workspace-agents/regenerate-canonical-consuelo-brand-assets-from-stream/workpad.md`

- 2026-08-26 15:28:40 apply-patch: `.task/workspace-agents/regenerate-canonical-consuelo-brand-assets-from-stream/workpad.md`

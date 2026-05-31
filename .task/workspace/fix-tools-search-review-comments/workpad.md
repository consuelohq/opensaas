# Fix tools search review comments

branch: `task/workspace/fix-tools-search-review-comments`
stream: `stream/workspace`
started: 2026-05-31

## Goal

Fix the CodeRabbit review comments on the current workspace stream PR, then promote the fix task into `stream/workspace`, merge the full stream to `main`, sync locally, restart the server, and smoke-test broader workspace commands including FS commands.

## Initial plan

1. Inspect CodeRabbit comments on stream PR #674.
2. Apply minimal fixes on this task branch.
3. Validate with focused tests and review/verify.
4. Push/promote this task into `stream/workspace`.
5. Merge full stream PR to `main`.
6. Pull/sync local changes, restart server.
7. Smoke-test less-hit commands and FS commands.

## Evidence log

- Task started from `stream/workspace` so it stacks on the tools.search stream changes.

- 2026-05-31 19:52:27 write: `.task/workspace/fix-tools-search-review-comments/workpad.md`

## files changed

- `packages/workspace/scripts/generate-docs.ts`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/scripts/tools-search.ts`
- `packages/workspace/tests/tools-search-v2.test.ts`

## workspace-owned: files changed

- `packages/workspace/scripts/generate-docs.ts`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/scripts/tools-search.ts`
- `packages/workspace/tests/tools-search-v2.test.ts`

## workspace-owned: activity log

- 2026-05-31 19:52:27 fs.write: `.task/workspace/fix-tools-search-review-comments/workpad.md`
- 2026-05-31 19:53:00 fs.write: `.task/workspace/fix-tools-search-review-comments/workpad.md`
- 2026-05-31 19:54:15 fs.patch: `packages/workspace/scripts/lib/facade/schemas.ts`
- 2026-05-31 19:54:26 fs.patch: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 19:55:15 fs.patch: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 19:56:32 fs.patch: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 19:57:12 fs.patch: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 19:57:31 fs.patch: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 19:58:09 fs.patch: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 19:58:27 fs.patch: `packages/workspace/scripts/generate-docs.ts`
- 2026-05-31 19:58:58 fs.write: `packages/workspace/scripts/generate-docs.ts`
- 2026-05-31 20:00:59 fs.patch: `packages/workspace/tests/tools-search-v2.test.ts`
- 2026-05-31 20:01:37 fs.patch: `packages/workspace/tests/tools-search-v2.test.ts`
- 2026-05-31 20:02:11 fs.patch: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 20:02:36 fs.patch: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 20:02:59 fs.patch: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 20:03:20 fs.patch: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 20:03:40 fs.patch: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 20:03:54 fs.patch: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 20:04:47 fs.write: `.task/workspace/fix-tools-search-review-comments/workpad.md`
- 2026-05-31 20:07:31 fs.write: `.task/workspace/fix-tools-search-review-comments/workpad.md`

## CodeRabbit findings on stream PR #674

Fetched review `4397496117` from CodeRabbit. Findings to fix:

1. `packages/workspace/scripts/lib/facade/schemas.ts`: `ToolsSearchOutput` match item signature omits real fields returned by `toMatch()` (`methodPath`, `category`, `capabilities`, `sessionRequired`, `inputSchema`, `outputSchema`, `outputSignature`, optional `docs`).
2. `packages/workspace/scripts/tools-search.ts`: `catalog.source` always includes `TOOLS.md` even when docs were skipped via `noDocs`.
3. `packages/workspace/scripts/tools-search.ts`: `detectedIntent` uses `intents[0]` instead of deriving from the top-ranked scored result.
4. `packages/workspace/scripts/tools-search.ts`: bare catch in embedding cache parse should use `catch (error: unknown)`.
5. `packages/workspace/TOOLS.md`: generated `tools.search` success example still shows `data.raw`; should regenerate/update generated docs to structured response example.

All appear valid against current stream state.

- 2026-05-31 19:53:00 append: `.task/workspace/fix-tools-search-review-comments/workpad.md`

## workspace-owned: files read

- `packages/workspace/TOOLS.md`
- `packages/workspace/scripts/generate-docs.ts`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/scripts/tools-search.ts`
- `packages/workspace/tests/tools-search-v2.test.ts`

## workspace-owned: validation evidence

- 2026-05-31 19:59:09 `checkFiles`: passed — OK
- 2026-05-31 20:00:59 patch lines 110-115: `packages/workspace/tests/tools-search-v2.test.ts`
- 2026-05-31 20:01:37 patch lines 109-110: `packages/workspace/tests/tools-search-v2.test.ts`
- 2026-05-31 20:01:51 `checkFiles`: passed — OK
- 2026-05-31 20:02:11 patch lines 533-534: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 20:02:36 patch lines 534-534: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 20:02:59 patch lines 535-535: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 20:03:20 patch lines 536-536: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 20:03:40 patch lines 537-537: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 20:03:54 patch lines 537-538: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 20:04:01 `checkFiles`: passed — OK
- 2026-05-31 20:05:11 `review.run`: passed — OK
- 2026-05-31 20:05:31 `verify`: passed — OK
- 2026-05-31 20:07:57 `verify`: passed — OK

## Fixes applied

- Expanded `ToolsSearchOutput` match item signature to include fields returned by `toMatch()`.
- Changed `catalog.source` to include `TOOLS.md` only when docs are included.
- Derived `detectedIntent` from the top-ranked scored result's primary intent id, with fallback to first matched intent.
- Replaced bare embedding cache parse catch with `catch (error: unknown)` and explicit `void error`.
- Updated `generate-docs.ts` so `tools.search` success examples use a structured search payload instead of `{ raw: "example" }`; regenerated `TOOLS.md` and generated workspace types.
- Added focused test coverage for `--no-docs` source diagnostics and winning detected intent.

## Validation so far

- `checkFiles` passed for `tools-search.ts`, `generate-docs.ts`, `schemas.ts`, and `tools-search-v2.test.ts`.
- `bun test packages/workspace/tests/tools-search-v2.test.ts` => 7 pass / 0 fail.
- `bun test packages/workspace/tests/facade/facade.test.ts --test-name-pattern tools.search` => 3 pass / 0 fail.
- Generated docs check: `tools.search` example success envelope now contains structured result fields and no `"raw": "example"` match in `TOOLS.md`.
- Smoke: `bun packages/workspace/scripts/tools-search.ts 'linear issue' --limit 3 --no-docs --json` returned `recommended=linear.issue`, `detectedIntent=read or search Linear issues`, and `catalog.source=[tool-manifest.json]`.

- 2026-05-31 20:04:47 append: `.task/workspace/fix-tools-search-review-comments/workpad.md`

## workspace-owned: test selection

- changed files: `.task/tasks/workspace/fix-tools-search-review-comments.json`, `.task/workspace/fix-tools-search-review-comments/current.json`, `.task/workspace/fix-tools-search-review-comments/evidence-log.json`, `.task/workspace/fix-tools-search-review-comments/read-log.json`, `.task/workspace/fix-tools-search-review-comments/session.json`, `.task/workspace/fix-tools-search-review-comments/verify.json`, `.task/workspace/fix-tools-search-review-comments/workpad.md`, `packages/workspace/TOOLS.md`, `packages/workspace/scripts/generate-docs.ts`, `packages/workspace/scripts/lib/facade/schemas.ts`, `packages/workspace/scripts/tools-search.ts`, `packages/workspace/src/generated/workspace.d.ts`, `packages/workspace/tests/tools-search-v2.test.ts`
- matched rules: `workspace-facade`, `workspace-audit-docs`
- selected suites: `workspace facade input contracts`, `workspace audit tests`
- run results: `workspace facade input contracts` passed, `workspace audit tests` passed
- failed suites: none

## Final publish checkpoint

- Local task worktree reset to remote commit `4eb5d322115ba0d60e6c1f61c2c52ae9f86e9569` after the initial publish sync warning.
- CodeRabbit fixes are committed remotely and local task state is synced.
- Validation remains: focused v2 tests 7/7, existing facade tools.search tests 3/3, review clean, verify publish-valid.
- Next action: push this metadata update, promote task into `stream/workspace`, merge the stream PR to `main`, sync/restart/test locally.

- 2026-05-31 20:07:31 append: `.task/workspace/fix-tools-search-review-comments/workpad.md`

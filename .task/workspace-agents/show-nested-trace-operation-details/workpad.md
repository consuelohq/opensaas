# show nested trace operation details

branch: `task/workspace-agents/show-nested-trace-operation-details`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/581/show-nested-trace-operation-details
github pr: https://github.com/consuelohq/opensaas/pull/581
taskSession: `tsk_0cfb6f24f233`
started: 2026-05-24

## objective

Show useful per-child operation detail in nested `code.run` / `batch` trace rows, including changed markers for mutating operations and path/command/target details where available.

## acceptance criteria

- [x] Nested rows keep per-child token counts.
- [x] Nested read rows can show the read path or target detail.
- [x] Nested mutating rows show a `changed` marker independent of filesystem-only tracking.
- [x] Detail extraction is generic across tool inputs: path, pattern, query, keyword, operation, PR, repo, command.
- [x] Batch child results carry the same detail and changed metadata as code.run child operations.

## implementation notes

- Added `detail` and `changed` metadata to `code.run` operation records.
- Added `detail` and `changed` metadata to batch child result envelopes.
- Extended `ToolResult` with optional `detail` and `changed` fields.
- Updated `trace-watch` nested renderer to prefer operation detail over helper/message and show `changed` on mutating child operations.

## files changed

- `packages/workspace/scripts/lib/codemode/tools/index.ts`
- `packages/workspace/scripts/lib/facade/batch.ts`
- `packages/workspace/scripts/lib/facade/types.ts`
- `scripts/operator/trace-watch.ts`

## validation evidence

- Used `code.run` for read/edit workflows and confirmed nested child operation payloads include path details and changed flags.
- Used `batch` to read changed ranges in parallel; batch result children include token fields.
- `checkFiles` passed for all changed TypeScript files.

## notes

- Existing historical traces cannot show detail/changed metadata unless their stored nested child payloads already contain it.
- New traces after this code is running will show richer nested details.

- 2026-05-24 07:34:28 write: `.task/workspace-agents/show-nested-trace-operation-details/workpad.md`

## workspace-owned: files changed

- `packages/workspace/scripts/lib/codemode/tools/index.ts`
- `packages/workspace/scripts/lib/facade/batch.ts`
- `packages/workspace/scripts/lib/facade/types.ts`
- `scripts/operator/trace-watch.ts`

## workspace-owned: activity log

- 2026-05-24 07:34:28 fs.write: `.task/workspace-agents/show-nested-trace-operation-details/workpad.md`

## workspace-owned: validation evidence

- Used `code.run` for read/edit workflows and confirmed nested child operation payloads include path details and changed flags.
- Used `batch` to read changed ranges in parallel; batch result children include token fields.
- `checkFiles` passed for all changed TypeScript files.
- 2026-05-24 07:35:43 `verify`: passed — OK

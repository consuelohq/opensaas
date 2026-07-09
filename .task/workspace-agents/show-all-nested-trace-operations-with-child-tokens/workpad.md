# show all nested trace operations with child tokens

branch: `task/workspace-agents/show-all-nested-trace-operations-with-child-tokens`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/580/show-all-nested-trace-operations-with-child-tokens
github pr: https://github.com/consuelohq/opensaas/pull/580
taskSession: `tsk_25302d388295`
started: 2026-05-24

## objective

Make `trace:watch` show all nested `code.run` / `batch` child operations by default and show a token column for each nested child row.

## acceptance criteria

- [x] Nested trace rows default to showing all children.
- [x] `--nested-limit <n>` still works as an optional compact view.
- [x] Nested `code.run` rows show child operation token counts.
- [x] Nested `batch` rows can show child token counts once the server is running the updated batch facade.
- [x] Parent row format remains stable.

## implementation notes

- `scripts/operator/trace-watch.ts` now treats `nestedLimit` as optional and only truncates nested rows when the flag is explicitly set.
- `trace-watch.ts` now renders a nested token column and reads `inputTokens`, `outputTokens`, and `totalTokens` from nested operation/result payloads.
- `code.run` now records approximate token counts for each composed child operation in `operations`.
- `batch` now records approximate token counts on child step result envelopes.
- `ToolResult` now allows optional token fields so composed tools can preserve per-child token metadata.

## files changed

- `scripts/operator/trace-watch.ts`
- `packages/workspace/scripts/lib/codemode/tools/index.ts`
- `packages/workspace/scripts/lib/facade/batch.ts`
- `packages/workspace/scripts/lib/facade/types.ts`

## validation evidence

- `bun build scripts/operator/trace-watch.ts --target=bun --outfile=/tmp/trace-watch-nested-token-build.js`: passed.
- `checkFiles` over trace-watch, codemode tools, batch, and facade types: passed.
- `code.run` smoke with two child operations: passed and child operation payloads included token fields.
- `trace:watch --once --limit 1 --tool code.run --no-color`: passed and showed nested child token counts.
- `code.run` smoke with eight child operations: passed.
- `trace:watch --once --limit 1 --tool code.run --no-color`: passed and showed all eight nested rows with no overflow line.
- `bun --cwd packages/workspace test tests/codemode.test.ts`: passed.

## caveats

- Existing historical traces may still show `0 tokens` for child rows because older `code.run` / `batch` results did not store child token metadata.
- Batch child tokens need the workspace server to run this updated batch code before new batch traces include non-zero child tokens.
- The first combined facade snapshot test wrote unrelated snapshot churn; it was reverted, then the focused codemode test was rerun cleanly.

## workspace-owned: validation evidence

- `bun build scripts/operator/trace-watch.ts --target=bun --outfile=/tmp/trace-watch-nested-token-build.js`: passed.
- `checkFiles` over trace-watch, codemode tools, batch, and facade types: passed.
- `code.run` smoke with two child operations: passed and child operation payloads included token fields.
- `trace:watch --once --limit 1 --tool code.run --no-color`: passed and showed nested child token counts.
- `code.run` smoke with eight child operations: passed.
- `trace:watch --once --limit 1 --tool code.run --no-color`: passed and showed all eight nested rows with no overflow line.
- `bun --cwd packages/workspace test tests/codemode.test.ts`: passed.
- 2026-05-24 07:24:56 `verify`: passed — OK

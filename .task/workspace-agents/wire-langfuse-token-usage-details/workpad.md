# wire langfuse token usage details

branch: `task/workspace-agents/wire-langfuse-token-usage-details`
stream: `stream/workspace-agents`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/465/wire-langfuse-token-usage-details
github pr: https://github.com/consuelohq/opensaas/pull/465
started: 2026-05-22

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```

## implementation checkpoint — initial task setup

### acceptance criteria

- Langfuse receives first-class token usage through `usage_details`, not only nested output JSON.
- No cost details are added.
- Local SQLite trace DB persists input/output/total token counts as first-class nullable columns.
- `context.trace --json` returns token usage when present.
- Tests cover local trace schema migration and usage persistence.
- Existing tracing, latency observations, and workspace calls keep working.

### plan before editing

1. Read current Langfuse and local trace implementation in `packages/workspace/server.py` and `scripts/context.js`.
2. Add token-usage fields and schema migration to local trace DB.
3. Update Langfuse observation finish path to pass `usage_details` on the observation.
4. Update `context.trace` normalization/tests to expose usage fields.
5. Validate with focused tests, package tests, audit/review/verify.

### initial assumptions

- Token counts are estimated with the existing `_estimate_tokens` helper.
- Langfuse consumption charts require observation-level `usage_details`.
- Cost details are intentionally omitted.
- The task must use top-level `taskSession`; root `.task/*` pointers are legacy.

- 2026-05-22 08:33:51 append: `.task/workspace-agents/wire-langfuse-token-usage-details/workpad.md`
## implementation checkpoint — before edit

Planned changes:

- Update Langfuse observations from generic spans to generation observations for workspace calls so token usage can be attached through `usage_details`.
- Keep existing output payload usage for debugging/backcompat, but make Langfuse usage first-class.
- Add local trace DB columns: `input_tokens`, `output_tokens`, `total_tokens`.
- Populate local token counts in `_write_tool_trace` using existing `_estimate_tokens` over tool input and result payload.
- Expose token fields from `context.trace` as `inputTokens`, `outputTokens`, and `totalTokens`.

Why safe:

- Token counts are estimates only and do not affect tool execution.
- DB columns are nullable and migration-compatible.
- Cost details are omitted by request.
- Existing trace fields and result JSON remain intact.

Expected validation:

- Python syntax check for `server.py`.
- Focused `context-trace` tests.
- Workspace package tests/facade where relevant.
- Audit/review/verify before publish.

- 2026-05-22 08:34:43 append: `.task/workspace-agents/wire-langfuse-token-usage-details/workpad.md`
- 2026-05-22 08:35:46 patch lines 185-189: `packages/workspace/server.py`
- 2026-05-22 08:35:46 patch lines 204-204: `packages/workspace/server.py`
- 2026-05-22 08:35:47 patch lines 219-225: `packages/workspace/server.py`
- 2026-05-22 08:35:47 patch lines 388-388: `packages/workspace/server.py`
- 2026-05-22 08:35:47 patch lines 401-403: `packages/workspace/server.py`
- 2026-05-22 08:35:47 patch lines 451-478: `packages/workspace/server.py`
- 2026-05-22 08:35:47 patch lines 420-421: `packages/workspace/scripts/context.js`
- 2026-05-22 08:35:47 patch lines 429-430: `packages/workspace/scripts/context.js`
- 2026-05-22 08:35:48 patch lines 455-455: `packages/workspace/scripts/context.js`
- 2026-05-22 08:35:48 patch lines 512-512: `packages/workspace/scripts/context.js`
## implementation checkpoint - after edit

Files changed:

- `packages/workspace/server.py`
- `packages/workspace/scripts/context.js`
- `packages/workspace/tests/context-trace.test.js`
- `packages/workspace/README.md`

Key decisions:

- Langfuse workspace observations use generation observations with estimated token usage in `usage_details`.
- Cost details are intentionally omitted.
- Local trace rows persist estimated input, output, and total token counts.

Issues encountered:

- One generated edit script failed before changing files.
- One line-range edit attempt required recovery from the stream base before reapplying deterministic changes.
- One README patch needed a scoped file rewrite fallback.

## final validation before publish

Files changed:

- `packages/workspace/README.md`
- `packages/workspace/scripts/context.js`
- `packages/workspace/server.py`
- `packages/workspace/tests/context-trace.test.js`

Validation evidence:

- `bun --cwd packages/workspace test tests/context-trace.test.js`: passed, 3 tests.
- `bun --cwd packages/workspace test`: passed, 547 tests.
- Python compile check for `packages/workspace/server.py`: passed via `py_compile.compile(..., doraise=True)`.
- `audit` scripts mode: passed, 51 documented / 51 actual.
- `audit` docs mode: failed on broad pre-existing missing-path drift unrelated to this task.
- `review.run --base origin/stream/workspace-agents --no-tests`: passed.
- `verify --base origin/stream/workspace-agents --no-db`: passed.

Diff inspection:

- `git.diff` could not run because the live server schema was stale and missing `GitDiffInput`.
- Scoped fallback `git diff --stat origin/stream/workspace-agents` showed four expected files changed.

Ready to publish.

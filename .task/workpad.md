# add workspace tool result time beacon

branch: `task/workspace-agents/add-workspace-tool-result-time-beacon`
stream: `stream/workspace-agents`
started: 2026-05-04

## acceptance criteria

- [ ] every top-level workspace typed tool JSON envelope includes `now`
- [ ] `now` is an ISO timestamp string
- [ ] existing envelope fields remain unchanged
- [ ] implementation is centralized in facade layer
- [ ] tests cover success/failure/batch/passthrough cases
- [ ] note recorded: "rule/document injection is separate from time beacon."

## plan

1. inspect `ToolResult` type and central result construction in `/workspace/opensaas/packages/workspace/scripts/lib/facade/types.ts` and `/workspace/opensaas/packages/workspace/scripts/lib/facade/errors.ts`.
2. implement centralized `now` injection in the facade result creation path and backfill passthrough result envelopes when needed.
3. add/update tests for success, failure, batch, and passthrough tool results.
4. run targeted workspace checks and tests, then `review.run`.

## files changed

- `.task/workpad.md`

## key decisions

- keep timestamp injection centralized so individual tools remain unchanged.

## notes for ko

- `task.start` via workspace facade failed locally because `gh` and GitHub token are unavailable in this environment.

## improvements noticed

- The workspace audit dependency issue should be fixed separately so script audit can run reliably in task worktrees.

## errors i ran into

- `bun run workspace task.start '{"area":"workspace-agents","title":"add workspace tool result time beacon"}'` failed with missing `gh` / `GITHUB_TOKEN`.

## follow-up note

- rule/document injection is separate from time beacon.

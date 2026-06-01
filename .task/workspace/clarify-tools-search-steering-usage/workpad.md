# Clarify tools search steering usage

branch: `task/workspace/clarify-tools-search-steering-usage`
stream: `stream/workspace`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/680/clarify-tools-search-steering-usage
github pr: https://github.com/consuelohq/opensaas/pull/680
started: 2026-06-01

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/workspace/STEERING.md`

## workspace-owned: files changed

- `packages/workspace/STEERING.md`

## workspace-owned: activity log

- 2026-06-01 23:40:50 fs.write: `.task/workspace/clarify-tools-search-steering-usage/workpad.md`
- 2026-06-01 23:42:39 fs.patch: `packages/workspace/STEERING.md`
- 2026-06-01 23:43:13 fs.patch: `packages/workspace/STEERING.md`
- 2026-06-01 23:43:45 fs.patch: `packages/workspace/STEERING.md`
- 2026-06-01 23:44:04 fs.write: `.task/workspace/clarify-tools-search-steering-usage/workpad.md`

## workspace-owned: validation evidence

- 2026-06-01 23:47:38 `review.run`: passed — OK
- 2026-06-01 23:47:39 `review.run`: passed — OK
- 2026-06-01 23:47:39 `review.run`: passed — OK
- 2026-06-01 23:47:39 `review.run`: passed — OK
- 2026-06-01 23:47:39 `review.run`: passed — OK
- 2026-06-01 23:47:40 `review.run`: passed — OK
- 2026-06-01 23:51:01 `verify`: failed — COMMAND_FAILED
- 2026-06-01 23:51:01 `verify`: failed — COMMAND_FAILED
- 2026-06-01 23:51:01 `verify`: failed — COMMAND_FAILED
- 2026-06-01 23:53:44 `review.run`: passed — OK
- 2026-06-01 23:53:45 `review.run`: passed — OK

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
bun run task:push -- --message "type(workspace): description" --changed
bun run task:pr
bun run task:finish
```


## Summary

Objective: update `packages/workspace/STEERING.md` so future agents use `tools.search` correctly after tools.search v2.

Problem: recent traces show agents searching for tools that were already present in the injected tool manifest/context, wasting tokens. The useful behavior is batching discovery for unknown tool areas, not rediscovering known tools.

Scope:
- Add durable steering doctrine for `tools.search` usage.
- Prefer `batch` for multiple independent tool-discovery queries.
- Prefer direct `workspace.call` when the exact tool is already visible in steering/context.
- Keep the rule general, not tied to a single incident.

Test-first decision: docs-only/steering-only change. Validation will be reread of changed steering section plus scripts/docs audit if applicable. No code behavior changes.

- 2026-06-01 23:40:50 append: `.task/workspace/clarify-tools-search-steering-usage/workpad.md`

## workspace-owned: files read

- `packages/workspace/STEERING.md`


## Final status before publish

Changed file:
- `packages/workspace/STEERING.md`

Change:
- Added a durable `Workspace tool discovery with tools.search` section near the workspace tool routing table.
- The rule tells agents to call known tools directly when the tool is already in context.
- The rule positions `tools.search` as discovery/orientation for unknown or ambiguous tools.
- The rule recommends `batch` for multiple independent tool-discovery queries.
- The rule preserves the future reduced-steering migration by explaining the current full-manifest burn-in transition.

Validation:
- Reread lines 274-310 and confirmed Markdown placement, code fence integrity, and blank lines.
- No code behavior changed.

- 2026-06-01 23:44:04 append: `.task/workspace/clarify-tools-search-steering-usage/workpad.md`

## workspace-owned: test selection

- changed files: `.task/tasks/workspace/clarify-tools-search-steering-usage.json`, `.task/workspace/clarify-tools-search-steering-usage/current.json`, `.task/workspace/clarify-tools-search-steering-usage/evidence-log.json`, `.task/workspace/clarify-tools-search-steering-usage/read-log.json`, `.task/workspace/clarify-tools-search-steering-usage/session.json`, `.task/workspace/clarify-tools-search-steering-usage/workpad.md`, `packages/workspace/STEERING.md`
- matched rules: none
- selected suites: none
- run results: none
- failed suites: none
- zero-suite reason: changed files are docs or task metadata

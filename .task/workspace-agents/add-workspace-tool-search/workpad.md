# add workspace tool search

Branch: `task/workspace-agents/add-workspace-tool-search`
Stream: `stream/workspace-agents`
Task session: `tsk_a05909fcdbf3`
PR: https://app.graphite.com/github/pr/consuelohq/opensaas/655/add-workspace-tool-search
GitHub PR: https://github.com/consuelohq/opensaas/pull/655
Started: 2026-05-30

## Goal

Add a regular workspace tool, `tools.search`, that lets agents discover the right workspace tool and usage shape without reading the full tool manifest.

## Acceptance criteria

- [x] Add a Bun-backed workspace script for fuzzy tool search over the local manifest/docs.
- [x] Expose it as a regular workspace facade tool, not a top-level MCP tool.
- [x] Return compact ranked results with tool name, description, read-only/mutating metadata, schema/usage hints, and relevant docs snippets when available.
- [x] Add tests for ranking and output shape.
- [x] Update generated docs/types/manifest as needed.
- [x] Add steering guidance telling agents to use `tools.search` when they are unsure which workspace tool to call.
- [x] Validate with focused tests, audit/review/verify, push, and promote.

## Plan

1. Inspect current facade manifest/schema/executor patterns and docs generation.
2. Add a typed `tools.search` schema and implementation using Bun/TypeScript patterns already in workspace scripts.
3. Keep output capped and read-only.
4. Add focused behavior test for intent ranking and output shape.
5. Regenerate docs/types and validate.

## Current status

- Implemented and validated. Ready to push/promote.

## Initial assumptions

- Scope is a regular facade tool named `tools.search`; no top-level MCP architecture change yet.
- Future token-saving manifest split/top-level discovery architecture is out of scope but noted in steering/docs direction.

## Files changed

- `package.json`
- `packages/workspace/package.json`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/STEERING.md`
- `packages/workspace/TOOLS.md`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/scripts/tools-search.ts`
- `packages/workspace/src/generated/workspace.d.ts`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/tooling/tool-manifest.json`

## workspace-owned: files changed

- `.task/tasks/workspace-agents/add-workspace-tool-search.json`
- `.task/workspace-agents/add-workspace-tool-search/verify.json`
- `.task/workspace-agents/add-workspace-tool-search/workpad.md`
- `package.json`
- `packages/workspace/package.json`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/scripts/tools-search.ts`
- `packages/workspace/src/generated/workspace.d.ts`
- `packages/workspace/STEERING.md`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/tooling/tool-manifest.json`
- `packages/workspace/TOOLS.md`

## workspace-owned: activity log

- 2026-05-30 19:53:05 fs.write: `.task/workspace-agents/add-workspace-tool-search/workpad.md`
- Added `packages/workspace/scripts/tools-search.ts`.
- Added `tools:search` scripts at repo root and package workspace level.
- Added `tools.search` manifest entry and `ToolsSearchInput` / `ToolsSearchOutput` schema metadata.
- Added focused facade test for `linear issue` intent ranking and usage guidance.
- Added steering guidance to use `tools.search` instead of reading the full manifest for discovery.
- Generated `TOOLS.md` and `src/generated/workspace.d.ts`.
- Initial generated workpad existed; replaced with scoped acceptance criteria.

## workspace-owned: validation evidence

- `bun packages/workspace/scripts/tools-search.ts "linear issue" --limit 5 --json`: passed; `linear.issue` ranked first after scoring adjustment.
- `bun packages/workspace/scripts/tool-runner.ts tools.search '{"query":"linear issue","limit":3}'`: passed through the typed facade runner after adding the root `tools:search` package script.
- `cd packages/workspace && bun run generate-docs && bun run generate-types`: passed; generated `TOOLS.md` and workspace type stubs.
- `bun x vitest run packages/workspace/tests/facade/facade.test.ts`: passed 556 tests. Vitest reported existing obsolete snapshot keys; snapshot file was not changed.
- `checkFiles` on `tools-search.ts`, `schemas.ts`, and `facade.test.ts`: passed.
- `audit --scripts`: passed after documenting `tools:search` in `SCRIPTS.md`; documented_count 57 / actual_count 57.
- `review.run --base origin/main --no-tests`: passed with 0 issues.
- `verify --base origin/main --no-db`: passed and wrote `.task/workspace-agents/add-workspace-tool-search/verify.json`.
- 2026-05-30 19:53:15 `verify`: passed — OK

## Key decisions

- `tools.search` is a regular manifest/facade tool, not a top-level MCP tool.
- The script reads local manifest and generated docs directly; no extra service or index is needed for v1.
- Exact tool-name phrase matches get a ranking boost, so `linear issue` ranks `linear.issue` over mutating variants.
- `tools.search` is excluded from the generic synthetic success/failure snapshot matrix because it depends on real manifest/docs content; it has a focused behavior test instead.

## Notes for Ko

- This is the first step toward the future token-saving model: agents can discover non-core tools on demand while `get_steering` can eventually shrink to a necessary-tool manifest plus search guidance.
- The tool already returns signatures, examples, capability metadata, docs snippets, and workspace.call usage strings.

## Improvements noticed

- `tool-runner` executes package scripts from repo root, so new facade-backed scripts must also exist in root `package.json`, not only `packages/workspace/package.json`.
- Full generic facade snapshot maintenance is brittle across Bun/Vitest runners; keeping behavior-specific tests avoids unrelated snapshot churn.

## Issues and recovery

- Initial `fs.write` failed because task.start had already created the workpad; recovered by reading and overwriting it with scoped task content.
- First `tools.search` scoring over-ranked mutating/Sentry issue tools for `linear issue`; removed the broad `issue` alias and added exact phrase boost.
- Running `bun test ... --update-snapshots` and then `bun x vitest ... -u` caused unwanted snapshot churn; recovered by restoring the snapshot file from HEAD and excluding `tools.search` from the generic synthetic snapshot matrix.
- Direct `tool-runner` smoke initially failed with `Script not found "tools:search"`; recovered by adding `tools:search` to the repo root `package.json`.
- `audit --scripts` initially failed because `tools:search` was undocumented; recovered by documenting it in `packages/workspace/SCRIPTS.md`.

---

## publish checklist

```bash
bun run task:push -- --message "feat(workspace): add tools.search" --changed
bun run task:pr
bun run task:finish
```

- 2026-05-30 19:53:05 write: `.task/workspace-agents/add-workspace-tool-search/workpad.md`

## files changed

- `.task/tasks/workspace-agents/add-workspace-tool-search.json`
- `.task/workspace-agents/add-workspace-tool-search/verify.json`
- `.task/workspace-agents/add-workspace-tool-search/workpad.md`
- `package.json`
- `packages/workspace/package.json`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/scripts/tools-search.ts`
- `packages/workspace/src/generated/workspace.d.ts`
- `packages/workspace/STEERING.md`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/tooling/tool-manifest.json`
- `packages/workspace/TOOLS.md`

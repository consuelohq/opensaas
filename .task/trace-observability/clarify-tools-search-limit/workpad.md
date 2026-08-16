# Clarify tools search limit

branch: `task/trace-observability/clarify-tools-search-limit`
stream: `stream/trace-observability`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2140/clarify-tools-search-limit
github pr: https://github.com/consuelohq/opensaas/pull/2140
started: 2026-08-16

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

- 2026-08-16 06:38:25 fs.write: `.task/trace-observability/clarify-tools-search-limit/workpad.md`
- 2026-08-16 06:42:52 fs.write: `.task/trace-observability/clarify-tools-search-limit/workpad.md`
- 2026-08-16 06:46:23 fs.write: `.task/trace-observability/clarify-tools-search-limit/workpad.md`

## workspace-owned: validation evidence

- 2026-08-16 06:43:18 `review.run`: passed — OK
- 2026-08-16 06:44:20 `verify`: failed — COMMAND_FAILED

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
bun run task:push -- --message "type(trace-observability): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `packages/os/manifests/manifest.config.json`
- `packages/os/package.json`
- `packages/os/scripts/lib/facade/schemas.ts`
- `packages/os/scripts/tools-search.ts`
- `packages/os/tests/facade/facade.test.ts`
- `packages/os/tests/tool-manifest.test.ts`
- `packages/os/tests/tools-search-v2.test.ts`
- `packages/os/tools/subagent/schema.ts`
- `packages/os/tools/tool-discovery/manifest.ts`
- `packages/os/tools/tool-discovery/schema.ts`
- `packages/workspace/manifests/manifest.config.json`
- `packages/workspace/scripts/generate-tool-manifest.ts`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/tests/tool-manifest.test.ts`
- `packages/workspace/tooling/tool-manifest.json`

## Test-first contract

behavior under test: the tools.search agent-facing description explicitly states that limit accepts at most 5 results, and repository examples/tests do not teach an invalid tools.search limit of 8.
existing local pattern: ToolsSearchInput enforces limit <= 5; the tools.search runtime clamps to MAX_LIMIT=5; its canonical example already uses limit: 5; manifest tests assert exact canonical tool descriptions.
new or changed tests: extend the canonical manifest description expectations for tools.search, then align the stale tools-search-v2 test helper default from 8 to 5.
focused red command: run the focused tool-manifest test after adding the expectation but before changing the tool definition.
expected red failure: generated/canonical tools.search description is still "search workspace tools by intent and return ranked usage guidance" and does not mention the max of 5.
no-test waiver: not applicable.

- 2026-08-16 06:38:25 append: `.task/trace-observability/clarify-tools-search-limit/workpad.md`

- 2026-08-16 06:39:08 apply-patch: `packages/os/tests/tool-manifest.test.ts`

- 2026-08-16 06:41:35 apply-patch: `packages/os/tests/tool-manifest.test.ts`
- 2026-08-16 06:41:35 apply-patch: `packages/workspace/tests/tool-manifest.test.ts`
- 2026-08-16 06:41:35 apply-patch: `packages/workspace/tests/facade/facade.test.ts`
- 2026-08-16 06:41:46 apply-patch: `packages/os/tools/tool-discovery/schema.ts`
- 2026-08-16 06:41:46 apply-patch: `packages/workspace/tooling/tool-manifest.json`
- 2026-08-16 06:41:46 apply-patch: `packages/workspace/scripts/lib/facade/schemas.ts`
- 2026-08-16 06:41:46 apply-patch: `packages/os/tests/tools-search-v2.test.ts`
- 2026-08-16 06:42:14 apply-patch: `packages/os/tests/fixtures/tool-package-baseline.json`

## Findings and implementation

- The original failing batch trace used `limit: 8` for all four discovery siblings: three `explore` calls and one `tools.search` call. `8` is valid and heavily documented for `explore`, so the tools.search value was most likely copied from the shared discovery-batch budget rather than learned from a tools.search example.
- Agent guidance contains multiple `explore(... limit: 8)` examples. Those are correct and remain unchanged.
- tools.search itself had an incomplete contract: its descriptions did not state the maximum; the OS facade rejects values over 5, while the workspace facade previously allowed up to 30 and the underlying runner silently clamps to 5. One OS tools-search-v2 test helper also defaulted to 8. This cross-layer mismatch made `8` look plausible.
- Updated both OS and workspace tools.search descriptions to append `limit is capped at 5`.
- Aligned the workspace facade schema from max 30 to max 5 so both facade layers reject the same invalid input instead of one silently accepting it.
- Changed the stale OS tools-search-v2 helper default from 8 to 5. Kept explore limit-8 guidance unchanged.
- Regenerated OS/workspace tool manifests, workflow bundles, and TOOLS.md from their canonical sources.

## Validation

- Red evidence: OS and workspace manifest-description expectations failed before source updates; the workspace facade accepted `limit: 8` before schema alignment.
- Green evidence: focused workspace limit rejection test passed; OS tool-manifest + tools-search-v2 + workspace tool-manifest suites passed 31/31 (`trc_02470b836500`).
- A broader `-t tools.search` run also exposed an unrelated pre-existing test path that points at missing `packages/workspace/scripts/tools-search.ts`; it is outside this task and was not changed.

- 2026-08-16 06:42:52 append: `.task/trace-observability/clarify-tools-search-limit/workpad.md`

- 2026-08-16 06:46:16 apply-patch: `packages/os/tests/facade/__snapshots__/facade.test.ts.snap`
## Verify status

- `review.run --base origin/stream/trace-observability` is clean: 0 blocking issues (`trc_9bb966041ce7`).
- Full `verify` reaches and passes the task-relevant/critical workspace facade, manifest, OS lifecycle, syntax, and filesystem suites, but the auto-selected full `@consuelo/os` package suite is already red on unrelated media synthetic-dry-run, subagent dry-run, and fs-read assertion baselines (`trc_06879c46aa8f`). None of those failures touch tools.search or these changed files.
- The full package test also wrote two unrelated `session.start` snapshots as a side effect; those snapshot changes were removed and are not part of this task.
- Focused task evidence remains green: tools.search max-5 rejection plus OS/workspace manifest/search suites (`trc_02470b836500`).

- 2026-08-16 06:46:23 append: `.task/trace-observability/clarify-tools-search-limit/workpad.md`

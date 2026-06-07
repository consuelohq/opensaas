# Upgrade tools search discovery

branch: `task/workspace/upgrade-tools-search-discovery`
stream: `stream/workspace`
started: 2026-05-31

## Summary

Build `tools.search` v2 as the discovery layer needed before reducing steering manifest injection. The catalog uses exactly two sources: `packages/workspace/tooling/tool-manifest.json` and generated `packages/workspace/TOOLS.md`.

## Acceptance criteria

- [ ] `tools.search` internally searches the full live catalog; caller `limit` is treated as display preference, not recall depth.
- [ ] Tool cards merge manifest metadata and `TOOLS.md` agent-facing descriptions.
- [ ] Tool-card embeddings are cached by embedding config + card hash and invalidated when manifest/docs/card version changes.
- [ ] Hybrid ranking combines deterministic lexical/BM25-style signals, embeddings, intent packs, and capability/safety fit.
- [ ] Ambiguous queries return intent groups and safe guidance, not just a flat score list.
- [ ] `task close abandon delete branch pr` recommends `task.cleanup` above `task.pr`/`task.prs` while preserving PR alternatives.
- [ ] FS tools are explicitly covered: search/read/list/write/patch/trash where applicable.
- [ ] Hermes/OpenClaw-style invariants are covered: live catalog, no invented tools, no silent drops, scoped filters, exact names win.
- [ ] `TOOLS.md` / generated surfaces are regenerated if manifest/schema/output contracts change.
- [ ] Focused tests, scripts audit, review, and verify pass before publish.

## Test-first contract

Behavior under test: `tools.search` becomes reliable enough to serve as future non-core tool discovery after steering is reduced.

Existing pattern to follow:
- Current implementation: `packages/workspace/scripts/tools-search.ts`.
- Existing tests: `packages/workspace/tests/facade/facade.test.ts`.
- Generated docs: `packages/workspace/TOOLS.md` from `tooling/tool-manifest.json`.
- Explore embedding config/cache pattern is the reference for embedding identity and cache invalidation, but this task keeps tool-card sources limited to manifest + TOOLS.md.

Intended red tests before implementation:
- Bad task lifecycle query ranks `task.cleanup` first and marks ambiguity.
- Read-only PR links query ranks `task.prs` first.
- `limit` does not prevent strong alternatives from appearing in ambiguity metadata.
- FS queries resolve `fs.search`, `fs.read`, `fs.list`, and mutating FS tools with safety guidance.
- Exact tool names win.
- Unknown tools are not invented and live catalog counts match manifest filters.
- Output includes catalog/cache diagnostics.

Focused red command:
`bun packages/workspace/tests/facade/facade.test.ts --test-name-pattern tools.search`

Expected red failure:
Current `task close abandon delete branch pr` returns `task.pr` then `task.prs` before `task.cleanup`, and output lacks dynamic recall, ambiguity groups, and cache diagnostics.

## Plan

1. Read current implementation, facade schema/output contract, generated docs, and related tests.
2. Add failing tests for target behavior.
3. Refactor `tools-search.ts` around tool cards, full-catalog scoring, dynamic display, intent packs, and embedding cache.
4. Update output schema/types/docs if the output contract changes.
5. Run focused tests and representative CLI smokes.
6. Regenerate docs/types if needed.
7. Run audit, review, verify, push, and promote to stream.

- 2026-05-31 19:18:29 write: `.task/workspace/upgrade-tools-search-discovery/workpad.md`

## files changed

- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/scripts/tools-search.ts`
- `packages/workspace/tests/tools-search-v2.test.ts`

## workspace-owned: files changed

- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/scripts/tools-search.ts`
- `packages/workspace/tests/tools-search-v2.test.ts`

## workspace-owned: activity log

- 2026-05-31 19:18:29 fs.write: `.task/workspace/upgrade-tools-search-discovery/workpad.md`
- 2026-05-31 19:19:45 fs.write: `packages/workspace/tests/tools-search-v2.test.ts`
- 2026-05-31 19:20:09 fs.write: `.task/workspace/upgrade-tools-search-discovery/workpad.md`
- 2026-05-31 19:21:38 fs.write: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 19:22:03 fs.patch: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 19:23:04 fs.patch: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 19:23:30 fs.patch: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 19:23:54 fs.patch: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 19:25:32 fs.patch: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 19:26:08 fs.patch: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 19:26:50 fs.patch: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 19:27:21 fs.patch: `packages/workspace/tests/tools-search-v2.test.ts`
- 2026-05-31 19:27:32 fs.patch: `packages/workspace/tests/tools-search-v2.test.ts`
- 2026-05-31 19:27:38 fs.patch: `packages/workspace/tests/tools-search-v2.test.ts`
- 2026-05-31 19:27:59 fs.patch: `packages/workspace/tests/tools-search-v2.test.ts`
- 2026-05-31 19:28:24 fs.patch: `packages/workspace/tests/tools-search-v2.test.ts`
- 2026-05-31 19:29:04 fs.patch: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 19:29:45 fs.patch: `packages/workspace/scripts/lib/facade/schemas.ts`
- 2026-05-31 19:30:12 fs.patch: `packages/workspace/scripts/lib/facade/schemas.ts`
- 2026-05-31 19:30:23 fs.patch: `packages/workspace/scripts/lib/facade/schemas.ts`
- 2026-05-31 19:32:09 fs.patch: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 19:32:31 fs.patch: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 19:32:57 fs.patch: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 19:33:22 fs.patch: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 19:34:19 fs.patch: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 19:34:27 fs.patch: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 19:35:03 fs.patch: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 19:35:36 fs.patch: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 19:36:55 fs.write: `.task/workspace/upgrade-tools-search-discovery/workpad.md`
- 2026-05-31 19:37:54 fs.patch: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 19:38:29 fs.patch: `packages/workspace/scripts/tools-search.ts`

## workspace-owned: files read

- `packages/workspace/package.json`
- `packages/workspace/scripts/lib/facade/schemas.ts`
- `packages/workspace/scripts/lib/index/embedder.js`
- `packages/workspace/scripts/lib/index/embedding-config.js`
- `packages/workspace/scripts/tools-search.ts`
- `packages/workspace/tests/facade/facade.test.ts`
- `packages/workspace/tests/tools-search-v2.test.ts`

## workspace-owned: TDD red evidence

- 2026-05-31 19:19:51 `bun test packages/workspace/tests/tools-search-v2.test.ts`: failed exit 1 trace: `trc_c66803f70581`
  - output: ^ error: expect(received).toEqual(expected) - [ - "tool-manifest.json", - "TOOLS.md", - ] + undefined - Expected - 4 + Received + 1 at <anonymous> (/private/var/folders/vl/1zvhm0bj28d1dbvbcb12b39r0000gn/T/opensaas-worktrees/task-workspace-upgrade-tools-search-discovery/packages/workspace/tests/tools-search-v2.test.ts:107:37) (fail) tools.search v2 intent resolution > reports live two-source catalog and cache diagnostics without inventing tools [31.70ms] 1 pass 5 fail 21 expect() calls Ran 6 tests across 1 file. [440.00ms] error: script "task:exec" exited with code 1

## Red evidence

- 2026-05-31 `bun test packages/workspace/tests/tools-search-v2.test.ts` failed as expected.
- Failures confirmed missing v2 fields (`searchedCount`, `recommended`, `catalog`), bad cleanup query ranking (`task.pr` before `task.cleanup`), and missing dynamic-recall alternatives.
- One FS coverage assertion already passed under the old scorer, but broader v2 behavior remains red.

## Implementation notes before edit

- Keep catalog sources to `tool-manifest.json` and generated `TOOLS.md`.
- Use cached embeddings only as one signal; exact tool names, deterministic intent, and mutating/read-only safety stay deterministic.
- Avoid relying on server restart for freshness; hash live cards and reuse embeddings by card hash.

- 2026-05-31 19:20:09 append: `.task/workspace/upgrade-tools-search-discovery/workpad.md`

- 2026-05-31 19:21:38 write: `packages/workspace/scripts/tools-search.ts`

## workspace-owned: validation evidence

- 2026-05-31 19:21:46 `checkFiles`: passed — OK
- 2026-05-31 19:23:37 `checkFiles`: passed — OK
- 2026-05-31 19:26:17 `checkFiles`: passed — OK
- 2026-05-31 19:28:32 `checkFiles`: passed — OK
- 2026-05-31 19:30:29 `checkFiles`: passed — OK
- 2026-05-31 19:31:17 `audit`: passed — OK
- 2026-05-31 19:33:33 `checkFiles`: passed — OK
- 2026-05-31 19:35:45 `checkFiles`: passed — OK
- 2026-05-31 19:36:28 `checkFiles`: passed — OK
- 2026-05-31 19:36:33 `audit`: passed — OK
- 2026-05-31 19:37:03 `audit`: failed — COMMAND_FAILED
- 2026-05-31 19:37:34 `review.run`: passed — OK
- 2026-05-31 19:38:43 `checkFiles`: passed — OK
- 2026-05-31 19:39:40 `review.run`: passed — OK
- 2026-05-31 19:39:57 `verify`: passed — OK

## workspace-owned: TDD green evidence

- 2026-05-31 19:21:52 `bun test packages/workspace/tests/tools-search-v2.test.ts`: failed exit 1 trace: `trc_6ea33b3cb754`
  - output: ) tools.search v2 intent resolution > keeps exact tool names as the strongest signal [37.48ms] (pass) tools.search v2 intent resolution > covers filesystem search/read/list and mutating file operations with safety guidance [151.76ms] (pass) tools.search v2 intent resolution > does not let caller display limit hide strong task alternatives [38.41ms] (pass) tools.search v2 intent resolution > reports live two-source catalog and cache diagnostics without inventing tools [39.10ms] 5 pass 1 fail 34 expect() calls Ran 6 tests across 1 file. [486.00ms] error: script "task:exec" exited with code 1
- 2026-05-31 19:22:03 patch lines 150-150: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 19:23:04 patch lines 150-150: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 19:23:30 patch lines 185-185: `packages/workspace/scripts/tools-search.ts`
- 2026-05-31 19:23:46 `bun test packages/workspace/tests/tools-search-v2.test.ts`: failed exit 1 trace: `trc_0cc98ecfd9a1`
  - output: ) tools.search v2 intent resolution > keeps exact tool names as the strongest signal [36.88ms] (pass) tools.search v2 intent resolution > covers filesystem search/read/list and mutating file operations with safety guidance [151.87ms] (pass) tools.search v2 intent resolution > does not let caller display limit hide strong task alternatives [38.64ms] (pass) tools.search v2 intent resolution > reports live two-source catalog and cache diagnostics without inventing tools [36.76ms] 5 pass 1 fail 35 expect() calls Ran 6 tests across 1 file. [484.00ms] error: script "task:exec" exited with code 1

- 2026-05-31 19:23:54 patch lines 185-185: `packages/workspace/scripts/tools-search.ts`

- 2026-05-31 19:25:32 patch lines 456-456: `packages/workspace/scripts/tools-search.ts`

- 2026-05-31 19:26:08 patch lines 456-459: `packages/workspace/scripts/tools-search.ts`

- 2026-05-31 19:26:50 patch lines 445-453: `packages/workspace/scripts/tools-search.ts`

- 2026-05-31 19:27:21 patch lines 3-3: `packages/workspace/tests/tools-search-v2.test.ts`

- 2026-05-31 19:27:32 patch lines 106-106: `packages/workspace/tests/tools-search-v2.test.ts`

- 2026-05-31 19:27:38 patch lines 109-109: `packages/workspace/tests/tools-search-v2.test.ts`

- 2026-05-31 19:27:59 patch lines 109-112: `packages/workspace/tests/tools-search-v2.test.ts`

- 2026-05-31 19:28:24 patch lines 113-113: `packages/workspace/tests/tools-search-v2.test.ts`

- 2026-05-31 19:29:04 patch lines 452-453: `packages/workspace/scripts/tools-search.ts`

- 2026-05-31 19:29:45 patch lines 1083-1083: `packages/workspace/scripts/lib/facade/schemas.ts`

- 2026-05-31 19:30:12 patch lines 1083-1086: `packages/workspace/scripts/lib/facade/schemas.ts`

- 2026-05-31 19:30:23 patch lines 1086-1086: `packages/workspace/scripts/lib/facade/schemas.ts`

- 2026-05-31 19:32:09 patch lines 497-502: `packages/workspace/scripts/tools-search.ts`

- 2026-05-31 19:32:31 patch lines 493-512: `packages/workspace/scripts/tools-search.ts`

- 2026-05-31 19:32:57 patch lines 479-504: `packages/workspace/scripts/tools-search.ts`

- 2026-05-31 19:33:22 patch lines 469-518: `packages/workspace/scripts/tools-search.ts`

- 2026-05-31 19:34:19 patch lines 513-513: `packages/workspace/scripts/tools-search.ts`

- 2026-05-31 19:34:27 patch lines 513-513: `packages/workspace/scripts/tools-search.ts`

- 2026-05-31 19:35:03 patch lines 511-536: `packages/workspace/scripts/tools-search.ts`

- 2026-05-31 19:35:36 patch lines 532-535: `packages/workspace/scripts/tools-search.ts`

## Implementation update

Implemented `tools.search` v2 as a live-card hybrid resolver:

- Catalog sources are exactly `tool-manifest.json` and `TOOLS.md`.
- Tool cards include name, category, description, capabilities, schemas, command args, examples, usage, and TOOLS doc snippet.
- Deterministic ranking now combines exact/name/lexical, BM25-style tool-card score, workspace intent packs, capability/safety fit, and optional embedding similarity.
- Embeddings use the existing workspace embedder/config and cache under `~/.cache/workspace-tool-search/<embedding-config>/tools-search-card-v2.json`.
- Cache invalidation is by embedding config + card version + per-card hash.
- `limit` is display cap only; search scans the full filtered catalog and alternatives preserve strong hidden candidates.
- Output now includes `recommended`, `confidence`, `ambiguous`, alternatives, safety guidance, score parts, and catalog/cache diagnostics.
- Catalog build includes every manifest entry to avoid silent drops.

## Validation evidence

- Red test initially failed on current flat scorer: cleanup query ranked `task.pr` before `task.cleanup`, v2 fields missing.
- Green focused test: `bun test packages/workspace/tests/tools-search-v2.test.ts` => 6 pass / 0 fail.
- Existing facade tests: `bun test packages/workspace/tests/facade/facade.test.ts --test-name-pattern tools.search` => 3 pass / 0 fail.
- Scripts audit passed: 57 documented / 57 actual.
- Generated `TOOLS.md` and workspace type stubs after schema output signature update.
- Embedding-enabled smoke for `task close abandon delete branch pr`: recommended `task.cleanup`, ambiguous true, searched 128 tools, embedded 128 cards, preserved PR alternatives.
- Cache-reuse smoke for `show task pr links`: recommended `task.prs`, reused 128 cards, embedded 0 cards.

## Current status

Ready for review/verify. Out of scope remains unchanged: do not shrink `get_steering` yet; run this v2 search for a burn-in period first.

- 2026-05-31 19:36:55 append: `.task/workspace/upgrade-tools-search-discovery/workpad.md`

- 2026-05-31 19:37:54 patch lines 578-578: `packages/workspace/scripts/tools-search.ts`

- 2026-05-31 19:38:29 patch lines 778-778: `packages/workspace/scripts/tools-search.ts`

## workspace-owned: test selection

- changed files: `.task/tasks/workspace/upgrade-tools-search-discovery.json`, `.task/workspace/upgrade-tools-search-discovery/current.json`, `.task/workspace/upgrade-tools-search-discovery/evidence-log.json`, `.task/workspace/upgrade-tools-search-discovery/read-log.json`, `.task/workspace/upgrade-tools-search-discovery/session.json`, `.task/workspace/upgrade-tools-search-discovery/workpad.md`, `packages/workspace/TOOLS.md`, `packages/workspace/scripts/lib/facade/schemas.ts`, `packages/workspace/scripts/tools-search.ts`, `packages/workspace/src/generated/workspace.d.ts`, `packages/workspace/tests/tools-search-v2.test.ts`
- matched rules: `workspace-facade`, `workspace-audit-docs`
- selected suites: `workspace facade input contracts`, `workspace audit tests`
- run results: `workspace facade input contracts` passed, `workspace audit tests` passed
- failed suites: none

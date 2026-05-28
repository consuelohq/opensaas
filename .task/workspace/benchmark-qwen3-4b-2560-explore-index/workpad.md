# Benchmark Qwen3 4B 2560 explore index

Linear: DEV-1521 / DEV-1523 follow-up
Stream: stream/workspace
Task session: tsk_144d6523a46d
Branch: task/workspace/benchmark-qwen3-4b-2560-explore-index

## Goal

Support a non-destructive Qwen3-Embedding-4B 2560-dimensional workspace explore index and benchmark it against the current 1024-dimensional index.

## Alignment

Ko approved this direction because `explore` is an attention/intention graph, not an exact-answer oracle. Score should remain an attention priority signal. The goal is to improve the semantic geometry feeding the attention graph while keeping the current index as fallback.

## Constraints

- Keep current 1024 index usable as fallback.
- Do not switch to 8B/4096 in this task.
- Do not switch providers in this task.
- Use OpenRouter Qwen3-Embedding-4B for the benchmark.
- Do not silently truncate vectors; validate expected dimensions.
- Do not promote 2560 as default unless benchmark evidence supports it.

## Acceptance criteria

- [ ] Add embedding config metadata for provider, model, dimensions, and instruction version.
- [ ] Namespace index/cache by embedding config so 1024 and 2560 indexes do not mix.
- [ ] Replace silent truncation with explicit dimension handling and mismatch errors.
- [ ] Add a way to run explore/index against 2560 config without overwriting 1024.
- [ ] Run or document a benchmark matrix comparing 1024 and 2560 on representative queries.
- [ ] Record runtime/cost notes where available.
- [ ] Keep current behavior/fallback intact.

## Plan

1. Inspect current shipped embedder, store, indexer, and explore CLI.
2. Identify the smallest safe config/versioning seam.
3. Implement config-driven dimensions/cache namespace.
4. Add tests for dimension mismatch and cache separation.
5. Validate syntax/tests/audit.
6. Build/attempt 2560 benchmark index if safe within runtime constraints; otherwise document exact command and blocker.
7. Publish to stream with workpad evidence.

- 2026-05-28 21:49:02 write: `.task/workspace/benchmark-qwen3-4b-2560-explore-index/workpad.md`

## files changed

- none yet

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-05-28 21:49:02 fs.write: `.task/workspace/benchmark-qwen3-4b-2560-explore-index/workpad.md`
- 2026-05-28 21:59:37 fs.write: `.task/workspace/benchmark-qwen3-4b-2560-explore-index/workpad.md`
- 2026-05-28 22:25:07 fs.write: `.task/workspace/benchmark-qwen3-4b-2560-explore-index/workpad.md`

## workspace-owned: validation evidence

- 2026-05-28 21:57:32 `audit`: passed — OK
- 2026-05-28 22:01:07 `review.run`: passed — OK
- 2026-05-28 22:01:08 `review.run`: passed — OK
- 2026-05-28 22:09:32 `verify`: failed — COMMAND_FAILED
- 2026-05-28 22:09:33 `verify`: failed — COMMAND_FAILED
- 2026-05-28 22:23:43 `audit`: passed — OK
- 2026-05-28 22:24:25 `review.run`: passed — OK
- 2026-05-28 22:24:41 `review.run`: passed — OK
- 2026-05-28 22:24:56 `verify`: passed — OK

## Implementation notes — 2026-05-28

Implemented non-destructive embedding configuration support:

- Added `packages/workspace/scripts/lib/index/embedding-config.js`.
- Default 1024 config remains legacy-compatible and keeps the existing cache root.
- Non-default configs, including Qwen3-Embedding-4B at 2560 dimensions, write under a config-specific cache subdirectory.
- Store metadata now exposes embedding provider, API model, dimensions, instruction version, and config id.
- `explore --json` now reports `embedding_config_id` and `embedding_dimensions` in `index_stats`.
- `embedder.js` now validates vector dimensions. Legacy 1024 allows truncation by default for compatibility; 2560 does not silently truncate.
- Added API batch embedding support through `embedTexts` and `WORKSPACE_EMBEDDING_BATCH_SIZE` to make full-index benchmarks practical.
- Documented the 2560 benchmark command in `packages/workspace/SCRIPTS.md`.

Validation so far:

- Syntax checks passed for:
  - `embedding-config.js`
  - `embedder.js`
  - `indexer.js`
  - `store.js`
  - `explore.js`
- `packages/workspace/tests/embedding-config.test.js` passed.
- `audit { scripts: true }` passed.
- OpenRouter 2560 single embedding smoke passed: returned vector length 2560.
- OpenRouter 2560 batch embedding smoke passed: 3 embeddings, each length 2560.
- Default 1024 explore smoke passed and kept current fallback behavior:
  - query: `how does dialer queue call target resolution work`
  - embedding_dimensions: 1024
  - top path: `packages/twenty-server/src/engine/core-modules/consuelo-api/services/dialer-call-start.service.ts`

Benchmark status:

- Started building the separate 2560 index at:
  - `/Users/kokayi/.cache/workspace-index/e8425497c3ee20bf0a28e9da/openrouter-qwen-qwen3-embedding-4b-2560d-workspace-code-retrieval-v1/index.db`
- The first non-batched attempt reached about 736 chunk embeddings before timeout.
- After adding API batch support, the partial index reached about 4,224 chunk embeddings before the next client timeout.
- Full 74k-chunk benchmark index did not complete during this run; it is resumable by rerunning the documented command.

Current conclusion:

- The 2560 path is technically viable and non-destructive.
- OpenRouter returns 2560 vectors for Qwen3-Embedding-4B.
- Current work is ready as infrastructure for the benchmark, but final 1024-vs-2560 quality comparison still requires completing the 2560 index.

- 2026-05-28 21:59:37 append: `.task/workspace/benchmark-qwen3-4b-2560-explore-index/workpad.md`

## Validation and publish status — 2026-05-28

After server restart, resumed task session `tsk_144d6523a46d` and verified the worktree still had the expected changes.

Focused validation rerun:

- `node --check` passed for:
  - `packages/workspace/scripts/lib/index/embedding-config.js`
  - `packages/workspace/scripts/lib/index/embedder.js`
  - `packages/workspace/scripts/lib/index/indexer.js`
  - `packages/workspace/scripts/lib/index/store.js`
  - `packages/workspace/scripts/explore.js`
- `cd packages/workspace && bun run test tests/embedding-config.test.js` passed.
- `audit { scripts: true }` passed.

Review/verify:

- `review.run` against `origin/stream/workspace` reported unrelated `consuelo-design.ts` findings because the stream branch contains unrelated drift; this task does not modify that file.
- `review.run` against `origin/main` isolated this task's actual six workspace files and passed with 0 issues / 0 blockers.
- `verify` against `origin/main` passed and wrote publish-valid stamp to `.task/workspace/benchmark-qwen3-4b-2560-explore-index/verify.json`.
- Verify selected and ran `packages/workspace/tests/audit/audit.test.ts`; it passed.

Remaining benchmark note:

The 2560 index build is partially complete and resumable. This PR ships the safe/versioned infrastructure and batch API support. Final quality comparison still requires completing the alternate 2560 index and running the scenario matrix.

- 2026-05-28 22:25:07 append: `.task/workspace/benchmark-qwen3-4b-2560-explore-index/workpad.md`

# Promote Qwen3 2560 embeddings default

Task session: `tsk_a9a361b0bc4a`
Branch: `task/workspace/promote-qwen3-2560-embeddings-default`
Stream: `stream/workspace`

## Current status

Ko approved using Qwen3-Embedding-4B 2560 dimensions as the default if the smoke matrix showed slight improvements and no meaningful regressions. The 2560 infrastructure is already merged to main in `b5e9b01528652d19d38df9ac1bab4e585576a4ae`.

## Goal

Promote workspace explore default embeddings from 1024 to 2560 dimensions while preserving 1024 as an explicit fallback path.

## Acceptance criteria

- Default embedding config uses Qwen3-Embedding-4B at 2560 dimensions.
- Legacy 1024 config still maps to the old cache root/model key when explicitly selected.
- 1024 fallback still allows provider-vector truncation.
- `explore --json` default reports `embedding_dimensions: 2560`.
- Smoke matrix has no meaningful regressions and records any incremental wins.
- Validate with focused tests, audit, review, and verify.

## Summary

This task changes the default dimension only after the benchmark index completed and the scenario matrix showed no meaningful regressions. The fallback path remains available by setting `WORKSPACE_EMBEDDING_DIMENSIONS=1024`.

- 2026-05-28 23:14:13 write: `.task/workspace/promote-qwen3-2560-embeddings-default/workpad.md`

## files changed

- `packages/workspace/scripts/lib/index/embedding-config.js`
- `packages/workspace/tests/embedding-config.test.js`

## workspace-owned: files changed

- `packages/workspace/scripts/lib/index/embedding-config.js`
- `packages/workspace/tests/embedding-config.test.js`

## workspace-owned: activity log

- 2026-05-28 23:14:13 fs.write: `.task/workspace/promote-qwen3-2560-embeddings-default/workpad.md`
- 2026-05-28 23:15:14 patch lines 1-6: `packages/workspace/scripts/lib/index/embedding-config.js`
- 2026-05-28 23:15:14 fs.patch: `packages/workspace/scripts/lib/index/embedding-config.js`
- 2026-05-28 23:15:58 patch lines 26-28: `packages/workspace/scripts/lib/index/embedding-config.js`
- 2026-05-28 23:15:58 fs.patch: `packages/workspace/scripts/lib/index/embedding-config.js`
- 2026-05-28 23:16:18 write: `packages/workspace/scripts/lib/index/embedding-config.js`
- 2026-05-28 23:16:18 fs.write: `packages/workspace/scripts/lib/index/embedding-config.js`
- 2026-05-28 23:16:48 write: `packages/workspace/tests/embedding-config.test.js`
- 2026-05-28 23:16:48 fs.write: `packages/workspace/tests/embedding-config.test.js`
- 2026-05-28 23:21:51 fs.write: `.task/workspace/promote-qwen3-2560-embeddings-default/workpad.md`

## Implementation checkpoint

Changed `packages/workspace/scripts/lib/index/embedding-config.js` so Qwen3-Embedding-4B uses 2560 dimensions by default while preserving 1024 as the explicit legacy fallback. The legacy fallback still allows truncation because OpenRouter returns 2560-length vectors for the 4B model. The default 2560 path validates dimensions and uses the config-specific cache root.

Updated `packages/workspace/tests/embedding-config.test.js` to assert:

- default config is 2560 dimensions
- default config is not the legacy cache path
- explicit 1024 config remains legacy-compatible
- explicit 1024 allows truncation
- invalid dimensions still throw

## Smoke matrix evidence

Ran default 2560 vs explicit legacy 1024 across five representative explore queries.

Result:

- 5/5 default runs reported `embedding_dimensions: 2560`.
- 3/5 scenarios had identical top-3 results: Open Design/Electron, research ingest, test selection.
- 2/5 scenarios improved semantic placement: DEV-1508 and dialer queue.
- 0/5 scenarios showed a meaningful regression.

Specific improvements:

- DEV-1508: 2560 moved `packages/agent/src/skills/post-call-analysis.md` into rank 2; 1024 had `STEERING.md` and website content in ranks 2–3.
- Dialer queue: 2560 kept the service and spec in ranks 1–2 and moved `packages/chat-bot/src/queue-dialer.ts` into rank 3; 1024 had the frontend hook in rank 3.

This is an incremental win rather than a night-and-day change. Based on the attention-graph goal, the observed outcome is acceptable: modest semantic improvement, preserved strong results, no meaningful regressions in the sampled matrix.

- 2026-05-28 23:21:51 append: `.task/workspace/promote-qwen3-2560-embeddings-default/workpad.md`

## workspace-owned: validation evidence

- 2026-05-28 23:22:01 `audit`: passed — OK
- 2026-05-28 23:22:32 `review.run`: passed — OK
- 2026-05-28 23:22:46 `verify`: passed — OK

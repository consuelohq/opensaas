# Inspect explore embedding ranking

Task session: `tsk_d15d1579faeb`
Branch: `task/workspace/inspect-explore-embedding-ranking`
Stream: `stream/workspace`
Task PR: #641

## Goal

Read the actual explore retriever/ranker code and propose the narrowest useful follow-up task for understanding why the completed 8B/4096 index performed worse than 4B/2560 on two soft-query benchmark cases.

## Context

Observed benchmark result:

- 8B/4096 index completed successfully.
- 5/7 benchmark scenarios were identical or effectively identical.
- 2/7 important soft-query scenarios regressed under 8B/4096:
  - DEV-1508 moved `packages/agent/src/skills/post-call-analysis.md` from rank 2 to rank 5.
  - Dialer queue swapped useful domain files for frontend/facade noise.

Hypothesis:

The larger embedding model may be producing a different candidate distribution, but the surrounding retrieval/ranking/scoring layer is tuned around the 4B/2560 distribution. We need code-level evidence before proposing implementation.

## Acceptance criteria

- [ ] Inspect retriever, ranker, explore output shaping, and ranker tests.
- [ ] Identify whether the right next task is diagnostics, scoring changes, benchmark harness, or model-specific tuning.
- [ ] Keep this task read-only unless Ko approves implementation.
- [ ] Return a targeted task proposal with likely files and acceptance criteria.

- 2026-05-29 02:29:51 write: `.task/workspace/inspect-explore-embedding-ranking/workpad.md`

## files changed

- `/tmp/close-describe.js`
- `/tmp/explore-ranker-new-tests.js`
- `/tmp/graph-centrality-test.js`
- `/tmp/graph-relevance-block.js`
- `/tmp/issue-soft-cap.js`
- `/tmp/ranker-anchor-graph-block.js`
- `/tmp/ranker-cap-block-full.js`
- `/tmp/ranker-cap-block.js`
- `packages/workspace/scripts/lib/search/ranker.js`
- `packages/workspace/tests/explore-ranker.test.js`

## workspace-owned: files changed

- `/tmp/close-describe.js`
- `/tmp/explore-ranker-new-tests.js`
- `/tmp/graph-centrality-test.js`
- `/tmp/graph-relevance-block.js`
- `/tmp/issue-soft-cap.js`
- `/tmp/ranker-anchor-graph-block.js`
- `/tmp/ranker-cap-block-full.js`
- `/tmp/ranker-cap-block.js`
- `packages/workspace/scripts/lib/search/ranker.js`
- `packages/workspace/tests/explore-ranker.test.js`

## workspace-owned: activity log

- 2026-05-29 02:29:51 fs.write: `.task/workspace/inspect-explore-embedding-ranking/workpad.md`
- 2026-05-29 02:36:34 write: `/tmp/explore-ranker-new-tests.js`
- 2026-05-29 02:36:34 fs.write: `/tmp/explore-ranker-new-tests.js`
- 2026-05-29 02:36:42 write: `packages/workspace/tests/explore-ranker.test.js`
- 2026-05-29 02:36:42 fs.write: `packages/workspace/tests/explore-ranker.test.js`
- 2026-05-29 02:37:12 write: `/tmp/issue-soft-cap.js`
- 2026-05-29 02:37:12 fs.write: `/tmp/issue-soft-cap.js`
- 2026-05-29 02:37:17 patch lines 194-198: `packages/workspace/scripts/lib/search/ranker.js`
- 2026-05-29 02:37:17 fs.patch: `packages/workspace/scripts/lib/search/ranker.js`
- 2026-05-29 02:37:29 write: `/tmp/ranker-cap-block.js`
- 2026-05-29 02:37:29 fs.write: `/tmp/ranker-cap-block.js`
- 2026-05-29 02:37:34 patch lines 193-201: `packages/workspace/scripts/lib/search/ranker.js`
- 2026-05-29 02:37:34 fs.patch: `packages/workspace/scripts/lib/search/ranker.js`
- 2026-05-29 02:37:47 write: `/tmp/ranker-cap-block-full.js`
- 2026-05-29 02:37:47 fs.write: `/tmp/ranker-cap-block-full.js`
- 2026-05-29 02:37:54 patch lines 192-207: `packages/workspace/scripts/lib/search/ranker.js`
- 2026-05-29 02:37:54 fs.patch: `packages/workspace/scripts/lib/search/ranker.js`
- 2026-05-29 02:41:37 write: `/tmp/graph-centrality-test.js`
- 2026-05-29 02:41:37 fs.write: `/tmp/graph-centrality-test.js`
- 2026-05-29 02:41:45 patch lines 136-136: `packages/workspace/tests/explore-ranker.test.js`
- 2026-05-29 02:41:45 fs.patch: `packages/workspace/tests/explore-ranker.test.js`
- 2026-05-29 02:42:02 write: `/tmp/close-describe.js`
- 2026-05-29 02:42:02 fs.write: `/tmp/close-describe.js`
- 2026-05-29 02:42:07 patch lines 165-165: `packages/workspace/tests/explore-ranker.test.js`
- 2026-05-29 02:42:07 fs.patch: `packages/workspace/tests/explore-ranker.test.js`
- 2026-05-29 02:42:42 write: `/tmp/graph-relevance-block.js`
- 2026-05-29 02:42:42 fs.write: `/tmp/graph-relevance-block.js`
- 2026-05-29 02:42:47 patch lines 178-178: `packages/workspace/scripts/lib/search/ranker.js`
- 2026-05-29 02:42:47 fs.patch: `packages/workspace/scripts/lib/search/ranker.js`
- 2026-05-29 02:42:59 write: `/tmp/ranker-anchor-graph-block.js`
- 2026-05-29 02:42:59 fs.write: `/tmp/ranker-anchor-graph-block.js`
- 2026-05-29 02:43:05 patch lines 178-181: `packages/workspace/scripts/lib/search/ranker.js`
- 2026-05-29 02:43:05 fs.patch: `packages/workspace/scripts/lib/search/ranker.js`
- 2026-05-29 02:49:28 fs.write: `.task/workspace/inspect-explore-embedding-ranking/workpad.md`
- 2026-05-29 02:57:27 fs.write: `.task/workspace/inspect-explore-embedding-ranking/workpad.md`

## TDD implementation checkpoint

Ko approved moving from diagnosis into a focused TDD fix for the 8B/4096 ranking regressions.

Tests added before/around implementation:

- `keeps post-call analysis above generic manifests for issue-style soft queries`
  - This failed first because both the relevant post-call doc and generic manifest were flattened to the same `0.38` `issue-anchor-missing` cap.
  - This confirmed the DEV-1508 failure was ranker cap behavior, not an 8B retrieval miss.

- `does not let graph centrality overpower weak domain fit for product queries`
  - This failed first because a generic high-centrality workspace facade candidate could beat a better domain file with stronger lexical fit.
  - This encodes the dialer queue regression shape.

Implemented changes:

- Issue-ID queries now keep the strict `0.38` cap for candidates missing the issue anchor unless they have meaningful soft evidence.
- Candidates missing the issue anchor but having soft evidence (`tokenCoverage`, `softAnchorCoverage`, or `lexicalScore` >= 0.25) are capped at `0.52` with `capReason: issue-anchor-missing-soft-match`.
- Graph relevance is capped at `0.35` for weak lexical/name fit candidates (`lexicalScore < 0.2`, `nameMatch === 0`, `anchorCoverage === 0`) so graph centrality remains useful but cannot dominate product intent by itself.

Validation so far:

- `cd packages/workspace && bun run test tests/explore-ranker.test.js` passes: 7 tests.

Live compare after patch:

- Full 7-scenario matrix completed.
- Stable/unchanged controls:
  - Open Design Electron: same top 3, overlap 5/5.
  - Research ingest: same top 3, overlap 5/5.
  - Test selection: same top 3, overlap 5/5.
  - sanitizeHref/security: same top 3, overlap 5/5.
  - Browser docs: same top 3, overlap 5/5.
- DEV-1508 improved:
  - 4B/2560: `post-call-analysis.md` rank 2.
  - 8B/4096: `post-call-analysis.md` rank 2 after patch.
  - This fixed the main soft-query regression that previously moved it to rank 5.
- Dialer queue improved but not identical:
  - 8B top 3 are now useful: `queue-dialer.ts`, server dialer service, `run-dialer-scenario.ts`.
  - `packages/workspace/scripts/lib/facade/executor.ts` is no longer in top 5.
  - `packages/twenty-front/src/modules/dialer/hooks/useStartDialerCall.ts` remains rank 4, with `packages/api/src/shared/dialer.ts` rank 5. This may be acceptable depending on whether frontend start-call hook is considered relevant for the query.

Current decision point:

- The targeted ranker fix clearly improves the 8B regression and keeps controls stable.
- It may be worth shipping this ranker fix regardless of whether 8B becomes default.
- Promoting 8B as default still needs Ko alignment because the dialer queue ordering is improved but still not strictly better than 4B/2560.

- 2026-05-29 02:49:28 append: `.task/workspace/inspect-explore-embedding-ranking/workpad.md`

## Alignment decision — keep 4B default

Ko agreed the ranker fix is meaningful regardless of 8B vs 4B, but also agreed the 4B/2560 dialer ordering is more correct for the query `how does dialer queue call target resolution work`:

1. server dialer service
2. `packages/chat-bot/src/queue-dialer.ts`
3. `packages/workspace/scripts/run-dialer-scenario.ts`
4. `packages/api/src/shared/dialer.ts`
5. `packages/dialer/src/dialer.ts`

The 8B/4096 ordering improved after the ranker fix, but still ranked the frontend `useStartDialerCall` hook above core shared/domain dialer files. Therefore this task should ship the ranker fix only and should not promote 8B/4096 as the default embedding model.

Final decision for this task:

- Ship ranker fix.
- Keep Qwen3-Embedding-4B/2560 as the default.
- Keep the completed 8B/4096 index as an experimental cache for future work.
- Defer any future 8B promotion until a separate task improves backend/domain intent handling enough for the dialer queue case.

- 2026-05-29 02:57:27 append: `.task/workspace/inspect-explore-embedding-ranking/workpad.md`

## workspace-owned: validation evidence

- 2026-05-29 02:57:46 `audit`: passed — OK
- 2026-05-29 02:58:19 `review.run`: passed — OK
- 2026-05-29 02:58:30 `verify`: passed — OK

# Preserve query semantic retrieval after local hydration errors

branch: `task/explore/preserve-query-semantic-retrieval-after-local-hydration-errors`
stream: `stream/explore`
pr: https://github.com/consuelohq/opensaas/pull/2419
started: 2026-09-08

## acceptance criteria

- [ ] Query-time semantic retrieval is skipped only when document hydration proves the hosted semantic provider/request path is unavailable, not for local validation/persistence failures.
- [ ] A newly added headingless Markdown chunk over the document gateway limit can degrade hydration without suppressing a healthy query embedding in a previously indexed repo.
- [ ] Provider timeout/unavailable hydration still performs exactly one semantic request and falls back promptly to lexical retrieval.
- [ ] Existing truthful degraded-status behavior remains unchanged for deferred document chunks.
- [ ] Focused tests, strict review, full verify, stream promotion, CI, merge, Canary release, local update, and live acceptance remain green.

## plan

1. Add an integration regression that builds a healthy semantic index, then adds an oversized headingless Markdown file whose document hydration fails locally; prove current code suppresses the second query embedding.
2. Split hydration failure reporting into the existing human-readable failure plus an explicit provider-unavailable/skip-query signal. Keep local validation/storage failures degraded without poisoning query semantics.
3. Re-run the original hung/unavailable provider cases to prove the latency fix is preserved, then review/verify and promote into the already-synced Explore stream.

## Test-first contract

behavior under test: a local document-hydration error must not be treated as evidence that query embeddings are unavailable.
existing local pattern: `packages/os/tests/explore-index-hydration-fallback.test.ts` already runs real temporary repositories through `scripts/explore.js` with a controllable local embedding gateway and verifies request counts/degraded status.
new or changed tests: add a two-run case: first run builds a healthy index; second run adds an unheaded >4,000-character Markdown file that fails document payload validation before HTTP, while the healthy gateway must still receive the second query embedding.
focused red command: `bun --cwd packages/os test tests/explore-index-hydration-fallback.test.ts`
expected red failure: the new case observes only one total query request because `explore.js` currently sets `skipSemantic` from any `indexResult.embeddingFailure`.
no-test waiver: not applicable.

## files changed

- none yet

## key decisions

- Codex P2 on stream PR #2415 is valid: `embeddingFailure` is a broad hydration error string, not proof that the provider is unavailable.
- Preserve the 4s query / 8s document deadlines and the skip-after-provider-failure optimization from PR #2412.
- Avoid message matching in `explore.js`; carry an explicit availability signal out of hydration instead.

## notes for ko

- PR #2412 is already merged into `stream/explore`; stream PR #2415 is synced with current main.
- Current stream CI had no active test failures when this review fix started; a superseded API-breaking-change workflow was cancelled and restarted.

## improvements noticed

- `chunkMarkdown` still emits a single unsplit chunk for headingless Markdown. That is the local validation edge case Codex used; this task will classify its failure correctly rather than broadening scope into chunking behavior.

## errors i ran into

- None in this follow-up task yet.

---

## publish checklist

- [ ] focused red captured
- [ ] focused green captured
- [ ] strict review green
- [ ] full verify green
- [ ] task pushed/promoted to stream
- [ ] stream CI/reviews green
- [ ] stream merged to main
- [ ] Canary release + local update complete
- [ ] live acceptance complete

- 2026-09-08 14:52:08 write: `.task/explore/preserve-query-semantic-retrieval-after-local-hydration-errors/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-08 14:52:08 fs.write: `.task/explore/preserve-query-semantic-retrieval-after-local-hydration-errors/workpad.md`
- 2026-09-08 14:52:25 apply-patch: `packages/os/tests/explore-index-hydration-fallback.test.ts`
- 2026-09-08 14:53:09 apply-patch: `packages/os/tests/explore-index-hydration-fallback.test.ts`
- 2026-09-08 14:54:43 fs.write: `.task/explore/preserve-query-semantic-retrieval-after-local-hydration-errors/workpad.md`
- 2026-09-08 14:56:20 fs.write: `.task/explore/preserve-query-semantic-retrieval-after-local-hydration-errors/workpad.md`
- 2026-09-08 14:56:52 fs.write: `.task/explore/preserve-query-semantic-retrieval-after-local-hydration-errors/workpad.md`
- 2026-09-08 14:57:23 fs.write: `.task/explore/preserve-query-semantic-retrieval-after-local-hydration-errors/workpad.md`
- 2026-09-08 15:01:11 fs.write: `.task/explore/preserve-query-semantic-retrieval-after-local-hydration-errors/workpad.md`
- 2026-09-08 15:03:33 fs.write: `.task/explore/preserve-query-semantic-retrieval-after-local-hydration-errors/workpad.md`

## TDD evidence

- setup-only false red: `trc_215ff53c9393` failed before product code because the new task worktree lacked package-local `tree-sitter`/`sqlite-vec` dependencies; repaired with ignored dependency links (`trc_b2c57d629abc`).
- fixture-adjustment run: `trc_7788ccf07a6a` isolated the new test but showed the oversized file was untracked, so it was not indexed; staged the file in the fixture.
- focused true red: `trc_46e82c73e176` — 5 existing hydration/fallback tests pass; only the new local-validation case fails. The second Explore run is truthfully degraded with deferred chunks, but `queryRequests` is 1 instead of 2, proving `embeddingFailure` incorrectly suppresses a healthy query embedding.

- 2026-09-08 14:54:43 append: `.task/explore/preserve-query-semantic-retrieval-after-local-hydration-errors/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/index/embedder.js`
- `packages/os/scripts/lib/index/embedding-gateway.js`
- `packages/os/tests/semantic-embedding-gateway.test.ts`
- `packages/workspace/scripts/verify.js`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/test-selection.test.js`

## workspace-owned: validation evidence

- 2026-09-08 14:57:13 `review.run`: passed — OK
- 2026-09-08 14:57:23 apply-patch: `packages/os/tests/semantic-embedding-gateway.test.ts`
- first strict review: `trc_a77ff1f4ca01` found only 2 mechanical `CATCH_TYPING` findings in the new unit test; no product or pre-existing findings. Updated both catches to explicit `unknown` typing.
- 2026-09-08 14:57:23 append: `.task/explore/preserve-query-semantic-retrieval-after-local-hydration-errors/workpad.md`
- 2026-09-08 14:57:39 `review.run`: passed — OK
- 2026-09-08 14:59:08 `verify`: failed — COMMAND_FAILED
- first full verify: `trc_8c51eba16acd` had clean review and DB gates but failed test selection. Direct canonical selection evidence `trc_e3e821474d87` shows the critical Explore rule and compact-output rule pass, but `embedder.js` was not claimed by the exclusive Explore registry rule, so auto-discovery also selected the historically red package-wide `@consuelo/os` suite. The failures are unrelated/pre-existing (lifecycle help matcher, skill migration parity, Grok discovery, etc.). Fixing the registry ownership gap so the Explore rule covers the shared embedder it now intentionally changes.
- 2026-09-08 15:01:11 append: `.task/explore/preserve-query-semantic-retrieval-after-local-hydration-errors/workpad.md`
- 2026-09-08 15:01:40 apply-patch: `packages/workspace/test-selection.rules.json`
- 2026-09-08 15:01:40 apply-patch: `packages/workspace/tests/test-selection.test.js`
- 2026-09-08 15:02:44 `review.run`: passed — OK
- 2026-09-08 15:03:21 `verify`: passed — OK

## Final task validation

- [x] Local hydration validation/storage failures remain degraded without suppressing healthy query semantics.
- [x] Real provider/network availability failures retain the one-request fast-fallback behavior.
- [x] Gateway availability classification is explicit: fetch failures and 408/429/5xx are unavailable; local payload validation is not.
- [x] Explore regression suite: `trc_430498995736` — 13 files / 98 tests passed.
- [x] Test-selection registry contract: `trc_3495b4ffcc06` — 73/73 passed from the canonical repo-root command.
- [x] Direct embedder ownership check: `trc_3bdafe55585a` selects only `os-explore-retrieval-science`, not the broad OS package suite.
- [x] Final strict review: `trc_dd611ed2afa2` — zero findings.
- [x] Final full verify: `trc_24d425cd777f` — publish-valid, zero review findings and zero DB risks.

### Product / validation files changed

- `packages/os/scripts/explore.js`
- `packages/os/scripts/lib/index/embedder.js`
- `packages/os/scripts/lib/index/embedding-gateway.js`
- `packages/os/scripts/lib/index/indexer.js`
- `packages/os/tests/explore-index-hydration-fallback.test.ts`
- `packages/os/tests/semantic-embedding-gateway.test.ts`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/test-selection.registry.json` (regenerated)
- `packages/workspace/tests/test-selection.test.js`

### Publish checklist status

- [x] focused red captured
- [x] focused green captured
- [x] strict review green
- [x] full verify green
- [ ] task pushed/promoted to stream
- [ ] stream CI/reviews green
- [ ] stream merged to main
- [ ] Canary release + local update complete
- [ ] live acceptance complete

- 2026-09-08 15:03:33 append: `.task/explore/preserve-query-semantic-retrieval-after-local-hydration-errors/workpad.md`

# investigate explore bad relevance for issue queries

branch: `task/workspace-agents/investigate-explore-bad-relevance-for-issue-queries`
stream: `stream/workspace-agents`
taskSession: `tsk_49b8e4f23c3f`
started: 2026-05-26

## objective

Diagnose why `explore` returned irrelevant results for an issue/feature query and produce a validation-backed action plan that improves general decision-engine retrieval behavior without overfitting to `DEV-1508`.

## acceptance criteria

- [ ] Read `packages/workspace/decision.md` and relevant decision-engine implementation files.
- [ ] Inspect current `explore`, retriever, ranker, index/store, and related tests.
- [ ] Inspect recent `explore` traces to understand real agent usage patterns.
- [ ] Run scenario checks covering the failing query and other realistic query classes.
- [ ] Identify whether reindexing is sufficient or whether retrieval/ranking logic must change.
- [ ] Produce an action plan with concrete implementation steps, validation matrix, and non-goals.

## current findings

- The failing query reproduced through `explore` and returned unrelated high-scoring semantic-only matches.
- Initial code reading showed scoring is mostly `embeddingSimilarity * boost`, with weak path-only `nameMatch` influence.
- Exact issue IDs and lexical anchors are not currently treated as hard evidence.
- Need to read `decision.md`, tests, and traces before recommending implementation.

## plan

1. Read decision-engine doctrine and algorithms.
2. Read implementation files and tests.
3. Inspect recent `explore` traces and classify usage patterns.
4. Run a scenario matrix against current `explore` output.
5. Produce an action plan that balances semantic retrieval, lexical evidence, graph context, external-source routing, and validation.

## files changed

- `.task/workspace-agents/investigate-explore-bad-relevance-for-issue-queries/workpad.md`
- `packages/workspace/scripts/lib/search/ranker.js`

## workspace-owned: files changed

- `.task/workspace-agents/investigate-explore-bad-relevance-for-issue-queries/workpad.md`
- `packages/workspace/scripts/lib/search/ranker.js`

## workspace-owned: activity log

- 2026-05-26 17:08:08 fs.write: `.task/workspace-agents/investigate-explore-bad-relevance-for-issue-queries/workpad.md`
- 2026-05-26 17:11:48 fs.write: `.task/workspace-agents/investigate-explore-bad-relevance-for-issue-queries/workpad.md`
- 2026-05-26 17:58:31 fs.write: `packages/workspace/scripts/lib/search/ranker.js`
- 2026-05-26 18:24:50 fs.write: `.task/workspace-agents/investigate-explore-bad-relevance-for-issue-queries/workpad.md`
- 2026-05-26 18:25:29 fs.write: `.task/workspace-agents/investigate-explore-bad-relevance-for-issue-queries/workpad.md`

## workspace-owned: validation evidence

- 2026-05-26 17:11:21 `audit`: failed — COMMAND_FAILED
- 2026-05-26 18:24:38 `audit`: passed — OK
- 2026-05-26 18:25:13 `review.run`: passed — OK
- 2026-05-26 18:25:22 `verify`: passed — OK

## investigation evidence — 2026-05-26

Read `packages/workspace/decision.md` and confirmed doctrine:

- `explore` creates a prior, not proof.
- confidence must come from evidence events, file reads, tests, runtime checks, and contradictions resolved.
- known failure modes include search treated as truth, graph connections empty, type files outranking implementation, and utility hubs dominating.
- graph expansion is supposed to prevent the system from degrading into plain vector search.

Read implementation files:

- `packages/workspace/scripts/lib/search/ranker.js`
- `packages/workspace/scripts/lib/search/retriever.js`
- `packages/workspace/scripts/explore.js`
- `packages/workspace/scripts/lib/index/store.js`
- `packages/workspace/scripts/lib/index/embedder.js`

Core implementation finding:

- Current ranking is dominated by `embeddingSimilarity * boost`.
- `nameMatch` only checks query tokens against `candidate.path` and gives a small 1.10 multiplier.
- Vector retrieval calls `store.searchChunks(queryVector, budget * 3)` before graph expansion.
- `store.searchChunks` is pure vector nearest-neighbor search with no lexical, exact-token, or source-routing constraints.
- `belief_prior` is normalized from score/rawScore, so bad semantic-only matches can look like strong priors.

Scenario matrix:

1. `DEV-1508 dialer post-call analysis Pi agent Groq transcript automatic disposition`
   - Bad. Top result was Postman response-time test chunk with high score and no relevant domain evidence.
   - This query should route to Linear first because `DEV-1508` is an external issue identifier.

2. `how does dialer queue call target resolution work`
   - Good top results. Found `dialer-call-start.service.ts` / `resolveQueueTargets` and tests.
   - Some irrelevant workspace `ai-review.js` still appeared high because score clamped to 1.

3. `code.run workspace maxOperations validation mode read edit verify`
   - Mixed. Found codemode/tooling files, but import chunks and manifest blobs ranked too high.

4. `browser screenshot full page open url accessibility snapshot tool`
   - Mixed/bad. `TOOLS.md` browser.screenshot appeared second; tool manifest and unrelated Open Design screenshot types ranked above/near it.

5. `sanitizeHref javascript data vbscript link xss`
   - Bad. Returned Open Design sanitizer/escapeHtml-ish matches and did not find a precise `sanitizeHref` implementation in top 5.

6. `test selection registry changed file packages/dialer/src/dialer.ts selects dialer specs`
   - Bad. Returned codemode tests and unrelated Storybook/testing files instead of `packages/workspace/scripts/test-selection.js` / registry/rules.

7. `research ingest youtube article pdf durable context packet extracted manifest`
   - Mixed. `TOOLS.md` and `SCRIPTS.md` relevant results appeared, but unrelated Open Design i18n content ranked first.

Trace findings:

- Recent explore traces include repeated 600s timeouts and several very large outputs near 114k output tokens.
- `context.trace` with `since: "24h"` unexpectedly returned zero rows; querying without `since` returned recent explore rows. That is a separate trace-query usability issue.

Index audit:

- `audit { index: true }` failed: 4 stale files (`package.json`, a NavigationDrawer file, `packages/workspace/SCRIPTS.md`, `packages/workspace/scripts/verify.js`).
- Index stats: 15,390 files, 73,707 chunks, last indexed 2026-05-26T01:14:58Z, last full index 2026-04-29T01:40:26Z.
- Reindexing is worth doing, but it does not fix pure-vector ranking, missing lexical anchors, or source routing.

## recommended action plan

1. Add a decision-engine relevance evaluation harness before changing ranking.
   - Create representative scenarios covering issue IDs, implementation discovery, exact symbols, generated tool docs, workflow docs, and security strings.
   - Store expected top paths / allowed path families / required anchor coverage.
   - Test current behavior first so regressions are visible.

2. Add lexical and anchor features to retrieval/ranking.
   - Tokenize query into ordinary tokens, exact identifiers, quoted phrases, file paths, package names, and issue IDs.
   - Compute lexical overlap across path, symbol/name, chunk preview/content, chunk type, and file outline.
   - Treat `DEV-1508`-style issue IDs, exact symbols, file paths, and package paths as hard anchors.
   - Cap semantic-only candidates when hard anchors exist.

3. Add source routing before repo vector search.
   - `DEV-*` and other issue IDs should trigger `linear.issue` / `linear.search` first.
   - Known tool names such as `research.ingest`, `browser.screenshot`, `code.run` should search `tool-manifest.json`, `TOOLS.md`, `SCRIPTS.md`, and schema files with lexical priority.
   - File paths in a query should trigger exact file/path lookup before vector search.

4. Calibrate scores and output labels.
   - Separate `semantic_similarity`, `lexical_score`, `anchor_coverage`, `graph_score`, `structural_score`, and `final_score`.
   - Stop clamping many results to `score: 1` in user-facing output.
   - Add a warning/reason such as `semantic-only; no query anchors found`.
   - Keep `belief_prior` modest unless lexical/anchor/graph evidence supports the result.

5. Reduce generated/noisy file dominance.
   - Penalize huge generated/navigation/i18n/blob files unless they contain exact anchors.
   - Consider default exclusions or lower weights for vendored Open Design, generated docs JSON, Postman collections, and i18n blobs unless query terms point there.

6. Improve graph signal quality.
   - Preserve graph expansion as doctrine requires, but make graph boost conditional on query relevance.
   - Do not let graph count alone promote generic hubs/import chunks.

7. Add trace and operational safeguards.
   - Fix `context.trace since` filtering if confirmed reproducible.
   - Add explore trace summaries that include query text, top paths, score components, anchor coverage, and timeout/output size.
   - Add output-size guardrails for explore so large results do not produce 100k+ token outputs.

8. Run validation.
   - Focused tests for tokenization, anchor detection, lexical scoring, source routing, score calibration, generated-file penalties, and scenario harness.
   - Scenario matrix must show improved top results without breaking the good dialer runtime query.
   - Run `audit { index: true }` and reindex only after ranking tests exist, so index freshness is separated from algorithm quality.

- 2026-05-26 17:11:48 append: `.task/workspace-agents/investigate-explore-bad-relevance-for-issue-queries/workpad.md`

- 2026-05-26 17:58:31 write: `packages/workspace/scripts/lib/search/ranker.js`

## implementation update — 2026-05-26

Ko approved implementation of action items 1–7 and explicitly said not to reindex before checking OpenRouter/API-key path.

Implemented:

- Added hybrid lexical/anchor-aware ranker features in `packages/workspace/scripts/lib/search/ranker.js`.
- Added query signal extraction for issue IDs, dotted tool names, quoted phrases, path-like terms, soft anchors, token coverage, and anchor coverage.
- Added score calibration/caps for missing issue anchors, missing hard anchors, semantic-only matches, semantic-only noisy/generated matches, and import chunks with weak lexical evidence.
- Added generated/noisy-file penalties for Postman collections, generated docs JSON, launch-docs source JSON, i18n blobs, and vendored Open Design unless the query explicitly targets Open Design/Electron/desktop.
- Added text fallback retrieval in `packages/workspace/scripts/lib/index/store.js` via `searchChunksByText`.
- Added semantic + lexical row merging in `packages/workspace/scripts/lib/search/retriever.js`, including retrieval type propagation.
- Added source-route hints in `packages/workspace/scripts/explore.js` for `DEV-*` issue IDs and dotted workspace tool names.
- Changed `belief_prior` to absolute score calibration instead of relative top-result normalization.
- Added `packages/workspace/tests/explore-ranker.test.js`.

Validation:

- `node --check` passed for:
  - `packages/workspace/scripts/lib/search/ranker.js`
  - `packages/workspace/scripts/lib/search/retriever.js`
  - `packages/workspace/scripts/lib/index/store.js`
  - `packages/workspace/scripts/explore.js`
- Focused tests passed:
  - repo-root: `./packages/workspace/node_modules/.bin/vitest run packages/workspace/tests/test-selection.test.js`
  - package cwd: `cd packages/workspace && bun run test tests/explore-ranker.test.js tests/context-trace.test.js`
- `audit { scripts: true }` passed.
- Scenario smoke through task-worktree CLI showed:
  - `DEV-1508 ...` now emits a `linear.issue` source route and keeps bad repo-only priors low (`belief_prior` around 0.44), with relevant post-call files surfacing below the route.
  - Dialer queue query still returns `dialer-call-start.service.ts` first and keeps implementation paths high.
  - Open Design/Electron query now returns Open Design packaging/dev Electron files first.
  - Research ingest query now returns `packages/workspace/scripts/research-ingest.js` and its test in the top results.

Tooling notes:

- Direct `workspace.call({ tool: "explore", taskSession })` appeared to use the old installed/main explore implementation after restart; task-worktree CLI validation used the edited files and is the reliable proof for this task.
- Typed `git.diff` returned zero changes, but raw task-worktree `git status` showed the expected changed files. Used raw task-worktree git output for diff state because typed diff was stale/incorrect.
- Do not run `--reindex` in this task. Reindex should wait until Ko confirms the OpenRouter/API-key embedding path.

Files changed:

- `packages/workspace/scripts/explore.js`
- `packages/workspace/scripts/lib/index/store.js`
- `packages/workspace/scripts/lib/search/ranker.js`
- `packages/workspace/scripts/lib/search/retriever.js`
- `packages/workspace/tests/explore-ranker.test.js`
- scoped task metadata/workpad files

- 2026-05-26 18:24:50 append: `.task/workspace-agents/investigate-explore-bad-relevance-for-issue-queries/workpad.md`

## publish-gate validation — 2026-05-26

Additional validation after implementation update:

- `review.run` against `origin/stream/workspace-agents` passed with 0 blocking issues.
- `verify` against `origin/stream/workspace-agents` passed and wrote publish-valid stamp to `.task/workspace-agents/investigate-explore-bad-relevance-for-issue-queries/verify.json`.
- Note: review selected zero affected suites, so focused tests listed above are the behavior proof for this workspace tooling change.

Known limitation / follow-up:

- `DEV-*` queries now emit source-route hints and low-confidence repo-only results. `explore` does not call Linear directly; the agent/workspace caller must follow `source_routes` before treating repo retrieval as complete.
- Reindex was intentionally not run.

- 2026-05-26 18:25:29 append: `.task/workspace-agents/investigate-explore-bad-relevance-for-issue-queries/workpad.md`

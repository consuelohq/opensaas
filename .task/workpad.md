# workspace explore decision confidence system

branch: `task/workspace-agents/workspace-explore-decision-confidence-system`
stream: `stream/workspace-agents`
pr: https://github.com/consuelohq/opensaas/pull/222
started: 2026-04-27

## acceptance criteria

- [x] all 6 commands exist and run (`explore`, `decide-next`, `confidence-score`, `exploit`, `confirm`, `audit`)
- [x] `explore` works against real repo structure with tree-sitter + embeddings + graph expansion
- [x] incremental indexing works (only re-indexes changed files)
- [x] worktree overlays do not force full re-indexing
- [x] shared local persistence works at `~/.cache/workspace-index/`
- [x] both human-readable and `--json` output for all commands
- [x] `confirm` correctly piggybacks on existing verify flow
- [x] `audit --scripts` correctly compares SCRIPTS.md against package.json
- [x] SCRIPTS.md is updated with all new commands
- [x] `--help` works for all commands

## plan

1. Inspect existing workspace script patterns and package setup.
2. Add the git-aware index/search/state libraries.
3. Wire all six commands with human and json output.
4. Update package scripts and SCRIPTS.md.
5. Smoke test explore/audit and run verification.

## files changed

- `package.json`
- `packages/workspace/SCRIPTS.md`
- `packages/workspace/package.json`
- `packages/workspace/scripts/task-exec.js`
- `packages/workspace/scripts/task-fs.js`
- `packages/workspace/bun.lock`
- `packages/workspace/scripts/audit.js`
- `packages/workspace/scripts/confidence-score.js`
- `packages/workspace/scripts/confirm.js`
- `packages/workspace/scripts/decide-next.js`
- `packages/workspace/scripts/exploit.js`
- `packages/workspace/scripts/explore.js`
- `packages/workspace/scripts/lib/index/chunker.js`
- `packages/workspace/scripts/lib/index/embedder.js`
- `packages/workspace/scripts/lib/index/graph-builder.js`
- `packages/workspace/scripts/lib/index/indexer.js`
- `packages/workspace/scripts/lib/index/store.js`
- `packages/workspace/scripts/lib/search/ranker.js`
- `packages/workspace/scripts/lib/search/retriever.js`
- `packages/workspace/scripts/lib/state/evidence-log.js`
- `packages/workspace/scripts/lib/state/explore-state.js`


## key decisions

- Qwen local embeddings remain the v1 embedding model. Full index completed locally.
- Evidence is the decision spine: commands write events to `.task/evidence-log.json` and mirror them into SQLite.
- `task:fs read` records `file.read` events automatically; `decide-next --mark-read <path>` is the manual fallback.

## notes for ko

- Full Qwen index completed: `69,609 / 69,609` chunks embedded, `0` missing.
- `explore -- "how does the dialer queue work?" --json` returned valid JSON with 3 `packages/dialer/` results and scores in range.
- `confirm --verify --json` passed and wrote `verify.pass`.

## improvements noticed

- Raised chunk line cap to 150 while preserving semantic chunking.
- Added SQLite `busy_timeout` after evidence write smoke exposed transient lock contention.

## errors i ran into

- Initial local embedding run had been stopped early; resumed and completed it fully.
- First `confirm --verify` found review-harness failures; fixed catch bindings, SQL template query warnings, async error-handling checks, then verify passed.

---

## publish checklist

```bash
bun run task:push -- --message "type(workspace-agents): description" --changed
bun run task:pr
bun run task:finish
```


## clarified definition of done

- [x] Qwen local embedding index is complete: missing vectors equals 0.
- [x] explore -- "how does the dialer queue work?" --json returns valid JSON.
- [x] Explore output includes at least 3 real packages/dialer/ files.
- [x] decide-next --json returns an action based on evidence state.
- [x] confidence-score --json reports confidence plus evidence for/against and uncertainties.
- [x] exploit --json marks the state as exploiting and names target/context files.
- [x] confirm --verify --json piggybacks on existing verify.js and writes evidence events.
- [x] .task/evidence-log.json exists and is updated by commands.
- [x] Evidence is mirrored into SQLite for future ranking/learning.
- [x] Read tracking cannot be forgotten when using normal workspace scripts, or at minimum manual marking exists and is documented.
- [x] audit --scripts --json passes.
- [x] All six commands support --help and --json.
- [x] packages/workspace/SCRIPTS.md is truthful.
- [x] node --check passes for all touched JS command/lib files.
- [x] bun run verify passes or any failure is fixed before push.

- 2026-04-28 06:15:32 append: `.task/workpad.md`


## Apr 28 review fixes / reindex pass

- [x] Verified and patched audit --scripts so undocumented workspace scripts fail audit.
- [x] Verified and patched audit error reporting to preserve actual thrown errors.
- [x] Verified and patched confirm --test argument validation.
- [x] Verified and patched confirm verify parsing so unparseable verify JSON is not a pass.
- [x] Verified and patched decide-next --context / --mark-read validation.
- [x] Verified and patched chunker tree-sitter require restoration with try/finally.
- [x] Verified chunking limits are 150 and no remaining limitChunks=40 path exists.
- [x] Verified graph_edges table had rows; fixed retriever graph expansion so existing semantic candidates still get graph_connections and expansion can add graph candidates.
- [x] Verified exploit context_files were already deduped via unique([...]) before output.
- [x] Moved Qwen prior out of confidence-score evidence_for into starting_state.
- [x] Patched embedder context cache to key by modelPath and cap stable contexts at 2.
- [x] Patched evidence-log store mirroring to close short-lived SQLite handles and preserve mirror errors.
- [x] node --check passed for touched JS.
- [ ] Delete existing workspace index DB and run full Qwen re-index.
- [ ] Smoke test explore JSON for dialer results, score > 0.75, structural reasons, non-empty graph_connections, no duplicates.
- [ ] Run full command chain: decide-next, confidence-score, exploit, confirm --verify, audit --scripts.

- 2026-04-28 16:54:43 append: `.task/workpad.md`

## Apr 29 completion proof

- [x] Deleted existing index DB and completed full Qwen re-index. Final DB count: 59,144 chunks / 59,144 embeddings / 0 missing / 55,419 graph edges.
- [x] Fixed graph expansion; explore output now has non-empty graph_connections.
- [x] Smoke test passed: valid JSON, 10 results, 4 packages/dialer results, top score 0.8098, scores in range, structural reasons present, graph connections non-empty, no duplicate paths or duplicate graph connections.
- [x] Full command chain passed: decide-next --json, confidence-score --json, exploit --json, confirm --verify --json, audit --scripts --json.
- [x] confirm --verify returned CONFIRMED and direct bun run verify -- --json passed review + DB guards.
- [x] All six commands support --help and --json.
- [x] node --check passed for touched JS files.
- [x] task:fs read tracking verified through branch script: file.read was written to .task/evidence-log.json and mirrored into SQLite evidence_events.

- 2026-04-29 01:45:42 append: `.task/workpad.md`

## Apr 29 round 2 ranking/confidence fixes

- [x] Kept the completed index intact. No DB delete or re-index was run.
- [x] Patched confidence-score so only the latest verify/test/runtime event contributes to evidence_for/evidence_against.
- [x] Patched confidence-score top-3 graph check to query SQLite graph_edges for direct edges between the current top 3 result paths.
- [x] Patched ranking weights to 0.60 embedding / 0.15 graph centrality / 0.10 recency / 0.10 change / 0.05 name.
- [x] Replaced raw edge-count centrality with weighted link quality plus a 0.5 type/export-heavy penalty.
- [x] Added implementation-name bonus for class/function/method chunks that match query terms.
- [x] Preferred structural chunk reasons within 0.05 similarity of a top block chunk.
- [x] Validation: dialer query now ranks `packages/dialer/src/services/parallel-dialer.ts` #1 and `packages/dialer/src/dialer.ts` #2, above `packages/dialer/src/types.ts`.
- [x] Validation: dialer confidence has no stale verify pass/fail conflict and no false top-3 graph penalty.
- [x] Validation: audit --scripts passes and all six command help surfaces still work.

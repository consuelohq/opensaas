# Redesign tool search retrieval and benchmarking

branch: `task/os/redesign-tool-search-retrieval-and-benchmarking`
stream: `stream/os`
pr: https://github.com/consuelohq/opensaas/pull/1840

## current status

- Deleted the obsolete `packages/workspace/scripts/tools-search.ts` implementation and its legacy test; OS is now the single source of truth for tool discovery.
- Added explicit runtime-vs-workspace execution scope so runtime-owned OS commands such as `tools.search` execute from the installed OS package rather than resolving through the active repository.
- Replaced global query alias expansion, intent-pack magic boosts, permissive subsequence fuzzy matching, and operation-driven domain selection with deterministic domain/entity-first retrieval.
- Added compact default search responses, bounded ranking/return counts, exact-name routing, explicit abstention, and semantic/embedding fallback only when deterministic retrieval is insufficient.
- Added structured search metadata to tool definitions and regenerated the canonical manifests.
- Added a benchmark harness and a 93-case gold/contrast corpus with cluster splitting, paraphrase invariance, domain macro metrics, abstention checks, and replay against historical `tools.search` traces.

## key decisions

Historical `tools.search` traces showed large payloads, broad candidate sets, and cross-domain routing errors such as Cloudflare/R2 queries landing on filesystem tools or generic log/status words forcing deployment/task intent. The redesign moves domain knowledge into manifests and tests architectural invariants instead of hand-tuning query-specific score boosts.

## validation evidence

- Affected Vitest surface: 69/69 tests passing across 13 files.
- `bun run --cwd packages/os generate-tool-manifest:check` passed.
- `bun run --cwd packages/os typecheck` passed.
- `git diff --check` passed.
- Repo-local strict review finished with `yours=[]` and `preExisting=[]` after fixing all review findings.
- Gold/contrast benchmark: 100% Top-1, Recall@3, MRR, macro-domain accuracy, contrast accuracy, paraphrase invariance, and abstention accuracy across 93 cases.
- Historical replay: 392 real August searches; average payload fell from ~12.76 KB to ~1.31 KB (~89.7% reduction), average returned tools from 8.61 to 2.79, and ranked candidates to 6.88 with a hard maximum of 8.

## issues and recovery

- The authenticated `review.run` transport was unavailable during validation, so the exact repo-local review wrapper was used instead.
- Historical downstream-use labels remain diagnostic only because later workflow actions are not reliable ground truth for the original search result.
- Stream handoff should occur through `task.pr`; the failure of this workpad gate despite prior append-only updates is being investigated in the follow-up workflow task.

## workspace-owned: validation evidence

- 2026-08-11 22:15:58 `verify`: passed — OK
- 2026-08-11 22:15:58 `verify`: passed — OK

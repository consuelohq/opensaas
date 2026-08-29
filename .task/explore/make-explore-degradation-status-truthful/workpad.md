# Make Explore degradation status truthful

branch: `task/explore/make-explore-degradation-status-truthful`
stream: `stream/explore`
pr: https://github.com/consuelohq/opensaas/pull/2304
started: 2026-08-29

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## files changed

- none yet

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## errors i ran into

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(explore): description" --changed
bun run task:pr
bun run task:finish
```

## acceptance criteria

- [ ] A failed semantic hydration batch counts every still-unembedded chunk in that failed batch as deferred, plus any later unprocessed chunks.
- [ ] If document hydration succeeds but query embedding fails and retrieval falls back to lexical-only results, Explore reports `embedding_status: "degraded"` in its default compact output.
- [ ] Healthy semantic retrieval still reports `embedding_status: "ready"` and does not invent deferred chunks.
- [ ] Focused regressions, the full Explore critical suite, strict review, canonical verify, stream promotion, PR #2300 CI/review, Canary release, Workspace Edge deployment, and live historical baselines succeed.

## plan

1. Synchronize this task worktree to current `stream/explore` before product edits because task bootstrap starts from `main` and the stream contains the prior three review fixes.
2. Add focused red assertions for failed-batch deferred accounting and query-time semantic fallback status.
3. Make the smallest indexer/Explore status changes without altering ranking or fallback policy.
4. Run focused + full Explore suites, strict review, verify, and promote #2304 into `stream/explore`.
5. Re-run #2300 final CI/Codex gate, then release to Canary, deploy Workspace Edge, and rerun live baselines/traces.

## Test-first contract

behavior under test: Explore's top-level degradation state is truthful for both document-hydration failure and query-embedding failure; deferred counts include the failed hydration batch itself.
existing local pattern: `explore-index-hydration-fallback.test.ts` already runs the Explore CLI against controlled embedding-gateway fixtures; `explore-retriever-fallback.test.ts` already proves lexical fallback when semantic query embedding is unavailable; compact output now preserves top-level degradation fields.
new or changed tests: extend `explore-index-hydration-fallback.test.ts` so the failing-document-gateway case asserts `chunks_deferred > 0`, and add a gateway fixture that succeeds for document embeddings but fails for `kind: "query"`, asserting lexical results plus `embedding_status: "degraded"` with no document-hydration deferral.
focused red command: `bun --cwd packages/os test tests/explore-index-hydration-fallback.test.ts tests/explore-retriever-fallback.test.ts tests/explore-output-contract.test.ts`.
expected red failure: failed hydration currently reports the failed batch as processed, allowing `chunks_deferred: 0`; query-time semantic fallback currently leaves top-level `embedding_status` at `ready` because it only considers index hydration failure.
no-test waiver: not applicable.

## key decisions

- Both final Codex P2 findings are valid and affect observability/correctness, not ranking policy.
- Preserve lexical fallback availability. The fix is to make degradation truthful, not to turn query embedding failure into a hard error.
- Keep the failed-batch deferred calculation precise: unembedded items in the failed batch plus later batches, excluding cached vectors that were successfully attached before the failure.

- 2026-08-29 08:24:19 append: `.task/explore/make-explore-degradation-status-truthful/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-29 08:24:19 fs.write: `.task/explore/make-explore-degradation-status-truthful/workpad.md`

# Bound total Explore hydration phase latency

branch: `task/explore/bound-total-explore-hydration-phase-latency`
stream: `stream/explore`
pr: https://github.com/consuelohq/opensaas/pull/2424
started: 2026-09-08

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

## Test-first contract

behavior under test: interactive Explore document hydration must enforce one total phase deadline across all sequential embedding batches, not restart the full document timeout for each batch.
existing local pattern: `packages/os/tests/explore-index-hydration-fallback.test.ts` already exercises real temporary repositories through `scripts/explore.js`, includes a 96-file multi-batch hydration fixture, and enforces a 15s interactive fallback budget.
new or changed tests: add a multi-batch slow-provider regression where the first document batch succeeds near the hydration deadline and the next batch hangs; current code should exceed the 15s harness budget, fixed code must fall back lexically before it.
focused red command: `bun --cwd packages/os test tests/explore-index-hydration-fallback.test.ts`
expected red failure: the new multi-batch case is killed by the existing 15s harness because each sequential document gateway request independently receives the full 8s timeout.
no-test waiver: not applicable.

## plan

1. Reuse the existing multi-batch fixture to prove the per-request timeout can exceed the total interactive budget.
2. Carry an explicit remaining hydration budget from the indexer to the embedder/gateway instead of relying on another independent 8s timeout per batch.
3. Preserve query 4s and document 8s default client deadlines, exhaustive/offline semantics where appropriate, provider-vs-local failure classification, and truthful degraded/deferred output.
4. Run focused/broad Explore tests, strict review, full verify, promote PR #2424 to `stream/explore`, then re-run current-head CI/reviews before merging PR #2415.

- 2026-09-08 15:16:52 append: `.task/explore/bound-total-explore-hydration-phase-latency/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-08 15:16:52 fs.write: `.task/explore/bound-total-explore-hydration-phase-latency/workpad.md`
- 2026-09-08 15:19:47 fs.write: `.task/explore/bound-total-explore-hydration-phase-latency/workpad.md`
- 2026-09-08 15:21:02 fs.write: `.task/explore/bound-total-explore-hydration-phase-latency/workpad.md`
- 2026-09-08 15:22:28 fs.write: `.task/explore/bound-total-explore-hydration-phase-latency/workpad.md`
- 2026-09-08 15:24:01 fs.write: `.task/explore/bound-total-explore-hydration-phase-latency/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/lib/index/embedder.js`
- `packages/os/scripts/lib/index/embedding-gateway.js`
- `packages/os/scripts/lib/index/indexer.js`
- `packages/os/tests/explore-index-hydration-fallback.test.ts`

- 2026-09-08 15:17:15 apply-patch: `packages/os/tests/explore-index-hydration-fallback.test.ts`
## TDD evidence

- setup-only false run `trc_a83b8877c161`: macOS temp volume was full from 270 leaked `consuelo-explore-*` integration fixture directories, causing ENOSPC after the first three tests. Removed only those ephemeral fixture directories (`trc_e61413448cda`).
- focused true red `trc_730c28c782b0`: 6 existing tests passed; only `should bound total hydration latency when a later semantic batch hangs` failed at 15.095s with the harness error `Explore did not fail over from semantic hydration within 15 seconds`. This reproduces the current-head Codex P2 exactly.

- 2026-09-08 15:19:47 append: `.task/explore/bound-total-explore-hydration-phase-latency/workpad.md`

- 2026-09-08 15:20:07 apply-patch: `packages/os/scripts/lib/index/embedding-gateway.js`
- 2026-09-08 15:20:07 apply-patch: `packages/os/scripts/lib/index/embedder.js`
- 2026-09-08 15:20:07 apply-patch: `packages/os/scripts/lib/index/indexer.js`
- 2026-09-08 15:20:24 apply-patch: `packages/os/tests/semantic-embedding-gateway.test.ts`
- focused green `trc_1f1dad9c81ac`: 2 files / 20 tests passed. The new multi-batch slow-provider case completes in 9.222s (vs 15.095s red), and gateway coverage proves a nearly exhausted phase can shrink a document request below the default 8s timeout.

- 2026-09-08 15:21:02 append: `.task/explore/bound-total-explore-hydration-phase-latency/workpad.md`

- 2026-09-08 15:21:51 apply-patch: `packages/os/tests/explore-index-hydration-fallback.test.ts`
- 2026-09-08 15:21:51 apply-patch: `packages/os/tests/semantic-embedding-gateway.test.ts`
- broad Explore suite `trc_a6a05234b046`: 13 files / 100 tests passed. A prior broad run exposed timing variance where the first 7s batch consumed the whole shared budget before a second request started; the regression assertion now accepts either 1 or 2 document requests while still requiring the full Explore call to finish inside 15s. The true pre-fix red remains the harness timeout, so this does not weaken the regression.

- 2026-09-08 15:22:28 append: `.task/explore/bound-total-explore-hydration-phase-latency/workpad.md`

## workspace-owned: validation evidence

- 2026-09-08 15:22:57 `review.run`: passed — OK
- 2026-09-08 15:23:40 `verify`: passed — OK

## Final task validation

- [x] Interactive document hydration uses one 8s phase budget across sequential batches.
- [x] Each hosted gateway/direct OpenRouter batch receives at most the remaining phase budget; existing per-request defaults remain caps (4s query, 8s gateway document, 60s direct OpenRouter).
- [x] Explicit `hydrateAll` / `--reindex` retains no whole-phase deadline while preserving per-request provider deadlines.
- [x] Provider deadline exhaustion remains `semanticUnavailable`, so the same Explore invocation skips a redundant query embedding and falls back lexically.
- [x] Multi-batch regression: red `trc_730c28c782b0` at 15.095s; green in `trc_1f1dad9c81ac` / broad `trc_a6a05234b046` at ~9.2s.
- [x] Broad Explore suite: `trc_a6a05234b046` — 13 files / 100 tests passed.
- [x] Strict review: `trc_36c8e1484ef3` — zero findings.
- [x] Full verify: `trc_6d70bc98917c` — publish-valid, zero review findings and zero DB risks.

### Files changed

- `packages/os/scripts/lib/index/embedder.js`
- `packages/os/scripts/lib/index/embedding-gateway.js`
- `packages/os/scripts/lib/index/indexer.js`
- `packages/os/tests/explore-index-hydration-fallback.test.ts`
- `packages/os/tests/semantic-embedding-gateway.test.ts`

### Notes

- The test machine had accumulated 270 leaked `consuelo-explore-*` fixture directories from repeated prior integration runs and hit ENOSPC; only those ephemeral test directories were removed before obtaining the valid red. This is separate test-harness cleanup debt, not a product regression.

### Publish checklist

- [x] focused red captured
- [x] focused green captured
- [x] broad suite green
- [x] strict review green
- [x] full verify green
- [ ] task pushed/promoted to stream
- [ ] stream current-head CI/reviews green
- [ ] stream merged to main
- [ ] Canary release + local update complete
- [ ] live acceptance complete

- 2026-09-08 15:24:01 append: `.task/explore/bound-total-explore-hydration-phase-latency/workpad.md`

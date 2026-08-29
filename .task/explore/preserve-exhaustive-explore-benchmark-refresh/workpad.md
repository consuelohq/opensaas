# Preserve exhaustive Explore benchmark refresh

branch: `task/explore/preserve-exhaustive-explore-benchmark-refresh`
stream: `stream/explore`
pr: https://github.com/consuelohq/opensaas/pull/2302
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

- [ ] Normal interactive Explore keeps bounded query-relevant semantic hydration.
- [ ] `explore-bench --refresh-index` explicitly requests exhaustive hydration before benchmark cases are ranked, so benchmark metrics never depend on arbitrary file ordering or a partially populated semantic cache.
- [ ] Benchmark behavior is protected by a focused regression that fails on the current bounded no-query path.
- [ ] Explore science tests, review, verify, stream promotion, PR #2300 review/CI, Canary release, live gateway smoke, and historical live Explore baselines succeed.

## plan

1. Sync this task worktree to the current `stream/explore` before edits because task bootstrap starts from `main` and there is no typed task-sync/rebase surface.
2. Add a focused benchmark contract proving refresh-index asks `ensureIndex` for exhaustive semantic hydration.
3. Add the smallest explicit option from benchmark caller to indexer; keep interactive Explore bounded.
4. Run focused Explore/benchmark suites, strict review, verify, and promote #2302 into the stream.

## Test-first contract

behavior under test: a benchmark refresh fully hydrates missing semantic vectors before ranking cases, while ordinary Explore remains bounded.
existing local pattern: `explore-bench.js` owns benchmark index refresh; `ensureIndex` now distinguishes explicit full `reindex` from bounded interactive hydration; benchmark tests already mock/inspect `ensureIndex` behavior.
new or changed tests: extend `packages/os/tests/explore-bench.test.ts` (or the nearest benchmark integration contract) to prove `--refresh-index` reaches `ensureIndex` with an explicit exhaustive-hydration signal and no-refresh runs do not.
focused red command: `bun --cwd packages/os test tests/explore-bench.test.ts`.
expected red failure: current `rankCases()` calls `ensureIndex({ ..., reindex: false })` without query/full-hydration intent, so the refresh path cannot distinguish itself and hydrates only the bounded changed-chunk set.
no-test waiver: not applicable.

## key decisions

- Codex P1 is valid. Benchmark correctness requires exhaustive semantic coverage; interactive latency requires bounded coverage. These are different callers and should communicate intent explicitly rather than infer it from the absence of a query.
- Do not make all no-query `ensureIndex` callers exhaustive by default; use an explicit benchmark/full-hydration option to avoid reintroducing the live 87k synchronous startup problem elsewhere.

- 2026-08-29 08:01:56 append: `.task/explore/preserve-exhaustive-explore-benchmark-refresh/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-08-29 08:01:56 fs.write: `.task/explore/preserve-exhaustive-explore-benchmark-refresh/workpad.md`
- 2026-08-29 08:06:39 fs.write: `.task/explore/preserve-exhaustive-explore-benchmark-refresh/workpad.md`

## workspace-owned: files read

- `packages/os/scripts/explore-bench.js`
- `packages/os/scripts/lib/index/indexer.js`
- `packages/os/tests/explore-bench.test.ts`
- `packages/os/tests/explore-index-hydration-fallback.test.ts`

## workspace-owned: validation evidence

- 2026-08-29 08:06:29 `checkFiles`: passed — OK

## implementation status

- Added explicit `hydrateAll` semantic-hydration intent to the indexer without changing normal interactive Explore behavior.
- `selectHydrationChunks` now treats `hydrateAll || reindex` as exhaustive vector hydration; ordinary interactive calls remain capped at 64 query-relevant chunks plus 32 changed chunks.
- `explore-bench --refresh-index` now calls `ensureIndex({ hydrateAll: true, reindex: false })`, preserving changed-file refresh semantics while filling every missing semantic vector.
- Benchmark refresh now fails closed when `embeddingFailure` is present or `chunksDeferred > 0`, so retrieval metrics cannot be emitted from a partial semantic index.
- Exported `selectHydrationChunks` as a focused test/diagnostic seam.

## validation evidence

- Clean red before production edit: 3 intended failures only — no `hydrateAll` selection contract, benchmark refresh did not request exhaustive hydration, and benchmark refresh did not fail closed on incomplete hydration.
- Focused green: `explore-bench.test.ts` + `explore-index-hydration-fallback.test.ts` = 12/12.
- Direct selection diagnostic: bounded=32, exhaustive=50.
- Full Explore science suite: 13 files / 92 tests green.
- `checkFiles` passed for all four touched JS/TS files.
- `git diff --check` clean.
- Explicit changed-file selector is `pass` and selects only the critical `os-explore-retrieval-science` suite; no package-wide OS fallback.

## current status

Implementation and focused validation are complete. Next: local task commit (required because this task was pre-synced to `stream/explore` with a merge commit), strict review, canonical verify, scoped branch push recovery, task promotion, then final PR #2300 CI/review and Canary release/live smoke.

- 2026-08-29 08:06:39 append: `.task/explore/preserve-exhaustive-explore-benchmark-refresh/workpad.md`

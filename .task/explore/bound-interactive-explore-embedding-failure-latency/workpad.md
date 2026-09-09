# Bound interactive Explore embedding failure latency

branch: `task/explore/bound-interactive-explore-embedding-failure-latency`
stream: `stream/explore`
pr: https://github.com/consuelohq/opensaas/pull/2412
started: 2026-09-08

## acceptance criteria

- [ ] Interactive Explore falls back to lexical retrieval within the existing 15s test budget when the hosted semantic provider hangs or times out.
- [ ] A failed document-hydration attempt does not force another long semantic wait before lexical query retrieval can proceed.
- [ ] Healthy gateway embedding requests still use the hosted approved embedding model and preserve caching/indexing behavior.
- [ ] Degraded output remains truthful (`embedding_status: degraded`, deferred chunks reported) and the policy tools remain coherent/fail closed.
- [ ] Focused Explore/gateway tests, review, verify, live Canary smoke, and historical query benchmarks are green before release completion.

## plan

1. Add a slow-provider regression to the existing Explore hydration/fallback integration test and prove current code exceeds the interactive fallback budget.
2. Implement the smallest availability-safe change at the embedding/retrieval boundary: bound interactive gateway latency and avoid redundant semantic waiting after hydration has already established provider failure.
3. Run focused tests for hydration fallback, retriever fallback, semantic gateway, runtime routing, and Explore policy behavior; inspect the diff and run review/verify.
4. Publish to `stream/explore`, sync the stream with current `main` if required, release Canary through the canonical release tool, update the Mac, and rerun the live gateway/policy/historical-query acceptance checks.

## Test-first contract

behavior under test: a hung/unresponsive hosted embedding provider must degrade interactive Explore promptly to lexical retrieval rather than consuming 30-60s per semantic phase.
existing local pattern: `packages/os/tests/explore-index-hydration-fallback.test.ts` already runs a real temporary repo through `scripts/explore.js`, enforces a 15s failover budget, and verifies lexical results plus degraded index status.
new or changed tests: add a slow/hung gateway fixture to `explore-index-hydration-fallback.test.ts`; preserve existing immediate-failure and healthy-provider cases.
focused red command: `bun --cwd packages/os test tests/explore-index-hydration-fallback.test.ts`
expected red failure: slow-provider case is killed by the harness with `Explore did not fail over from semantic hydration within 15 seconds` because `embedding-gateway.js` currently allows a 60s request deadline.
no-test waiver: not applicable.

## files changed

- none yet

## key decisions

- Live OS `0.1.108` proves the original global route bug is fixed: the gateway now returns `503 embedding_provider_timeout`, not `404 WORKSPACE_HOSTNAME_NOT_FOUND`.
- Live hydration is already bounded to stop after the first failed batch; the remaining latency bug is the long request deadline plus a second query-time semantic attempt.
- Preserve lexical fallback and hosted semantic embeddings; this task is availability control, not a semantic-policy rewrite.

## notes for ko

- PR #2297 is already merged into `stream/explore`.
- Installed runtime policy routing is fixed: `confidenceScore` reports gathering, `decideNext` recommends read, and `exploit` refuses while `edit_ready` is false.
- Live `workspace contracts CI` currently completes but took ~68s with `embedding_status: degraded`; semantic gateway calls currently time out upstream around 30s.

## improvements noticed

- Tool discovery itself uses the same semantic gateway and currently pays the provider timeout before lexical/deterministic fallback, so the latency fix should be reusable by that path through the shared embedding client.

## errors i ran into

- The handoff task session `tsk_fe981ca72a98` was stale after the OS restart; durable PR state showed #2297 already merged, so this follow-up task was created instead of resurrecting the old session.
- Local `main` is 120 commits behind `origin/main` and has an unrelated `.opencode/package-lock.json` modification; all edits are isolated in this task worktree.

---

## publish checklist

- [ ] focused red captured
- [ ] focused green captured
- [ ] diff reviewed
- [ ] `review.run` green
- [ ] `verify` green
- [ ] `task.push` green
- [ ] `task.pr` promoted into `stream/explore`
- [ ] stream synced/current and stream PR green
- [ ] Canary release complete and local Mac updated
- [ ] live gateway + historical Explore benchmarks verified

- 2026-09-08 14:35:34 write: `.task/explore/bound-interactive-explore-embedding-failure-latency/workpad.md`

## workspace-owned: files changed

- none yet

## workspace-owned: activity log

- 2026-09-08 14:35:34 fs.write: `.task/explore/bound-interactive-explore-embedding-failure-latency/workpad.md`
- 2026-09-08 14:35:52 apply-patch: `packages/os/tests/explore-index-hydration-fallback.test.ts`
- 2026-09-08 14:36:59 fs.write: `.task/explore/bound-interactive-explore-embedding-failure-latency/workpad.md`
- 2026-09-08 14:38:04 fs.write: `.task/explore/bound-interactive-explore-embedding-failure-latency/workpad.md`
- 2026-09-08 14:40:29 fs.write: `.task/explore/bound-interactive-explore-embedding-failure-latency/workpad.md`
- 2026-09-08 14:43:30 fs.write: `.task/explore/bound-interactive-explore-embedding-failure-latency/workpad.md`
- 2026-09-08 14:44:30 fs.write: `.task/explore/bound-interactive-explore-embedding-failure-latency/workpad.md`

## workspace-owned: files read

- `packages/os/package.json`
- `packages/os/scripts/explore.js`
- `packages/os/tests/semantic-embedding-gateway.test.ts`

## TDD evidence

- setup-only false red: `trc_bd3204d9c1f0` failed before product code because the task worktree lacked package-local `tree-sitter` dependencies; repaired by linking the existing ignored dependency entries from the main checkout, matching the prior handoff setup.
- focused red: `trc_d5ab7877a9c6` — `bun --cwd packages/os test tests/explore-index-hydration-fallback.test.ts`; 4 existing tests passed and the new hung-provider case failed at 15.075s with `Explore did not fail over from semantic hydration within 15 seconds`. This is the expected product regression signal.

- 2026-09-08 14:36:59 append: `.task/explore/bound-interactive-explore-embedding-failure-latency/workpad.md`

- 2026-09-08 14:37:32 apply-patch: `packages/os/scripts/lib/index/embedding-gateway.js`
- 2026-09-08 14:37:33 apply-patch: `packages/os/scripts/lib/search/retriever.js`
- 2026-09-08 14:37:33 apply-patch: `packages/os/scripts/explore.js`
- focused green: `trc_9ccdf235e156` — all 5 hydration/fallback tests pass. The new hung-provider case completes in 9.203s, proves exactly one gateway request after hydration failure, returns lexical results, and reports degraded embedding state.

- 2026-09-08 14:38:04 append: `.task/explore/bound-interactive-explore-embedding-failure-latency/workpad.md`

- steady-state task-code live query: `trc_022ac26b4759` ran `workspace contracts CI` against the real hosted gateway and current repo in 3.296s, returned the expected lexical result set, and truthfully reported `embedding_status: degraded` with 27 deferred chunks. The `code.call` envelope itself flagged verify-mode mutation only because Explore persisted its normal `.task` evidence/state files; the Explore subprocess exited 0.
- surrounding focused suite: `trc_37faf0d93442` — 8 files / 57 tests passed, covering hydration fallback, retriever fallback, runtime compatibility routing, output contract, promotion/VOI policy, hosted client contract, and Cloudflare edge gateway contract.

- 2026-09-08 14:40:29 append: `.task/explore/bound-interactive-explore-embedding-failure-latency/workpad.md`

- 2026-09-08 14:40:48 apply-patch: `packages/os/tests/semantic-embedding-gateway.test.ts`

## workspace-owned: validation evidence

- 2026-09-08 14:41:51 `review.run`: passed — OK
- 2026-09-08 14:43:19 `verify`: failed — COMMAND_FAILED
- 2026-09-08 14:43:30 apply-patch: `packages/os/scripts/lib/index/embedding-gateway.js`
- first full verify: `trc_982e4f142314` failed only on one related mechanical `ERROR_HANDLING` finding in `embedding-gateway.js`: the async gateway request had no local try/catch. No task-owned findings or DB risks were reported. Fixing this in-scope by wrapping the network fetch and preserving the original error as `cause`.
- 2026-09-08 14:43:30 append: `.task/explore/bound-interactive-explore-embedding-failure-latency/workpad.md`
- 2026-09-08 14:44:19 `verify`: passed — OK

## Final task validation

- [x] Interactive hung-provider fallback stays inside 15s; regression case completes in ~9.3s and makes one semantic request.
- [x] Failed hydration suppresses the redundant query-time semantic wait in the same Explore invocation.
- [x] Healthy gateway behavior remains covered; client timeout contract is query 4s / document 8s.
- [x] Degraded output remains truthful and lexical retrieval/policy tools remain coherent.
- [x] Broad Explore suite: `trc_62b36400cea5` — 11 files / 92 tests passed after the final error-handling change.
- [x] Strict review: `trc_76db6dcb7dd1` initially zero task findings; full gate later surfaced one related mechanical error-handling issue, which was fixed.
- [x] Final full verify: `trc_3a34c47d7d9a` — passed, publish-valid, zero task/related/pre-existing findings and zero DB risks.
- [x] Steady-state real-gateway task-code query: `trc_022ac26b4759` — `workspace contracts CI` completed in 3.296s with lexical fallback while the upstream embedding provider was degraded.

### Product files changed

- `packages/os/scripts/explore.js`
- `packages/os/scripts/lib/index/embedding-gateway.js`
- `packages/os/scripts/lib/search/retriever.js`
- `packages/os/tests/explore-index-hydration-fallback.test.ts`
- `packages/os/tests/semantic-embedding-gateway.test.ts`

### Publish checklist status

- [x] focused red captured
- [x] focused green captured
- [x] diff reviewed
- [x] `review.run` green
- [x] `verify` green
- [ ] `task.push` green
- [ ] `task.pr` promoted into `stream/explore`
- [ ] stream synced/current and stream PR green
- [ ] Canary release complete and local Mac updated
- [ ] live gateway + historical Explore benchmarks verified

- 2026-09-08 14:44:30 append: `.task/explore/bound-interactive-explore-embedding-failure-latency/workpad.md`

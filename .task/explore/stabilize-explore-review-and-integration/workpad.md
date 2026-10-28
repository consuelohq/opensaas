# stabilize explore review and integration

branch: `task/explore/stabilize-explore-review-and-integration`
stream: `stream/explore`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2120/stabilize-explore-review-and-integration
github pr: https://github.com/consuelohq/opensaas/pull/2120
started: 2026-08-16

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/workspace/scripts/explore-bench.js`

## workspace-owned: files changed

- `packages/workspace/scripts/explore-bench.js`

## workspace-owned: activity log

- 2026-08-16 03:54:18 fs.write: `.task/explore/stabilize-explore-review-and-integration/workpad.md`
- 2026-08-16 03:57:44 fs.write: `.task/explore/stabilize-explore-review-and-integration/workpad.md`
- 2026-08-16 04:01:15 fs.write: `packages/workspace/scripts/explore-bench.js`
- 2026-08-16 04:07:31 fs.write: `.task/explore/stabilize-explore-review-and-integration/workpad.md`
- 2026-08-16 04:09:25 fs.write: `.task/explore/stabilize-explore-review-and-integration/workpad.md`

## workspace-owned: validation evidence

- 2026-08-16 04:08:01 `review.run`: passed — OK
- 2026-08-16 04:08:34 `verify`: failed — COMMAND_FAILED
- 2026-08-16 04:09:40 `review.run`: passed — OK
- 2026-08-16 04:09:58 `verify`: passed — OK

## key decisions

- none yet

## notes for ko

- none yet

## improvements noticed

- none yet

## issues and recovery

- none yet

---

## publish checklist

```bash
bun run task:push -- --message "type(explore): description" --changed
bun run task:pr
bun run task:finish
```

## workspace-owned: files read

- `package.json`
- `packages/os/SCRIPTS.md`
- `packages/os/cloudflare/workspace-edge/src/index.ts`
- `packages/os/cloudflare/workspace-edge/src/semantic-embedding-gateway.ts`
- `packages/os/cloudflare/workspace-edge/wrangler.toml`
- `packages/os/explore-bench/cases.v1.json`
- `packages/os/explore-bench/reports/e2-live-control.json`
- `packages/os/explore-bench/reports/e2-live-control.md`
- `packages/os/package.json`
- `packages/os/scripts/explore-bench.js`
- `packages/os/scripts/explore.js`
- `packages/os/scripts/lib/explore-bench.js`
- `packages/os/scripts/lib/facade/executor.ts`
- `packages/os/scripts/lib/index/embedding-gateway.js`
- `packages/os/scripts/lib/index/indexer.js`
- `packages/os/scripts/lib/search/explore-output.js`
- `packages/os/scripts/lib/search/ranker.js`
- `packages/os/scripts/lib/search/retrieval-policy.js`
- `packages/os/scripts/lib/search/retriever.js`
- `packages/os/scripts/lib/state/explore-calibration.v1.json`
- `packages/os/scripts/lib/state/explore-promotion-criteria.v1.json`
- `packages/os/scripts/lib/state/explore-promotion-evidence.v1.json`
- `packages/os/scripts/lib/state/explore-promotion-gate.js`
- `packages/os/scripts/lib/state/explore-read-cost-model.v1.json`
- `packages/os/scripts/lib/workspace-cloudflare-edge-router.ts`
- `packages/os/scripts/lib/workspace-edge-node-auth.ts`
- `packages/os/tests/explore-bench.test.ts`
- `packages/os/tests/explore-retrieval-policy.test.ts`
- `packages/os/tests/explore-retriever-fallback.test.ts`
- `packages/os/tests/explore-runtime-routing.test.ts`
- `packages/os/tests/semantic-embedding-edge-gateway.test.ts`
- `packages/os/tests/semantic-embedding-gateway.test.ts`
- `packages/os/tests/semantic-embedding-identity.test.ts`
- `packages/os/tools/decision-engine/handler.ts`
- `packages/workspace/scripts/explore-bench.js`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/scripts/verify.js`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/explore-bench.test.js`
- `packages/workspace/tests/test-selection.test.js`

## Test-first stabilization contract

Scope: fix still-live Explore review/integration defects on `stream/explore` without weakening E4/E5/E6 authority or fabricating confirmatory evidence. `main` remains untouched.

Acceptance criteria:

1. Hosted semantic embedding errors use the standard structured `{ error: { code, message } }` envelope; provider calls are bounded by a finite timeout; primary abuse protection is keyed by server-observed request identity rather than the caller-minted install ID. Install IDs remain telemetry/pseudonymous correlation only.
2. Local hosted-embedding identity persistence is fail-open: an unwritable/corrupt identity path cannot make Explore unavailable. The process retains a stable ephemeral generated ID when durable persistence is unavailable.
3. Retrieval channels fail independently. If lexical SQL fails while semantic candidates exist, Explore continues with semantic/fusion evidence and records channel availability; it does not turn a degraded channel into a total outage.
4. Public result `score` describes the final fusion relevance actually used for selection. The pre-fusion embedding/heuristic score remains available as diagnostics in `scoreParts`; `rankingScore`/fusion metadata retain their existing meaning.
5. Runtime-scoped Explore still executes installed Consuelo OS code, but the caller repository root is propagated explicitly to indexing/retrieval. The installed runtime directory must never silently become the indexed repository merely because `executionScope` is `runtime`.
6. The legacy `packages/workspace/scripts/explore-bench.js` surface stops duplicating/breaking benchmark logic and delegates to the canonical OS ExploreBench implementation. `--help` works, cwd is the caller repository, and canonical errors remain visible.
7. Historical `e2-live-control` is retained only as an invalid failure diagnostic. It is explicitly marked invalid and any confirmatory/comparison validation must reject invalid/unusable benchmark evidence rather than treating all-empty rankings as a scientific control.
8. Documentation-only changes to `packages/os/SCRIPTS.md` do not select the lifecycle execution bundle. Selector registry is regenerated and focused selector tests prove this routing.
9. E6 stays fail-closed: current missing frozen utility/configuration, N=50 paired evidence, and frozen shadow evidence remain blockers. No synthetic data or threshold relaxation is allowed.
10. After focused GREEN, run the authoritative selector, strict review, canonical verify, then sync/resolve `stream/explore` against current `main` through the typed stream workflow. Promote only to `stream/explore`; do not merge PR #2060 to `main`.

RED plan:

- semantic gateway: structured error body; install-ID rotation cannot rotate the primary limiter bucket for one observed IP; upstream request has an abort/timeout signal.
- embedding identity: persistence failure still returns the same valid install ID for repeated calls in one process.
- retriever: lexical failure with semantic evidence still returns results; lexical-only/public score reflects fusion relevance and exposes old heuristic separately.
- runtime routing: command plan executes from installed OS root while carrying the caller cwd into the child environment; Explore passes that cwd to `ensureIndex`.
- legacy Workspace ExploreBench: syntax/help delegation and canonical error preservation.
- benchmark evidence: an explicitly invalid/all-empty comparator is rejected by evidence validation.
- test selector: `packages/os/SCRIPTS.md` alone never selects `os-lifecycle-update-handoff`.

No production edit starts until these contracts have been added and observed RED for the missing behavior.

- 2026-08-16 03:54:18 append: `.task/explore/stabilize-explore-review-and-integration/workpad.md`

- 2026-08-16 03:56:10 apply-patch: `packages/os/tests/semantic-embedding-edge-gateway.test.ts`
- 2026-08-16 03:56:10 apply-patch: `packages/os/tests/semantic-embedding-identity.test.ts`
- 2026-08-16 03:56:10 apply-patch: `packages/os/tests/explore-retriever-fallback.test.ts`
- 2026-08-16 03:56:10 apply-patch: `packages/os/tests/explore-runtime-routing.test.ts`
- 2026-08-16 03:56:11 apply-patch: `packages/os/tests/explore-bench.test.ts`
- 2026-08-16 03:56:11 apply-patch: `packages/workspace/tests/explore-bench.test.js`
- 2026-08-16 03:56:11 apply-patch: `packages/workspace/tests/test-selection.test.js`
## Transport recovery wait

Wait reason: task-scoped read/search calls are intermittently returning transport-level network errors during destructive-literal preflight.
Duration: 15s.
Resume action: rerun the exact seven-test-file destructive-literal scan before any test execution.
Expected signal: a successful typed read/scan showing no prohibited literals in the selected RED test sources.
Fallback: if the signal is still missing, switch typed read surface and do not execute the tests until preflight evidence exists.

- 2026-08-16 03:57:44 append: `.task/explore/stabilize-explore-review-and-integration/workpad.md`

- 2026-08-16 04:00:56 apply-patch: `packages/os/cloudflare/workspace-edge/src/semantic-embedding-gateway.ts`
- 2026-08-16 04:00:56 apply-patch: `packages/os/scripts/lib/index/embedding-gateway.js`
- 2026-08-16 04:00:56 apply-patch: `packages/os/scripts/lib/search/retriever.js`
- 2026-08-16 04:00:56 apply-patch: `packages/os/scripts/lib/facade/executor.ts`
- 2026-08-16 04:00:56 apply-patch: `packages/os/scripts/explore.js`
- 2026-08-16 04:00:56 apply-patch: `packages/os/scripts/lib/explore-bench.js`
- 2026-08-16 04:00:56 apply-patch: `packages/workspace/test-selection.rules.json`
- 2026-08-16 04:01:15 write: `packages/workspace/scripts/explore-bench.js`

- 2026-08-16 04:01:25 apply-patch: `packages/os/explore-bench/reports/e2-live-control.json`
- 2026-08-16 04:01:25 apply-patch: `packages/os/explore-bench/reports/e2-live-control.md`
- 2026-08-16 04:01:25 apply-patch: `packages/os/SCRIPTS.md`

- 2026-08-16 04:02:07 apply-patch: `packages/workspace/scripts/test-selection.js`
- 2026-08-16 04:02:40 apply-patch: `packages/workspace/tests/test-selection.test.js`
- 2026-08-16 04:02:57 apply-patch: `packages/workspace/test-selection.rules.json`
- 2026-08-16 04:03:29 apply-patch: `packages/workspace/tests/test-selection.test.js`
- 2026-08-16 04:03:48 apply-patch: `packages/workspace/test-selection.rules.json`

- 2026-08-16 04:05:13 apply-patch: `packages/os/cloudflare/workspace-edge/src/semantic-embedding-gateway.ts`
- 2026-08-16 04:05:13 apply-patch: `packages/os/tests/semantic-embedding-edge-gateway.test.ts`

## Stabilization implementation and validation

### Live defects fixed
- Hosted semantic gateway errors now use `{ error: { code, message } }`; upstream provider calls have a 30s default AbortSignal deadline with deterministic signal injection for tests.
- Caller-minted install IDs are telemetry/cache correlation only. Provider-spend limiting is keyed from the Cloudflare-observed client IP (`client-ip:<ip>`); rotating install IDs does not rotate the primary bucket.
- Embedding install-ID persistence is fail-open and process-stable when the filesystem is unavailable; malformed persisted identity state is not deleted/recreated as an availability workaround.
- Lexical and semantic retrieval fail independently. A lexical SQL failure does not discard usable semantic results; availability is explicit in fusion diagnostics.
- Public result `score` is the final fusion relevance used for selection; the previous heuristic remains `scoreParts.preFusionHeuristicScore` for diagnostics.
- Runtime-scoped Explore still executes installed Consuelo OS code but explicitly propagates caller repository cwd through `CONSUELO_TOOL_CALLER_CWD`; `explore.js` uses it for `ensureIndex`.
- The broken duplicate Workspace ExploreBench implementation was replaced by a compatibility delegator to canonical OS ExploreBench, preserving canonical cwd/help/error behavior.
- Added `validateBenchmarkEvidence`; historical `e2-live-control` is explicitly invalid failure-diagnostic evidence because all rankings were empty after `WORKSPACE_HOSTNAME_NOT_FOUND` and cannot be used as control/promotion evidence.
- Test selection no longer routes `packages/os/SCRIPTS.md`/`TOOLS.md` to lifecycle tests. Auto package rules ignore docs-only matches. `executor.ts` is explicitly owned by focused Explore science. Workspace ExploreBench has its own focused compatibility rule. Registry regenerated.

### TDD evidence
- Initial RED: OS focused contracts failed 10 expected cases; legacy Workspace ExploreBench failed both new compatibility cases due its syntax/cwd/error defects; docs-selector contract failed because lifecycle/full OS suites were selected.
- Additional REDs proved `executor.ts` lacked focused ownership and Workspace ExploreBench had no selector ownership.
- All RED contracts are now GREEN.

### Final safe validation
- Workspace test-selection: 42/42.
- Workspace ExploreBench compatibility: 9/9.
- Focused OS Explore science (E2-E6 plus gateway/routing): 83/83 across 11 files.
- Changed-server selector: 22/22.
- GitHub workflow policy: 12/12.
- TypeORM CLI compatibility: 2/2.
- `bun run --cwd packages/os typecheck`: green.
- Direct `node --check` for all changed Explore/compatibility JS entrypoints: green.
- `git diff --check`: green.
- Final selector matches only `workspace-test-selection`, `workspace-explore-bench-compatibility`, `os-explore-retrieval-science`, and `server-ci-task-contract`; it selects six focused suites and selects neither lifecycle contracts nor broad `@consuelo/os package test`.
- No lifecycle test bundle was executed manually in this task because the historical lifecycle source contains a prohibited `sudo` literal. The current selector fix prevents documentation-only Explore changes from waking that bundle.

### E6 invariant proof
Read-only evaluation of the actual current criteria/evidence/calibration/cost artifacts returns:
- `status=blocked`
- `promotion_eligible=false`
- `production_cutover=false`
- `control_remains_authoritative=true`
- benchmark evidence: 0 evaluated of planned fixed N=50, unfrozen
- shadow evidence: 0 observations / 0 questions, unfrozen
- challenger configuration: insufficient, unfrozen, no explicit utility scale
- blockers remain the expected challenger/calibration/benchmark/shadow evidence insufficiency set. No synthetic evidence or threshold relaxation was introduced.

### Operational recovery
- Initial task creation failed due disk pressure (~374 MiB free; managed task worktrees ~16 GiB). Only lifecycle-proven merged historical Explore task worktrees E2, E3, and the gateway-routing fix were previewed and cleaned; no active/unmerged stream work was removed.
- Task-scoped transport had a short intermittent network-error period during safety preflight. A recorded 15.002s wait was followed by typed direct-file inspection; test execution did not proceed until destructive-literal safety was established.

Pending: strict review, canonical verify, task push/promotion into `stream/explore`, then typed `stream.sync` against current `main`. PR #2060 must remain open; `main` is not a target of this task.

- 2026-08-16 04:07:31 append: `.task/explore/stabilize-explore-review-and-integration/workpad.md`

- 2026-08-16 04:09:04 apply-patch: `packages/os/cloudflare/workspace-edge/src/semantic-embedding-gateway.ts`
### Canonical verify review finding resolved
- First canonical verify did not stamp because its embedded review surfaced one related mechanical `ERROR_HANDLING` finding in `semantic-embedding-gateway.ts`: the top-level async handler had validation/rate-limit awaits before a nearby catch boundary.
- Fixed by adding a structured internal-error catch boundary around validation/rate-limit setup (`embedding_gateway_internal_error`, HTTP 500). No suppression or review exception was added.
- Focused post-fix validation: semantic embedding edge gateway 9/9, OS type/syntax green, `git diff --check` green.
- Pending new-change-hash strict review and canonical verify.

- 2026-08-16 04:09:25 append: `.task/explore/stabilize-explore-review-and-integration/workpad.md`

# E3 honest belief model

branch: `task/explore/e3-honest-belief-model`
stream: `stream/explore`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2077/e3-honest-belief-model
github pr: https://github.com/consuelohq/opensaas/pull/2077
started: 2026-08-15

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/os/scripts/confidence-score.js`
- `packages/os/scripts/decide-next.js`
- `packages/os/scripts/exploit.js`
- `packages/os/scripts/lib/state/explore-calibration.v1.json`
- `packages/os/scripts/lib/state/explore-hypothesis-model.js`
- `packages/os/scripts/lib/state/explore-state.js`
- `packages/os/tests/explore-hypothesis-model.test.ts`

## workspace-owned: files changed

- `packages/os/scripts/confidence-score.js`
- `packages/os/scripts/decide-next.js`
- `packages/os/scripts/exploit.js`
- `packages/os/scripts/lib/state/explore-calibration.v1.json`
- `packages/os/scripts/lib/state/explore-hypothesis-model.js`
- `packages/os/scripts/lib/state/explore-state.js`
- `packages/os/tests/explore-hypothesis-model.test.ts`

## workspace-owned: activity log

- 2026-08-15 18:52:26 fs.write: `.task/explore/e3-honest-belief-model/workpad.md`
- 2026-08-15 18:53:48 fs.write: `packages/os/tests/explore-hypothesis-model.test.ts`
- 2026-08-15 18:54:28 fs.write: `packages/os/scripts/lib/state/explore-hypothesis-model.js`
- 2026-08-15 18:54:45 fs.write: `packages/os/scripts/lib/state/explore-calibration.v1.json`
- 2026-08-15 18:55:08 fs.write: `packages/os/scripts/lib/state/explore-state.js`
- 2026-08-15 18:55:46 fs.write: `packages/os/scripts/confidence-score.js`
- 2026-08-15 18:56:08 fs.write: `packages/os/scripts/decide-next.js`
- 2026-08-15 18:56:19 fs.write: `packages/os/scripts/exploit.js`
- 2026-08-15 19:04:42 fs.write: `.task/explore/e3-honest-belief-model/workpad.md`
- 2026-08-15 19:08:14 fs.write: `.task/explore/e3-honest-belief-model/workpad.md`

## workspace-owned: validation evidence

- 2026-08-15 19:03:05 `review.run`: passed — OK
- 2026-08-15 19:05:09 `verify`: failed — COMMAND_FAILED
- 2026-08-15 19:05:44 `review.run`: passed — OK
- 2026-08-15 19:06:07 `verify`: failed — COMMAND_FAILED
- 2026-08-15 19:06:34 `review.run`: passed — OK
- 2026-08-15 19:06:55 `verify`: failed — COMMAND_FAILED
- 2026-08-15 19:08:36 `verify`: passed — OK

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

- `packages/os/SCRIPTS.md`
- `packages/os/dev-steering.md`
- `packages/os/explore-bench/cases.v1.json`
- `packages/os/package.json`
- `packages/os/scripts/ai-review.js`
- `packages/os/scripts/confidence-score.js`
- `packages/os/scripts/decide-next.js`
- `packages/os/scripts/exploit.js`
- `packages/os/scripts/explore.js`
- `packages/os/scripts/lib/search/explore-output.js`
- `packages/os/scripts/lib/state/explore-state.js`
- `packages/os/scripts/review.js`
- `packages/os/tests/explore-output-contract.test.ts`
- `packages/os/tests/tool-package-layout.test.ts`
- `packages/os/tools/decision-engine/handler.ts`
- `packages/os/tools/decision-engine/schema.ts`
- `packages/workspace/scripts/verify.js`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/tests/test-selection.test.js`

## Acceptance criteria

- Replace per-file pseudo-posteriors and arbitrary multiplicative belief updates with explicit hypothesis/subgraph state.
- A plain `file.read` records observation/coverage only; it never implies relevance.
- Explicit relevance/irrelevance labels affect hypothesis support; test/verify/runtime evidence affects readiness/validation only.
- Fit a versioned provisional retrieval-support calibration from ExploreBench rank/relevance labels using an auditable smoothed estimator and diagnostics; do not claim calibrated probability while the corpus is small.
- `decide-next`, `confidence-score`, and `exploit` consume the same hypothesis/readiness model and stop emitting `posterior` as if it were a probability.
- `exploit` chooses the strongest supported hypothesis root, not blindly `results[0]`.
- E1 compact/full response behavior and E2 retrieval ordering remain unchanged.

## Plan

1. Characterize current pseudo-posterior behavior and benchmark labels.
2. Add a pure hypothesis/calibration model with deterministic subgraph construction and provisional benchmark support.
3. Migrate Explore state to hypothesis version 1 while retaining compatibility with existing state files.
4. Route evidence into either hypothesis support (explicit relevance labels) or readiness (reads/validation/contradictions).
5. Update decision/confidence/exploit consumers without implementing E4 unified policy or E5 VOI.
6. Validate focused contracts, benchmark invariance, strict review, and canonical verify before promotion.

## Test-first contract

behavior under test:
- `file.read` alone does not increase hypothesis relevance/support.
- overlapping Explore results form connected dependency hypotheses/subgraphs with a deterministic root.
- rank-bin relevance support is fitted from ExploreBench with Jeffreys-smoothed binomial estimates, sample counts, Brier diagnostic, and `provisional` status for the current small corpus.
- explicit `file.relevant` / `file.irrelevant` events update hypothesis evidence without multiplicative pseudo-probabilities.
- test/verify/runtime events change readiness/validation state but never hypothesis relevance support.
- decide-next output uses `readiness` / `hypothesis_support`, not `posterior`, and exploit chooses the strongest supported hypothesis root.

existing local pattern:
- `packages/os/scripts/lib/state/explore-state.js` owns persisted Explore investigation state.
- `packages/os/scripts/lib/state/evidence-log.js` is the source of observed evidence events.
- `packages/os/explore-bench/cases.v1.json` plus E2 report supply curated retrieval relevance labels.

new or changed tests:
- add focused hypothesis/calibration state tests under `packages/os/tests/`.
- extend decision/confidence/exploit contracts for readiness naming and target selection.
- preserve existing Explore compact/full and E2 retrieval tests unchanged.

focused red command:
- run the new hypothesis-model tests plus existing decision-engine focused contracts after destructive-literal preflight.

expected red failure:
- hypothesis/calibration module and readiness fields do not exist; current read event increases pseudo-posterior and exploit defaults to result index 0.

no-test waiver: not applicable.

- 2026-08-15 18:52:26 append: `.task/explore/e3-honest-belief-model/workpad.md`

- 2026-08-15 18:53:48 write: `packages/os/tests/explore-hypothesis-model.test.ts`

- 2026-08-15 18:54:28 write: `packages/os/scripts/lib/state/explore-hypothesis-model.js`

- 2026-08-15 18:54:45 write: `packages/os/scripts/lib/state/explore-calibration.v1.json`

- 2026-08-15 18:55:08 write: `packages/os/scripts/lib/state/explore-state.js`

- 2026-08-15 18:55:46 write: `packages/os/scripts/confidence-score.js`

- 2026-08-15 18:56:08 write: `packages/os/scripts/decide-next.js`

- 2026-08-15 18:56:19 write: `packages/os/scripts/exploit.js`

## Progress

- Replaced independent per-file pseudo-posteriors and arbitrary multiplier updates with `hypothesis_version: 1` dependency-subgraph state.
- Plain `file.read` is coverage/observation only. Explicit `file.relevant` / `file.irrelevant` events update hypothesis support. Test/verify/runtime events update readiness only.
- Added benchmark-derived `retrieval_support` with a versioned provisional calibration artifact. Current ExploreBench has 10 independent cases, so the artifact remains `provisional`; calibration cannot self-promote from sample count without explicit review approval.
- Current rank-bin evidence: rank 1 = 9/10 relevant (Jeffreys estimate 0.863636); ranks 2-3 = 6/19 (0.325); ranks 4-5 = 2/18 (0.131579); ranks 6-10 = 4/45 (0.097826). Leave-one-case-out Brier = 0.12369133031942595.
- Removed fake agent-facing `information_value` and `belief_prior`. Compact Explore now exposes `retrieval_support` + `calibration_status` while retaining E1 result order/detail semantics.
- Reworked `confidence-score` semantics to categorical readiness (`insufficient-evidence`, `gathering`, `ready-to-edit`, `blocked`). Tool name remains for compatibility only.
- Reworked `decide-next` to choose the next unread root/dependency from the strongest hypothesis and `exploit` to choose the strongest supported hypothesis root instead of `results[0]`.
- Updated local review/AI-review context, decision-engine descriptions, SCRIPTS/TOOLS, and steering doctrine to use readiness/hypothesis terminology.
- Extended the existing exclusive Explore test-selection rule so E3 does not wake the historically red broad OS package suite.

## Validation evidence

- TDD RED: new hypothesis-model suite initially failed only because `explore-hypothesis-model.js` did not exist.
- Focused hypothesis/output contract: 14/14 passed.
- Full focused Explore contract (E1 + E2 + E3 + embedding/runtime fixes): 9 files, 50/50 tests passed.
- Test-selection registry regression: 39/39 passed.
- Runtime helper probe under Bun proved a contradicted rank-1 hypothesis loses to a supported rank-2 hypothesis for both `decide-next` and `exploit`.
- All touched JS files pass `node --check`; OS syntax/typecheck script passes.
- Generated tool manifest drift check passes; generated TOOLS.md/tool manifest are current.
- Strict review against `origin/stream/explore`: 0 E3-owned issues, 0 blockers, 0 failed suites. One unrelated pre-existing openworkspace typecheck remains baseline debt. Public tools docs mapping was reported as a non-blocking documentation opportunity.
- `git diff --check origin/stream/explore` passes.
- Secret/privacy scan across tracked and untracked task files found no actionable credential patterns. All 15 broad `sk-` hits were structurally verified as substrings of generated `task-...` identifiers.

## Scientific claims / limits

- `retrieval_support` is an empirical, Jeffreys-smoothed rank-bin estimate from the current judged benchmark. It is NOT a posterior probability of correctness.
- The current 10-query corpus is far too small to claim calibration; E3 deliberately labels the artifact provisional and requires explicit calibration approval even after the minimum-case threshold is reached.
- Readiness is a categorical evidence/coverage state, not a probability and not a correctness guarantee.
- E3 does not implement expected value of information. A mathematically defined VOI policy remains E5 scope.

- 2026-08-15 19:04:42 append: `.task/explore/e3-honest-belief-model/workpad.md`

## Final gate notes

- Canonical verify initially surfaced self-review false positives because both reviewer copies only exempted the workspace reviewer. Updated the OS and canonical workspace reviewers so review-checker regex/messages are not linted as if they were application code. Strict review then returned 0 task-owned / related blockers.
- Updating the discoverable decision-tool descriptions intentionally invalidated `packages/os/tests/fixtures/tool-package-baseline.json`; regenerated the 159-definition characterization snapshot from the current generated tool manifest. `tool-package-layout.test.ts` now passes 3/3.
- Exact registry `--run` gate now passes all 9 selected critical suites with zero failures, including the focused OS Explore E1/E2/E3 contract and lifecycle/tool-manifest contracts.

- 2026-08-15 19:08:14 append: `.task/explore/e3-honest-belief-model/workpad.md`

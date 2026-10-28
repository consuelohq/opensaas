# E6 Explore challenger promotion gate

branch: `task/explore/e6-explore-challenger-promotion-gate`
stream: `stream/explore`
pr: https://app.graphite.com/github/pr/consuelohq/opensaas/2107/e6-explore-challenger-promotion-gate
github pr: https://github.com/consuelohq/opensaas/pull/2107
started: 2026-08-16

## acceptance criteria

- [ ] Define explicit task acceptance criteria before coding.

## plan

1. Read the relevant code and update this plan before editing.

## current status

- Task started. Update this before publish.

## files changed

- `packages/os/explore-bench/E6_PROMOTION_GATE.md`
- `packages/os/scripts/lib/state/explore-promotion-criteria.v1.json`
- `packages/os/scripts/lib/state/explore-promotion-evidence.v1.json`
- `packages/os/scripts/lib/state/explore-promotion-gate.js`
- `packages/os/tests/explore-promotion-gate.test.ts`

## workspace-owned: files changed

- `packages/os/explore-bench/E6_PROMOTION_GATE.md`
- `packages/os/scripts/lib/state/explore-promotion-criteria.v1.json`
- `packages/os/scripts/lib/state/explore-promotion-evidence.v1.json`
- `packages/os/scripts/lib/state/explore-promotion-gate.js`
- `packages/os/tests/explore-promotion-gate.test.ts`

## workspace-owned: activity log

- 2026-08-16 03:05:42 fs.write: `.task/explore/e6-explore-challenger-promotion-gate/workpad.md`
- 2026-08-16 03:06:05 fs.write: `packages/os/tests/explore-promotion-gate.test.ts`
- 2026-08-16 03:06:36 fs.write: `.task/explore/e6-explore-challenger-promotion-gate/workpad.md`
- 2026-08-16 03:07:03 fs.write: `packages/os/scripts/lib/state/explore-promotion-gate.js`
- 2026-08-16 03:07:04 fs.write: `packages/os/scripts/lib/state/explore-promotion-criteria.v1.json`
- 2026-08-16 03:07:05 fs.write: `packages/os/scripts/lib/state/explore-promotion-evidence.v1.json`
- 2026-08-16 03:12:00 fs.write: `packages/os/explore-bench/E6_PROMOTION_GATE.md`
- 2026-08-16 03:12:03 fs.write: `.task/explore/e6-explore-challenger-promotion-gate/workpad.md`
- 2026-08-16 03:20:22 fs.write: `packages/os/scripts/lib/state/explore-promotion-evidence.v1.json`
- 2026-08-16 03:20:57 fs.write: `.task/explore/e6-explore-challenger-promotion-gate/workpad.md`
- 2026-08-16 03:26:49 fs.write: `packages/os/scripts/lib/state/explore-promotion-evidence.v1.json`
- 2026-08-16 03:30:55 fs.write: `packages/os/explore-bench/E6_PROMOTION_GATE.md`
- 2026-08-16 03:31:20 fs.write: `.task/explore/e6-explore-challenger-promotion-gate/workpad.md`
- 2026-08-16 03:32:16 fs.write: `.task/explore/e6-explore-challenger-promotion-gate/workpad.md`
- 2026-08-16 03:32:46 fs.write: `.task/explore/e6-explore-challenger-promotion-gate/workpad.md`
- 2026-08-16 03:34:09 fs.write: `.task/explore/e6-explore-challenger-promotion-gate/workpad.md`

## workspace-owned: validation evidence

- 2026-08-16 03:32:41 `review.run`: passed — OK

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
- `packages/os/explore-bench/E5_VOI_POLICY.md`
- `packages/os/explore-bench/E6_PROMOTION_GATE.md`
- `packages/os/explore-bench/cases.v1.json`
- `packages/os/scripts/explore-bench.js`
- `packages/os/scripts/explore.js`
- `packages/os/scripts/lib/explore-bench.js`
- `packages/os/scripts/lib/search/explore-output.js`
- `packages/os/scripts/lib/state/explore-calibration.v1.json`
- `packages/os/scripts/lib/state/explore-promotion-criteria.v1.json`
- `packages/os/scripts/lib/state/explore-promotion-gate.js`
- `packages/os/scripts/lib/state/explore-read-cost-model.v1.json`
- `packages/os/scripts/lib/state/explore-voi-policy.js`
- `packages/os/tests/explore-bench.test.ts`
- `packages/os/tests/explore-output-contract.test.ts`
- `packages/os/tests/explore-promotion-gate.test.ts`
- `packages/os/tests/explore-voi-policy.test.ts`
- `packages/workspace/scripts/test-selection.js`
- `packages/workspace/test-selection.registry.json`
- `packages/workspace/test-selection.rules.json`
- `packages/workspace/tests/github-workflow-policy.test.js`
- `packages/workspace/tests/run-changed-server-task.test.mjs`
- `packages/workspace/tests/test-selection.test.js`
- `packages/workspace/tests/typeorm-cli-contract.test.mjs`

## E6 acceptance criteria

- [ ] Add a versioned, fail-closed E6 promotion gate beside E4/E5; E4 remains the runtime authority and E6 must never directly replace `next_action` or perform a production cutover.
- [ ] Define promotion as **eligibility for a controlled trial/manual promotion review**, not automatic production replacement.
- [ ] Require E5 itself to be scientifically evaluable (`evaluable_shadow`, explicit positive net utility, no self-promotion authority violation) before E6 can pass.
- [ ] Require truly calibrated retrieval evidence with at least 50 independent benchmark cases; a label of `calibrated` without the declared minimum must fail closed.
- [ ] Compare E4 control and E5 challenger on the same curated cases as paired ordinal observations. Use an exact one-sided sign test on non-tied relevance differences; ties are excluded from the inferential denominator. Require at least 50 evaluated independent cases, at least 10 relevance-discordant pairs, more challenger wins than losses, and p <= 0.05.
- [ ] Treat required-node coverage as a safety endpoint: any paired case where control hits a required node and challenger does not is a promotion blocker. Do not convert this safety endpoint into a compensating scalar utility.
- [ ] Treat live shadow history as operational evidence only, never an accuracy/causal label. Require at least 50 E5 shadow observations, at least 20 distinct questions, zero evaluator errors, and zero E5 self-promotion authority violations.
- [ ] Ship explicit versioned criteria and current evidence artifacts. The current repository state must report blocked/insufficient evidence (10 benchmark cases, no paired promotion benchmark, zero live shadow observations, provisional calibration, no utility scale).
- [ ] Add compact/full output and evidence logging for the E6 gate without widening the existing Explore response materially.
- [ ] Document the estimand, exact-test assumptions, preregistered thresholds, safety endpoint, limitations, and current blocked state. Update `packages/os/SCRIPTS.md` because Explore runtime behavior/output changes.
- [ ] Add E6 to the exclusive Explore science test-selection rule and keep the historical package-wide OS suite out of the authoritative path.

## E6 plan

1. Add pure paired-evidence and promotion-gate contracts first; capture a focused RED before production implementation.
2. Implement exact paired sign-test math, live-shadow operational summaries, fail-closed artifact validation, and controlled-trial eligibility only.
3. Extend ExploreBench shadow reports with paired case rows/deltas so future evidence can be generated from the same curated labels without inventing outcomes.
4. Wire E6 read-only into Explore after E5 shadow logging; persist/log a gate snapshot but leave E4 `policy.next_action` untouched.
5. Add compact output, scientific documentation, versioned criteria/current-evidence artifacts, SCRIPTS docs, and focused selector registration.
6. Run focused GREEN, the complete Explore science selector, syntax/type/static checks, strict review, canonical verify, then push PR #2107 and promote only into `stream/explore`.

## Test-first contract

behavior under test: E6 passes only when all preregistered scientific and operational gates are satisfied; it fails closed on provisional/mislabeled calibration, insufficient or unpaired benchmark evidence, weak/no directional relevance evidence, any required-node regression, insufficient/errored shadow history, non-positive E5 utility, malformed artifacts, or E5 authority violations. Passing means only `eligible_for_controlled_trial`; `production_cutover` remains false and E4 remains authoritative.

existing local pattern: E5 pure evaluator in `packages/os/scripts/lib/state/explore-voi-policy.js`, paired curated-label comparison in `packages/os/scripts/lib/explore-bench.js`, versioned JSON evidence/calibration artifacts under `scripts/lib/state`, and compact response shaping in `scripts/lib/search/explore-output.js`.

new or changed tests: new `packages/os/tests/explore-promotion-gate.test.ts`; extend `explore-bench.test.ts` for paired deltas; extend `explore-output-contract.test.ts` for compact E6 summary; existing E5 tests remain unchanged unless integration requires additive typing only.

focused red command: `bun --cwd packages/os test tests/explore-promotion-gate.test.ts`

expected red failure: the test imports `../scripts/lib/state/explore-promotion-gate.js`, which does not exist before E6 implementation (or exported E6 functions/criteria are missing).

no-test waiver: not applicable; E6 is decision-critical policy logic and requires test-first behavior coverage.

## Scientific design decision

- Primary quality endpoint: paired ordinal relevance direction on the same independent curated benchmark cases. Because relevance labels are ordinal (0-3), E6 does not assume interval-scale magnitudes. Non-tied pairs are reduced to challenger-win/control-win signs and tested with an exact Binomial(n, 0.5) upper-tail test.
- Safety endpoint: required-node regression is non-compensatory and zero-tolerance for promotion eligibility.
- Operational shadow evidence: sample volume, question diversity, evaluator errors, and authority invariants only. Agreement/disagreement is descriptive because the challenger is not executed and therefore has no online outcome label.
- No non-inferiority margin is invented. Without a domain-justified margin, E6 requires positive directional evidence rather than tuning an arbitrary tolerated degradation after seeing outcomes.
- The gate criteria are versioned before sufficient evidence exists; current evidence is intentionally expected to fail the gate.

- 2026-08-16 03:05:42 append: `.task/explore/e6-explore-challenger-promotion-gate/workpad.md`

- 2026-08-16 03:06:05 write: `packages/os/tests/explore-promotion-gate.test.ts`

## RED evidence

- Focused RED: `bun --cwd packages/os test tests/explore-promotion-gate.test.ts`
- Result: 1 file failed, 7/7 tests failed as expected because `../scripts/lib/state/explore-promotion-gate.js` does not exist yet.
- No production source was edited before this RED.

- 2026-08-16 03:06:36 append: `.task/explore/e6-explore-challenger-promotion-gate/workpad.md`

- 2026-08-16 03:07:03 write: `packages/os/scripts/lib/state/explore-promotion-gate.js`

- 2026-08-16 03:07:04 write: `packages/os/scripts/lib/state/explore-promotion-criteria.v1.json`

- 2026-08-16 03:07:05 write: `packages/os/scripts/lib/state/explore-promotion-evidence.v1.json`

- 2026-08-16 03:12:00 write: `packages/os/explore-bench/E6_PROMOTION_GATE.md`

## Fixed-look statistical amendment

The initial acceptance text said “at least 50 evaluated cases.” Before finalizing E6, this was tightened test-first to a fixed-sample design to avoid repeated optional stopping at alpha 0.05. Criteria v1 now plans exactly 50 evaluated independent benchmark cases; promotion evidence must declare `analysisMode: fixed_sample`, `plannedEvaluatedCaseCount: 50`, and `frozen: true`. A different/larger analysis requires a new criteria/evidence version rather than repeated peeking. The revised E6 tests went RED until the fixed-sample contract was implemented, then returned GREEN.

Terminology was also corrected from “preregistered” to “versioned pre-specified.” The criteria are committed before sufficient paired promotion evidence exists, but there is no external preregistration registry and E6 does not claim one.

- 2026-08-16 03:12:03 append: `.task/explore/e6-explore-challenger-promotion-gate/workpad.md`

- 2026-08-16 03:20:22 write: `packages/os/scripts/lib/state/explore-promotion-evidence.v1.json`

## Frozen-shadow reproducibility amendment

Final scientific audit found that using worktree-local `explore.voi.shadow` history as a promotion input would make the same code/evidence commit potentially eligible in one worktree and blocked in another. That is not a reproducible promotion decision.

E6 was corrected test-first so promotion eligibility now consumes a versioned `shadowEvidence` snapshot inside `explore-promotion-evidence.v1.json`. The snapshot must be schema/criteria v1, `status: frozen_shadow_history`, `frozen: true`, contain unique non-empty event ids/questions, identify E5 VOI v1 and the expected method, and carry explicit promotion-authority booleans. Mutable worktree history is still summarized as `local_shadow`, but is diagnostics only and cannot satisfy a promotion threshold.

RED after adding this contract: 10 promotion tests, 4 failed because the previous evaluator still used transient live events. GREEN after the correction: 10/10 promotion tests. Compact-output RED then proved the frozen status/frozen flag and local diagnostics were missing; after output wiring, promotion + output contracts are 15/15 green.

- 2026-08-16 03:20:57 append: `.task/explore/e6-explore-challenger-promotion-gate/workpad.md`

- 2026-08-16 03:26:49 write: `packages/os/scripts/lib/state/explore-promotion-evidence.v1.json`

- 2026-08-16 03:30:55 append: `packages/os/explore-bench/E6_PROMOTION_GATE.md`

## Final scientific coherence amendments

A second reproducibility audit found that the global E6 decision also could not depend on the E5 packet for whichever query happened to invoke `explore`. E6 now consumes a frozen `challengerConfiguration` from the versioned promotion artifact. The configuration binds E5 VOI version/method, `promotionAuthority: e6_gate_only`, the read-cost artifact schema, and a named explicit utility profile. Utility rates must be finite/non-negative and non-degenerate (at least one positive rate). The current E5 packet is exposed only as `local_challenger` diagnostics.

The paired benchmark and frozen shadow snapshot are both bound to `challengerConfigurationId`. Every non-empty paired row and every frozen shadow event must carry the same configuration id; mixed-policy evidence is rejected. Runtime E5 shadow events now log challenger configuration and utility-profile ids for future evidence collection.

The paired benchmark itself was corrected test-first to evaluate the actual proposed E5 policy: only `evaluable_shadow` decisions enter the confirmatory set; positive `shadow_recommendation` is the challenger action; an evaluable E5 abstention falls back to E4 and therefore becomes a policy tie; provisional/non-evaluable decisions are excluded. The previous research-candidate scoring path failed the new RED and was replaced.

Latest focused GREEN: promotion gate 13/13, ExploreBench 5/5, compact output 5/5; combined 23/23.

- 2026-08-16 03:31:20 append: `.task/explore/e6-explore-challenger-promotion-gate/workpad.md`

## Final validation evidence (pre-review)

- Final E6 artifact evaluation is intentionally `blocked`, with `promotion_eligible=false` and `production_cutover=false`.
- Exact current blockers: `challenger_evidence_not_ready`, `challenger_evidence_not_frozen`, `challenger_utility_scale_missing`, `calibration_not_ready`, `benchmark_evidence_not_ready`, `benchmark_evidence_not_frozen`, `benchmark_case_minimum_not_met`, `benchmark_evaluated_plan_not_met`, `benchmark_disagreement_minimum_not_met`, `shadow_evidence_not_ready`, `shadow_evidence_not_frozen`, `shadow_observation_minimum_not_met`, `shadow_question_minimum_not_met`.
- Explore science surface: 11 files, 77/77 tests green.
- Workspace selector contract: 40/40 green.
- Changed-server selector contract: 22/22 green.
- GitHub workflow policy: 12/12 green.
- TypeORM CLI contract: 2/2 green.
- OS script syntax/typecheck and direct `node --check` for every changed Explore JS module are green; `git diff --check` is green.
- The repository selector also selects a lifecycle test bundle because `packages/os/SCRIPTS.md` is a shared lifecycle source. `packages/os/tests/lifecycle-restart-contract.test.ts` contains the prohibited literal `sudo` in a non-executing assertion. Per machine-safety policy, the selected lifecycle test surfaces were **not executed**. All 12 selected lifecycle source files, including the facade snapshot test, were instead statically bundled with `bun build --target bun` successfully (554 modules). This is an explicit safety limitation, not a test failure.
- No E6 code path mutates E4 `policy.next_action`; E6 can only emit `eligible_for_controlled_trial`, never `production_cutover`.
- Pending: strict review, canonical verify, push PR #2107, scope verification, stream-only promotion, cleanup.

- 2026-08-16 03:32:16 append: `.task/explore/e6-explore-challenger-promotion-gate/workpad.md`

## Strict review

- `review.run --base origin/stream/explore --strict --mine`: 0 owned issues, 0 pre-existing issues, 0 blocking issues, 0 documentation opportunities.
- Review scoped the changed Explore implementation/tests correctly. Executable test evidence remains the already-green safety-preflighted suites recorded above; selected lifecycle tests remain static-only per machine-safety policy.
- Next: canonical verify, then no further source/workpad mutation unless verify finds an issue.

- 2026-08-16 03:32:46 append: `.task/explore/e6-explore-challenger-promotion-gate/workpad.md`

## Verify transport recovery

- Typed `verify.run` returned a transport-level network error twice. Completion state was checked after the failures; `.task/explore/e6-explore-challenger-promotion-gate/verify.json` remained absent.
- Per workspace recovery guidance for repeated same-class facade failures, final publish validation is switching to the repository's canonical verifier (`packages/workspace/scripts/verify.js`) executed directly inside this managed task worktree through task-scoped `code.call`. This is a verification-surface tooling fallback only; no source behavior is changing.

- 2026-08-16 03:34:09 append: `.task/explore/e6-explore-challenger-promotion-gate/workpad.md`

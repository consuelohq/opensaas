# E6 Explore challenger promotion gate

E6 turns the E5 value-of-information challenger from a permanently shadow-only research packet into a candidate that can become **eligible for a controlled trial** when, and only when, a fixed set of evidence gates pass.

E6 does **not** change the production Explore action. E4 remains the sole owner of `policy.next_action`, `edit_ready`, and edit targeting. Even when every E6 gate passes, `production_cutover` remains `false`; the only positive result is `eligible_for_controlled_trial`, which still requires an explicit trial/cutover decision outside this evaluator.

## Inputs

E6 evaluates four independent evidence surfaces:

1. **E5 scientific readiness** — the challenger must be `evaluable_shadow`, must have an explicit positive `net_voi`, must produce a shadow recommendation, and must still report `promotion_eligible: false` / no replacement authority.
2. **Retrieval calibration** — the rank-support calibration must actually be marked `calibrated` and must contain at least 50 independent benchmark cases, including its own declared minimum.
3. **Frozen paired benchmark evidence** — E4 control and E5 challenger are scored on the same curated cases. The evidence artifact must use criteria version 1, fixed-sample analysis mode, the planned case count, unique case ids, and a frozen snapshot.
4. **Frozen operational shadow evidence** — a versioned snapshot of real E5 shadow evaluations must show stable operation across distinct questions. Worktree-local live events are emitted as diagnostics only and cannot satisfy promotion eligibility. These observations are not treated as accuracy labels.

The versioned criteria live in `scripts/lib/state/explore-promotion-criteria.v1.json`. Current evidence lives in `scripts/lib/state/explore-promotion-evidence.v1.json`.

## Fixed-sample design

Criteria v1 fixes the inferential look at exactly **50 evaluated independent benchmark cases** before sufficient paired promotion evidence exists. The evidence artifact must declare:

- `analysisMode: "fixed_sample"`
- `plannedEvaluatedCaseCount: 50`
- `evaluatedCaseCount: 50`
- `frozen: true`
- `criteriaVersion: 1`

The fixed look matters. Re-running the same alpha-0.05 test after 50, 51, 52, ... cases until it passes would be optional stopping and would not preserve the nominal fixed-sample Type-I error interpretation. If a later study needs a different sample size or sequential design, it must use a new criteria/evidence version with its analysis rule specified before that evidence is examined.

## Primary paired quality endpoint

ExploreBench relevance labels are ordinal (`0..3`), not a demonstrated interval scale. E6 therefore does not treat a one-point and two-point relevance difference as quantitatively commensurate utility.

For each paired benchmark case `i`, define only the direction of the challenger-control relevance difference:

- challenger relevance > control relevance: challenger win
- challenger relevance < control relevance: control win
- equal relevance: tie

Ties are excluded from the inferential denominator. Let `W` be challenger wins, `L` control wins, and `n = W + L` discordant cases. Under the fixed null used by the paired sign test,

`X ~ Binomial(n, 0.5)`

and the one-sided p-value is

`P(X >= W)`.

Criteria v1 requires all of the following:

- 50 independent benchmark cases in the evidence set;
- exactly 50 evaluated cases at the fixed analysis look;
- at least 10 relevance-discordant pairs;
- `W > L`;
- exact one-sided sign-test `p <= 0.05`.

This is evidence of directional improvement on the curated ordinal relevance endpoint. It is not a causal estimate of engineering-task success, and it does not establish a magnitude of real-world benefit.

## Required-node safety endpoint

Required-node coverage is not converted into the relevance test or a scalar utility. It is a non-compensatory safety endpoint.

A **required-node regression** occurs when E4's selected control file is labeled `required: true` for a benchmark case and E5's selected candidate is not. Criteria v1 permits **zero** such regressions in the frozen paired evidence set.

A challenger cannot offset a required-node regression with better average relevance elsewhere.

## Frozen operational shadow gate

Promotion eligibility consumes a versioned `shadowEvidence` snapshot from `explore-promotion-evidence.v1.json`, not the mutable worktree evidence log. The snapshot must use schema/criteria version 1, status `frozen_shadow_history`, `frozen: true`, unique non-empty event ids/questions, E5 VOI version 1, the expected method identifier, and an explicit boolean `promotion_eligible` field on every observation. Criteria v1 then requires:

- at least 50 frozen shadow observations;
- at least 20 distinct non-empty questions;
- zero evaluator-error statuses;
- zero observations in which E5 claims its own promotion authority.

The current worktree's live `explore.voi.shadow` events are still summarized as `local_shadow` diagnostics after de-duplication by event id, but they cannot satisfy any promotion threshold. This makes a given criteria/evidence commit deterministic with respect to promotion eligibility instead of allowing different worktrees to reach different gate decisions.

Agreement/disagreement counts and rates are descriptive only. Because E5 is not executed as the action policy, the shadow log contains no counterfactual outcome for the action E5 would have taken. E6 therefore does not call agreement accuracy, does not estimate online treatment effect from it, and does not use disagreement rate as a promotion-quality endpoint.

## Why there is no invented non-inferiority margin

A non-inferiority margin is a domain/value judgment about how much degradation is acceptable. The current ordinal relevance labels and E5 utility artifacts do not supply a defensible negative relevance margin. Criteria v1 therefore does not tune a tolerated degradation after looking at the outcomes; it requires positive directional evidence on the primary endpoint and a zero-regression safety rule.

This follows the general statistical design principle that a non-inferiority margin should be justified and specified before the confirmatory comparison, rather than selected from the observed result.

## Current repository state

The committed E6 evidence is intentionally blocked:

- retrieval calibration status: `provisional`;
- independent calibration cases: 10, below the 50-case threshold;
- paired E4-vs-E5 promotion benchmark: 0 evaluated cases;
- fixed-sample evidence: not frozen;
- committed Explore runtime utility-rate profile: absent, so E5 is not `evaluable_shadow` under current artifacts;
- frozen E5 operational shadow snapshot: 0 observations and not frozen;
- worktree-local shadow history remains diagnostic only and cannot change promotion eligibility.

E6 should therefore report blockers rather than manufacture readiness.

## Fail-closed properties

Promotion is blocked when any of these conditions occurs:

- criteria fields are missing, coercible strings/nulls, or otherwise malformed;
- evidence schema/criteria version, analysis mode, planned sample, declared row count, unique ids, or frozen state is inconsistent;
- E5 is not scientifically evaluable or claims replacement authority itself;
- calibration is provisional or below its minimum;
- the frozen benchmark misses its planned sample, has too few discordant cases, or fails the exact directional test;
- any required-node regression exceeds the configured zero-tolerance limit;
- the frozen shadow snapshot is malformed, non-ready, unfrozen, insufficiently diverse, or shows evaluator/authority failures;
- transient worktree-local shadow events disagree with the frozen snapshot — they remain diagnostic and do not repair a blocked gate;
- the gate evaluator itself throws — runtime catches this and emits a blocked `gate_evaluator_error` packet.

## Limitations

- Benchmark cases are curated, not a probability sample of all future engineering questions. The exact p-value is conditional on the paired sign-test assumptions for that frozen corpus; external generalization remains a product/research judgment.
- `independentCaseCount` and benchmark provenance are auditable artifact claims plus unique case ids; software validation cannot prove substantive statistical independence of human-curated cases.
- The sign test deliberately ignores relevance magnitude and ties. This protects ordinal-scale validity but can reduce power.
- The required-node safety rule is a product safety constraint, not a separately calibrated statistical estimate.
- Frozen shadow history can establish evaluator stability and coverage only. Worktree-local live history is intentionally non-authoritative. A true online causal policy comparison would require an executed randomized/controlled policy trial with prospectively defined outcomes and assignment logging.

## Method references

- NIST Dataplot Sign Test: paired signs follow a binomial distribution with `p = 0.5` under the sign-test null: https://www.itl.nist.gov/div898/software/dataplot/refman1/auxillar/signtest.htm
- FDA Non-Inferiority Clinical Trials guidance: non-inferiority margins should be justified and specified as part of the study design rather than inferred from observed results: https://www.fda.gov/regulatory-information/search-fda-guidance-documents/non-inferiority-clinical-trials

## Frozen challenger configuration and study binding

A global promotion decision must not depend on the question that happened to invoke `explore`. E6 therefore does not use the current query-local E5 packet as confirmatory readiness evidence. The promotion artifact contains a versioned `challengerConfiguration` that must be `frozen_challenger_configuration`, `frozen: true`, E5 VOI version 1, the expected `myopic-empirical-voi-proxy` method, and `promotionAuthority: "e6_gate_only"`.

That frozen configuration must provide an explicit named utility profile with finite non-negative token, latency, and action-risk exchange rates. At least one rate must be positive; an all-zero scale is treated as degenerate rather than as a scientific claim that every resource is free. The configuration is also bound to the observed read-cost artifact schema, which must contain a positive successful-read sample count and finite positive token/latency medians.

The paired benchmark artifact and frozen operational-shadow artifact both carry the same `challengerConfigurationId`. Every non-empty paired benchmark row carries `challengerConfigurationId`, and every frozen shadow observation carries `details.challenger_configuration_id`. Any row/event mismatch makes that evidence artifact invalid. This prevents a promotion analysis from combining observations generated under different utility profiles or E5 challenger policies.

The current query's E5 packet is still exposed as `local_challenger` diagnostics. It can be `not_applicable`, provisional, or otherwise different without changing a global E6 decision that is backed by frozen evidence.

## What action the paired study scores

The confirmatory paired benchmark scores the **actual E5 shadow policy action**, not the merely interesting `research_candidate`:

- only E5 decisions with `status: "evaluable_shadow"` enter the confirmatory paired sample;
- when E5 has a positive `shadow_recommendation`, that recommendation is the challenger action;
- when an otherwise evaluable E5 decision abstains (`shadow_recommendation: null`), the challenger policy falls back to the E4 control action, producing a policy tie for that case;
- provisional/non-evaluable E5 decisions are excluded rather than relabeled as successes or failures.

This matters because scoring `research_candidate` directly would evaluate a policy E5 never proposed to execute and would bias the promotion comparison against E5's own abstention rule.

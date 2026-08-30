# Explore E5 Value-of-Information Challenger

E5 is a **shadow-only** research challenger beside the E4 unified Explore policy. E4 remains the sole authority for `readiness`, `next_action`, `edit_ready`, and `edit_target`. E5 cannot promote itself; E6 owns any later promotion decision.

## Estimand

E5 asks a one-step research question: for the strongest dependency hypothesis, what is the expected **benchmark-relevance-weighted dependency-coverage gain** from one additional read, and what observed resource cost would that read consume?

For hypotheses with dependencies, `U(s) = (I_root_read + dependency_read_fraction) / 2`; with no dependencies, `U(s) = I_root_read`. Therefore `0 <= U(s) <= 1`.

For candidate read `a` in empirical retrieval-rank bin `b`, E5 computes `G(a) = r_hat_b * [U(s_a) - U(s)]`. `r_hat_b` comes from the versioned Jeffreys-smoothed ExploreBench artifact. It is observational benchmark support, **not** a Bayesian posterior, a causal effect of reading, or a probability that the engineering task succeeds. Candidates without empirical rank support are not scored.

This proxy is intentionally incomplete: an irrelevant read can still eliminate a hypothesis, while benchmark relevance does not guarantee usefulness on a new task. `G(a)` is a research score, not total information gain.

## Acquisition cost and net VOI

`explore-read-cost-model.v1.json` records observed successful `fs.read` costs from the local trace corpus: 1,133 total traces, 970 successful reads used for summaries, median duration 537 ms (p90 1,151 ms), and median total tokens 2,031 (p90 10,088). These are resource-cost observations only, not probabilities that a read is useful.

Tokens, milliseconds, risk, and coverage utility do not share a natural unit. E5 therefore computes `net_voi = G - lambda_token*tokens - lambda_ms*latency - lambda_risk*risk` **only** when explicit non-negative exchange rates are supplied. The committed runtime supplies no lambda profile, so normal `net_voi` is null. Break-even `G/tokens` and `G/latency` values are sensitivity diagnostics, not recommended rates.

## Abstention and promotion

- `not_applicable`: E4 is not asking for a read.
- `insufficient_data`: no candidate has empirical support and positive coverage gain.
- `provisional_evidence`: a candidate can be scored but calibration is provisional.
- `insufficient_calibration_cases`: an artifact says calibrated but fails its own declared case minimum.
- `insufficient_utility_scale`: calibrated evidence exists but no explicit utility-rate profile exists.
- `evaluable_shadow`: calibrated evidence plus explicit rates permit a net shadow score.
- `error`: shadow evaluation failed; E4 remains authoritative.

`promotion_eligible` is always false in E5. `recommended_replacement` remains null. E5 can emit only `shadow_recommendation`; E6 owns any promotion.

## Runtime and evaluation boundary

E4 computes the production control first. E5 receives a read-only view, computes/logs its shadow packet, and fails open on challenger or logging errors. Compact output exposes only the minimum shadow summary. `evaluateVoiShadowBenchmark` compares control and challenger paths only against curated ExploreBench relevance/required-node labels; it does not estimate counterfactual task success or causal policy improvement.

E5 follows the decision-theoretic principle that observations should be acquired when expected value justifies cost, including approximate/myopic VOI work by Heckerman, Horvitz, and Middleton (1993), *An Approximate Nonmyopic Computation for Value of Information*, and Poh and Horvitz (1993), *Reasoning about the Value of Decision-Model Refinement*. It does **not** claim exact nonmyopic optimization, a solved POMDP, adaptive-submodular guarantees, calibrated Bayesian beliefs, causal treatment effects, or an optimal information-gathering policy.

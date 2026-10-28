# Dialer predictive model boundary

`@consuelo/dialer` owns provider-neutral dialing decisions. CRM/provider adapters contribute normalized observations and perform provider-specific side effects; they do not own predictive policy.

## Scientific scope

The current predictive model is an uncertainty-aware contextual ranking heuristic over observational Bernoulli response data. It is not a causal model, a calibrated lifetime-value model, or a formally derived Whittle index.

The legacy `WhittleIndexService` remains only on compatibility surfaces outside the standalone dialer-server predictive runtime. Its historical score combines expected reward, cost, urgency, and an ad-hoc exploration term; it should not be cited as a Whittle index because no restless-bandit state transition model, subsidy problem, or indexability proof was specified. D3 removes it from the standalone runtime decision path entirely.

D2 established the provider-neutral predictive path with explicit statistical evidence:

- Bernoulli sufficient statistics: successes and uncensored trials;
- 95% Wilson score intervals for finite-sample uncertainty;
- optimistic expected net value for candidate priority;
- conservative economic stopping based on the interval upper bound;
- lower-bound evidence for learned timing-window comparisons.

These intervals are descriptive frequentist intervals for the aggregated observational samples. Because future runtime selection is adaptive, the implementation does not claim sequential confidence coverage or causal treatment effects.

## Decision layers

The model separates four questions:

1. **Which contact next?** `PredictiveSelectionModel` applies stopping evidence and ranks remaining candidates by uncertainty-aware optimistic expected net value. FIFO position breaks equal-score ties.
2. **Whether to retry?** `RetryDecisionModel` uses attempt-specific response evidence plus workspace economics. Missing historical evidence is not treated as zero response probability. After attempt two, a retry is suppressed only when the 95% Wilson upper response bound is economically unprofitable.
3. **When to retry?** Learned local hour/day windows are compared with conservative lower-bound evidence once enough uncensored observations exist. The core does not encode transport-specific scheduling delays.
4. **How often?** `CadenceOptimizerService` owns attempt spacing, fresh/aged policy, learned cadence, and double-dial policy. When count evidence is available, cadence aggregates integer successes/trials rather than averaging already-rounded rates. Static age-bucket and double-dial defaults remain policy fallbacks, not learned scientific results.

## Canonical observation contract

D2 introduces append-only `dialer_learning_observations` as the scientific source of truth for future predictive learning. Each row records:

- workspace, segment, contact, group, and stable leg position;
- attempted timestamp plus response/observation-end timestamps when known;
- local hour and local day captured at observation time using the configured IANA timezone;
- outcome class: `response`, `non_response`, or `censored`;
- explicit censor reason when the response outcome was not observed.

The primary key `(workspace_id, group_id, position)` makes repeated telemetry idempotent.

### Competing-risk censoring

Parallel dialing creates a competing-risk problem: when another leg wins and this leg is terminated, the terminated leg did not demonstrate a non-response. Counting that leg as a failure biases response-rate estimates downward, particularly for later or staggered legs.

Therefore:

- an actually answered human-like leg is a response even if it loses the atomic winner claim;
- explicit machine, no-answer, busy, and failed outcomes are observed non-responses;
- winner-take-all termination without response evidence is censored;
- ambiguous manual/terminal cancellation is censored.

Censored rows still consume chronological attempt order because the call was attempted, but they are excluded from Bernoulli success-rate denominators.

## Attempt ordering and local time

Canonical event order is derived with:

`ROW_NUMBER() OVER (PARTITION BY workspace_id, contact_id ORDER BY attempted_at, group_id, position)`

The ordinal is computed before censored rows are excluded from Bernoulli aggregation. Callback arrival order therefore cannot change event order.

D3 also preserves the lifetime attempt ordinal for contacts that already had attempts before canonical D2 observations began. For each contact, the model computes an attempt offset as `max(attempts_total - canonical_attempt_count, 0)` from the idempotent attempt ledger, then adds the chronological canonical row number. This uses only attempt counts, not legacy response labels: if a contact has four completed lifetime attempts and two canonical observations, those canonical events are modeled as attempts 3 and 4. This relies on D2's atomic canonical-observation gate: successful post-D2 telemetry increments the attempt ledger and writes the canonical row together, so their count difference remains the pre-canonical baseline rather than drifting with successful new observations.

Historical local hour/day are persisted when the observation is written. Aggregation does not recompute old events from the workspace's current timezone setting, which avoids retroactively moving observations across bins after a configuration change and preserves DST-local bins.

## Statistical estimators

For `x` responses in `n` uncensored trials, the point estimate is `p = x / n`. D2 computes the two-sided 95% Wilson score interval using `z = 1.959963984540054`.

The interval is used asymmetrically according to decision risk:

- **priority/exploration:** use the upper bound, so plausible upside is explored without an arbitrary `1/sqrt(n)` bonus;
- **stopping:** use the upper bound, so uncertain attempts are not stopped merely because a noisy point estimate falls below break-even;
- **timing-window comparison:** use the lower bound, so a tiny lucky bin does not outrank a well-supported bin solely on raw rate.

No arbitrary 48-hour multiplicative probability penalty is applied by the predictive selector. Recency/spacing remains an eligibility or cadence concern, where its operational meaning can be stated and tested explicitly.

## Economics

Workspace economics are explicit model inputs:

- `valuePerConnection = avgDealValue * avgCloseRate`;
- `costPerAttempt` is the marginal attempt cost.

The Postgres store fails if configured economic values are missing or invalid rather than inventing model economics. D3 handles that infrastructure/configuration failure outside the statistical store by preserving the original FIFO candidate order and emitting `dialer.predictive.fifo_fallback`. Missing canonical response observations with otherwise valid economics are different: the model remains deterministic and FIFO without treating absence of evidence as an error or a zero-probability failure.

## Historical retry intent

The April 11, 2026 stopping/timing integration explicitly separated stopping as **whether** to retry and timing as **when** to retry. A later review rewrite removed the concrete timing schedule while retaining a timing-model field. The current core preserves that durable separation without reviving old hard-coded five-minute or 30-second delays.

## D3 runtime boundary

D3 cuts the standalone dialer-server predictive-selection runtime to `PredictiveSelectionModel` backed by the canonical Postgres store. The runtime adapter reads `contact_attempt_ledger` only for per-contact attempt count and last-attempt state, while all response-rate, timing, uncertainty, stopping, and economic model evidence comes from `dialer_learning_observations` and `dialer_workspace_settings`.

Standalone queue identity is the model segment identity. The Railway runtime passes the resolved queue ID as `segmentId`, matching canonical telemetry's `campaignSegment || queueId` fallback semantics. This keeps training and selection scoped to the same population without importing provider entities into the core model.

`consuelo_lead_connector_call_outcomes` remains a temporary compatibility mirror for legacy consumers and migration safety, but it is not a standalone predictive decision input. The isolated D3 service proof deliberately gives that compatibility table the opposite preference from canonical observations and verifies that runtime ranking follows canonical evidence.

Canonical stopping is applied before fanout. If every queue candidate is economically suppressed, normal call-start capacity handling returns `NO_CALLABLE_TARGETS` before mock or provider initiation. If canonical persistence or configured economics are unavailable, runtime fails open to the original FIFO candidate order and emits the explicit fallback event rather than silently substituting a different statistical model.

D3 does not add a retry scheduler. `RetryDecisionModel` continues to define provider-neutral whether/when evidence, but the standalone runtime does not yet own an explicit scheduling surface for `preferredWindow`; adding one would be a separate product/runtime change rather than part of the model-source cutover.

There is intentionally no backfill from `consuelo_lead_connector_call_outcomes` into canonical observations. Legacy rows do not contain enough information to distinguish true non-response from winner-race censoring, so backfilling them would manufacture biased training labels.

## D4 contextual predictive science boundary

D4 does not replace the D3 production policy. D3 remains the authoritative runtime selector and continues to use the same workspace-local timing bins, Wilson evidence, stopping rule, optimistic priority score, and FIFO fallback behavior. D4 adds immutable research evidence and shadow-only challenger models around that control.

### Observation V2: immutable decision-time context

The D4 migration adds `feature_schema_version`, `decision_id`, and `decision_context` to canonical observations plus a separate `dialer_predictive_decisions` table. Feature schema version 2 records facts that were available when the ranking decision was made instead of joining later against mutable CRM state.

The provider-neutral source snapshot may contain:

- opportunity, pipeline, and stage identifiers;
- opportunity status and monetary value;
- a contact IANA timezone only when a provider or another trustworthy source supplies one.

The decision snapshot adds:

- lifetime attempts used plus attempts today and this week;
- minutes since the previous attempt, with missingness preserved explicitly;
- local hour/day plus timezone provenance;
- local-presence intent;
- the D3 next-attempt number, point probability, uncertainty upper bound, score, hazard source, and stopping state.

After a selected target becomes a parallel leg, canonical telemetry augments the immutable decision snapshot with realized dial profile, fanout, stagger, and parallel position. Contact name, email, phone number, raw tags, free text, and LLM-derived lead-quality labels are intentionally excluded from the D4 feature snapshot.

LeadConnector queue facts are captured from the server-authorized provider preview, not from browser-supplied metadata. The currently normalized LeadConnector contract does not expose a trustworthy contact timezone. Consequently current production observations normally record `timezoneSource = workspace_fallback`; D4 does not infer timezone from phone area code.

Critically, D4 contact-local context does **not** overwrite D3's canonical `local_hour` and `local_day_of_week` columns. Those columns continue to use the configured workspace timezone because D3 still queries them using workspace-local time. A future production model that owns contact-local timing must perform an explicit model cutover rather than silently changing the meaning of D3 training bins.

### Decision logging and policy support

`dialer_predictive_decisions` separates the ranking decision from the action that was actually initiated after caller-ID capacity and fanout are resolved. Each decision records:

- policy, model, and feature-schema versions;
- the eligible candidate set and immutable D4 contexts;
- D3 ranked and suppressed evidence;
- the selected contact IDs only after mock/provider legs are successfully created; partial provider creation records only contacts with created legs;
- policy mode and optional selection probabilities.

The D3 policy is deterministic, so D4 records `policy_mode = deterministic` and `selection_probabilities = NULL`. A database constraint enforces that invariant. D4 deliberately does not manufacture 1/0 values and call them propensities. Therefore these logs do not by themselves justify inverse-propensity, doubly robust, or other off-policy evaluation claims. A future exploratory policy must log genuine stochastic action probabilities with adequate support/overlap before those estimators are valid.

Decision-log persistence is auxiliary to D3 selection. If the D4 decision log is unavailable, the runtime emits an explicit diagnostic and preserves the D3 ranking. A canonical D3 model-store failure remains a separate condition and still fails open to FIFO through `dialer.predictive.fifo_fallback`.

D4 context construction is also auxiliary. If a successfully ranked D3 candidate lacks D4 evidence because of an internal alignment defect, the runtime preserves the D3 result and omits D4 context for that candidate rather than converting the decision to FIFO. FIFO remains reserved for actual D3 model/store failure.

Browser-supplied `targetContexts` are never authoritative scientific input. The public route strips them unless the server reconstructs context from an authorized provider preview. Direct-call authorization also removes client context. This prevents clients from spoofing timezone, opportunity value, or other research features.

### Contextual response challenger

`ContextualResponseModel` is a shadow-only L2-regularized logistic response model. For observations `(x_i, y_i)` it minimizes the explicitly implemented objective

`mean_i[-y_i log p_i - (1-y_i) log(1-p_i)] + (lambda / 2) * ||w_non_intercept||^2`

with `p_i = sigmoid(w^T x_i)`. The intercept is not regularized. The L2 term is applied outside the sample-size normalization, so a fixed `lambda` has the same mathematical meaning when the same empirical distribution is replicated to a larger sample. The feature dimension is derived from the encoder at fit time and mismatched dimensions fail closed.

The first feature basis is deliberately small and reproducible:

- cyclic local hour and day-of-week terms;
- lifetime, daily, and weekly attempt counts;
- minutes since the prior attempt plus an explicit missingness indicator;
- candidate opportunity value plus an explicit missingness indicator;
- sourced-contact-timezone vs workspace-fallback provenance;
- local-presence intent;
- a coarse open-opportunity status indicator.

The model does not currently one-hot encode pipeline IDs, stage IDs, arbitrary tags, names, or text. Those values are either high-cardinality, mutable, or insufficiently specified for a stable first challenger. Pipeline and stage identity remain in the immutable snapshot so a later hierarchical/partially pooled model can use them once data volume and validation justify the additional degrees of freedom.

This challenger is an observational prediction model. Its coefficients are not treatment effects, and a high predicted response probability does not imply that placing a call caused the response probability to increase relative to another action.

The Bernoulli challenger is fit only on canonical rows whose response outcome was actually observed. If censoring remains informative after conditioning on the recorded context, this complete-case response model can still be selection-biased. D4 does not claim independent censoring, inverse-probability-of-censoring correction, or causal identification.

`attemptsToday` and `attemptsThisWeek` currently inherit the ledger's database/session calendar-window semantics. They are useful predictive covariates but should not be described as contact-local calendar counts until the ledger itself owns an explicit local-timezone definition.

### Discrete-time fixed-horizon response challenger

D4 also defines `DiscreteTimeResponseHazardModel`. The historical class name contains "Hazard", but the hardened D4 estimand is more precisely a fixed-horizon attempt-response incidence model on a discrete logistic time grid. The target is whether a human response is observed in the half-open interval `[0, horizon)`, conditional on the recorded context and the stated censoring convention.

It converts each canonical response-time observation into discrete period rows:

- intervals fully observed before a response contribute observed no-event rows;
- the interval containing an observed response contributes the event row;
- a terminal provider `non_response` is definitive evidence that the attempt cannot later produce a response, so it contributes no-event rows through the fixed horizon;
- intervals fully observed before genuine right-censoring contribute no-event rows;
- a partially observed censor interval contributes no synthetic failure label;
- an observation that remains event-free through the configured horizon contributes all horizon intervals as no-event rows.

The grid requires `horizonMs` to be an integer multiple of `intervalMs`; unsupported intervals are not assigned the accidental `sigmoid(0)=0.5` default and instead contribute zero predicted interval probability. The model uses a separate unpenalized indicator for each supported interval plus shared L2-regularized contextual effects. As with the Bernoulli challenger, the contextual L2 penalty is applied to the mean-loss objective without an additional `1/n` shrinkage. The response-by-horizon prediction is `1 - product(1 - h_j)` over the fitted interval probabilities.

The fixed-horizon shadow evaluator trains on earlier observations, including correctly right-censored records. A terminal `non_response` is always an observed fixed-horizon `Y=0`, even when it ends before the horizon. A genuine leg censored before the horizon is counted explicitly and excluded from Brier/log-loss scoring rather than treated as a non-response. A response at exactly the horizon is outside the half-open `[0, horizon)` event window and therefore scores `Y=0`. D4 does not compare this fixed-horizon probability directly with D3's response estimate because they are different estimands.

That fixed-horizon holdout score is descriptive complete-case evaluation over outcomes known by the horizon. Winner-induced or ambiguous early censoring can still be informative conditional on the recorded context, so excluding those rows can bias the reported score. D4 does not claim IPCW-adjusted survival evaluation, a competing-risks cumulative-incidence estimator, independent censoring, or causal identification. Those require separately specified assumptions and validation.

### Shadow evaluation and calibration

The contextual response evaluator uses chronological holdout rather than random train/test mixing. It reports:

- Brier score and log loss as proper probabilistic scores;
- empirical calibration bins;
- D3-vs-D4 score improvement on holdout rows where D3 actually had a probability estimate;
- population stability index over challenger prediction distributions as a drift diagnostic;
- explicit insufficient-data status below the configured minimum sample size.

The report also exposes unique contacts in training/holdout and their overlap. A chronological split can contain repeated contacts on both sides, so it measures next-attempt/out-of-time prediction under the observed stream; it is not automatically a new-contact generalization experiment. A contact-blocked split or purge gap is a future evaluation design, not something D4 silently claims today.

`minSampleSize` and the training fraction are explicit research policy settings, not confidence guarantees. The report labels the minimum-sample rule as heuristic. Calibration reports how many fixed bins are empty rather than hiding sparse cells.

D3 `hazardSource = missing` is not scored as a zero-probability control forecast. D3 intentionally treats missing evidence as absence of an estimate, so evaluating its internal zero placeholder as a substantive forecast would bias the comparison against the control.

Population stability index is a monitoring heuristic, not a statistical test or a guarantee of stationarity. Empty PSI cells receive a small normalized pseudocount only for numerical stability. Calibration bins are descriptive. D4 does not claim that a single chronological split proves future generalization across campaign, season, caller-reputation, or workspace shifts.

Malformed feature snapshots and observations are quarantined per row and reported. Rows whose non-null `decision_id` cannot be linked to a persisted decision are also excluded and counted. New writes are constrained so non-null decision-context JSON is an object whose embedded `schemaVersion` matches the positive `feature_schema_version` column. Existing historical rows are not backfilled or rewritten by this hardening migration.

### Candidate-specific economics

D4 keeps response prediction separate from candidate economics. Where an immutable opportunity value and valid workspace close-rate/cost settings exist, the research layer computes:

`valuePerConnection(candidate) = opportunityValue * workspaceCloseRate`

`expectedNetValue(candidate) = predictedResponseProbability * valuePerConnection(candidate) - costPerAttempt`

The shadow report also includes a value-weighted Brier diagnostic, mean predicted net value, and `observedNetValueProxy`. The proxy uses the observed response indicator multiplied by expected value per connection; it is not realized booked revenue. If every candidate has zero economic weight, the value-weighted Brier is `NULL` rather than manufacturing a denominator. These diagnostics are explicitly labeled `descriptive_not_causal`. They do not estimate incremental revenue caused by calling, and they are not an uplift model or a counterfactual policy-value estimate.

### Promotion rule

D4 has no automatic production promotion path. The D3 runtime remains the control until a later task defines and passes an explicit promotion gate. At minimum, a production challenger should demonstrate out-of-time improvement in proper probabilistic scores, acceptable calibration, stable behavior across important subgroups and drift regimes, and service-backed shadow evidence without changing D3 call outcomes during evaluation.

If future work introduces deliberate exploration or a contextual-bandit policy, that policy must first define its action space, support assumptions, and stochastic logging probabilities. Only then should off-policy estimators or anytime-valid policy-upgrade confidence procedures be added. The current fixed-sample Wilson intervals remain descriptive finite-sample evidence and are not promoted into sequential confidence claims.

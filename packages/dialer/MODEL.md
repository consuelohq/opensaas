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

The retained response and observation-end timestamps allow a future model to evaluate time-to-response or survival/hazard estimators without discarding the raw evidence now. Such a future change should define its censoring assumptions and validation separately rather than treating the current Bernoulli model as a survival model.

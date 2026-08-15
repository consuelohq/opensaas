# Dialer predictive model boundary

`@consuelo/dialer` owns provider-neutral dialing decisions. CRM/provider adapters contribute normalized observations and perform provider-specific side effects; they do not own predictive policy.

## Decision layers

The mature model separates four questions:

1. **Which contact next?** `PredictiveSelectionModel` applies stopping evidence and then ranks remaining candidates with the existing Whittle index.
2. **Whether to retry?** `RetryDecisionModel` uses observed answer probability plus workspace economics. Missing historical evidence is not treated as a zero-percent answer rate.
3. **When to retry?** `RetryDecisionModel` exposes the preferred learned hazard window only after the timing model has at least 50 observations. It does not encode transport- or CRM-specific scheduling delays.
4. **How often?** `CadenceOptimizerService` owns attempt spacing, fresh/aged behavior, learned cadence, and double-dial policy. Eligibility/cadence constraints are applied before predictive candidate ranking.

## Provider-neutral learning contract

The predictive store is scoped by `workspaceId` and `segmentId` and supplies:

- answer probabilities by attempt number;
- hazard estimates by attempt number, local hour, and local day;
- sample size for exploration/confidence;
- workspace value-per-connection and cost-per-attempt economics.

Candidate context supplies attempt count, last-attempt time, local timezone, callable-window end, and stable contact identity. Provider-specific IDs, GoHighLevel/LeadConnector types, and Twenty entities are not part of this model contract.

The selection model preserves the mature behavior reconstructed from the April 2026 implementation: exact local hazard slots are preferred, the best same-attempt estimate is the fallback, attempts older than 48 hours receive the existing 0.8 stale factor, low-sample segments receive the existing Whittle exploration bonus, and FIFO position breaks equal-index ties.

## Historical retry intent

The April 11, 2026 stopping/timing integration explicitly defined stopping as **whether** to retry and the timing model as **when** to retry. A later review rewrite removed the concrete timing schedule while retaining a timing-model field. D1 preserves the durable separation without reviving the old hard-coded five-minute or 30-second delay policies: the core returns a learned preferred window, while cadence/runtime composition decides the actual legal and operational schedule.

## Migration boundary

D1 defines and tests these core contracts only. It does not change `dialer-server` runtime composition or persistence. D2 owns the provider-neutral Postgres learning adapter. D3 cuts runtime ranking/retry behavior over to these contracts and proves parity before the remaining Twenty implementation can be deleted.
